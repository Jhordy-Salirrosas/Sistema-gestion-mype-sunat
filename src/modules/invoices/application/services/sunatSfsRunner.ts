import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { sfsTimeoutMs } from './sunatSfsRuntime';

export interface ResultadoSfs {
  completado: true;
  errores: { codigo: string; mensaje: string; nodo: string | null }[];
}

/** Proceso cancelable, sin shell ni red; presupuesto configurable para arranque frío en servidores pequeños. */
export function ejecutarSfs(xml: string, tipo: string): Promise<ResultadoSfs> {
  const timeoutMs = sfsTimeoutMs();
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.SUNAT_SFS_PYTHON ?? 'python3', [
      join(process.cwd(), 'scripts', 'm1', 'validate_sfs.py'),
    ], { stdio: ['pipe', 'pipe', 'ignore'] });
    let salida = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Ejecutor SFS excedió ${timeoutMs} ms`));
    }, timeoutMs);
    child.on('error', () => { clearTimeout(timer); reject(new Error('Ejecutor Python SFS no disponible')); });
    child.stdin.on('error', () => { /* El cierre del proceso resuelve el fallo. */ });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      salida += chunk;
      if (salida.length > 1_000_000) child.kill('SIGKILL');
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(salida) as ResultadoSfs;
        if (code !== 0 || result.completado !== true || !Array.isArray(result.errores) ||
            result.errores.some(e => !/^(\d{4}|XSD)$/.test(e.codigo) || typeof e.mensaje !== 'string' || !(e.nodo === null || typeof e.nodo === 'string'))) {
          throw new Error();
        }
        resolve(result);
      } catch { reject(new Error('Ejecutor SFS no completó la validación')); }
    });
    child.stdin.end(JSON.stringify({ xml, tipo }));
  });
}
