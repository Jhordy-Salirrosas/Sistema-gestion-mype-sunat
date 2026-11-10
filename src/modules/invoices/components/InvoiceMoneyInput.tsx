import { useState, type InputHTMLAttributes } from 'react';
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> { value: number; onValue: (value: number) => void }
/** Dos decimales visibles; enfocar/abandonar no cambia la precisión del origen. */
export function InvoiceMoneyInput({ value, onValue, ...props }: Props) {
 const [editing, setEditing] = useState(false); const [draft, setDraft] = useState('');
 return <input {...props} type="text" inputMode="decimal" value={editing ? draft : Number(value).toFixed(2)}
 onFocus={() => { setDraft(Number(value).toFixed(2)); setEditing(true); }} onBlur={() => setEditing(false)}
 onChange={e => { if (!/^\d*(?:\.\d{0,2})?$/.test(e.target.value)) return; setDraft(e.target.value); onValue(Number(e.target.value)); }} />;
}
