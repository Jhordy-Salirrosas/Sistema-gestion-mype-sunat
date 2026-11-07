import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type ProductFormData } from '../validators/productSchema';
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
import { Loader2, PlusCircle, AlertCircle, Edit2, Package, Scale, Globe } from 'lucide-react';
import { type InventoryBalance } from '../types/inventory.types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: InventoryBalance | null;
  mode?: 'create' | 'edit';
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  mode = 'create',
}) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = mode === 'edit' && Boolean(initialData);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      description: '',
      brand: '',
      model: '',
      category: '',
      barcode: '',
      hs_code: '',
      weight_kg: undefined,
      volume_m3: undefined,
      sunat_type_code: '01',
      sunat_unit_code: 'NIU',
      tax_affectation: '10',
      min_stock_alert: 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      if (isEdit && initialData) {
        setValue('sku', initialData.sku);
        setValue('description', initialData.description);
        setValue('brand', initialData.brand || '');
        setValue('model', initialData.model || '');
        setValue('category', initialData.category || '');
        setValue('barcode', initialData.barcode || '');
        setValue('hs_code', initialData.hsCode || '');
        setValue('weight_kg', initialData.weightKg ?? undefined);
        setValue('volume_m3', initialData.volumeM3 ?? undefined);
        setValue('sunat_type_code', initialData.sunatTypeCode || '01');
        setValue('sunat_unit_code', initialData.sunatUnitCode || 'NIU');
        setValue('min_stock_alert', initialData.minStockAlert ?? 0);
      } else {
        reset({
          sku: '',
          description: '',
          brand: '',
          model: '',
          category: '',
          barcode: '',
          hs_code: '',
          weight_kg: undefined,
          volume_m3: undefined,
          sunat_type_code: '01',
          sunat_unit_code: 'NIU',
          tax_affectation: '10',
          min_stock_alert: 0,
        });
      }
    }
  }, [isOpen, isEdit, initialData, setValue, reset]);

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      if (isEdit && initialData) {
        await inventoryApi.updateProduct(initialData.sku, data);
      } else {
        await inventoryApi.registerProduct(data);
      }
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setServerError(err.response?.data?.message || err.message || 'Error al guardar producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            {isEdit ? (
              <>
                <Edit2 className="h-5 w-5 text-primary" />
                Editar Ficha Técnica de Producto ({initialData?.sku})
              </>
            ) : (
              <>
                <PlusCircle className="h-5 w-5 text-primary" />
                Nuevo Producto en Catálogo e Inventario
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive" className="text-xs">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1 text-xs">
          {/* SECCIÓN 1: Identificación y Datos Comerciales */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
              <Package className="h-3.5 w-3.5 text-primary" />
              1. Identificación y Descripción Comercial
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Código SKU Único *
                </label>
                <Input
                  placeholder="ej: PROD-LAP-001"
                  disabled={isEdit}
                  {...register('sku')}
                  className="mt-1 uppercase font-mono font-bold"
                />
                {errors.sku && <p className="text-[10px] text-destructive mt-0.5">{errors.sku.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Descripción Comercial Oficial *
                </label>
                <Input
                  placeholder="ej: Laptop Gamer ASUS ROG Strix Core i7 16GB RAM 512GB SSD"
                  {...register('description')}
                  className="mt-1"
                />
                {errors.description && (
                  <p className="text-[10px] text-destructive mt-0.5">{errors.description.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Marca
                </label>
                <Input placeholder="ej: ASUS" {...register('brand')} className="mt-1" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Modelo
                </label>
                <Input placeholder="ej: ROG G15" {...register('model')} className="mt-1" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Categoría
                </label>
                <Input placeholder="ej: Informática / Cómputo" {...register('category')} className="mt-1" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Código de Barras (EAN / QR)
                </label>
                <Input placeholder="ej: 7751234567890" {...register('barcode')} className="mt-1 font-mono" />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Logística y Comercio Exterior */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              2. Datos Logísticos y Comercio Exterior (Importaciones)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Partida Arancelaria (SPN / HS Code)
                </label>
                <Input
                  placeholder="ej: 8471.30.00.00"
                  {...register('hs_code')}
                  className="mt-1 font-mono"
                />
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  10 dígitos para DUA/DAM de importación
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Peso Unitario Bruto (kg)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="ej: 2.80"
                  {...register('weight_kg', { valueAsNumber: true })}
                  className="mt-1 font-mono"
                />
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Usado para prorrateo de fletes/almacenaje
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Volumen Unitario (m³)
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="ej: 0.0150"
                  {...register('volume_m3', { valueAsNumber: true })}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Clasificación Tributaria SUNAT y Parámetros */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
              <Scale className="h-3.5 w-3.5 text-emerald-500" />
              3. Clasificación SUNAT y Control de Existencias
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Tipo Existencia (Tabla 5)
                </label>
                <select
                  {...register('sunat_type_code')}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="01">01 - Mercaderías</option>
                  <option value="02">02 - Prod. Terminados</option>
                  <option value="03">03 - Materias Primas</option>
                  <option value="04">04 - Envases / Embalajes</option>
                  <option value="07">07 - Repuestos</option>
                  <option value="99">99 - Otros</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Unidad de Medida (Tabla 6)
                </label>
                <select
                  {...register('sunat_unit_code')}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="NIU">NIU - Unidades</option>
                  <option value="KGM">KGM - Kilogramos</option>
                  <option value="LTR">LTR - Litros</option>
                  <option value="MTR">MTR - Metros</option>
                  <option value="BX">BX - Cajas</option>
                  <option value="PK">PK - Paquetes</option>
                  <option value="SET">SET - Juegos / Sets</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Afectación IGV
                </label>
                <select
                  {...register('tax_affectation')}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="10">10 - Gravado Operación Onerosa</option>
                  <option value="20">20 - Exonerado Operación Onerosa</option>
                  <option value="30">30 - Inafecto Operación Onerosa</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Alerta Stock Mínimo
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="ej: 10"
                  {...register('min_stock_alert', { valueAsNumber: true })}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2 font-bold">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Actualizar Ficha Técnica' : 'Guardar Producto en Catálogo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
