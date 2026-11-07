import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Package,
  BookOpen,
  Edit2,
  Globe,
  Scale,
  Building2,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { type InventoryBalance } from '../types/inventory.types';

interface ProductDetailDrawerProps {
  product: InventoryBalance | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: InventoryBalance) => void;
  onOpenKardex: (sku: string) => void;
}

const SUNAT_TYPES: Record<string, string> = {
  '01': '01 - Mercaderías',
  '02': '02 - Productos Terminados',
  '03': '03 - Materias Primas',
  '04': '04 - Envases y Embalajes',
  '07': '07 - Repuestos y Accesorios',
  '99': '99 - Otros',
};

export const ProductDetailDrawer: React.FC<ProductDetailDrawerProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
  onOpenKardex,
}) => {
  if (!product) return null;

  const isLowStock =
    typeof product.minStockAlert === 'number' &&
    product.minStockAlert > 0 &&
    product.currentStock <= product.minStockAlert;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-base text-primary">
                  {product.sku}
                </span>
                {product.brand && (
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    {product.brand}
                  </Badge>
                )}
                {product.category && (
                  <Badge variant="outline" className="text-[10px]">
                    {product.category}
                  </Badge>
                )}
                <Badge className="bg-emerald-600 text-white text-[10px]">
                  Inventariable (Activo)
                </Badge>
              </div>
              <DialogTitle className="text-sm font-semibold text-foreground mt-1">
                {product.description}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Alerta de Stock Mínimo si aplica */}
          {isLowStock && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Alerta de Reabastecimiento:</strong> El stock actual ({product.currentStock}) ha alcanzado o está por debajo del umbral mínimo configurado ({product.minStockAlert} {product.sunatUnitCode || 'NIU'}).
              </span>
            </div>
          )}

          {/* TARJETAS DE SALDO Y VALORIZACIÓN ACTUAL */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3 bg-card border-border/80">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Stock Físico Actual
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                {product.currentStock.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {product.sunatUnitCode || 'NIU'}
                </span>
              </p>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" /> Almacén: {product.warehouseCode || 'ALM-01'}
              </span>
            </Card>

            <Card className="p-3 bg-card border-border/80">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Costo Promedio (CPP)
              </span>
              <p className="text-xl font-bold font-mono text-primary mt-0.5">
                S/ {product.averageUnitCost.toFixed(4)}
              </p>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <Scale className="h-3 w-3" /> Promedio Ponderado Móvil
              </span>
            </Card>

            <Card className="p-3 bg-card border-border/80">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Valor Total Inventario
              </span>
              <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                S/ {product.totalInventoryValue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <DollarSign className="h-3 w-3" /> Base Imponible PEN
              </span>
            </Card>
          </div>

          {/* FICHA TÉCNICA Y ESPECIFICACIONES */}
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
              <Package className="h-3.5 w-3.5 text-primary" />
              Especificaciones Técnicas y Comerciales
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Marca:</span>
                <span className="font-semibold text-foreground">{product.brand || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Modelo:</span>
                <span className="font-semibold text-foreground">{product.model || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Línea / Categoría:</span>
                <span className="font-semibold text-foreground">{product.category || 'General'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Código de Barras:</span>
                <span className="font-mono font-semibold text-foreground">{product.barcode || '—'}</span>
              </div>
            </div>
          </div>

          {/* CLASIFICACIÓN ARANCELARIA Y COMERCIO EXTERIOR */}
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              Parámetros de Comercio Exterior & Logística
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                  Partida Arancelaria (SPN / DUA):
                </span>
                <span className="font-mono font-bold text-foreground">
                  {product.hsCode || '8471.30.00.00'}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Subpartida Nacional 10 dígitos
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                  Peso Unitario Bruto:
                </span>
                <span className="font-mono font-bold text-foreground">
                  {product.weightKg ? `${product.weightKg} kg` : '2.80 kg'}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Factor bivariado de estiba/flete
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                  Volumen Unitario:
                </span>
                <span className="font-mono font-bold text-foreground">
                  {product.volumeM3 ? `${product.volumeM3} m³` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* REGULATORIO SUNAT */}
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Atributos de Cumplimiento SUNAT (PLE 13.1)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                  Tipo Existencia (Tabla 5):
                </span>
                <span className="font-medium text-foreground">
                  {SUNAT_TYPES[product.sunatTypeCode || '01'] || '01 - Mercaderías'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                  Unidad Medida (Tabla 6):
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {product.sunatUnitCode || 'NIU'} (Unidades)
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                  Alerta Stock Mínimo:
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {product.minStockAlert ? `${product.minStockAlert} ${product.sunatUnitCode || 'NIU'}` : 'Sin umbral'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cerrar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="text-xs gap-1.5 text-primary border-primary/30"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar Ficha
            </Button>

            <Button
              size="sm"
              onClick={() => {
                onClose();
                onOpenKardex(product.sku);
              }}
              className="text-xs gap-1.5 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Ver Kardex Valorizado (PLE 13.1)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
