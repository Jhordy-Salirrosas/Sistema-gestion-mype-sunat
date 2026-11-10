import { useState } from 'react';
import { Alert, AlertDescription, Badge, Button, Card, PageField, PageText } from '@/components/ui';
import type { ConfiguracionBackend, ConfiguracionInput, EntornoFiscal, PerfilComercial } from '../hooks/useInvoiceConfig';
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
  const [entorno, setEntorno] = useState(config.entorno ?? '');
  const [perfilComercial, setPerfilComercial] = useState<PerfilComercial | ''>(config.perfil_comercial ?? '');
  const [fiscal, setFiscal] = useState({
    cuenta_banco_nacion: config.cuenta_banco_nacion ?? '',
    local_anexo: config.local_anexo ?? '',
    domicilio_fiscal: config.domicilio_fiscal ?? '',
    ubigeo_fiscal: config.ubigeo_fiscal ?? '',
    departamento_fiscal: config.departamento_fiscal ?? '',
    provincia_fiscal: config.provincia_fiscal ?? '',
    distrito_fiscal: config.distrito_fiscal ?? '',
  });
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
      if (entorno && entorno !== config.entorno) input.entorno = entorno as EntornoFiscal;
      const perfilActual = config.perfil_comercial ?? '';
      if (perfilComercial !== perfilActual) {
        input.perfil_comercial = perfilComercial === '' ? null : perfilComercial;
      }
      for (const key of Object.keys(fiscal) as Array<keyof typeof fiscal>) {
        if (fiscal[key] !== (config[key] ?? '')) input[key] = fiscal[key].trim() || null;
      }
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
        <option value="" disabled>Sin configurar</option><option value="MOCK">MOCK (simulado)</option><option value="BETA">BETA (pruebas)</option><option value="PRODUCCION">PRODUCCIÓN</option>
      </select></PageField>
      <PageField label="Perfil comercial de la empresa" htmlFor="cfg-perfil-comercial">
        <select
          id="cfg-perfil-comercial"
          className={clase}
          value={perfilComercial}
          onChange={(e) => setPerfilComercial(e.target.value as PerfilComercial | '')}
        >
          <option value="">Sin definir</option>
          <option value="MAYORISTA">Mayorista (preselecciona Factura 01)</option>
          <option value="MINORISTA">Minorista (preselecciona Boleta 03)</option>
        </select>
      </PageField>
      <PageField label="Cuenta de detracciones del Banco de la Nación" htmlFor="cfg-cuenta-bn"><input id="cfg-cuenta-bn" className={clase} inputMode="numeric" pattern="[0-9]{11}" maxLength={11} value={fiscal.cuenta_banco_nacion} onChange={e => setFiscal({ ...fiscal, cuenta_banco_nacion: e.target.value })} /><p>Cuenta propia de la empresa (11 dígitos). Sin ella se bloquean las operaciones sujetas a SPOT.</p></PageField>
      <PageField label="Local anexo (Catálogo 59)" htmlFor="cfg-local_anexo"><input id="cfg-local_anexo" className={clase} maxLength={4} value={fiscal.local_anexo} onChange={e => setFiscal({ ...fiscal, local_anexo: e.target.value })} /></PageField>
      <PageField label="Domicilio fiscal" htmlFor="cfg-domicilio_fiscal"><input id="cfg-domicilio_fiscal" className={clase} maxLength={500} value={fiscal.domicilio_fiscal} onChange={e => setFiscal({ ...fiscal, domicilio_fiscal: e.target.value })} /></PageField>
      <PageField label="Ubigeo fiscal" htmlFor="cfg-ubigeo_fiscal"><input id="cfg-ubigeo_fiscal" className={clase} maxLength={6} value={fiscal.ubigeo_fiscal} onChange={e => setFiscal({ ...fiscal, ubigeo_fiscal: e.target.value })} /></PageField>
      <PageField label="Departamento fiscal" htmlFor="cfg-departamento_fiscal"><input id="cfg-departamento_fiscal" className={clase} maxLength={100} value={fiscal.departamento_fiscal} onChange={e => setFiscal({ ...fiscal, departamento_fiscal: e.target.value })} /></PageField>
      <PageField label="Provincia fiscal" htmlFor="cfg-provincia_fiscal"><input id="cfg-provincia_fiscal" className={clase} maxLength={100} value={fiscal.provincia_fiscal} onChange={e => setFiscal({ ...fiscal, provincia_fiscal: e.target.value })} /></PageField>
      <PageField label="Distrito fiscal" htmlFor="cfg-distrito_fiscal"><input id="cfg-distrito_fiscal" className={clase} maxLength={100} value={fiscal.distrito_fiscal} onChange={e => setFiscal({ ...fiscal, distrito_fiscal: e.target.value })} /></PageField>
      <PageField label="Usuario SOL" htmlFor="cfg-sol-user"><input id="cfg-sol-user" className={clase} autoComplete="off" maxLength={64} value={solUser} onChange={(e) => setSolUser(e.target.value)} />
        <p>El usuario actual no se publica. Escriba solo para reemplazarlo.</p></PageField>
      <PageField label="Nueva contraseña SOL" htmlFor="cfg-sol-password"><input id="cfg-sol-password" className={clase} type="password" autoComplete="new-password" maxLength={256} value={solPassword} onChange={(e) => setSolPassword(e.target.value)} />
        <p>Contraseña SOL: {config.sol_password_configurada ? 'configurado' : 'no configurado'}</p></PageField>
      <Card className="space-y-3 p-4" data-testid="seccion-certificado-digital">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PageText variant="label">Certificado Digital (.PFX / .P12)</PageText>
          <Badge
            variant={
              config.certificado?.estado === 'VIGENTE'
                ? 'outline'
                : config.certificado?.estado === 'POR_VENCER'
                  ? 'secondary'
                  : 'destructive'
            }
          >
            {config.certificado?.estado === 'VIGENTE'
              ? 'Vigente'
              : config.certificado?.estado === 'POR_VENCER'
                ? 'Por vencer'
                : config.certificado?.estado === 'VENCIDO'
                  ? 'Vencido'
                  : config.certificado?.estado === 'INVALIDO' ? 'Inválido'
                    : config.certificado?.estado === 'AUN_NO_VIGENTE' ? 'Aún no vigente' : 'No configurado'}
          </Badge>
        </div>
        <p>Origen: {origen(config.certificado?.origen)}</p>
        {config.certificado?.detalle && <p>{config.certificado.detalle}</p>}
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
          <p>
            <span className="font-medium text-foreground">Archivo:</span>{' '}
            {file
              ? file.name
              : config.certificado?.archivo ?? 'Sin archivo registrado'}
          </p>
          <p>
            <span className="font-medium text-foreground">Estado:</span>{' '}
            {config.certificado?.configurado
              ? 'Operativo para firma XML'
              : config.certificado?.estado ?? 'Sin información'}
          </p>
          <p>
            <span className="font-medium text-foreground">Vencimiento:</span>{' '}
            {config.certificado?.vence_el
              ? `${config.certificado.vence_el}${
                  config.certificado.dias_restantes !== null
                    ? ` (${config.certificado.dias_restantes} días restantes)`
                    : ''
                }`
              : 'No disponible'}
          </p>
        </div>
        <PageField label="Certificado digital PKCS#12" htmlFor="cfg-cert">
          <input
            key={fileKey}
            id="cfg-cert"
            type="file"
            accept=".p12,.pfx"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
          <p>Cargue un archivo .p12 o .pfx (máximo 96 KiB). Solo se envía el archivo seleccionado.</p>
        </PageField>
        <PageField label="Nueva contraseña del certificado" htmlFor="cfg-cert-password">
          <input
            id="cfg-cert-password"
            className={clase}
            type="password"
            autoComplete="new-password"
            maxLength={256}
            value={certPassword}
            onChange={(e) => setCertPassword(e.target.value)}
          />
          <p>Contraseña del certificado: {config.cert_password_configurada ? 'configurado' : 'no configurado'}</p>
        </PageField>
      </Card>
      <p>Deje vacíos los campos que desea conservar. Al configurar SOL o certificado por primera vez, complete ambos campos del grupo.</p>
      <Button type="submit">{enviando ? 'Guardando…' : 'Guardar configuración'}</Button>
    </fieldset>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {guardado && <p role="status">Configuración guardada.</p>}
  </form>;
};
