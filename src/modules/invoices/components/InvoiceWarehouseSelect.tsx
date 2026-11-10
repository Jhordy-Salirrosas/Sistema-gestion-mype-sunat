import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/axios';
interface Almacen {
  warehouse_code: string;
  description: string;
}
export function InvoiceWarehouseSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (codigo: string) => void;
}) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    apiClient
      .get<Almacen[]>('/invoices/warehouses')
      .then((r) => {
        if (vivo) {
          if (Array.isArray(r.data)) setAlmacenes(r.data);
          else setError(true);
        }
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <label className="mb-4 flex flex-col gap-2 text-sm font-medium">
      Almacén de salida
      <select
        className="rounded-md border border-input bg-background px-3 py-2"
        aria-label="Almacén de salida"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!almacenes.some((a) => a.warehouse_code === value) && (
          <option value={value}>{value} — pendiente de verificar</option>
        )}
        {almacenes.map((a) => (
          <option key={a.warehouse_code} value={a.warehouse_code}>
            {a.warehouse_code} — {a.description}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert">
          No se pudieron consultar los almacenes. El servidor verificará el
          almacén antes de emitir.
        </span>
      )}
    </label>
  );
}
