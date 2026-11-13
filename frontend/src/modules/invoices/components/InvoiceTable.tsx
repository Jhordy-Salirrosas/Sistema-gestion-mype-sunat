/**
 * Grilla enriquecida de comprobantes (M1) con 10 columnas tributarias.
 *
 * Columnas: comprobante, cliente, fecha, moneda, base imponible, IGV,
 * detracción/retención, total neto, estado CDR y acciones (XML, CDR, PDF).
 */
import {
  Card,
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
  /** Mensaje mostrado cuando el filtro no devuelve resultados. */
  mensajeVacio?: string;
  onVerXml: (c: ComprobanteDemo) => void;
  onVerCdr: (c: ComprobanteDemo) => void;
  onDescargarPdf: (c: ComprobanteDemo) => void;
  onReintentarCdr: (c: ComprobanteDemo) => void;
}

const COLUMNAS = [
  'Comprobante',
  'Cliente',
  'Fecha Emisión',
  'Moneda',
  'Base sin IGV',
  'IGV (18%)',
  'Detracción / Retención',
  'Total Neto',
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
  mensajeVacio = 'No se encontraron comprobantes con los filtros aplicados.',
  onVerXml,
  onVerCdr,
  onDescargarPdf,
  onReintentarCdr,
}: InvoiceTableProps) => {
  return (
    <Card flush>
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNAS.map((columna) => (
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
            comprobantes.map((comprobante) => (
              <InvoiceTableRow
                key={comprobante.id}
                comprobante={comprobante}
                onVerXml={onVerXml}
                onVerCdr={onVerCdr}
                onDescargarPdf={onDescargarPdf}
                onReintentarCdr={onReintentarCdr}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={COLUMNAS.length} align="center">
                {mensajeVacio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
};
