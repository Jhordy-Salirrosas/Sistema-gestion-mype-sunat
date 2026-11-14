import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValue: (value: number) => void;
}

/** Rechaza decimales, signos y exponentes; normaliza ceros sin redondear cantidades. */
export function InvoiceIntegerInput({ value, onValue, ...props }: Props) {
  const visible = Number.isFinite(value) ? String(value) : '';
  return <input {...props} type="text" inputMode="numeric" pattern="[0-9]*" value={visible}
    onKeyDown={e => { if (['.', ',', '-', '+', 'e', 'E'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
    onChange={e => {
      const texto = e.currentTarget.value;
      if (!/^\d*$/.test(texto) || (texto !== '' && !Number.isSafeInteger(Number(texto)))) {
        e.currentTarget.value = visible;
        return;
      }
      const siguiente = texto === '' ? NaN : Number(texto);
      e.currentTarget.value = texto === '' ? '' : String(siguiente);
      onValue(siguiente);
    }} />;
}
