import type { SireLibroMenu } from './sireMenuQueryDto';

export interface SireAccountingPreviewLine {
  cuenta: string;
  nombre: string;
  debe: number;
  haber: number;
}

export interface SireAccountingPreviewEntry {
  libro: SireLibroMenu;
  glosa: string;
  fecha: string;
  lineas: SireAccountingPreviewLine[];
  totales: {
    base: number;
    igv: number;
    total: number;
    comprobantes: number;
  };
}

export interface SireAccountingPreviewResponse {
  periodo: string;
  asientos: SireAccountingPreviewEntry[];
}
