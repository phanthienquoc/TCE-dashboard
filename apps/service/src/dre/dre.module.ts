import { Module } from '@nestjs/common';

/**
 * Dividend Rolling Engine composition boundary.
 *
 * P0 intentionally registers no TCE Core or broker implementation. Later
 * phases may wire adapters through the ports in dre.contracts.ts without
 * making TCE Core depend on DRE.
 */
@Module({})
export class DreModule {}
