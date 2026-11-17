"""Local CPU-contention harness; no database, network or SUNAT transport.

Rootless Docker may ignore --cpus. Instead, bind validators and N competitors
on one allowed logical CPU, then measure the actual CPU share with a probe.
Every ejecutarSfs invocation starts a fresh Python/lxml/XSL process.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--competitors', type=int, default=9)
    args.add_argument('--samples', type=int, default=5)
    args.add_argument('--concurrency', type=int, default=1)
    config = args.parse_args()
    if not 0 <= config.competitors <= 39 or not 1 <= config.samples <= 20 or not 1 <= config.concurrency <= 20:
        args.error('Limits: competitors 0..39, samples/concurrency 1..20')
    root = Path(__file__).resolve().parents[2]
    cpu = min(os.sched_getaffinity(0))

    def pin():
        os.sched_setaffinity(0, {cpu})

    workers = []
    try:
        for _ in range(config.competitors):
            workers.append(subprocess.Popen([sys.executable, '-c', 'while True: pass'], preexec_fn=pin))
        time.sleep(0.25)
        probe = subprocess.check_output([sys.executable, '-c',
            'import time,json; wall=time.monotonic(); cpu=time.process_time();\n'
            'while time.process_time()-cpu < 0.25: pass\n'
            'print(json.dumps({"cpuSeconds":time.process_time()-cpu,"wallSeconds":time.monotonic()-wall}))'],
            preexec_fn=pin, text=True)
        calibration = json.loads(probe)
        print(json.dumps({'cpu': cpu, 'competitors': config.competitors,
                          'effectiveCpu': round(calibration['cpuSeconds'] / calibration['wallSeconds'], 3),
                          'calibration': calibration, 'concurrency': config.concurrency}), flush=True)
        env = {**os.environ, 'SUNAT_SFS_PYTHON': sys.executable,
               'SFS_BENCH_SAMPLES': str(config.samples), 'SFS_BENCH_CONCURRENCY': str(config.concurrency),
               'PYTHONDONTWRITEBYTECODE': '1'}
        result = subprocess.run([shutil.which('node'), 'scripts/m1/benchmark_sfs.cjs'], cwd=root, env=env, preexec_fn=pin)
        return result.returncode
    finally:
        for worker in workers:
            worker.terminate()
        for worker in workers:
            worker.wait()


if __name__ == '__main__':
    sys.exit(main())
