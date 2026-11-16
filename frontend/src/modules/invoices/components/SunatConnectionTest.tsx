import { useState } from 'react';
import { apiClient } from '@/lib/axios';
import { Button } from '@/components/ui';
interface Diagnostic { conectado: boolean; mensaje: string; latencia_ms: number; credenciales: string; certificado: { estado: string; vence_el: string | null } }
export function SunatConnectionTest() {
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<Diagnostic>(); const [error, setError] = useState('');
  return <section aria-label="Diagnóstico SUNAT" className="space-y-2 rounded-md border p-4">
    <Button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); setResult(undefined); try { setResult((await apiClient.post<Diagnostic>('/invoices/connection-test')).data); } catch { setError('No se pudo consultar el diagnóstico SUNAT. Verifique su acceso y vuelva a intentarlo.'); } finally { setBusy(false); } }}>{busy ? 'Probando conexión…' : 'Probar conexión SUNAT beta'}</Button>
    <p className="text-xs">Consulta de solo lectura contra beta; no emite ni anula documentos. No verifica las credenciales en producción.</p>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status"><p>{result.conectado ? 'Conectado' : 'Error de conexión o verificación'} · {result.latencia_ms} ms</p><p>{result.mensaje}</p><p>Credenciales: {result.credenciales}</p><p>Certificado: {result.certificado.estado}{result.certificado.vence_el ? ` · Vence: ${result.certificado.vence_el.slice(0,10)}` : ''}</p></div>}
  </section>;
}
