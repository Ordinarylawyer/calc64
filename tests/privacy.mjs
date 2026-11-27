// 入力を外に出さないための約束（README「入力を外に出さないために」）を機械的に確かめる
//   - index.html の CSP が外部との通信を禁じていること・読み込むのは自分のファイルだけであること
//   - 自前の JS が通信・保存の API を使っていないこと
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '../site');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
for (const d of ["default-src 'self'", "connect-src 'none'", "form-action 'none'", "script-src 'self'", "object-src 'none'", "base-uri 'none'"]) ok(csp.includes(d), 'CSP に ' + d);
ok(!/unsafe-(inline|eval)/.test(csp), 'CSP に unsafe-inline／unsafe-eval が無い');
// 読み込むもの（src・<link href>）は自分のファイルだけ。<a href> は読み込みではない（ライセンス・ソースへのリンク）が、新しいタブで開き、参照元を送らないこと
for (const m of html.matchAll(/(?:\ssrc="([^"]+)"|<link [^>]*href="([^"]+)")/g)) { const u = m[1] || m[2]; ok(!/^(https?:)?\/\//.test(u), '外部のファイルを読まない: ' + u); }
for (const m of html.matchAll(/<a ([^>]*)>/g)) if (/href="(https?:)?\/\//.test(m[1])) ok(/target="_blank"/.test(m[1]) && /rel="[^"]*noreferrer/.test(m[1]), '外部へのリンクは新しいタブ・参照元なし: ' + m[1]);
ok(!/<script>/.test(html) && !/ on[a-z]+="/.test(html), 'インラインのスクリプトが無い');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const banned = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|EventSource|new\s+Worker|\beval\s*\(|new\s+Function|https?:\/\/(?!schemas\.openxmlformats\.org|schemas\.microsoft\.com|purl\.org|www\.w3\.org)/;
for (const f of walk(site).filter((f) => f.endsWith('.js') && !f.includes(path.sep + 'vendor' + path.sep))) {
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(banned);
  ok(!m, path.relative(site, f) + (m ? ' に ' + m[0] : ''));
}
console.log(`privacy: PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
