import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

interface ExportSireButtonProps {
  onExport: () => void;
  isLoading?: boolean;
}

export const ExportSireButton: React.FC<ExportSireButtonProps> = ({
  onExport,
  isLoading = false,
}) => {
  return (
    <Button
      size="sm"
      variant="default"
      className="h-8 text-xs gap-1.5 font-bold shadow-xs"
      onClick={onExport}
      disabled={isLoading}
    >
      {isLoading ? (
        <FileText className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Descargar Archivo Estructurado SIRE (.txt)
    </Button>
  );
};
