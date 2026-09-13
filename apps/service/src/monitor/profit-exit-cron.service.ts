import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { TceExecutionIntent } from '@tce/contracts';
import { SupabaseClientService } from '../db/supabase.client';
import { TceSsiExecutionAdapter } from '../platform/tce-ssi-execution.adapter';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_PROFIT_TARGET_PCT = 10;
const TICK_MS = 60 * 1000;
const ACTIVE_ORDER_STATUSES = ['READY','PENDING','SUBMITTED','PARTIALLY_FILLED','PROCESSING','ACCEPTED','EXECUTING','PROTECTED','OPEN'] as const;

type AutoSellConfig = { account_id:string; auto_sell_enabled:boolean; auto_sell_profit_target_pct:number; auto_sell_interval_minutes:number; auto_sell_last_run_at:string|null; auto_sell_hold_symbols:string[]|null; timezone?:string|null };
type Position = { id:string; account_id:string; symbol:string; quantity:number; avg_cost:number|null; cost_basis:number|null; market_price:number|null; market_value:number|null; status:string };
type RunOptions = { accountId?:string; force?:boolean; dryRun?:boolean; execute?:boolean };
type Candidate = { symbol:string; profitPct:number; targetPrice:number; quantity:number; action:'CREATE'|'SKIP_HOLD'; executionStatus?:string; providerOrderId?:string; error?:string };

export type AutoSellDecision = { action:'CREATE'; targetPrice:number; profitPct:number; costBasis:number; marketValue:number } | { action:'SKIP'; reason:string };

export function evaluateAutoSell(position:Pick<Position,'quantity'|'avg_cost'|'cost_basis'|'market_price'|'market_value'>, targetPct:number):AutoSellDecision {
  const quantity=Number(position.quantity), avgCost=Number(position.avg_cost??0), costBasis=Number(position.cost_basis??avgCost*quantity), marketPrice=Number(position.market_price??0), marketValue=Number(position.market_value??marketPrice*quantity), target=Number(targetPct);
  if(!Number.isFinite(quantity)||quantity<=0)return{action:'SKIP',reason:'invalid_quantity'};
  if(!Number.isFinite(costBasis)||costBasis<=0)return{action:'SKIP',reason:'invalid_cost_basis'};
  if(!Number.isFinite(marketPrice)||marketPrice<=0)return{action:'SKIP',reason:'invalid_market_price'};
  if(!Number.isFinite(marketValue)||marketValue<=0)return{action:'SKIP',reason:'invalid_market_value'};
  if(!Number.isFinite(target)||target<0)return{action:'SKIP',reason:'invalid_target'};
  const profitPct=((marketValue-costBasis)/costBasis)*100;
  if(profitPct<target)return{action:'SKIP',reason:'target_not_reached'};
  return{action:'CREATE',targetPrice:marketPrice,profitPct,costBasis,marketValue};
}
export function normalizeHoldSymbols(symbols:unknown):string[]{if(!Array.isArray(symbols))return[];return[...new Set(symbols.filter((s):s is string=>typeof s==='string').map(s=>s.trim().toUpperCase()).filter(Boolean))].sort();}

