import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception.filter';
import { createPlatformSessionMiddleware } from './platform-session.middleware';
import { JwtService } from './auth/jwt.service';
import { RuntimeEventsQueryService } from './runtime-events/runtime-events.query.service';
import { attachRuntimeEventsWebSocket } from './runtime-events/runtime-events.websocket';

process.on('uncaughtException', error => {
  console.error('[FATAL] uncaughtException', error);
  process.exitCode = 1;
});

process.on('unhandledRejection', reason => {
  console.error('[FATAL] unhandledRejection', reason);
  process.exitCode = 1;
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(createPlatformSessionMiddleware(new JwtService()));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(Number(process.env.PORT ?? 8210), '0.0.0.0');
  attachRuntimeEventsWebSocket(
    app.getHttpServer(),
    app.get(RuntimeEventsQueryService),
    app.get(JwtService)
  );
}

bootstrap().catch(error => {
  console.error('[FATAL] bootstrap failed', error);
  process.exitCode = 1;
});
