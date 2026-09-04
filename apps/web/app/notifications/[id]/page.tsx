'use client';
import dynamic from 'next/dynamic';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { NavigationDock } from '../../../components/navigation/NavigationDock';
import { Button } from '../../../components/ui/button';
import { useAuthStore } from '../../../lib/store';
import { platformApi } from '../../../lib/api';
const TelegramBotConfig=dynamic(()=>import('../TelegramBotConfig'),{loading:()=> <div className="loading-state min-h-[360px] animate-pulse rounded-2xl p-4"/>});
type BotRow={id:string;name:string;environment:string;isActive:boolean};
export default function NotificationDetailPage(){
 const router=useRouter(); const params=useParams<{id:string}>(); const user=useAuthStore(s=>s.user); const authLoading=useAuthStore(s=>s.loading); const initialized=useAuthStore(s=>s.initialized); const init=useAuthStore(s=>s.init); const [bot,setBot]=useState<BotRow|null>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>{void init()},[init]);
 useEffect(()=>{if(!initialized||!user||!params?.id)return;void(async()=>{try{const response=await platformApi.telegramBots();const rows=response.data?.bots??response.data??[];setBot(Array.isArray(rows)?rows.find((item:BotRow)=>item.id===params.id)??null:null)}finally{setLoading(false)}})()},[initialized,user,params?.id]);
 if(authLoading||!initialized||!user)return <main className="app-shell"><div className="app-container app-content"><div className="loading-state flex items-center gap-2 p-4"><Bell className="size-4"/>Checking secure session…</div></div></main>;
 return <main className="app-shell"><div className="app-container app-content"><div className="mb-3 flex items-center gap-2"><Button type="button" variant="outline" size="icon" onClick={()=>router.push('/notifications')} aria-label="Back to notifications"><ArrowLeft className="size-4"/></Button><div className="min-w-0"><p className="eyebrow">Notifications</p><p className="account-email">{bot?.name??'Notification channel'}</p></div></div>{loading?<div className="loading-state flex min-h-[240px] items-center justify-center p-4 text-muted"><Loader2 className="mr-2 size-4 animate-spin"/>Loading channel…</div>:!bot?<section className="empty-state p-5"><p className="eyebrow">Notification channel</p><h1 className="mt-2 text-xl font-semibold">Bot not found</h1><p className="page-subtitle">This Telegram channel may have been removed or is no longer available.</p><Button type="button" variant="outline" className="mt-4" onClick={()=>router.push('/notifications')}>Back to notifications</Button></section>:<><section className="page-heading"><div><p className="eyebrow">Telegram channel</p><h1>{bot.name}</h1><p className="page-subtitle">{bot.environment} · {bot.isActive?'Active':'Inactive'} · credentials and delivery routing</p></div><div className={`hero-status ${bot.isActive?'':'opacity-50'}`}>{bot.isActive?'Active':'Inactive'}</div></section><TelegramBotConfig/></>}</div><NavigationDock items={[{id:'notifications',label:'Notifications',icon:Bell,active:true}]} onSelect={()=>router.push('/notifications')}/></main>;
}
