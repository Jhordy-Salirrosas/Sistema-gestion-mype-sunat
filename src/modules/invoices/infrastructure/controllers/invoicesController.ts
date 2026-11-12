import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { Roles } from '../../../../common/decorators';
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AtomicInvoiceCreationService } from '../../application/services/atomicInvoiceCreationService';
import { CreateInvoiceDto } from '../../application/dto/createInvoiceDto';
import { EmitirComprobanteDto } from '../../application/dto/emitirComprobanteDto';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';

/**
 * Emisión de comprobantes.
 *
 * DOS RUTAS, DOS CONTRATOS, A PROPÓSITO
 *
 *  - `POST /` recibe `CreateInvoiceDto`: el contrato fiscal que ya trae el
 *    `payload_ubl` armado. Sirve a la integración máquina-a-máquina y a los
 *    tests del generador UBL.
 *
 *  - `POST /emitir` recibe `EmitirComprobanteDto`: lo que escribe una persona en
 *    el mostrador (cliente, serie y líneas). El backend liquida los impuestos,
 *    valida el stock, reserva el correlativo y arma el UBL.
 *
 * Por qué no una sola ruta: durante la revisión del 31-10 se comprobó contra el
 * servidor real que el front mandaba el formulario a `POST /`, que exige
 * `payload_ubl`. El `whitelistValidation` respondía 400 a TODAS las emisiones
 * ("property clienteRuc should not exist"), así que la pantalla de emisión
 * nunca pudo emitir. Relajar `CreateInvoiceDto` habría perdido las validaciones
 * fiscales que SUNAT necesita; separar el contrato de entrada conserva ambas.
 */
@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(
    private readonly creation: AtomicInvoiceCreationService,
  ) { }

  /**
   * Alta con el contrato fiscal completo (integración).
   *
   * Devuelve 202 porque el comprobante queda en la cola: el estado real del CDR
   * se consulta después. Es deliberado no responder "aceptado" aquí.
   */
  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @UseGuards(RolesGuard)
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentCompany() companyId: string,
    @Headers('idempotency-key') key?: string,
  ) {
    const invoice = await this.creation.create(dto, companyId, key);

    return {
      id: invoice.id,
      estado: invoice.estado,
      message: 'Comprobante recibido y en cola para procesamiento',
      created_at: invoice.created_at,
    };
  }

  /**
   * Emisión desde la pantalla (lo que llena el usuario).
   *
   * Responde 201 con el número ya asignado y los importes liquidados, para que
   * la pantalla muestre el comprobante real en lugar de inventarlo. NO dice
   * nada sobre el CDR: eso llega después desde SUNAT.
   *
   * Debe declararse ANTES de cualquier `GET /:id` para no quedar capturada por
   * la ruta paramétrica (el orden de las rutas en Nest importa).
   */
  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @UseGuards(RolesGuard)
  @Post('emitir')
  @HttpCode(HttpStatus.CREATED)
  async emitir(
    @Body() dto: EmitirComprobanteDto,
    @CurrentCompany() companyId: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.creation.emitir(dto, companyId, key);
  }
}
