import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class RecoveryService {
  hash(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }
  verify(candidate: string, storedHash: string) {
    const a = Buffer.from(this.hash(candidate));
    const b = Buffer.from(storedHash);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new UnauthorizedException('Invalid recovery code');
    return true;
  }
}
