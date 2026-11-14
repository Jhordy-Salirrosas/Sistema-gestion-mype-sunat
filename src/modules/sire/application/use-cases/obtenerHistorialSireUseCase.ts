import { Injectable } from '@nestjs/common';
import type {
  SireHistorialFila,
  SireHistorialRespuesta,
} from '../dto/sireMenuResponseDto';
import { SireMenuRepository } from '../../infrastructure/persistence/sireMenuRepository';

/** Máximo de filas que devuelve el historial si no se pide un límite. */
export const SIRE_HISTORIAL_LIMITE_POR_DEFECTO = 100;

/**
 * Historial unificado de los flujos del menú SIRE.
 *
 * Une en una sola lista las importaciones, las conciliaciones y los reportes,
 * ordenados de más reciente a más antiguo. La unión se hace en SQL (ver
 * `SireMenuRepository.obtenerHistorial`), no en memoria: así el volumen no
 * crece con los datos.
 */
@Injectable()
export class ObtenerHistorialSireUseCase {
  constructor(private readonly repository: SireMenuRepository) {}

  async execute(
    companyId: string,
    periodo: string | null,
    limite: number | null,
  ): Promise<SireHistorialRespuesta> {
    const filas = await this.repository.obtenerHistorial(
      companyId,
      periodo,
      limite ?? SIRE_HISTORIAL_LIMITE_POR_DEFECTO,
    );

    return {
      total: filas.length,
      filas: filas.map((fila) => this.aFila(fila)),
    };
  }

  private aFila(fila: {
    id: string;
    fecha: Date;
    tipoAccion: string;
    periodo: string;
    estado: string;
    detalle: string | null;
  }): SireHistorialFila {
    return {
      id: fila.id,
      fecha: fila.fecha.toISOString(),
      tipoAccion: fila.tipoAccion as SireHistorialFila['tipoAccion'],
      periodo: fila.periodo,
      estado: fila.estado,
      detalle: fila.detalle,
    };
  }
}
