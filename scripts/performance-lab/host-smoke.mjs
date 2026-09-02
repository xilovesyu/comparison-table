import { fileURLToPath } from 'node:url';
import { runPerformanceLab } from './run.mjs';

export async function runHostSmoke() {
  return runPerformanceLab({
    quick: true,
    output: '.performance-lab/results/host-smoke.v1.json',
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { document } = await runHostSmoke();
  process.stdout.write(`Playwright Chromium host smoke: ${document.status}\n`);
}
