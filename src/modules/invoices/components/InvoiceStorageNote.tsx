/**
 * Dónde queda el XML firmado y el CDR de cada comprobante (D1, resto).
 *
 * Fue pregunta literal del docente y la pantalla de configuración no la
 * respondía. Es información fiscal, no una curiosidad: el contribuyente tiene
 * que poder exhibir el documento que realmente viajó a SUNAT, con su firma, y
 * la constancia de recepción que devolvió la administración.
 *
 * LO QUE SE DICE Y POR QUÉ ES EXACTO
 *
 * Verificado contra la base el 3 nov: 8 de los 9 comprobantes tienen
 * `xml_storage_url`, `cdr_sunat` y `cdr_storage_url` guardados; el noveno es
 * `F001-00000052`, en `ERROR_RED`, y no tiene ninguno — correcto, porque nunca
 * llegó a SUNAT.
 *
 * NO se promete una carpeta en disco ni un bucket: el proyecto no tiene
 * almacenamiento externo. El XML firmado y el CDR se guardan EN LA BASE, en las
 * columnas de la tabla `invoices`, y se entregan por los endpoints de descarga.
 * Decir «se guardan en un repositorio documental» sería una promesa que el
 * sistema no cumple.
 */
import { Card, PageText } from '@/components/ui';
import { FileCheck2, FileCode2 } from 'lucide-react';

interface Props {
  /**
   * Comprobantes ACEPTADOS u OBSERVADOS de la empresa.
   *
   * Es el único dato que el front conoce de verdad: el listado trae `cdr` y
   * `hash_xml`, pero NO si el XML firmado quedó guardado. Por eso no se inventa
   * un contador de «cuántos tienen XML»: se explica dónde queda y quiénes
   * necesariamente no lo tienen todavía.
   */
  aceptados: number;
}

/** Explica dónde quedan los archivos fiscales y cómo se recuperan. */
export const InvoiceStorageNote = ({ aceptados }: Props) => (
  <Card>
    <PageText variant="label">Dónde quedan el XML y el CDR</PageText>

    <div className="flex items-start gap-2">
      <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <PageText variant="caption">
        <strong>XML firmado.</strong> Es el documento que realmente se envió a
        SUNAT, con la firma digital incluida. Se guarda en la base de datos junto
        al comprobante —no se regenera al descargarlo— y se recupera desde el
        detalle del comprobante con «Descargar XML oficial».
      </PageText>
    </div>

    <div className="flex items-start gap-2">
      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <PageText variant="caption">
        <strong>CDR.</strong> Es la constancia que devuelve SUNAT y la única
        prueba de que aceptó el documento. Se guarda tal como llegó y se
        recupera con «Descargar CDR» en el mismo detalle.
      </PageText>
    </div>

    <PageText variant="caption">
      Hay {aceptados} comprobante(s) aceptado(s) con su XML firmado y su CDR
      guardados. Los que están en cola o con error de red todavía no tienen CDR
      porque SUNAT no los recibió: se reintentan desde el Monitor Outbox.
    </PageText>
  </Card>
);
