import { Controller, Post, Header, Headers, Query, Body, Res } from '@nestjs/common';
import { SunatMockService } from './sunat-mock.service';

@Controller('sunat-mock')
export class SunatMockController {
  constructor(private readonly sunatMockService: SunatMockService) { }

  /**
   * Emula el endpoint SOAP de SUNAT (billService).
   * Soporta 3 modos de operación:
   * 1. SUCCESS: HTTP 200 con CDR de aceptación (código '0').
   * 2. REJECT: HTTP 200 con CDR de rechazo (código '2000', '2324', etc.).
   * 3. FAULT: HTTP 500 con estructura oficial de SOAP Fault.
   */
  @Post('billService')
  @Header('Content-Type', 'text/xml;charset=UTF-8')
  sendBill(
    @Headers('x-mock-mode') headerMode?: string,
    @Headers('x-mock-code') headerCode?: string,
    @Query('mode') queryMode?: string,
    @Query('code') queryCode?: string,
    @Body() body: any = '',
    @Res({ passthrough: true }) res?: any,
  ): string {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body || '');
    const mode = (
      headerMode ||
      queryMode ||
      (rawBody.includes('MODE_FAULT')
        ? 'FAULT'
        : rawBody.includes('MODE_REJECT')
          ? 'REJECT'
          : 'SUCCESS')
    ).toUpperCase();

    // Modo SOAP Fault (HTTP 500)
    if (mode === 'FAULT' || mode === 'SOAP_FAULT') {
      if (res) res.status(500);
      return this.sunatMockService.generateSoapFaultResponse(
        headerCode || queryCode || 'S:Client.0100',
        'El comprobante no cumple con la estructura XML SOAP requerida',
      );
    }

    // Modo Rechazo con CDR (HTTP 200)
    if (mode === 'REJECT' || mode === 'RECHAZO') {
      const rejectCode = headerCode || queryCode || '2324';
      if (res) res.status(200);
      return this.sunatMockService.generateSendBillResponse({
        responseCode: rejectCode,
        description: `El comprobante numero F001-1 ha sido rechazado con codigo ${rejectCode}`,
      });
    }

    // Modo Éxito por defecto (HTTP 200, código 0)
    if (res) res.status(200);
    return this.sunatMockService.generateSendBillResponse();
  }
}