@Injectable()
export class ProfitExitCronService implements OnModuleInit,OnModuleDestroy{
  private readonly logger=new Logger(ProfitExitCronService.name); private timer?:NodeJS.Timeout; private running=false;
  constructor(private readonly supabase:SupabaseClientService,private readonly execution:TceSsiExecutionAdapter){}
  onModuleInit(){this.timer=setInterval(()=>void this.run(),TICK_MS);void this.run();this.logger.log('Profit-exit cron started; default is disabled, 60m interval, 10% target');}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  async run(options:RunOptions={}){
    if(this.running)return{skipped:true,reason:'already_running',created:0}; this.running=true;
    let created=0,evaluated=0,held=0,submitted=0;const candidates:Candidate[]=[];
    try{
      let query=this.supabase.db.from('tce_strategy_config').select('account_id,auto_sell_enabled,auto_sell_profit_target_pct,auto_sell_interval_minutes,auto_sell_last_run_at,auto_sell_hold_symbols,timezone');
      query=options.accountId?query.eq('account_id',options.accountId):query.eq('auto_sell_enabled',true);const{data:configs,error}=await query;if(error)throw error;
      if(options.accountId&&!configs?.length)return{skipped:false,reason:'config_not_found',created:0,evaluated:0,held:0,submitted:0,candidates:[]};
      for(const config of(configs??[])as AutoSellConfig[]){const timezone=this.safeTimezone(config.timezone);if(!options.force&&(!this.isMarketSession(timezone)||!this.isDue(config)))continue;const startedAt=new Date().toISOString();
        const{data:positions,error:positionError}=await this.supabase.db.from('tce_positions').select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,status').eq('account_id',config.account_id).neq('status','CLOSED').order('symbol');if(positionError)throw positionError;
        const holds=new Set(normalizeHoldSymbols(config.auto_sell_hold_symbols));let accountCreated=0;
        for(const position of(positions??[])as Position[]){const symbol=position.symbol.trim().toUpperCase();if(holds.has(symbol)){held++;candidates.push({symbol,profitPct:0,targetPrice:0,quantity:Number(position.quantity),action:'SKIP_HOLD'});continue;}evaluated++;
          const decision=evaluateAutoSell(position,config.auto_sell_profit_target_pct??DEFAULT_PROFIT_TARGET_PCT);if(decision.action!=='CREATE')continue;const quantity=Math.trunc(Number(position.quantity));if(quantity<=0)continue;const target=Number(config.auto_sell_profit_target_pct??DEFAULT_PROFIT_TARGET_PCT);const note=`TCE_AUTO_SELL:${position.id}:${target}`;const candidate:Candidate={symbol,profitPct:decision.profitPct,targetPrice:decision.targetPrice,quantity,action:'CREATE'};
          const{data:active,error:activeError}=await this.supabase.db.from('tce_orders').select('id,status').eq('account_id',config.account_id).eq('symbol',symbol).eq('side','SELL').in('status',[...ACTIVE_ORDER_STATUSES]).limit(1);if(activeError)throw activeError;if((active??[]).length){candidate.executionStatus='ALREADY_ACTIVE';candidates.push(candidate);continue;}
          const{data:existing,error:existingError}=await this.supabase.db.from('tce_orders').select('id,status').eq('account_id',config.account_id).eq('note',note).maybeSingle();if(existingError)throw existingError;if(existing){candidate.executionStatus=`ALREADY_${String(existing.status??'EXISTS')}`;candidates.push(candidate);continue;}
          const{data:order,error:insertError}=await this.supabase.db.from('tce_orders').insert({account_id:config.account_id,order_date:new Date().toISOString().slice(0,10),symbol,side:'SELL',price:decision.targetPrice,quantity,gross_value:Math.round(decision.marketValue),fee_tax:0,net_cashflow:Math.round(decision.marketValue),cycle_no:0,status:'READY',note}).select('id').single();if(insertError)throw insertError;created++;accountCreated++;
          if(options.execute&&!options.dryRun){const correlationId=`tce-auto-sell:${position.id}`,idempotencyKey=`tce-auto-sell:${position.id}:${target}`,clientRequestId=`TCE-AUTO-SELL-${position.id}`;const intent:TceExecutionIntent={id:`execution-intent:auto-sell:${position.id}`,orderPlanId:`auto-sell:${position.id}`,correlationId,idempotencyKey,mode:'LIVE',symbol,side:'SELL',quantity,limitPrice:decision.targetPrice,lifecycleState:'EXIT_READY',createdAt:startedAt};const result=await this.execution.submit({operation:'SUBMIT',accountId:config.account_id,environment:'production',mode:'LIVE',authorization:{approvalId:`auto-profit-exit:${position.id}`,approvedAt:startedAt,correlationId,idempotencyKey},intent,clientRequestId});candidate.executionStatus=result.ok?result.status:`REJECTED:${result.error?.code??'UNKNOWN'}`;candidate.providerOrderId=result.providerOrderId;candidate.error=result.error?.message;if(result.ok){submitted++;await this.supabase.db.from('tce_orders').update({status:result.status==='PENDING'?'PENDING':'SUBMITTED',updated_at:new Date().toISOString()}).eq('id',order.id);}else await this.supabase.db.from('tce_orders').update({status:result.status==='UNKNOWN'?'UNKNOWN':'REJECTED',updated_at:new Date().toISOString()}).eq('id',order.id);}
          candidates.push(candidate);
        }
        if(!options.dryRun){await this.supabase.db.from('tce_strategy_config').update({auto_sell_last_run_at:startedAt,updated_at:startedAt}).eq('account_id',config.account_id);await this.audit(config.account_id,startedAt,positions?.length??0,accountCreated);}
      }
      return{skipped:false,created,evaluated,held,submitted,dryRun:options.dryRun===true,candidates};
    }catch(error){this.logger.error('Profit-exit cron failed',error instanceof Error?error.stack:String(error));return{skipped:false,reason:'error',created,evaluated,held,submitted,dryRun:options.dryRun===true,candidates};}finally{this.running=false;}
  }
  private isDue(config:AutoSellConfig){const interval=Math.min(1440,Math.max(1,Number(config.auto_sell_interval_minutes??DEFAULT_INTERVAL_MINUTES)));if(!config.auto_sell_last_run_at)return true;const last=Date.parse(config.auto_sell_last_run_at);return Number.isFinite(last)&&Date.now()-last>=interval*60000;}
  private async audit(accountId:string,startedAt:string,monitored:number,created:number){const{error}=await this.supabase.db.from('tce_monitor_runs').insert({account_id:accountId,run_type:'AUTO_SELL',started_at:startedAt,finished_at:new Date().toISOString(),market_session:true,positions_monitored:monitored,signals_found:created,skipped:false,metadata:{source:'tce-profit-exit-cron',created_sell_orders:created,target_basis:'cost_basis'}});if(error)this.logger.warn(`Unable to audit profit-exit run: ${error.message}`);}
  private safeTimezone(timezone:string|null|undefined){if(!timezone)return DEFAULT_TZ;try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format();return timezone;}catch{return DEFAULT_TZ;}}
  private isMarketSession(timezone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour12:false,weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date());const get=(type:string)=>parts.find(p=>p.type===type)?.value??'';const day=get('weekday');if(day==='Sat'||day==='Sun')return false;const minutes=Number(get('hour'))*60+Number(get('minute'));return(minutes>=540&&minutes<690)||(minutes>=780&&minutes<=885);}
}
