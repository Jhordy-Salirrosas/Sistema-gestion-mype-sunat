import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { type RegisterDuaWizardItemPayload } from '../types';

interface DuaStep2SeriesTableProps {
  items: RegisterDuaWizardItemPayload[];
  onChangeItems: (items: RegisterDuaWizardItemPayload[]) => void;
}

export const DuaStep2SeriesTable: React.FC<DuaStep2SeriesTableProps> = ({
  items,
  onChangeItems,
}) => {
  const handleAddItem = () => {
    const nextOrder = items.length + 1;
    onChangeItems([
      ...items,
      {
        series_order: nextOrder,
        product_code: `ITEM-${nextOrder}`,
        hs_code: '8471300000',
        commercial_description: '',
        goods_state: 'NUEVO',
        tpi_code: '800',
        physical_quantity: 1,
        physical_unit: 'NIU',
        net_weight_kg: 10,
        gross_weight_kg: 12,
        fob_usd: 0,
        ad_valorem_rate: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    onChangeItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, partial: Partial<RegisterDuaWizardItemPayload>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...partial };
    onChangeItems(updated);
  };

  const totalFob = items.reduce((sum, item) => sum + (item.fob_usd || 0), 0);

  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardContent className="p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-foreground">Series Arancelarias Declaradas (Formato B)</h4>
            <p className="text-[11px] text-muted-foreground">
              Total FOB acumulado: <span className="font-bold text-primary">${totalFob.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddItem}
              className="h-7 text-xs gap-1 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              + Nueva Serie Arancelaria
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center border border-dashed rounded-lg text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">No hay series arancelarias cargadas para esta declaración.</p>
            <p className="text-[11px]">
              Al iniciar el trámite desde una Orden de Compra Internacional o Expediente, los productos se cargan automáticamente.
              También puedes agregar una serie de forma manual.
            </p>
            <Button size="sm" variant="outline" onClick={handleAddItem} className="gap-1.5 h-7 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Agregar primera serie
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
          {items.map((item, index) => (
            <div
              key={index}
              className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Serie N° {item.series_order}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  onClick={() => handleRemoveItem(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">Subpartida SPN (10 dígitos)</label>
                  <Input
                    value={item.hs_code}
                    onChange={(e) => handleUpdateItem(index, { hs_code: e.target.value })}
                    maxLength={10}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-muted-foreground block mb-0.5">Descripción Comercial</label>
                  <Input
                    value={item.commercial_description}
                    onChange={(e) => handleUpdateItem(index, { commercial_description: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">FOB (USD)</label>
                  <Input
                    type="number"
                    value={item.fob_usd}
                    onChange={(e) => handleUpdateItem(index, { fob_usd: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono font-bold text-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">Destino Contable</label>
                  <select
                    value={item.destination_type || 'MERCADERIA'}
                    onChange={(e) => handleUpdateItem(index, { destination_type: e.target.value as any })}
                    className="h-7 w-full rounded border border-border/70 bg-background px-1.5 text-xs font-semibold text-foreground"
                  >
                    <option value="MERCADERIA">Mercadería (NIC 2)</option>
                    <option value="ACTIVO_FIJO">Activo Fijo (NIC 16)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block">Cantidad</label>
                  <Input
                    type="number"
                    value={item.physical_quantity}
                    onChange={(e) => handleUpdateItem(index, { physical_quantity: Number(e.target.value) || 0 })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Unidad</label>
                  <Input
                    value={item.physical_unit}
                    onChange={(e) => handleUpdateItem(index, { physical_unit: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Peso Neto (kg)</label>
                  <Input
                    type="number"
                    value={item.net_weight_kg}
                    onChange={(e) => handleUpdateItem(index, { net_weight_kg: Number(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Peso Bruto (kg)</label>
                  <Input
                    type="number"
                    value={item.gross_weight_kg}
                    onChange={(e) => handleUpdateItem(index, { gross_weight_kg: Number(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">TPI (TLC)</label>
                  <Input
                    value={item.tpi_code || ''}
                    onChange={(e) => handleUpdateItem(index, { tpi_code: e.target.value })}
                    placeholder="800 China"
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Ad-Valorem (%)</label>
                  <Input
                    type="number"
                    value={item.ad_valorem_rate}
                    onChange={(e) => handleUpdateItem(index, { ad_valorem_rate: Number(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </CardContent>
    </Card>
  );
};
