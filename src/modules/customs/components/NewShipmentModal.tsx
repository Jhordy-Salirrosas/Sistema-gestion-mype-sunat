import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shipmentSchema, type ShipmentFormData } from '../validators';
import { CUSTOMS_OFFICES, getStoredCountries, getStoredSuppliers, type CountryItem } from '../services/catalogsApi';
import { SupplierSelector } from './SupplierSelector';
import { CountrySelector } from './CountrySelector';
import { FALLBACK_CURRENCIES, FALLBACK_INCOTERMS } from '../lib/customsConstants';
import { masterDataApi } from '../services/masterDataApi';
import { type ForeignSupplierSummary } from '../types';
import { Globe, Ship } from 'lucide-react';

interface NewShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ShipmentFormData) => Promise<unknown>;
}

const numeroExpedienteInicial = (): string =>
  `EXP-2026-${Math.floor(10000 + Math.random() * 90000)}`;

export const NewShipmentModal: React.FC<NewShipmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [suppliers, setSuppliers] = useState<ForeignSupplierSummary[]>(getStoredSuppliers());
  const [countries, setCountries] = useState<CountryItem[]>(getStoredCountries());

  // Catálogos configurables: si la API no responde, se usa el respaldo local.
  const incotermsQuery = useQuery({
    queryKey: ['master-data', 'incoterms'],
    queryFn: masterDataApi.getIncoterms,
    staleTime: 1000 * 60 * 10,
    retry: 0,
  });
  const currenciesQuery = useQuery({
    queryKey: ['master-data', 'currencies'],
    queryFn: masterDataApi.getCurrencies,
    staleTime: 1000 * 60 * 10,
    retry: 0,
  });
  const incotermOptions =
    incotermsQuery.data && incotermsQuery.data.length > 0
      ? incotermsQuery.data
      : FALLBACK_INCOTERMS;
  const currencyOptions =
    currenciesQuery.data && currenciesQuery.data.length > 0
      ? currenciesQuery.data
      : FALLBACK_CURRENCIES;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      shipment_number: numeroExpedienteInicial(),
      supplier_id: suppliers[0]?.id || 'a0000000-0000-0000-0000-000000000001',
      order_reference: '',
      incoterm: 'FOB',
      currency_code: 'USD',
      transport_mode: 'MARITIMO',
      origin_country_code: 'CN',
      destination_customs: '118',
      etd_date: '',
      eta_date: '',
    },
  });

  const selectedSupplierId = watch('supplier_id');

  useEffect(() => {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (supplier?.country_code) setValue('origin_country_code', supplier.country_code);
  }, [selectedSupplierId, suppliers, setValue]);

  const handleFormSubmit = async (data: ShipmentFormData) => {
    await onSubmit(data);
    reset({ ...data, shipment_number: numeroExpedienteInicial() });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-w-[95vw] p-6 text-xs max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-primary">
            <Ship className="h-5 w-5" />
            Registrar Embarque Internacional y Documento de Transporte (BL / Guía Aérea)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Vinculación del medio de transporte, naviera/aerolínea, conocimiento de embarque y fechas estimadas de travesía (ETD / ETA).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          {/* Bloque 1: Datos Comerciales */}
          <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/50">
              <Globe className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-foreground uppercase tracking-wide text-[11px]">
                1. Datos Comerciales de Compra
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">N° Expediente *</label>
                <Input {...register('shipment_number')} className="h-8 text-xs font-mono font-semibold" />
                {errors.shipment_number && (
                  <p className="text-[11px] text-red-500 mt-0.5">{errors.shipment_number.message}</p>
                )}
              </div>

              <SupplierSelector
                suppliers={suppliers}
                onSuppliersChange={setSuppliers}
                selectedSupplierId={selectedSupplierId}
                onSelectSupplier={(id) => setValue('supplier_id', id, { shouldValidate: true })}
                countryCode={watch('origin_country_code')}
                errorMessage={errors.supplier_id?.message}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Incoterm (ICC 2020)</label>
                <select
                  {...register('incoterm')}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium"
                >
                  {incotermOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} — {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Moneda</label>
                <select
                  {...register('currency_code')}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium"
                >
                  {currencyOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} ({item.symbol}) — {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Referencia Comercial / O.C.</label>
                <Input {...register('order_reference')} placeholder="PO-2026-88: 100 Laptops" className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Bloque 2: Logística y Aduana */}
          <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/50">
              <Ship className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-foreground uppercase tracking-wide text-[11px]">
                2. Logística y Despacho Aduanero
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Vía de Transporte</label>
                <select
                  {...register('transport_mode')}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium"
                >
                  <option value="MARITIMO">Marítimo (Buque)</option>
                  <option value="AEREO">Aéreo (Vuelo)</option>
                  <option value="TERRESTRE">Terrestre</option>
                  <option value="FLUVIAL">Fluvial</option>
                </select>
              </div>

              <CountrySelector
                countries={countries}
                onCountriesChange={setCountries}
                selectedCountryCode={watch('origin_country_code')}
                onSelectCountry={(code) => setValue('origin_country_code', code, { shouldValidate: true })}
                errorMessage={errors.origin_country_code?.message}
              />

              <div>
                <label className="font-medium text-foreground block mb-1">Aduana de Ingreso</label>
                <select
                  {...register('destination_customs')}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium"
                >
                  {CUSTOMS_OFFICES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="font-medium text-foreground block mb-1">Fecha Salida (ETD)</label>
                <Input type="date" {...register('etd_date')} className="h-8 text-xs font-mono" />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Fecha Arribo (ETA)</label>
                <Input type="date" {...register('eta_date')} className="h-8 text-xs font-mono" />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs font-semibold px-4">
              {isSubmitting ? 'Aperturando Expediente...' : 'Crear Expediente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
