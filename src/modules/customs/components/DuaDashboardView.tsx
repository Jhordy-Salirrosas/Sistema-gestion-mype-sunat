import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CustomsKpiCards } from './CustomsKpiCards';
import { DeclarationsTable } from './DeclarationsTable';
import { KardexTable } from './KardexTable';
import { DeclarationDetailSheet } from './DeclarationDetailSheet';
import { useCustomsDeclarations } from '../hooks/useCustomsDeclarations';
import { useKardexMovements } from '../hooks/useKardexMovements';
import { Plus, Search, FileText, Layers, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useRolePermissions } from '@/hooks/useRolePermissions';

interface Props {
  onOpenRegistration: () => void;
}

export const DuaDashboardView = ({ onOpenRegistration }: Props) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { canRegisterDua, isAuditor } = useRolePermissions();

  const {
    data: declarations = [],
    isLoading: loadingDeclarations,
    refetch: refetchDeclarations,
  } = useCustomsDeclarations();

  const {
    data: kardex = [],
    isLoading: loadingKardex,
    refetch: refetchKardex,
  } = useKardexMovements();

  const handleSelectDeclaration = (id: string) => {
    setSelectedDeclarationId(id);
    setIsSheetOpen(true);
  };

  const handleRefresh = () => {
    refetchDeclarations();
    refetchKardex();
  };

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Ingesta Aduanera e Importaciones (DUA / DAM)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Liquidación oficial SUNAT, Casilla 4 y afectación en tiempo real al Kardex Permanente Valorizado (NIC 2)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9 px-3 gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          {canRegisterDua ? (
            <Button onClick={onOpenRegistration} size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
              <Plus className="h-4 w-4" />
              + Registrar Nueva Declaración
            </Button>
          ) : (
            <Badge variant="outline" className="h-9 px-3 text-xs bg-muted/60 text-muted-foreground border-dashed">
              {isAuditor ? '👁️ Inspección Aduanera (Solo Lectura)' : '📊 Consulta de Crédito Fiscal (Lectura)'}
            </Badge>
          )}
        </div>
      </div>

      {/* Tarjetas KPI Resumen */}
      <CustomsKpiCards declarations={declarations} />

      {/* Tabs y Buscador Local */}
      <Tabs defaultValue="declarations" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="declarations" className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Declaraciones Aduaneras ({declarations.length})
            </TabsTrigger>
            <TabsTrigger value="kardex" className="gap-2 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Kardex Permanente Valorizado ({kardex.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por DAM, Aduana, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        <TabsContent value="declarations" className="mt-0">
          <DeclarationsTable
            declarations={declarations}
            isLoading={loadingDeclarations}
            onSelectDeclaration={handleSelectDeclaration}
            searchQuery={searchQuery}
          />
        </TabsContent>

        <TabsContent value="kardex" className="mt-0">
          <KardexTable
            movements={kardex}
            isLoading={loadingKardex}
            searchQuery={searchQuery}
          />
        </TabsContent>
      </Tabs>

      {/* Drawer Lateral Derecho (Sheet) */}
      <DeclarationDetailSheet
        declarationId={selectedDeclarationId}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </div>
  );
};
