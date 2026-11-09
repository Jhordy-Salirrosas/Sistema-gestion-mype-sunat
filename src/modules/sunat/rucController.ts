import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/infrastructure/guards/authGuard';
import { RucConsultaService } from './rucConsultaService';

@Controller('api/v1/sunat')
@UseGuards(AuthGuard)
export class RucController {
  constructor(private readonly rucConsulta: RucConsultaService) {}

  @Get('ruc/:ruc')
  consultar(@Param('ruc') ruc: string) {
    return this.rucConsulta.consultar(ruc);
  }
}
