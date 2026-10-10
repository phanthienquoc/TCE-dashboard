import 'reflect-metadata';
import crypto from 'node:crypto';
import express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const allowedOrigins = new Set(
  (process.env.AUTH_ALLOWED_ORIGINS || 'https://app.mrcute.space,https://tce.mrcute.space')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: '32kb' }));
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('CORS origin denied'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'x-request-id', 'x-csrf-token'],
    exposedHeaders: ['x-request-id'],
  });
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('x-request-id', req.header('x-request-id')?.slice(0, 128) || crypto.randomUUID());
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}

void bootstrap().catch(error => {
  console.error('[microfe-auth] bootstrap failed', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
