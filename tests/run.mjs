// すべてのテストを順に実行する: node tests/run.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
let ok = true;
for (const t of ['engine.mjs', 'privacy.mjs']) {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL(t, import.meta.url))], { stdio: 'inherit' });
  if (r.status !== 0) ok = false;
}
console.log(ok ? 'ALL PASS' : 'FAILED');
process.exit(ok ? 0 : 1);
