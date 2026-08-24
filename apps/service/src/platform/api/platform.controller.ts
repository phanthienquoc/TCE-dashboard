import { Controller, Get, Param, Query } from '@nestjs/common';
import { BinanceClient } from '../binance/binance.client';
import { SsiClient } from '../ssi/ssi.client';

@Controller('platform')
export class PlatformController {
  constructor(private readonly ssi: SsiClient, private readonly binance: BinanceClient) {}

  @Get('ssi/quote/:symbol')
  getSsiQuote(@Param('symbol') symbol: string) { return this.ssi.getQuote(symbol); }

  @Get('ssi/klines/:symbol')
  getSsiKlines(@Param('symbol') symbol: string, @Query('interval') interval = '1d', @Query('limit') limit = '200') {
    return this.ssi.getKlines(symbol, interval, Number(limit));
  }

  @Get('binance/quote/:symbol')
  getBinanceQuote(@Param('symbol') symbol: string) { return this.binance.getQuote(symbol); }

  @Get('binance/klines/:symbol')
  getBinanceKlines(@Param('symbol') symbol: string, @Query('interval') interval = '1h', @Query('limit') limit = '200') {
    return this.binance.getKlines(symbol, interval, Number(limit));
  }
}
