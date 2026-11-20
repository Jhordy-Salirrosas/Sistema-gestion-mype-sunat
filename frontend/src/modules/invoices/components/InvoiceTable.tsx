import { useState } from 'react';
/**
 * Grilla enriquecida de comprobantes (M1) con 10 columnas tributarias.
 *
 * Columnas: comprobante, cliente, fecha, moneda, base imponible, IGV,
 * detracción/retención, total neto, estado CDR y acciones (XML, CDR, PDF).
 */
import {
  Card,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import type { ComprobanteDemo } from '../data/invoiceDemoSchema';
import { InvoiceTableRow } from './InvoiceTableRow';

interface InvoiceTableProps {
  comprobantes: readonly ComprobanteDemo[];
  /** Presentación exclusiva de la bandeja de Facturas y Boletas. */
  sinAcciones?: boolean;
  /** Mensaje mostrado cuando el filtro no devuelve resultados. */
  mensajeVacio?: string;
  onVerXml: (c: ComprobanteDemo) => void;
  onVerCdr: (c: ComprobanteDemo) => void;
  onDescargarPdf: (c: ComprobanteDemo) => void;
  onReintentarCdr: (c: ComprobanteDemo) => void;
}

const COLUMNAS = [
  'Comprobante',
  'Fecha Emisión',
  'Cliente',
  'Total Neto',
  'Moneda',
  'Base sin IGV',
  'IGV (18%)',
  'Detracción / Retención',
  'Estado CDR',
  'Acciones',
] as const;

/** Alineación por columna (por defecto a la izquierda). */
const ALINEACION: Record<string, 'right' | 'center'> = {
  Moneda: 'center',
  'Base sin IGV': 'right',
  'IGV (18%)': 'right',
  'Detracción / Retención': 'right',
  'Total Neto': 'right',
  'Estado CDR': 'center',
  Acciones: 'right',
};

export const InvoiceTable = ({
  comprobantes,
  sinAcciones = false,
  mensajeVacio = 'No se encontraron comprobantes con los filtros aplicados.',
  onVerXml,
  onVerCdr,
  onDescargarPdf,
  onReintentarCdr,
}: InvoiceTableProps) => {
  const columnas = sinAcciones ? COLUMNAS.slice(0, -1) : COLUMNAS;
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState('fecha-desc');
  const ordenados = [...comprobantes].sort((a,b) => orden === 'total-desc' ? b.totalNeto-a.totalNeto : orden === 'numero' ? `${a.serie}-${a.correlativo}`.localeCompare(`${b.serie}-${b.correlativo}`, 'es', {numeric:true}) : orden === 'fecha-asc' ? a.fechaEmision.localeCompare(b.fechaEmision) : b.fechaEmision.localeCompare(a.fechaEmision));
  const paginas = Math.ceil(ordenados.length / 25);
  const actual = Math.min(pagina, Math.max(1, paginas));
  return (
    <Card flush>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3"><p>Comprobantes: fecha, cliente, importes y estado ante SUNAT</p>
        <label>Ordenar <select aria-label="Ordenar comprobantes" value={orden} onChange={e => { setOrden(e.target.value); setPagina(1); }} className="rounded border p-1"><option value="fecha-desc">Más recientes</option><option value="fecha-asc">Más antiguos</option><option value="total-desc">Mayor importe</option><option value="numero">Serie y número</option></select></label>
      </div>
      <Table>
        <caption className="sr-only">Comprobantes electrónicos y su estado ante SUNAT</caption>
        <TableHeader>
          <TableRow>
            {columnas.map((columna) => (
              <TableHead
                key={columna}
                align={ALINEACION[columna] ?? 'left'}
              >
                {columna}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {comprobantes.length > 0 ? (
            ordenados.slice((actual-1)*25, actual*25).map((comprobante) => (
              <InvoiceTableRow
                key={comprobante.id}
                comprobante={comprobante}
                sinAcciones={sinAcciones}
                onVerXml={onVerXml}
                onVerCdr={onVerCdr}
                onDescargarPdf={onDescargarPdf}
                onReintentarCdr={onReintentarCdr}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnas.length} align="center">
                {mensajeVacio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {paginas > 1 && <nav aria-label="Paginación de comprobantes" className="flex flex-wrap items-center justify-end gap-3 p-3">
        <Button variant="outline" size="sm" disabled={actual===1} onClick={() => setPagina(actual-1)}>Anterior</Button>
        <span>Página {actual} de {paginas}</span>
        <Button variant="outline" size="sm" disabled={actual===paginas} onClick={() => setPagina(actual+1)}>Siguiente</Button>
      </nav>}
    </Card>
  );
};
