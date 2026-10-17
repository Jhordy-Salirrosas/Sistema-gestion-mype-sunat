import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  message?: unknown;
  invalidParams?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'Ha ocurrido un error inesperado en el servidor.';
    let rawMessage: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = exception.name.replace(/Exception$/, '');
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
        rawMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, unknown>;
        rawMessage = respObj['message'] ?? exceptionResponse;

        if (typeof respObj['detail'] === 'string') {
          detail = respObj['detail'];
        } else if (typeof respObj['message'] === 'string') {
          detail = respObj['message'];
        } else if (Array.isArray(respObj['message'])) {
          detail = 'Se detectaron errores de validación en la solicitud.';
        } else if (Array.isArray(exceptionResponse)) {
          detail = 'Se detectaron errores de validación en la solicitud.';
          rawMessage = exceptionResponse;
        }
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
      this.logger.error(`Error no controlado: ${exception.message}`, exception.stack);
    }

    const slug = title
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();

    const problem: ProblemDetails = {
      type: `https://sync-sunat.pe/errors/${slug}`,
      title,
      status,
      detail,
      instance: request?.url ?? '',
      ...(rawMessage !== undefined ? { message: rawMessage } : {}),
      ...(Array.isArray(rawMessage) ? { invalidParams: rawMessage } : {}),
    };

    response.status(status).json(problem);
  }
}
