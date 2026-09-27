import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiError } from './api-error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, code, message } = this.toApiError(exception);
    res.status(status).json({ error: { code, message } });
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof ApiError) return exception;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 400 || status === 413 || status === 415) {
        return ApiError.validation('Request body must be valid JSON.');
      }
      if (status === 404) return new ApiError(404, 'NOT_FOUND', 'Route not found.');
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }
}
