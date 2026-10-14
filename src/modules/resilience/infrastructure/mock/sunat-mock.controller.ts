import { Controller, Post, HttpCode, Header } from '@nestjs/common';
import { SunatMockService } from './sunat-mock.service';

@Controller('sunat-mock')
export class SunatMockController {
  constructor(private readonly sunatMockService: SunatMockService) {}

  /**
   * Emula el endpoint SOAP de SUNAT (billService).
   * Acepta cualquier comprobante (Factura, Boleta, NC, ND) y siempre 
   * devuelve un XML con el CDR en Base64 indicando éxito (Código 0).
   */
  @Post('billService')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml;charset=UTF-8')
  sendBill(): string {
    // Al ser un mock determinista sin lógica de negocio, 
    // simplemente devolvemos la respuesta de éxito.
    return this.sunatMockService.generateSendBillResponse();
  }
}
