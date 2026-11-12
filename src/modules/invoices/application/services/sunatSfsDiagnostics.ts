import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { sfsTimeoutMs } from './sunatSfsRuntime';

export interface DiagnosticoSfs {
  disponible: boolean;
  causa: string | null;
  motor: 'SFS';
}

const TTL_MS = 60_000;
let cache: { key: string; value: DiagnosticoSfs; expires: number } | undefined;
let pending: { key: string; promise: Promise<DiagnosticoSfs> } | undefined;

/** Cache por proceso de éxitos y fallos; no acredita documentos ni abre la compuerta. */
export function diagnosticarSfs(): Promise<DiagnosticoSfs> {
  const timeout = sfsTimeoutMs();
  const key = JSON.stringify([process.env.SUNAT_SFS_PYTHON, timeout]);
  if (cache?.key === key && Date.now() < cache.expires) return Promise.resolve({ ...cache.value });
  if (pending?.key === key) return pending.promise;
  const promise = ejecutarDiagnostico(timeout).then(value => {
    cache = { key, value: { ...value }, expires: Date.now() + TTL_MS };
    return value;
  }).finally(() => { if (pending?.promise === promise) pending = undefined; });
  pending = { key, promise };
  return promise;
}

function ejecutarDiagnostico(timeout: number): Promise<DiagnosticoSfs> {
  return new Promise(resolve => {
    execFile(process.env.SUNAT_SFS_PYTHON ?? 'python3', [join(process.cwd(), 'scripts/m1/diagnose_sfs.py')],
      { timeout, maxBuffer: 4096, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }, (error, stdout) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException & { killed?: boolean }).code;
          resolve({ disponible: false, causa: code === 'ENOENT' ? 'SFS_PYTHON_AUSENTE' : error.killed ? 'SFS_DIAGNOSTICO_TIMEOUT' : 'SFS_DIAGNOSTICO_FALLIDO', motor: 'SFS' });
          return;
        }
        try {
          const result = JSON.parse(stdout);
          const causas = ['SFS_LXML_AUSENTE', 'SFS_ASSETS_AUSENTES', 'SFS_XSD_NO_OPERATIVO'];
          if (result.disponible === true && result.causa === null) resolve({ disponible: true, causa: null, motor: 'SFS' });
          else if (result.disponible === false && causas.includes(result.causa)) resolve({ disponible: false, causa: result.causa, motor: 'SFS' });
          else throw new Error();
        } catch { resolve({ disponible: false, causa: 'SFS_DIAGNOSTICO_INVALIDO', motor: 'SFS' }); }
      });
  });
}
