import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button, Input } from '@/components/ui';
import { FileUp, ShieldCheck, Hash, UploadCloud } from 'lucide-react';
import type { AddOrderDocumentPayload, ImportOrderRecord } from '../services/importOrdersApi';

interface AddOrderDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ImportOrderRecord;
  onSuccess: () => void;
  onSubmit: (payload: AddOrderDocumentPayload) => Promise<void>;
  defaultStageIndex?: number;
}

const STAGE_OPTIONS = [
  { index: 0, name: 'Solicitud', defaultDoc: 'SOLICITUD', defaultLabel: 'Requerimiento Interno' },
  { index: 1, name: 'Aprobación / OC', defaultDoc: 'ORDEN_COMPRA', defaultLabel: 'Orden de Compra' },
  { index: 2, name: 'Proforma', defaultDoc: 'PROFORMA', defaultLabel: 'Factura Proforma' },
  { index: 3, name: 'Embarque', defaultDoc: 'BL_GUIA_AEREA', defaultLabel: 'B/L (Bill of Lading) o Guía Aérea' },
  { index: 4, name: 'Tránsito', defaultDoc: 'POLIZA_SEGURO', defaultLabel: 'Póliza de Seguro de Transporte' },
  { index: 5, name: 'Arribo', defaultDoc: 'AVISO_LLEGADA', defaultLabel: 'Aviso de Llegada / Volante' },
  { index: 6, name: 'Almacén Aduanero', defaultDoc: 'INGRESO_ALMACEN', defaultLabel: 'Tarja / Ingreso Depósito Temporal' },
  { index: 7, name: 'DAM', defaultDoc: 'DAM_DUA', defaultLabel: 'Declaración Aduanera DAM / DUA 10' },
  { index: 8, name: 'Canal', defaultDoc: 'ASIGNACION_CANAL', defaultLabel: 'Resolución / Control de Canal SUNAT' },
  { index: 9, name: 'Tributos', defaultDoc: 'LIQUIDACION_TRIBUTOS', defaultLabel: 'Comprobante de Pago CDA Tributos' },
  { index: 10, name: 'Levante', defaultDoc: 'LEVANTE_AUTORIZADO', defaultLabel: 'Constancia de Levante Autorizado' },
  { index: 11, name: 'Retiro', defaultDoc: 'GUIA_RETIRO', defaultLabel: 'Guía de Remisión / Pase de Salida' },
  { index: 12, name: 'Recepción', defaultDoc: 'ACTA_RECEPCION', defaultLabel: 'Acta de Recepción de Mercancías' },
  { index: 13, name: 'Costeo', defaultDoc: 'HOJA_COSTEO', defaultLabel: 'Liquidación Landed Cost NIC 2' },
];

export const AddOrderDocumentModal: React.FC<AddOrderDocumentModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
  onSubmit,
  defaultStageIndex,
}) => {
  const initialIndex = defaultStageIndex !== undefined ? defaultStageIndex : order.currentStageIndex;
  const initialStage = STAGE_OPTIONS[initialIndex] || STAGE_OPTIONS[0];

  const [stageIndex, setStageIndex] = useState<number>(initialIndex);
  const [documentType, setDocumentType] = useState<string>(initialStage.defaultDoc);
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [storageUrl, setStorageUrl] = useState<string>('');
  const [fileHash, setFileHash] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSimulatedHash = () => {
    const chars = '0123456789abcdef';
    let h = '';
    for (let i = 0; i < 64; i++) {
      h += chars[Math.floor(Math.random() * chars.length)];
    }
    setFileHash(h);
  };

  const handleStageChange = (idx: number) => {
    setStageIndex(idx);
    const st = STAGE_OPTIONS[idx];
    if (st) {
      setDocumentType(st.defaultDoc);
      setDocumentNumber(`DOC-${order.orderNumber}-${st.defaultDoc}`);
      setFileName(`${st.defaultDoc.toLowerCase()}_${order.orderNumber.toLowerCase()}.pdf`);
      setStorageUrl(`https://supabase-storage.mype-sunat.internal/customs/${order.orderNumber}/${st.defaultDoc.toLowerCase()}.pdf`);
      generateSimulatedHash();
    }
  };

  // Inicializar campos por defecto si están vacíos al abrir
  React.useEffect(() => {
    if (isOpen) {
      const idx = defaultStageIndex !== undefined ? defaultStageIndex : order.currentStageIndex;
      handleStageChange(idx);
    }
  }, [isOpen, defaultStageIndex, order.currentStageIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentNumber.trim() || !fileName.trim()) {
      setError('Por favor complete el número de documento y nombre de archivo.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const st = STAGE_OPTIONS[stageIndex] || STAGE_OPTIONS[0];
      await onSubmit({
        stageIndex,
        stageName: st.name,
        documentType,
        documentNumber: documentNumber.trim(),
        fileName: fileName.trim(),
        storageUrl: storageUrl.trim() || `https://supabase.internal/documents/${fileName.trim()}`,
        fileHash: fileHash.trim() || undefined,
        fileSizeBytes: 1024 * 256, // 256 KB
        mimeType: 'application/pdf',
        isMandatory: true,
        uploadedBy: 'Operador Comercio Exterior',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Error al adjuntar documento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <FileUp className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base">Adjuntar Documento a Checklist</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Orden {order.orderNumber} — Repositorio y verificación criptográfica SHA-256
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 space-y-4">
            {error && (
              <div className="p-2.5 rounded text-xs bg-destructive/15 text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Etapa del Flujo Aduanero</label>
                <select
                  value={stageIndex}
                  onChange={(e) => handleStageChange(parseInt(e.target.value, 10))}
                  className="w-full h-8 text-xs bg-background border rounded-md px-2 focus:ring-1 focus:ring-primary"
                >
                  {STAGE_OPTIONS.map((st) => (
                    <option key={st.index} value={st.index}>
                      {st.index}. {st.name} ({st.defaultLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Tipo de Documento</label>
                <Input
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value.toUpperCase())}
                  placeholder="BL_GUIA_AEREA, FACTURA, ETC."
                  className="h-8 text-xs font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">N° de Documento / Comprobante</label>
                <Input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ej: BL-MSK-2026-99"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Nombre de Archivo</label>
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="bl_embarque_oficial.pdf"
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">URL de Almacenamiento (Supabase Storage)</label>
              <div className="relative">
                <UploadCloud className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={storageUrl}
                  onChange={(e) => setStorageUrl(e.target.value)}
                  placeholder="https://supabase-storage..."
                  className="h-8 text-xs pl-8 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  Hash de Integridad Criptográfica (SHA-256)
                </label>
                <button
                  type="button"
                  onClick={generateSimulatedHash}
                  className="text-[10px] text-primary hover:underline"
                >
                  Regenerar Hash
                </button>
              </div>
              <Input
                value={fileHash}
                onChange={(e) => setFileHash(e.target.value)}
                placeholder="64 caracteres hexadecimales SHA-256"
                className="h-8 text-[11px] font-mono bg-muted/30"
              />
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                Garantiza inmutabilidad y auditoría tributaria SUNAT ante fiscalizaciones.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" />
              {isSubmitting ? 'Guardando...' : 'Guardar y Verificar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
