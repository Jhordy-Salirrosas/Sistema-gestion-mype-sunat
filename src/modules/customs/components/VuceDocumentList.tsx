import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Plus, ShieldCheck } from 'lucide-react';
import { type CustomsDocumentRecord } from '../types';

interface VuceDocumentListProps {
  documents: CustomsDocumentRecord[];
  onOpenAddModal: () => void;
}

export const VuceDocumentList: React.FC<VuceDocumentListProps> = ({
  documents,
  onOpenAddModal,
}) => {
  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Documentos de Despacho y Resoluciones VUCE
        </CardTitle>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onOpenAddModal}>
          <Plus className="h-3.5 w-3.5" />
          Adjuntar Documento
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {documents.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-lg text-xs text-muted-foreground gap-1.5">
            <p>No se han adjuntado comprobantes o permisos VUCE.</p>
            <Button size="sm" variant="link" className="text-xs h-auto p-0" onClick={onOpenAddModal}>
              Cargar Factura o B/L
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {documents.map((doc) => (
              <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {doc.document_type}
                  </Badge>
                  <div>
                    <p className="font-semibold text-foreground">{doc.document_number}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Emitido: {new Date(doc.issue_date).toLocaleDateString('es-PE')}
                      {doc.issuer_name ? ` • ${doc.issuer_name}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {doc.vuce_dr_number && (
                    <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      VUCE: {doc.vuce_dr_number}
                    </Badge>
                  )}
                  <Badge variant={doc.is_validated ? 'default' : 'outline'} className="text-[10px]">
                    {doc.is_validated ? 'Validado' : 'Cargado'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
