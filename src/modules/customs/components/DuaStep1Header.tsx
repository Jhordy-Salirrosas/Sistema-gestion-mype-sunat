import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CUSTOMS_OFFICES } from '../services/catalogsApi';
import { type RegisterDuaWizardPayload } from '../types';

interface DuaStep1HeaderProps {
  data: Partial<RegisterDuaWizardPayload>;
  onChange: (partial: Partial<RegisterDuaWizardPayload>) => void;
}

export const DuaStep1Header: React.FC<DuaStep1HeaderProps> = ({ data, onChange }) => {
  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardContent className="p-4 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-semibold text-foreground block mb-1">Aduana Operativa</label>
            <select
              value={data.customs_code || '118'}
              onChange={(e) => onChange({ customs_code: e.target.value })}
              className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
            >
              {CUSTOMS_OFFICES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Año de Declaración</label>
            <Input
              type="number"
              value={data.declaration_year || 2026}
              onChange={(e) => onChange({ declaration_year: Number(e.target.value) })}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">N° Correlativo DAM (6 dígitos)</label>
            <Input
              value={data.correlative_number || ''}
              onChange={(e) => onChange({ correlative_number: e.target.value })}
              placeholder="004200"
              maxLength={6}
              className="h-8 text-xs font-mono font-bold"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Correlativo único anual de 6 dígitos ante SUNAT.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-semibold text-foreground block mb-1">Modalidad de Despacho</label>
            <select
              value={data.dispatch_mode || '10'}
              onChange={(e) => onChange({ dispatch_mode: e.target.value as '10' | '00' | '01' | '02' })}
              className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium"
            >
              <option value="10">10 - Despacho Anticipado (Obligatorio &gt; $2,000)</option>
              <option value="00">00 - Despacho Diferido</option>
              <option value="01">01 - Despacho Urgente</option>
            </select>
            <p className="text-[10px] text-muted-foreground mt-0.5">Numeración previa a la llegada de la nave.</p>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Fecha de Numeración</label>
            <Input
              type="date"
              value={data.numeration_date || new Date().toISOString().split('T')[0]}
              onChange={(e) => onChange({ numeration_date: e.target.value })}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Fecha oficial de transmisión del teledespacho.</p>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Tipo de Cambio SBS (Venta)</label>
            <Input
              type="number"
              step="0.001"
              value={data.exchange_rate || 3.82}
              onChange={(e) => onChange({ exchange_rate: parseFloat(e.target.value) || 3.82 })}
              className="h-8 text-xs font-mono font-bold"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Tipo de cambio oficial para liquidar tributos en PEN.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="font-semibold text-foreground block mb-1">N° Documento de Transporte (B/L / AWB)</label>
            <Input
              value={data.transport_doc_number || ''}
              onChange={(e) => onChange({ transport_doc_number: e.target.value })}
              placeholder="BL-MSK-2026-9912"
              className="h-8 text-xs font-mono font-bold text-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Conocimiento de embarque marítimo o carta de porte aéreo.</p>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="art160"
              checked={data.has_article_160_guarantee || false}
              onChange={(e) => onChange({ has_article_160_guarantee: e.target.checked })}
              className="h-4 w-4 rounded-sm border-input text-primary"
            />
            <label htmlFor="art160" className="text-xs text-foreground cursor-pointer">
              Acogida a Garantía Global Previa (Art. 160 Ley de Aduanas)
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
