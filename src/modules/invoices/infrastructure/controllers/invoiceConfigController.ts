import { Roles } from '../../../../common/decorators';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
/**
 * Endpoints de configuración de Facturación Electrónica (TA-60, HU-09).
 *
 * Controlador aparte por la misma razón que `invoiceQueryController`: no mezclar
 * responsabilidades y no acercar este archivo al límite de líneas del proyecto.
 * Comparte el prefijo `api/v1/invoices` y el `AuthGuard` de los demás.
 *
 * ORDEN DE LAS RUTAS: `series` y `customers/lookup` se declaran ANTES que
 * cualquier `:id`. En NestJS gana la primera ruta que coincide, así que con
 * `@Get(':id')` declarado antes, `GET /invoices/series` entraría al detalle con
 * `id = "series"` y respondería 404. Es un defecto real y silencioso.
 *
 * `companyId` sale SIEMPRE de `@CurrentCompany()`, que lo lee del token ya
 * validado: ninguna ruta acepta la empresa por query o body (Anti-IDOR).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InvoiceConfigService } from '../../application/services/invoiceConfigService';
import {
  InvoiceSeriesService,
  type AltaSerieParams,
} from '../../application/services/invoiceSeriesService';
import {
  REGLAS_SERIE,
  serieCorrespondeATipo,
} from '../../domain/rules/serieRules';

/** Cuerpo de POST /api/v1/invoices/series. */
interface AltaSerieBody {
  document_type?: string;
  series?: string;
  correlativo_inicial?: number;
}

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoiceConfigController {
  constructor(
    private readonly config: InvoiceConfigService,
    private readonly series: InvoiceSeriesService,
  ) {}

  /** GET /api/v1/invoices/config — estado del entorno y del checklist. */
  @Get('config')
  obtenerConfiguracion(@CurrentCompany() companyId: string) {
    return this.config.obtener(companyId);
  }

  @Put('config')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  actualizarConfiguracion(
    @CurrentCompany() companyId: string,
    @Body() body: unknown,
  ) {
    return this.config.actualizar(companyId, body);
  }

  /** GET /api/v1/invoices/series — series de la empresa con su correlativo. */
  @Get('series')
  listarSeries(@CurrentCompany() companyId: string) {
    return this.series.listar(companyId);
  }

  /**
   * POST /api/v1/invoices/series — crea o reactiva una serie.
   *
   * El `correlativo_inicial` permite arrancar en el último número ya usado en
   * papel o en otro sistema, sin reutilizar ninguno.
   */
  @Post('series')
  @HttpCode(HttpStatus.CREATED)
  async crearSerie(
    @CurrentCompany() companyId: string,
    @Body() body: AltaSerieBody,
  ) {
    const tipo = (body.document_type ?? '').trim();
    const serie = (body.series ?? '').trim();

    if (!/^(01|03|07|08)$/.test(tipo)) {
      throw new BadRequestException(
        'document_type debe ser 01 (factura), 03 (boleta), 07 (NC) u 08 (ND)',
      );
    }
    /**
     * La serie se valida con la MISMA regla de dominio que usan el DTO de
     * emisión y el value object, no con un patrón propio.
     *
     * Antes aquí había `/^[A-Za-z]\d{3}$/` ("una letra y tres dígitos"), que
     * rechazaba FC01 y BC01: justo las series que SUNAT exige para las notas de
     * crédito. Con ese patrón era imposible dar de alta la serie y, por tanto,
     * emitir una nota de crédito. Se detectó emitiendo una NC el 31-10.
     *
     * `serieCorrespondeATipo` ya conocía F/B/FC/BC/FD/BD y EB, así que tener dos
     * validaciones distintas para lo mismo era el defecto de fondo.
     */
    if (!serieCorrespondeATipo(serie, tipo)) {
      throw new BadRequestException(
        REGLAS_SERIE[tipo]?.mensaje ??
          'La serie no corresponde al tipo de comprobante',
      );
    }

    const inicial = body.correlativo_inicial;
    if (inicial !== undefined && (!Number.isInteger(inicial) || inicial < 0)) {
      throw new BadRequestException(
        'correlativo_inicial debe ser un entero mayor o igual que 0',
      );
    }

    const params: AltaSerieParams = {
      companyId,
      documentType: tipo,
      series: serie,
      correlativoInicial: inicial,
    };
    return this.series.asegurarSerie(params);
  }

  /**
   * GET /api/v1/invoices/series/:tipo/:serie/siguiente
   *
   * Consulta de solo lectura del próximo número, para que la pantalla de
   * emisión lo muestre ANTES de reservarlo. NO lo consume: el número se
   * reserva de verdad al emitir. Si esta ruta lo reservara, abrir el formulario
   * y cerrarlo quemaría un correlativo y dejaría un hueco en la serie.
   */
  @Get('series/:tipo/:serie/siguiente')
  async siguienteCorrelativo(
    @CurrentCompany() companyId: string,
    @Param('tipo') tipo: string,
    @Param('serie') serie: string,
  ) {
    const listado = await this.series.listar(companyId);
    const encontrada = listado.find(
      (fila) =>
        fila.document_type === tipo.trim().padStart(2, '0') &&
        fila.series === serie.trim().toUpperCase(),
    );

    if (!encontrada) {
      throw new NotFoundException(
        `La serie ${tipo}-${serie} no está configurada para la empresa`,
      );
    }

    return {
      serie: encontrada.series,
      document_type: encontrada.document_type,
      // Proyección: el próximo número que asignará la reserva atómica.
      siguiente: encontrada.current_correlative + 1,
      is_active: encontrada.is_active,
    };
  }
}
