import { HttpException } from '@nestjs/common';

/**
 * Excepción HTTP con un mensaje redactado para el cliente.
 *
 * POR QUÉ EXISTE
 *
 * El filtro global oculta el detalle de todo 5xx para no filtrar internos
 * (stack, cuerpos crudos de SUNAT, cadenas de conexión). Con esa política un
 * 503 de infraestructura llegaba al frontend como "Ha ocurrido un error
 * inesperado en el servidor", sin decir qué se debe reintentar.
 *
 * Esta clase es la única vía para devolver un 5xx con un texto útil:
 *
 * - El mensaje es ESTÁTICO y lo escribe el código, nunca se deriva del error
 *   capturado ni de la respuesta de un proveedor.
 * - Solo el filtro global la reconoce; cualquier otra excepción 5xx sigue
 *   devolviendo el detalle genérico.
 *
 * El estado se llama `statusCode` porque `HttpException` ya declara `status`
 * como privado.
 */
export class ClientSafeHttpException extends HttpException {
  constructor(
    readonly statusCode: number,
    readonly clientMessage: string,
    readonly clientTitle = 'Service Unavailable',
  ) {
    super({ message: clientMessage }, statusCode);
    this.name = 'ClientSafeHttpException';
  }
}
