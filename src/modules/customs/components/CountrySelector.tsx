import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type CountryItem, saveStoredCountry } from '../services/catalogsApi';
import { Check } from 'lucide-react';

interface CountrySelectorProps {
  countries: CountryItem[];
  onCountriesChange: (updated: CountryItem[]) => void;
  selectedCountryCode: string;
  onSelectCountry: (code: string) => void;
  errorMessage?: string;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  countries,
  onCountriesChange,
  selectedCountryCode,
  onSelectCountry,
  errorMessage,
}) => {
  const [isAddingCountry, setIsAddingCountry] = useState(false);
  const [newCountryCode, setNewCountryCode] = useState('');
  const [newCountryName, setNewCountryName] = useState('');

  const handleQuickSaveCountry = () => {
    const codeTrimmed = newCountryCode.trim().toUpperCase();
    const nameTrimmed = newCountryName.trim();
    if (codeTrimmed.length < 2 || nameTrimmed.length < 2) return;

    const newCountry: CountryItem = {
      code: codeTrimmed,
      name: nameTrimmed,
      flag: '🌐',
    };
    const updated = saveStoredCountry(newCountry);
    onCountriesChange(updated);
    onSelectCountry(newCountry.code);
    setIsAddingCountry(false);
    setNewCountryCode('');
    setNewCountryName('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-foreground block">País de Origen</label>
        <button
          type="button"
          onClick={() => setIsAddingCountry(!isAddingCountry)}
          className="text-[10px] text-primary hover:underline font-semibold"
        >
          {isAddingCountry ? '✕ Cancelar' : '+ Nuevo País'}
        </button>
      </div>

      {isAddingCountry ? (
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Cód (ej. FR)..."
            value={newCountryCode}
            onChange={(e) => setNewCountryCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="h-8 text-xs w-20 font-mono uppercase"
            autoFocus
          />
          <Input
            placeholder="Nombre país (ej. Francia)..."
            value={newCountryName}
            onChange={(e) => setNewCountryName(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleQuickSaveCountry}
            className="h-8 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            title="Guardar país y dejarlo seleccionado"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <select
          value={selectedCountryCode}
          onChange={(e) => onSelectCountry(e.target.value)}
          className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      )}
      {errorMessage && <p className="text-[11px] text-red-500 mt-0.5">{errorMessage}</p>}
    </div>
  );
};

