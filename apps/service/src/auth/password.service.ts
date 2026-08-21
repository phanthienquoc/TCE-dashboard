import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${key.toString('hex')}`;
  }
  async verify(password: string, stored: string): Promise<boolean> {
    const [salt, hex] = stored.split(':');
    if (!salt || !hex) return false;
    const key = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(hex, 'hex');
    return expected.length === key.length && timingSafeEqual(expected, key);
  }
}
