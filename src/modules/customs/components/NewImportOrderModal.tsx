import React, { useState, useEffect } from 'react';
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
  Ship,
  Plus,
  Trash2,
  DollarSign,
  Loader2,
  AlertCircle,
  Building2,
  Anchor,
  ShieldAlert,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import {
  importOrdersApi,
  type CreateImportOrderPayload,
} from '../services/importOrdersApi';
import { masterDataApi, type BusinessPartnerRecord } from '../services/masterDataApi';

interface OrderItemRow {
  productCode: string;
  description: string;
  hsCode: string;
  quantity: number;
  unitPriceFob: number;
}

interface NewImportOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const INCOTERMS = ['FOB', 'CIF', 'CFR', 'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

export const NewImportOrderModal: React.FC<NewImportOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCountry, setSupplierCountry] = useState('CN');
  const [supplierTaxId, setSupplierTaxId] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierCondition, setSupplierCondition] = useState('FABRICANTE');
  const [isRelated, setIsRelated] = useState(false);
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [incoterm, setIncoterm] = useState('FOB');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [transportMode, setTransportMode] = useState('MARITIMO');
  const [portOfOrigin, setPortOfOrigin] = useState('');
  const [portOfDestination, setPortOfDestination] = useState('CALLAO');
  const [estimatedFreight, setEstimatedFreight] = useState(0);
  const [estimatedInsurance, setEstimatedInsurance] = useState(0);
  const [proformaNumber, setProformaNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItemRow[]>([
    { productCode: '', description: '', hsCode: '', quantity: 10, unitPriceFob: 0 },
  ]);

  const [registeredSuppliers, setRegisteredSuppliers] = useState<BusinessPartnerRecord[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('MANUAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [registeredCurrencies, setRegisteredCurrencies] = useState<string[]>(['USD', 'EUR', 'PEN', 'CNY', 'GBP', 'JPY']);
  const [partnerBankInfo, setPartnerBankInfo] = useState<{ swift?: string; iban?: string; bank_name?: string } | null>(null);

  // Cargar catálogo de proveedores registrados y monedas
  useEffect(() => {
    if (isOpen) {
      masterDataApi
        .getPartners({ role: 'PROVEEDOR' })
        .then((data) => setRegisteredSuppliers(data || []))
        .catch(() => setRegisteredSuppliers([]));

      masterDataApi
        .getCurrencies()
        .then((currs) => {
          if (currs && currs.length > 0) {
            setRegisteredCurrencies(currs.filter((c) => c.is_active).map((c) => c.code));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    if (partnerId === 'MANUAL') {
      setPartnerBankInfo(null);
      return;
    }
    const found = registeredSuppliers.find((p) => p.id === partnerId);
    if (found) {
      setSupplierName(found.legal_name);
      setSupplierCountry(found.country_code || 'CN');
      setSupplierTaxId(found.doc_number || '');
      setSupplierAddress(found.address || '');
      setSupplierEmail(found.email || '');
      setSupplierPhone(found.phone || '');
      if (found.currency_code) {
        setCurrencyCode(found.currency_code);
      }
      // Cargar cuenta bancaria del proveedor si existe
      masterDataApi
        .getPartner(found.id)
        .then((detail) => {
          if (detail.bank_accounts && detail.bank_accounts.length > 0) {
            const defBank = detail.bank_accounts.find((b) => b.is_default) || detail.bank_accounts[0];
            setPartnerBankInfo({
              swift: defBank.swift || undefined,
              iban: defBank.iban || defBank.account_number || undefined,
              bank_name: defBank.bank_name,
            });
          } else {
            setPartnerBankInfo(null);
          }
        })
        .catch(() => setPartnerBankInfo(null));
    }
  };

  // Cálculos en vivo
  const totalFob = items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPriceFob) || 0),
    0
  );
  const totalCif = totalFob + (Number(estimatedFreight) || 0) + (Number(estimatedInsurance) || 0);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { productCode: '', description: '', hsCode: '', quantity: 1, unitPriceFob: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItemRow, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierName.trim()) {
      setErrorMessage('La razón social del proveedor del exterior es obligatoria.');
      return;
    }

    const invalidItem = items.find((it) => !it.description.trim() || it.quantity <= 0);
    if (invalidItem) {
      setErrorMessage('Todos los ítems deben tener descripción válida y cantidad > 0.');
      return;
    }

    const payload: CreateImportOrderPayload = {
      orderNumber: orderNumber.trim() || undefined,
      supplierName: supplierName.trim(),
      supplierCountry,
      supplierTaxId: supplierTaxId.trim() || undefined,
      supplierAddress: supplierAddress.trim() || undefined,
      supplierCondition,
      isRelated,
      supplierEmail: supplierEmail.trim() || undefined,
      supplierPhone: supplierPhone.trim() || undefined,
      incoterm,
      currencyCode,
      transportMode,
      portOfOrigin: portOfOrigin.trim() || undefined,
      portOfDestination: portOfDestination.trim() || 'CALLAO',
      estimatedFreight: Number(estimatedFreight) || 0,
      estimatedInsurance: Number(estimatedInsurance) || 0,
      proformaNumber: proformaNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      responsible: 'Operador Comercio Exterior',
      items: items.map((it) => ({
        productCode: it.productCode.trim() || undefined,
        description: it.description.trim(),
        hsCode: it.hsCode.trim() || undefined,
        quantity: Number(it.quantity),
        unitPriceFob: Number(it.unitPriceFob),
      })),
    };

    setIsSubmitting(true);
    try {
      await importOrdersApi.createOrder(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Error al emitir la orden de importación.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Ship className="h-5 w-5 text-primary" />
            Nueva Orden de Compra Internacional
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Emisión de pedido al exterior conforme a Incoterms 2020 (CCI) y normativa de Valoración Aduanera SUNAT (Acuerdo de Valor OMC).
          </p>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Proveedor y Origen */}
          <div className="bg-muted/40 p-3.5 rounded-lg border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Building2 className="h-4 w-4 text-primary" />
                Proveedor y Origen (Formato B SUNAT / Casillas 3.1 - 3.9)
              </h3>
              {registeredSuppliers.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">Cargar del Catálogo:</span>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => handleSelectPartner(e.target.value)}
                    className="h-7 text-xs bg-background border rounded px-2 font-medium"
                  >
                    <option value="MANUAL">+ Escribir / Registrar nuevo</option>
                    {registeredSuppliers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.legal_name} ({p.country_code} - {p.doc_number || 'S/N'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Fila 1: Razón Social, Tax ID, País, N° OC */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  Proveedor Extranjero (Razón Social) *
                </label>
                <Input
                  placeholder="ej: SHENZHEN TECH ELECTRONICS CO., LTD."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase font-medium"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  Tax ID / TIN Exterior
                </label>
                <Input
                  placeholder="ej: USCI-91440300MA5"
                  value={supplierTaxId}
                  onChange={(e) => setSupplierTaxId(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  País de Origen *
                </label>
                <select
                  value={supplierCountry}
                  onChange={(e) => setSupplierCountry(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="CN">China (CN)</option>
                  <option value="US">Estados Unidos (US)</option>
                  <option value="DE">Alemania (DE)</option>
                  <option value="JP">Japón (JP)</option>
                  <option value="KR">Corea del Sur (KR)</option>
                  <option value="BR">Brasil (BR)</option>
                  <option value="IT">Italia (IT)</option>
                  <option value="ES">España (ES)</option>
                  <option value="MX">México (MX)</option>
                  <option value="IN">India (IN)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  N° OC (Opcional)
                </label>
                <Input
                  placeholder="Auto-correlativo"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase font-mono"
                />
              </div>
            </div>

            {/* Fila 2: Dirección en el exterior, Condición SUNAT, Vinculación Económica OMC */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-5">
                <label className="font-medium text-muted-foreground uppercase text-[10px] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  Domicilio / Ciudad en el Exterior
                </label>
                <Input
                  placeholder="ej: High-Tech Industrial Park, Nanshan, Shenzhen"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  Condición Proveedor (Casilla 3.2)
                </label>
                <select
                  value={supplierCondition}
                  onChange={(e) => setSupplierCondition(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1 font-medium"
                >
                  <option value="FABRICANTE">Fabricante / Productor</option>
                  <option value="DISTRIBUIDOR">Distribuidor Oficial</option>
                  <option value="COMERCIANTE">Comerciante / Dealer</option>
                  <option value="BROKER">Intermediario / Broker</option>
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="font-medium text-muted-foreground uppercase text-[10px] flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3 text-amber-500" />
                  Vinculación Económica (Art. 24 OMC)
                </label>
                <select
                  value={isRelated ? 'SI' : 'NO'}
                  onChange={(e) => setIsRelated(e.target.value === 'SI')}
                  className={`w-full h-8 rounded-md border border-input px-2 text-xs mt-1 font-medium ${
                    isRelated ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold' : 'bg-background'
                  }`}
                >
                  <option value="NO">No Vinculado (Partes Independientes)</option>
                  <option value="SI">Sí Vinculado (Filial / Matriz / Control)</option>
                </select>
              </div>
            </div>

            {/* Fila 3: Contacto (Email, Teléfono) y Banco Internacional */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-4">
                <label className="font-medium text-muted-foreground uppercase text-[10px] flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  Email de Contacto Comercial
                </label>
                <Input
                  type="email"
                  placeholder="sales@shenzhen-tech.cn"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="font-medium text-muted-foreground uppercase text-[10px] flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  Teléfono / WhatsApp
                </label>
                <Input
                  placeholder="+86 755 8888 9999"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="font-medium text-muted-foreground uppercase text-[10px] flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-emerald-500" />
                  Banco Exterior (SWIFT / IBAN)
                </label>
                <div className="mt-1 h-8 px-2 rounded-md border bg-muted/60 flex items-center text-[11px] font-mono truncate">
                  {partnerBankInfo ? (
                    <span className="text-emerald-500 font-semibold truncate" title={`${partnerBankInfo.bank_name} - SWIFT: ${partnerBankInfo.swift}`}>
                      SWIFT: {partnerBankInfo.swift || 'N/A'} · {partnerBankInfo.iban || ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Giro bancario directo</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Negociación & Logística */}
          <div className="bg-muted/40 p-3.5 rounded-lg border space-y-2">
            <h3 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Anchor className="h-4 w-4 text-primary" />
              Términos de Negociación (Incoterms 2020) y Flete
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Incoterm *</label>
                <select
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1 font-semibold"
                >
                  {INCOTERMS.map((inc) => (
                    <option key={inc} value={inc}>
                      {inc} 2020
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Moneda *</label>
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1 font-mono font-semibold"
                >
                  {registeredCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Transporte *</label>
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="MARITIMO">Marítimo</option>
                  <option value="AEREO">Aéreo</option>
                  <option value="TERRESTRE">Terrestre</option>
                </select>
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Puerto Origen</label>
                <Input
                  placeholder="ej: Shanghai, Ningbo"
                  value={portOfOrigin}
                  onChange={(e) => setPortOfOrigin(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase"
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Puerto Destino</label>
                <Input
                  value={portOfDestination}
                  onChange={(e) => setPortOfDestination(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Flete Estimado ({currencyCode})</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedFreight}
                  onChange={(e) => setEstimatedFreight(parseFloat(e.target.value) || 0)}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Seguro Estimado ({currencyCode})</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedInsurance}
                  onChange={(e) => setEstimatedInsurance(parseFloat(e.target.value) || 0)}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">N° Proforma</label>
                <Input
                  placeholder="ej: PI-2026-99"
                  value={proformaNumber}
                  onChange={(e) => setProformaNumber(e.target.value)}
                  className="mt-1 h-8 text-xs uppercase font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">Observaciones</label>
                <Input
                  placeholder="Términos de entrega, notas..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Mercancías */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground text-xs">Mercancías y Precios Unitarios FOB</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Producto
              </Button>
            </div>

            <div className="border rounded-md overflow-x-auto bg-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/60 text-muted-foreground uppercase text-[10px]">
                    <th className="p-2 w-28">Código / SKU</th>
                    <th className="p-2">Descripción Arancelaria *</th>
                    <th className="p-2 w-32">Partida (SPN)</th>
                    <th className="p-2 w-24 text-right">Cantidad *</th>
                    <th className="p-2 w-28 text-right">P. Unit FOB *</th>
                    <th className="p-2 w-28 text-right">Total FOB</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, idx) => {
                    const lineFob = (Number(it.quantity) || 0) * (Number(it.unitPriceFob) || 0);
                    return (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2">
                          <Input
                            placeholder="SKU-001"
                            value={it.productCode}
                            onChange={(e) => handleItemChange(idx, 'productCode', e.target.value)}
                            className="h-7 text-xs font-mono uppercase"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="Descripción comercial y técnica..."
                            value={it.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="h-7 text-xs"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="8517.13.00.00"
                            value={it.hsCode}
                            onChange={(e) => handleItemChange(idx, 'hsCode', e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="h-7 text-xs text-right font-mono"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.unitPriceFob}
                            onChange={(e) => handleItemChange(idx, 'unitPriceFob', e.target.value)}
                            className="h-7 text-xs text-right font-mono"
                            required
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {currencyCode} {lineFob.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
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

          {/* Resumen Totalizador */}
          <div className="bg-muted p-3.5 rounded-lg border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5 text-muted-foreground text-[11px]">
              <div>Total Ítems: <span className="font-bold text-foreground">{items.length}</span></div>
              <div>Moneda de la Operación: <span className="font-bold text-foreground">{currencyCode}</span></div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Total FOB</span>
                <span className="font-mono font-bold text-sm">
                  {currencyCode} {totalFob.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Flete + Seguro</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {currencyCode} {(Number(estimatedFreight) + Number(estimatedInsurance)).toFixed(2)}
                </span>
              </div>
              <div className="pl-3 border-l">
                <span className="text-[10px] text-primary uppercase font-bold block">Valor CIF Estimado</span>
                <span className="font-mono font-extrabold text-base text-primary">
                  {currencyCode} {totalCif.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5 bg-primary">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Emitiendo Orden...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4" />
                  Emitir Orden de Importación
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
