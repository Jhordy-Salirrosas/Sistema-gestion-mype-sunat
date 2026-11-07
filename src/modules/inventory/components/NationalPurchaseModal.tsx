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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  inventoryPurchasesApi,
  type CreateNationalPurchasePayload,
} from '../services/inventoryPurchasesApi';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Receipt,
  Building2,
  Calendar,
} from 'lucide-react';

interface PurchaseItemRow {
  sku: string;
  quantity: number;
  unitCost: number;
}

interface NationalPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NationalPurchaseModal: React.FC<NationalPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [supplierDocNumber, setSupplierDocNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [documentTypeCode, setDocumentTypeCode] = useState('01');
  const [documentSerial, setDocumentSerial] = useState('F001');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [warehouseCode, setWarehouseCode] = useState('ALM-01');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItemRow[]>([
    { sku: '', quantity: 1, unitCost: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cálculos en tiempo real
  const netAmount = items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    0
  );
  const igvAmount = netAmount * 0.18;
  const totalAmount = netAmount + igvAmount;

  const handleAddItem = () => {
    setItems((prev) => [...prev, { sku: '', quantity: 1, unitCost: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItemRow, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierDocNumber.trim() || !supplierName.trim()) {
      setErrorMessage('El RUC y la razón social del proveedor son obligatorios.');
      return;
    }

    if (!documentSerial.trim() || !documentNumber.trim()) {
      setErrorMessage('La serie y el número de la factura son obligatorios.');
      return;
    }

    const invalidItem = items.find(
      (it) => !it.sku.trim() || it.quantity <= 0 || it.unitCost < 0
    );
    if (invalidItem) {
      setErrorMessage('Todos los ítems deben tener SKU válido, cantidad > 0 y costo >= 0.');
      return;
    }

    const skus = items.map((it) => it.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      setErrorMessage('No puedes repetir el mismo SKU en varias filas.');
      return;
    }

    const payload: CreateNationalPurchasePayload = {
      supplierDocNumber: supplierDocNumber.trim(),
      supplierName: supplierName.trim(),
      documentTypeCode,
      documentSerial: documentSerial.trim().toUpperCase(),
      documentNumber: documentNumber.trim(),
      issueDate,
      warehouseCode,
      notes: notes.trim() || undefined,
      items: items.map((it) => ({
        sku: it.sku.trim().toUpperCase(),
        quantity: Number(it.quantity),
        unitCost: Number(it.unitCost),
      })),
    };

    setIsSubmitting(true);
    try {
      await inventoryPurchasesApi.createPurchase(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Error al registrar la compra nacional.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Registrar Factura de Compra Nacional (Operación 02)
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Ingreso al Kardex con costo promedio ponderado, crédito fiscal de IGV (18%) y cuenta por pagar.
          </p>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Datos del Proveedor */}
          <div className="bg-muted/40 p-3 rounded-lg border space-y-2">
            <h3 className="font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              Proveedor Nacional
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-muted-foreground uppercase">
                  RUC del Proveedor *
                </label>
                <Input
                  placeholder="ej: 20123456789"
                  maxLength={11}
                  value={supplierDocNumber}
                  onChange={(e) => setSupplierDocNumber(e.target.value)}
                  className="mt-1 h-8 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase">
                  Razón Social *
                </label>
                <Input
                  placeholder="ej: Ferretería Industrial del Centro S.A.C."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase"
                  required
                />
              </div>
            </div>
          </div>

          {/* Datos del Comprobante */}
          <div className="bg-muted/40 p-3 rounded-lg border space-y-2">
            <h3 className="font-semibold text-foreground flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-primary" />
              Comprobante de Pago y Destino
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-medium text-muted-foreground uppercase">Tipo Doc. *</label>
                <select
                  value={documentTypeCode}
                  onChange={(e) => setDocumentTypeCode(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="01">01 - Factura</option>
                  <option value="03">03 - Boleta</option>
                </select>
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase">Serie *</label>
                <Input
                  placeholder="ej: F001"
                  value={documentSerial}
                  onChange={(e) => setDocumentSerial(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase font-mono"
                  required
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase">Número *</label>
                <Input
                  placeholder="ej: 0012345"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="mt-1 h-8 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase">
                  Almacén Destino *
                </label>
                <select
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1 font-semibold"
                >
                  <option value="ALM-01">ALM-01 — Principal</option>
                  <option value="ALM-02">ALM-02 — Obra</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="font-medium text-muted-foreground uppercase flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Fecha de Emisión *
                </label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="mt-1 h-8 text-xs"
                  required
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase">Observaciones</label>
                <Input
                  placeholder="Glosa o referencia de la compra"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Detalle de Productos */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Productos / Ítems Recibidos</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Ítem
              </Button>
            </div>

            <div className="border rounded-md overflow-x-auto bg-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/60 text-muted-foreground uppercase">
                    <th className="p-2 w-36">Código SKU *</th>
                    <th className="p-2 w-28">Cantidad *</th>
                    <th className="p-2 w-36">Costo Unit. Neto (S/) *</th>
                    <th className="p-2 w-32 text-right">Subtotal (S/)</th>
                    <th className="p-2 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((row, idx) => {
                    const rowSubtotal = (Number(row.quantity) || 0) * (Number(row.unitCost) || 0);
                    return (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2">
                          <Input
                            placeholder="ej: CEM-001"
                            value={row.sku}
                            onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                            className="h-7 text-xs uppercase font-mono"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="any"
                            min="0.0001"
                            value={row.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            className="h-7 text-xs font-semibold"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.unitCost}
                            onChange={(e) =>
                              handleItemChange(idx, 'unitCost', parseFloat(e.target.value) || 0)
                            }
                            className="h-7 text-xs font-mono"
                            required
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-medium">
                          S/ {rowSubtotal.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen Fiscal / Contable */}
          <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Tratamiento Tributario:</span> Entrada valorizada al costo neto (Kardex). IGV (18%) registrado para Crédito Fiscal.
            </div>
            <div className="w-full sm:w-auto text-right space-y-1 font-mono text-xs">
              <div className="flex justify-between sm:justify-end gap-6 text-muted-foreground">
                <span>Base Imponible (Neto):</span>
                <span>S/ {netAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-6 text-muted-foreground">
                <span>IGV Crédito Fiscal (18%):</span>
                <span>S/ {igvAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-6 text-sm font-bold text-foreground border-t pt-1">
                <span>Total a Pagar (CxP):</span>
                <span className="text-primary">S/ {totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando compra...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Asentar Compra Nacional
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

