import { Module } from '@nestjs/common';
import { SsiClient } from './ssi.client';

@Module({
  providers: [SsiClient],
  exports: [SsiClient],
})
export class SsiModule {}
