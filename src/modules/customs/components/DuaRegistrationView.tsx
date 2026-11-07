import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DuaGeneralDataBlock } from './DuaGeneralDataBlock';
import { DuaGlobalValuesBlock } from './DuaGlobalValuesBlock';
import { DuaItemsGridBlock } from './DuaItemsGridBlock';
import { DuaRealtimeSummaryCard } from './DuaRealtimeSummaryCard';
import { useRegisterDeclaration } from '../hooks/useRegisterDeclaration';
import { INITIAL_DUA_FORM, DEMO_SUNAT_FORM } from '../lib/customsConstants';
import { type RegisterDuaItemPayload, type RegisterDuaPayload } from '../types/customs.types';
import { ArrowLeft, Sparkles, AlertTriangle } from 'lucide-react';

import { extractApiErrorMessage } from '@/lib/apiErrors';

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

export const DuaRegistrationView = ({ onBack, onSuccess }: Props) => {
  const [form, setForm] = useState<RegisterDuaPayload>(INITIAL_DUA_FORM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const registerMutation = useRegisterDeclaration();

  const handleFieldChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemAdd = () => {
    const newItem: RegisterDuaItemPayload = {
      item_order: form.items.length + 1,
      item_code: '',
      hs_code: '',
      commercial_description: '',
      quantity: 1,
      unit_code: 'NIU',
      fob_unit_usd: 0,
    };
    setForm((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const handleItemRemove = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, item_order: i + 1 })),
    }));
  };

  const handleItemUpdate = (idx: number, field: keyof RegisterDuaItemPayload, val: string | number) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[idx] = { ...nextItems[idx], [field]: val };
      return { ...prev, items: nextItems };
    });
  };

  const sumFobItems = form.items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.fob_unit_usd) || 0),
    0
  );
  const isBalanced = Math.abs(form.fob_value_usd - sumFobItems) <= 0.05 && form.fob_value_usd > 0;

  const handleSubmit = async () => {
    if (!isBalanced) return;
    setErrorMsg(null);
    try {
      // Saneamiento de datos para compatibilidad estricta con DTOs de SUNAT
      const sanitizedPayload: RegisterDuaPayload = {
        ...form,
        customs_agency_code: form.customs_agency_code.slice(0, 3).trim(),
        items: form.items.map((it) => ({
          ...it,
          hs_code: it.hs_code.replace(/\D/g, ''),
        })),
      };
      await registerMutation.mutateAsync(sanitizedPayload);
      onSuccess();
    } catch (err: unknown) {
      setErrorMsg(extractApiErrorMessage(err, 'Error al registrar la DAM ante SUNAT'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" />
            Volver al Historial
          </Button>
          <span className="text-muted-foreground">|</span>
          <h2 className="text-base font-bold tracking-tight">Registro de Declaración Aduanera (DAM)</h2>
        </div>
        <Button
          onClick={() => { setForm(DEMO_SUNAT_FORM); setErrorMsg(null); }}
          variant="outline"
          size="sm"
          className="border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 gap-1.5 text-xs font-semibold"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          ⚡ Cargar Ejemplo Demo SUNAT
        </Button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <DuaGeneralDataBlock values={form} onChange={handleFieldChange} />
          <DuaGlobalValuesBlock values={form} onChange={handleFieldChange} />
          <DuaItemsGridBlock
            items={form.items}
            targetFob={form.fob_value_usd}
            onAddItem={handleItemAdd}
            onRemoveItem={handleItemRemove}
            onUpdateItem={handleItemUpdate}
          />
        </div>
        <div className="lg:col-span-1">
          <DuaRealtimeSummaryCard
            values={form}
            isBalanced={isBalanced}
            isSubmitting={registerMutation.isPending}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
};
