import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { manualMovementSchema, type ManualMovementFormData } from '../validators/manualMovementSchema';
import { inventoryApi } from '../services/inventoryApi';
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
import { Loader2, ArrowLeftRight, AlertCircle } from 'lucide-react';

interface ManualMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSku?: string;
}

export const ManualMovementModal = ({
  isOpen,
  onClose,
  onSuccess,
  defaultSku = '',
}: ManualMovementModalProps) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ManualMovementFormData>({
    resolver: zodResolver(manualMovementSchema),
    defaultValues: {
      sku: defaultSku,
      warehouse_code: 'ALM-01',
      direction: 'ENTRADA',
      operation_type_code: '02',
      quantity: 1,
      unit_cost: 0,
      document_type_code: '01',
      document_serial: '',
      document_number: '',
      notes: '',
    },
  });

  const direction = watch('direction');

  const onSubmit = async (data: ManualMovementFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await inventoryApi.createManualMovement(data);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setServerError(err.response?.data?.message || err.message || 'Error al asentar movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Registro de Movimiento Físico
          </DialogTitle>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-muted-foreground uppercase">
                Sentido de Movimiento *
              </label>
              <select
                {...register('direction')}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
              >
                <option value="ENTRADA">ENTRADA (Aumento de Stock)</option>
                <option value="SALIDA">SALIDA (Disminución de Stock)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground uppercase">
                Tipo Operación (Tabla 12) *
              </label>
              <select
                {...register('operation_type_code')}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
              >
                {direction === 'ENTRADA' ? (
                  <>
                    <option value="02">02 - Compra Nacional</option>
                    <option value="16">16 - Saldo Inicial</option>
                    <option value="28">28 - Ajuste por Inventario Físico</option>
                    <option value="24">24 - Devolución del Cliente</option>
                    <option value="99">99 - Otros Ingresos</option>
                  </>
                ) : (
                  <>
                    <option value="01">01 - Venta Nacional</option>
                    <option value="10">10 - Salida a Producción</option>
                    <option value="13">13 - Mermas</option>
                    <option value="14">14 - Desmedros</option>
                    <option value="25">25 - Devolución a Proveedor</option>
                    <option value="99">99 - Otras Salidas</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-muted-foreground uppercase">Código SKU *</label>
              <Input placeholder="ej: LAP-001" {...register('sku')} className="mt-1 uppercase text-sm" />
              {errors.sku && <p className="text-destructive mt-1">{errors.sku.message}</p>}
            </div>

            <div>
              <label className="font-semibold text-muted-foreground uppercase">Almacén Destino</label>
              <Input {...register('warehouse_code')} className="mt-1 uppercase text-sm" defaultValue="ALM-01" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-muted-foreground uppercase">Cantidad *</label>
              <Input
                type="number"
                step="any"
                {...register('quantity', { valueAsNumber: true })}
                className="mt-1 text-sm font-semibold"
              />
              {errors.quantity && <p className="text-destructive mt-1">{errors.quantity.message}</p>}
            </div>

            {direction === 'ENTRADA' ? (
              <div>
                <label className="font-semibold text-muted-foreground uppercase">
                  Costo Unitario (S/ PEN) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('unit_cost', { valueAsNumber: true })}
                  className="mt-1 text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="font-semibold text-muted-foreground uppercase">Valorización CPP</label>
                <div className="h-9 px-3 flex items-center bg-muted rounded-md text-xs text-muted-foreground mt-1">
                  Automático por Costo Promedio Móvil
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-semibold text-muted-foreground uppercase">Doc. Sustento</label>
              <select
                {...register('document_type_code')}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                <option value="01">01 - Factura</option>
                <option value="03">03 - Boleta</option>
                <option value="09">09 - Guía Remisión</option>
                <option value="50">50 - DAM (Aduana)</option>
                <option value="00">00 - Documento Interno</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-muted-foreground uppercase">Serie</label>
              <Input placeholder="ej: F001" {...register('document_serial')} className="mt-1 text-xs uppercase" />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground uppercase">Número</label>
              <Input placeholder="ej: 0012345" {...register('document_number')} className="mt-1 text-xs" />
            </div>
          </div>

          <div>
            <label className="font-semibold text-muted-foreground uppercase">Observaciones / Justificación</label>
            <Input placeholder="Motivo o referencia del asiento" {...register('notes')} className="mt-1 text-xs" />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Asentar Movimiento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

