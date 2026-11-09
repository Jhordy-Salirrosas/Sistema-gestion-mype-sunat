import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { sfsTimeoutMs } from '../../../src/modules/invoices/application/services/sunatSfsRuntime';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';

jest.mock('node:child_process', () => ({ ...jest.requireActual('node:child_process'), execFile: jest.fn() }));
const execute = execFile as unknown as jest.Mock;
const original = { python: process.env.SUNAT_SFS_PYTHON, timeout: process.env.SUNAT_SFS_TIMEOUT_MS, legacy: process.env.SUNAT_XSL_DIR };
beforeEach(() => {
  delete process.env.SUNAT_SFS_PYTHON; delete process.env.SUNAT_SFS_TIMEOUT_MS; delete process.env.SUNAT_XSL_DIR;
  execute.mockReset();
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, value] of [['SUNAT_SFS_PYTHON', original.python], ['SUNAT_SFS_TIMEOUT_MS', original.timeout], ['SUNAT_XSL_DIR', original.legacy]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
function diagnostic(): () => Promise<unknown> {
  let fn!: () => Promise<unknown>;
  jest.isolateModules(() => { fn = require('../../../src/modules/invoices/application/services/sunatSfsDiagnostics').diagnosticarSfs; });
  return fn;
}
it.each([undefined, '', 'invalid', '0', '-1', '1.5', 'Infinity', '2147483648'])('presupuesto inválido %s usa 20 segundos', value => {
  if (value !== undefined) process.env.SUNAT_SFS_TIMEOUT_MS = value;
  expect(sfsTimeoutMs()).toBe(20_000);
});
it('diagnóstico usa el mismo presupuesto configurable del ejecutor', async () => {
  process.env.SUNAT_SFS_TIMEOUT_MS = '35000';
  execute.mockImplementation((_file, _args, options, callback) => {
    expect(options.timeout).toBe(35_000);
    callback(null, JSON.stringify({ disponible: true, causa: null }));
  });
  expect(await diagnostic()()).toMatchObject({ disponible: true });
});
it('ejecutor real respeta presupuesto configurado sin tocar red', async () => {
  process.env.SUNAT_SFS_TIMEOUT_MS = '35000';
  const timer = jest.spyOn(global, 'setTimeout');
  await ejecutarSfs(readFileSync('test/fixtures/sfs/factura.xml', 'utf8'), '01');
  expect(timer).toHaveBeenCalledWith(expect.any(Function), 35_000);
});
it.each([true, false])('cachea resultado disponible=%s por 60 segundos y vuelve a diagnosticar', async disponible => {
  let now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  execute.mockImplementation((_file, _args, _options, callback) => callback(
    disponible ? null : { killed: true }, JSON.stringify({ disponible: true, causa: null }),
  ));
  const check = diagnostic();
  const first = await check();
  expect(first).toEqual({ disponible, causa: disponible ? null : 'SFS_DIAGNOSTICO_TIMEOUT', motor: 'SFS' });
  now += 59_999; expect(await check()).toEqual(first); expect(execute).toHaveBeenCalledTimes(1);
  now += 1; await check(); expect(execute).toHaveBeenCalledTimes(2);
});
it('lecturas concurrentes comparten proceso y un cambio de presupuesto invalida cache', async () => {
  let finish!: (error: null, stdout: string) => void;
  execute.mockImplementation((_file, _args, _options, callback) => { finish = callback; });
  const check = diagnostic();
  const a = check(), b = check();
  expect(execute).toHaveBeenCalledTimes(1);
  finish(null, '{"disponible":true,"causa":null}');
  expect(await a).toEqual(await b);
  process.env.SUNAT_SFS_TIMEOUT_MS = '25000';
  const c = check(); expect(execute).toHaveBeenCalledTimes(2);
  finish(null, '{"disponible":true,"causa":null}'); await c;
});
