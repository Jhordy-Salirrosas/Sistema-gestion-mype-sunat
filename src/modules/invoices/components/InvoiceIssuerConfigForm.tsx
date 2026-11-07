import { useState } from 'react';
import { Alert, AlertDescription, Button, PageField } from '@/components/ui';
import type { ConfiguracionBackend, ConfiguracionInput, EntornoFiscal } from '../hooks/useInvoiceConfig';
import { invoiceConfigError } from '../lib/invoiceConfigError';

const origen = (value?: string) => value === 'company' ? 'Configuración guardada de la empresa'
  : value === 'deployment' ? 'Respaldo del despliegue' : 'Sin información';
const clase = 'h-9 w-full rounded-md border bg-background px-3 text-sm';

async function certificadoBase64(file: File): Promise<string> {
  if (!/\.(p12|pfx)$/i.test(file.name) || file.size === 0 || file.size > 98304) {
    throw new Error('Seleccione un certificado PKCS#12 (.p12 o .pfx), de hasta 96 KiB.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer el certificado.'));
    reader.readAsDataURL(file);
  });
}

export const InvoiceIssuerConfigForm = ({ config, ruc, guardar }: {
  config: Omit<ConfiguracionBackend, 'series'>; ruc: string; guardar: (input: ConfiguracionInput) => Promise<void>;
}) => {
  const [entorno, setEntorno] = useState(config.entorno ?? 'MOCK');
  const [solUser, setSolUser] = useState('');
  const [solPassword, setSolPassword] = useState('');
  const [certPassword, setCertPassword] = useState('');
  const [file, setFile] = useState<File>();
  const [fileKey, setFileKey] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const guardarCambios = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setGuardado(false); setEnviando(true);
    try {
      const input: ConfiguracionInput = {};
      if (entorno !== config.entorno) input.entorno = entorno as EntornoFiscal;
      if (solUser.trim()) input.sol_user = solUser.trim();
      if (solPassword) input.sol_password = solPassword;
      if (certPassword) input.cert_password = certPassword;
      if (file) input.cert_base64 = await certificadoBase64(file);
      if (!Object.keys(input).length) throw new Error('Escriba o cambie al menos un campo para guardar.');
      await guardar(input);
      setSolUser(''); setSolPassword(''); setCertPassword(''); setFile(undefined); setFileKey((key) => key + 1);
      setGuardado(true);
    } catch (e) { setError(invoiceConfigError(e)); }
    finally { setEnviando(false); }
  };
  return <form onSubmit={guardarCambios} className="grid gap-4">
    <p>Ambiente efectivo: {config.entorno === 'MOCK' ? 'MOCK (simulado)' : config.entorno}</p>
    <p>Origen efectivo: {origen(config.origen_efectivo)}</p>
    <p>Origen SOL: {origen(config.origen_sol)}</p>
    <p>Origen certificado: {origen(config.origen_certificado)}</p>
    <PageField label="RUC (no editable)" htmlFor="cfg-ruc"><input id="cfg-ruc" className={clase} readOnly value={config.ruc ?? ruc} /></PageField>
    <fieldset disabled={enviando} className="grid gap-4">
      <PageField label="Ambiente" htmlFor="cfg-entorno"><select id="cfg-entorno" className={clase} value={entorno} onChange={(e) => setEntorno(e.target.value)}>
        <option value="MOCK">MOCK (simulado)</option><option value="BETA">BETA (pruebas)</option><option value="PRODUCCION">PRODUCCIÓN</option>
      </select></PageField>
      <PageField label="Usuario SOL" htmlFor="cfg-sol-user"><input id="cfg-sol-user" className={clase} autoComplete="off" maxLength={64} value={solUser} onChange={(e) => setSolUser(e.target.value)} />
        <p>El usuario actual no se publica. Escriba solo para reemplazarlo.</p></PageField>
      <PageField label="Nueva contraseña SOL" htmlFor="cfg-sol-password"><input id="cfg-sol-password" className={clase} type="password" autoComplete="new-password" maxLength={256} value={solPassword} onChange={(e) => setSolPassword(e.target.value)} />
        <p>Contraseña SOL: {config.sol_password_configurada ? 'configurado' : 'no configurado'}</p></PageField>
      <PageField label="Certificado digital PKCS#12" htmlFor="cfg-cert"><input key={fileKey} id="cfg-cert" type="file" accept=".p12,.pfx" onChange={(e) => setFile(e.target.files?.[0])} />
        <p>Cargue un archivo .p12 o .pfx (máximo 96 KiB). Solo se envía el archivo seleccionado.</p></PageField>
      <PageField label="Nueva contraseña del certificado" htmlFor="cfg-cert-password"><input id="cfg-cert-password" className={clase} type="password" autoComplete="new-password" maxLength={256} value={certPassword} onChange={(e) => setCertPassword(e.target.value)} />
        <p>Contraseña del certificado: {config.cert_password_configurada ? 'configurado' : 'no configurado'}</p></PageField>
      <p>Deje vacíos los campos que desea conservar. Al configurar SOL o certificado por primera vez, complete ambos campos del grupo.</p>
      <Button type="submit">{enviando ? 'Guardando…' : 'Guardar configuración'}</Button>
    </fieldset>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {guardado && <p role="status">Configuración guardada.</p>}
  </form>;
};
