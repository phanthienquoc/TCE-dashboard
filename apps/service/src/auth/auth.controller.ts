import { Controller, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('status')
  status() {
    return { configured: false, message: 'Auth implementation pending database configuration' };
  }
}
