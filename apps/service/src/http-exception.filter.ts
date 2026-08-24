import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<any>();
    const response = ctx.getResponse<any>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      console.error('[HTTP_5XX]', {
        method: request?.method,
        url: request?.originalUrl || request?.url,
        status,
        name: exception instanceof Error ? exception.name : undefined,
        message: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      response.status(status).json(payload);
      return;
    }

    response.status(status).json({ statusCode: status, message: 'Internal server error' });
  }
}
