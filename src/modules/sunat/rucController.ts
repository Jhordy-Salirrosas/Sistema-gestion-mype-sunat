import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/infrastructure/guards/authGuard';
import { RucConsultaService } from './rucConsultaService';
import { DniConsultaService } from './dniConsultaService';

@Controller('api/v1/sunat')
@UseGuards(AuthGuard)
export class RucController {
  constructor(
    private readonly rucConsulta: RucConsultaService,
    private readonly dniConsulta: DniConsultaService,
  ) {}

  @Get('dni/:dni')
  consultarDni(@Param('dni') dni: string) {
    return this.dniConsulta.consultar(dni);
  }

  @Get('ruc/:ruc')
  consultar(@Param('ruc') ruc: string) {
    return this.rucConsulta.consultar(ruc);
  }
}
