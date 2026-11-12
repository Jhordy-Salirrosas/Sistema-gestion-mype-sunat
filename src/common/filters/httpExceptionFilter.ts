import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ClientSafeHttpException } from '../exceptions';

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

    try {
      const problem = this.buildProblem(exception, request?.url ?? '');
      response.status(problem.status).json(problem);
    } catch (error) {
      /**
       * Última barrera: si la construcción del problema falla (una excepción
       * con un `getResponse()` defectuoso, un `response` que ya no acepta
       * JSON...), el frontend NO debe recibir la página HTML de error de
       * Express. Se responde con un JSON mínimo y se registra el motivo.
       */
      this.logger.error(
        `No se pudo construir la respuesta de error controlada: ${
          error instanceof Error ? error.name : 'Error desconocido'
        }`,
      );
      if (!response.headersSent) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          type: 'https://sync-sunat.pe/errors/internal-server-error',
          title: 'Internal Server Error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          detail: 'Ha ocurrido un error inesperado en el servidor.',
          instance: request?.url ?? '',
        });
      }
    }
  }

  /**
   * Traduce la excepción al detalle RFC 7807 que ve el frontend.
   *
   * El texto de un 5xx solo se muestra si la excepción es una
   * `ClientSafeHttpException`: el mensaje lo escribe el código y nunca
   * proviene del error capturado ni de un proveedor externo.
   */
  private buildProblem(exception: unknown, instance: string): ProblemDetails {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'Ha ocurrido un error inesperado en el servidor.';
    let rawMessage: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      /**
       * Única excepción autorizada a mostrar su propio texto en un 5xx: el
       * mensaje lo escribe el código y no proviene del error capturado.
       */
      const clientSafe =
        exception instanceof ClientSafeHttpException ? exception : undefined;
      title =
        clientSafe?.clientTitle ?? exception.name.replace(/Exception$/, '');
      const exceptionResponse = exception.getResponse();

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        detail =
          clientSafe?.clientMessage ??
          'Ha ocurrido un error inesperado en el servidor.';
        rawMessage = clientSafe ? clientSafe.clientMessage : undefined;
        this.logger.error(`Error HTTP interno (status=${status}).`);
      } else if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
        rawMessage = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
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
      this.logger.error('Error no controlado.');
    } else {
      this.logger.error('Error no controlado de tipo desconocido.');
    }

    const slug = title.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

    return {
      type: `https://sync-sunat.pe/errors/${slug}`,
      title,
      status,
      detail,
      instance,
      ...(rawMessage !== undefined ? { message: rawMessage } : {}),
      ...(Array.isArray(rawMessage) ? { invalidParams: rawMessage } : {}),
    };
  }
}

