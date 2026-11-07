import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type ForeignSupplierSummary } from '../types';
import { saveStoredSupplier } from '../services/catalogsApi';
import { Check } from 'lucide-react';

interface SupplierSelectorProps {
  suppliers: ForeignSupplierSummary[];
  onSuppliersChange: (updated: ForeignSupplierSummary[]) => void;
  selectedSupplierId: string;
  onSelectSupplier: (id: string) => void;
  countryCode?: string;
  errorMessage?: string;
}

const generateUuid = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16)
      );

export const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  suppliers,
  onSuppliersChange,
  selectedSupplierId,
  onSelectSupplier,
  countryCode = 'CN',
  errorMessage,
}) => {
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierTaxId, setNewSupplierTaxId] = useState('');

  const handleQuickSaveSupplier = () => {
    const trimmed = newSupplierName.trim();
    if (trimmed.length < 2) return;
    const newSup: ForeignSupplierSummary = {
      id: generateUuid(),
      business_name: trimmed,
      country_code: countryCode,
      tax_id: newSupplierTaxId.trim() || 'EXT-TAXID',
    };
    const updated = saveStoredSupplier(newSup);
    onSuppliersChange(updated);
    onSelectSupplier(newSup.id);
    setIsAddingSupplier(false);
    setNewSupplierName('');
    setNewSupplierTaxId('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-foreground block">
          Proveedor del Exterior <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => setIsAddingSupplier(!isAddingSupplier)}
          className="text-[10px] text-primary hover:underline font-semibold"
        >
          {isAddingSupplier ? '✕ Cancelar' : '+ Nuevo Proveedor'}
        </button>
      </div>

      {isAddingSupplier ? (
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Razón Social exterior..."
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            className="h-8 text-xs flex-1"
            autoFocus
          />
          <Input
            placeholder="Tax ID..."
            value={newSupplierTaxId}
            onChange={(e) => setNewSupplierTaxId(e.target.value)}
            className="h-8 text-xs w-24 font-mono"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleQuickSaveSupplier}
            className="h-8 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            title="Guardar proveedor y dejarlo seleccionado"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <select
          value={selectedSupplierId}
          onChange={(e) => onSelectSupplier(e.target.value)}
          className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium"
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.business_name} ({s.tax_id})
            </option>
          ))}
        </select>
      )}
      {errorMessage && <p className="text-[11px] text-red-500 mt-0.5">{errorMessage}</p>}
    </div>
  );
};

