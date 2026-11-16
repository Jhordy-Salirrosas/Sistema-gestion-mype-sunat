import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RucConsultaService } from '../../../sunat/rucConsultaService';

/**
 * Validación del RUC de la empresa contra el padrón de SUNAT.
 *
 * Reutiliza `RucConsultaService` (proveedor Decolecta, cache y normalización
 * de la respuesta) para no duplicar la integración.
 */
@Controller('api/v1/empresa')
@UseGuards(AuthGuard)
export class CompanyRucValidationController {
  constructor(private readonly rucConsultaService: RucConsultaService) {}

  @Get('validar-ruc/:ruc')
  async validar(@Param('ruc') ruc: string) {
    if (!/^\d{11}$/.test(ruc)) {
      throw new BadRequestException(
        'El RUC debe tener 11 dígitos numéricos.',
      );
    }

    try {
      const data = await this.rucConsultaService.consultar(ruc);
      return {
        ...data,
        direccion: data.direccionFiscal,
        estado: data.estadoContribuyente,
        condicion: data.condicionDomicilio,
      };
    } catch {
      throw new BadRequestException(
        'No se pudo validar el RUC. Verifique el número e intente nuevamente.',
      );
    }
  }
}
