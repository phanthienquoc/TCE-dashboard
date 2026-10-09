import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${key.toString('hex')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    if (typeof stored !== 'string') return false;
    const separator = stored.indexOf(':');
    if (separator <= 0) return false;
    const salt = stored.slice(0, separator);
    const encoded = stored.slice(separator + 1);
    if (!/^[a-f0-9]{128}$/i.test(encoded)) return false;
    const expected = Buffer.from(encoded, 'hex');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
