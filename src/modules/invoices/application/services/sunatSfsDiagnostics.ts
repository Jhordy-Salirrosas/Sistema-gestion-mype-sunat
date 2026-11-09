import { execFile } from 'node:child_process';
import { join } from 'node:path';

export interface DiagnosticoSfs {
  disponible: boolean;
  causa: string | null;
  motor: 'SFS' | 'HEREDADO';
}

/** Disponibilidad del ejecutor; no acredita ningún documento ni abre la compuerta. */
export function diagnosticarSfs(): Promise<DiagnosticoSfs> {
  if (process.env.SUNAT_XSL_DIR) return Promise.resolve({ disponible: false, causa: 'MOTOR_HEREDADO_SELECCIONADO', motor: 'HEREDADO' });
  return new Promise(resolve => {
    execFile(process.env.SUNAT_SFS_PYTHON ?? 'python3', [join(process.cwd(), 'scripts/m1/diagnose_sfs.py')],
      { timeout: 2000, maxBuffer: 4096, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }, (error, stdout) => {
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
