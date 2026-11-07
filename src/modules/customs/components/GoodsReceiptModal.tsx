import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  goodsReceiptSchema,
  type GoodsReceiptFormData,
} from '../validators/goodsReceiptSchema';
import { goodsReceiptApi } from '../services/goodsReceiptApi';
import { GoodsReceiptItemsTable } from './GoodsReceiptItemsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  declarationId: string;
  shipmentId?: string;
  initialItems: Array<{
    id?: string;
    productCode: string;
    commercialDescription: string;
    quantity: number;
    unitCode?: string;
    destinationType?: 'MERCADERIA' | 'ACTIVO_FIJO';
  }>;
  onSuccess?: () => void;
}

export const GoodsReceiptModal: React.FC<GoodsReceiptModalProps> = ({
  isOpen,
  onClose,
  declarationId,
  shipmentId,
  initialItems,
  onSuccess,
}) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GoodsReceiptFormData>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: {
      receiptNumber: `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      declarationId,
      shipmentId,
      warehouseCode: 'ALM-01',
      receptionType: 'TOTAL',
      responsibleName: '',
      responsibleDni: '',
      containerNumber: '',
      sealNumber: '',
      items: initialItems.map((item) => ({
        customsItemId: item.id,
        productCode: item.productCode,
        commercialDescription: item.commercialDescription,
        declaredQuantity: item.quantity,
        receivedQuantity: item.quantity,
        damagedQuantity: 0,
        unitCode: item.unitCode ?? 'NIU',
        destinationType: item.destinationType ?? 'MERCADERIA',
      })),
    },
  });

  const { fields } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items') || [];

  const hasDiscrepancy = watchedItems.some(
    (it) => it.receivedQuantity !== it.declaredQuantity || (it.damagedQuantity || 0) > 0,
  );

  if (!isOpen) return null;

  const onSubmit = async (data: GoodsReceiptFormData) => {
    try {
      setIsSubmitting(true);
      setServerError(null);
      await goodsReceiptApi.confirmReceipt({
        ...data,
        items: data.items.map((it) => ({
          ...it,
          destinationType: it.destinationType ?? 'MERCADERIA',
        })),
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setServerError(
        err.response?.data?.message || err.message || 'Error al confirmar la recepción física.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <h2 className="text-xl font-bold">Acta de Recepción Física en Rampa / Almacén</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">N° de Acta Oficial</label>
              <Input {...register('receiptNumber')} className="bg-slate-800 text-slate-100" />
              {errors.receiptNumber && (
                <span className="text-xs text-rose-400">{errors.receiptNumber.message}</span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">Almacén Receptor</label>
              <Input {...register('warehouseCode')} className="bg-slate-800 text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">Tipo de Recepción</label>
              <select
                {...register('receptionType')}
                className="w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-sm text-slate-100"
              >
                <option value="TOTAL">TOTAL (Carga Completa)</option>
                <option value="PARCIAL">PARCIAL (Despacho Parcial)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-slate-300">Responsable de Recepción</label>
              <Input
                {...register('responsibleName')}
                placeholder="Nombre del inspector o almacenero"
                className="bg-slate-800 text-slate-100"
              />
              {errors.responsibleName && (
                <span className="text-xs text-rose-400">{errors.responsibleName.message}</span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">DNI Responsable</label>
              <Input
                {...register('responsibleDni')}
                placeholder="8 dígitos"
                maxLength={8}
                className="bg-slate-800 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">N° Precinto Aduanero</label>
              <Input
                {...register('sealNumber')}
                placeholder="N° Precinto SUNAT"
                className="bg-slate-800 text-slate-100"
              />
            </div>
          </div>

          <GoodsReceiptItemsTable
            fields={fields as any}
            watchedItems={watchedItems}
            register={register}
          />

          {hasDiscrepancy ? (
            <Alert className="border-amber-500/50 bg-amber-950/30 text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertTitle>Discrepancias Detectadas</AlertTitle>
              <AlertDescription className="text-xs">
                Se detectaron diferencias o averías físicas. El acta se emitirá como CON_DISCREPANCIA
                para el reclamo aduanero o de seguro.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-500/50 bg-emerald-950/30 text-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <AlertTitle>Carga Conforme</AlertTitle>
              <AlertDescription className="text-xs">
                Cantidades verificadas al 100%. Listas para liquidación de costos e ingreso a inventario.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500">
              {isSubmitting ? 'Firmando Acta...' : 'Firmar y Confirmar Recepción'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
