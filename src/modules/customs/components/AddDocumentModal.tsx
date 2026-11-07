import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type AddDocumentPayload, type CustomsDocumentType } from '../types';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AddDocumentPayload) => Promise<unknown>;
}

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [docType, setDocType] = useState<CustomsDocumentType>('FAC');
  const [docNumber, setDocNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [issuer, setIssuer] = useState('');
  const [vuceDr, setVuceDr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        document_type: docType,
        document_number: docNumber,
        issue_date: issueDate,
        issuer_name: issuer || undefined,
        vuce_dr_number: vuceDr || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Adjuntar Documento Probatorio / VUCE</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-medium text-foreground block mb-1">Tipo de Documento</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as CustomsDocumentType)}
              className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
            >
              <option value="FAC">Factura Comercial (FAC)</option>
              <option value="TRA">Documento de Transporte / BL (TRA)</option>
              <option value="SEG">Póliza de Seguro de Transporte (SEG)</option>
              <option value="CRO">Certificado de Origen TLC (CRO)</option>
              <option value="AUT">Autorización / Documento Resolutivo VUCE (AUT)</option>
              <option value="DAV">Declaración Andina del Valor (DAV)</option>
            </select>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Número de Comprobante / Trámite</label>
            <Input
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="INV-2026-0891 o BL-MSK-9981"
              required
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium text-foreground block mb-1">Fecha de Emisión</label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Emisor</label>
              <Input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="Shenzhen Tech / Naviera"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {docType === 'AUT' && (
            <div>
              <label className="font-medium text-foreground block mb-1">
                N° Documento Resolutivo VUCE (ej. MTC, DIGEMID)
              </label>
              <Input
                value={vuceDr}
                onChange={(e) => setVuceDr(e.target.value)}
                placeholder="DR-MTC-2026-008941"
                className="h-8 text-xs font-mono"
              />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Cargar Documento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
