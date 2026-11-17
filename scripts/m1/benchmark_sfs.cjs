/** Local only: run after npm run build, optionally inside a CPU/memory-limited container. */
const { readFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
process.chdir(require('node:path').resolve(__dirname, '../..'));
const { ejecutarSfs } = require('../../dist/modules/invoices/application/services/sunatSfsRunner.js');
const { sfsTimeoutMs } = require('../../dist/modules/invoices/application/services/sunatSfsRuntime.js');

async function main() {
  const samples = Number(process.env.SFS_BENCH_SAMPLES ?? 5);
  const concurrency = Number(process.env.SFS_BENCH_CONCURRENCY ?? 1);
  if (![samples, concurrency].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 20)) throw Error('Invalid benchmark limits');
  for (const [tipo, fixture] of [['07', 'nota-credito'], ['08', 'nota-debito']]) {
    const xml = readFileSync(`test/fixtures/sfs/${fixture}.xml`, 'utf8');
    for (let sample = 1; sample <= samples; sample++) {
      await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
        const start = performance.now();
        try {
          const result = await ejecutarSfs(xml, tipo);
          console.log(JSON.stringify({ tipo, sample, worker, budgetMs: sfsTimeoutMs(), ms: Math.round(performance.now() - start),
            valid: result.completado && result.errores.length === 0 }));
          if (result.errores.length) process.exitCode = 1;
        } catch (error) {
          console.log(JSON.stringify({ tipo, sample, worker, budgetMs: sfsTimeoutMs(), ms: Math.round(performance.now() - start), error: error.message }));
          process.exitCode = 1;
        }
      }));
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
