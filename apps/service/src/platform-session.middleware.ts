import type { IncomingHttpHeaders } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import type { RequestHandler } from 'express';
import { JwtService } from './auth/jwt.service';

function cookieHeader(headers: IncomingHttpHeaders): string | undefined {
  const value = headers.cookie;
  return Array.isArray(value) ? value.join('; ') : value;
}

/**
 * Bridges the shared MicroFE session cookie into the TCE service's existing
 * internal JWT authorization context. The JWT never leaves the service.
 */
export function createPlatformSessionMiddleware(jwt: JwtService): RequestHandler {
  return async (req, _res, next) => {
    if (
      req.headers.authorization ||
      req.path === '/api/health' ||
      req.path.startsWith('/api/auth')
    ) {
      return next();
    }
    const cookie = cookieHeader(req.headers);
    const authServiceUrl = process.env.AUTH_SERVICE_URL;
    if (!cookie || !authServiceUrl) return next();

    try {
      const response = await fetch(new URL('/auth/me', authServiceUrl), {
        headers: { cookie, 'x-request-id': String(req.headers['x-request-id'] ?? '') },
        signal: AbortSignal.timeout(Number(process.env.AUTH_INTROSPECTION_TIMEOUT_MS ?? 2000)),
      });
      if (response.status === 401)
        return next(new UnauthorizedException('Authentication required'));
      if (!response.ok)
        return next(new UnauthorizedException('Authentication service unavailable'));
      const body = (await response.json()) as { user?: { id?: string; role?: string } };
      if (!body.user?.id) return next(new UnauthorizedException('Invalid authentication context'));
      req.headers.authorization = `Bearer ${jwt.issue(body.user.id, body.user.role ?? 'user')}`;
      return next();
    } catch (error) {
      console.error('[PLATFORM_SESSION_AUTH]', error);
      return next(new UnauthorizedException('Authentication service unavailable'));
    }
  };
}
