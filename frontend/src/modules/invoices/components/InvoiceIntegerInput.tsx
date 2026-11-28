import { useEffect, useRef, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValue: (value: number) => void;
}

/** Cantidades enteras: descarta la fracción sin concatenar sus dígitos. */
export function InvoiceIntegerInput({ value, onValue, onKeyDown, onBlur, onFocus, onPaste, onPointerDown, ...props }: Props) {
  const fraccion = useRef(false);
  const visible = Number.isSafeInteger(Math.trunc(value)) ? String(Math.trunc(value)) : '';
  useEffect(() => {
    // Una precarga o un borrador antiguo tampoco puede ocultar una fracción
    // en el estado mientras el control muestra un entero.
    if (Number.isFinite(value) && !Number.isInteger(value) && Number.isSafeInteger(Math.trunc(value))) onValue(Math.max(0, Math.trunc(value)));
  }, [value, onValue]);
  const aceptar = (input: HTMLInputElement, texto: string) => {
    const entero = texto.split(/[.,]/, 1)[0];
    if (!/^\d*$/.test(entero) || (entero !== '' && !Number.isSafeInteger(Number(entero)))) {
      input.value = visible;
      return;
    }
    const siguiente = entero === '' ? NaN : Number(entero);
    input.value = entero === '' ? '' : String(siguiente);
    onValue(siguiente);
  };
  return <input {...props} type="number" inputMode="numeric" min={props.min ?? 0} step="1" value={visible}
    onKeyDown={e => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (!e.ctrlKey && !e.metaKey && ['.', ','].includes(e.key)) { fraccion.current = true; e.preventDefault(); return; }
      if (e.ctrlKey || e.metaKey || ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown'].includes(e.key)) fraccion.current = false;
      if (!e.ctrlKey && !e.metaKey && (['-', '+', 'e', 'E'].includes(e.key) || (fraccion.current && /^\d$/.test(e.key)))) e.preventDefault();
    }}
    onPaste={e => {
      onPaste?.(e);
      if (e.defaultPrevented) return;
      const texto = e.clipboardData.getData('text');
      fraccion.current = false;
      if (/^\d*$/.test(texto)) return;
      e.preventDefault();
      aceptar(e.currentTarget, texto);
    }}
    onFocus={e => { fraccion.current = false; onFocus?.(e); }}
    onPointerDown={e => { fraccion.current = false; onPointerDown?.(e); }}
    onChange={e => aceptar(e.currentTarget, e.currentTarget.value)}
    onBlur={e => {
      fraccion.current = false;
      const texto = e.currentTarget.value;
      const fallback = Math.max(0, Math.ceil(Number(props.min) || 0));
      const entero = texto === '' ? fallback : Math.trunc(Number(texto));
      const siguiente = Number.isSafeInteger(entero) && entero >= 0 ? entero : fallback;
      e.currentTarget.value = String(siguiente);
      onValue(siguiente);
      onBlur?.(e);
    }} />;
}
