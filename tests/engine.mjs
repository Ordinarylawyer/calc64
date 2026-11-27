// 計算エンジンのテスト
//   - 負担割合 z が、請求 1 件ごとに費用を割り付けて足し上げた結果と一致すること（架空の事例を乱数で作る）
//   - 金額の式の評価（四則演算・括弧・万・全角・×÷）
//   - 分数の提案が条件（合計＝分母、ずれ ±15%、0.5% 未満は 0 可）を満たすこと
//   - 主文例（架空の事例）
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
vm.runInThisContext(fs.readFileSync(path.join(here, '../site/js/engine/calc64.js'), 'utf8'));
const C = globalThis.C64;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

// ---- z を、請求 1 件ごとの割付けで検算する ----
// 当事者 j に生じた費用のうち、請求 c（a→b、請求額 X・認容額 Y）に係る部分は X / D_j。
// その部分を、請求者 a が (X−Y)/X、相手方 b が Y/X 負担する。これを全部の請求について足し上げる。
const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
for (let t = 0; t < 300; t++) {
  const n = 2 + Math.floor(rnd() * 6);
  const claims = [];
  for (let m = 1 + Math.floor(rnd() * n * 2); m > 0; m--) {
    const a = Math.floor(rnd() * n);
    let b = Math.floor(rnd() * (n - 1)); if (b >= a) b++;
    const X = 1000 * (1 + Math.floor(rnd() * 20000));
    const r = rnd();
    const Y = r < 0.3 ? 0 : r < 0.5 ? X : Math.floor(rnd() * X);
    claims.push({ a, b, X, Y });
  }
  const D = new Array(n).fill(0);
  for (const c of claims) { D[c.a] += c.X; D[c.b] += c.X; }
  const want = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const c of claims) for (const j of [c.a, c.b]) {
    want[c.a][j] += (c.X / D[j]) * ((c.X - c.Y) / c.X);
    want[c.b][j] += (c.X / D[j]) * (c.Y / c.X);
  }
  const { x, y } = C.buildMatrices(n, claims.map((c) => ({ from: c.a, to: [c.b], claim: String(c.X), allowed: String(c.Y) })));
  const { z, den } = C.computeZ(x, y);
  let worst = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) worst = Math.max(worst, Math.abs(z[i][j] - want[i][j]));
  ok(worst < 1e-12, `検算 ${t}: z のずれ ${worst}`);
  for (let j = 0; j < n; j++) if (den[j] > 0) ok(Math.abs(z.reduce((acc, row) => acc + row[j], 0) - 1) < 1e-12, `検算 ${t}: 列 ${j} の合計が 100%`);
}

// ---- 金額の書き方 ----
for (const [s, v] of [['668919', 668919], ['100000/2', 50000], ['1000*3/4', 750], ['(1000+2000)*3', 9000], ['10000-2500', 7500], ['1.5*2000', 3000], ['300000/3+1', 100001], ['66万8919', 668919], ['66万8919円', 668919], ['１２万３４５', 120345], ['1億2000万', 120000000], ['3.5万', 35000], ['1,000,000', 1000000], ['3×4÷2', 6], ['（10＋20）＊３', 90], ['100000／2', 50000], [' 1 000 ', 1000]]) {
  const p = C.parseAmount(s);
  ok(p.ok && p.value === v, `金額 ${s} → ${p.value}`);
}
for (const s of ['abc', '1万万', '万', '1/0', '(1+2', '-5', '1+']) ok(!C.parseAmount(s).ok, `金額 ${s} は誤り`);
ok(C.parseAmount('').empty, '空欄は 0');

// ---- 分数の提案 ----
let fallbacks = 0;
for (let t = 0; t < 3000; t++) {
  const k = 2 + Math.floor(rnd() * 6);
  const col = Array.from({ length: k }, () => (rnd() < 0.15 ? 0 : rnd() ** 2));
  if (col.every((v) => v === 0)) continue;
  const tot = col.reduce((a, b) => a + b, 0);
  const r = C.suggestColumn(col);
  eq(r.nums.reduce((a, b) => a + b, 0), r.den, `提案 ${t}: 分子の合計`);
  ok(r.den >= 1 && r.den <= 100, `提案 ${t}: 分母 ${r.den}`);
  if (r.fallback) {
    // 分母 100 までに収まらないのは、ごく小さい（2% 未満）割合があるときだけ
    fallbacks++;
    ok(col.some((v) => v > 0 && v / tot < 0.02), `提案 ${t}: 2% 未満の割合が無いのに分母 100 までに収まらない`);
    continue;
  }
  col.forEach((v, i) => {
    const q = r.nums[i] / r.den, p = v / tot;
    if (p === 0) eq(r.nums[i], 0, `提案 ${t}: 0 は 0`);
    else if (r.nums[i] === 0) ok(p < 0.005, `提案 ${t}: 0 にできるのは 0.5% 未満だけ (${p})`);
    else ok(Math.abs(q - p) <= 0.15 * p + 1e-12, `提案 ${t}: ずれ ${q} / ${p}`);
  });
  // 大小関係が逆転しない
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (col[i] > col[j]) ok(r.nums[i] >= r.nums[j], `提案 ${t}: 大小関係`);
}
ok(fallbacks < 400, `分母 100 までに収まらない提案が多すぎる (${fallbacks})`);
// 分母 10 までは、ずれが最小のもの
{
  const r = C.suggestColumn([50, 25, 25]);
  eq(`${r.nums.join(',')}/${r.den}`, '2,1,1/4', '50:25:25');
  const r2 = C.suggestColumn([60, 30, 10]);
  eq(`${r2.nums.join(',')}/${r2.den}`, '6,3,1/10', '60:30:10');
  const r3 = C.suggestColumn([99.7, 0.3]);
  eq(`${r3.nums.join(',')}/${r3.den}`, '1,0/1', '0.5% 未満は 0（64条ただし書）');
  const r5 = C.suggestColumn([38.1, 61.9]);
  eq(`${r5.nums.join(',')}/${r5.den}`, '3,5/8', '分母 10 までをすべて比べる（2/5 より 3/8 の方がずれが小さい）');
  const r4 = C.suggestColumn([75.85, 2.28, 21.87]);
  eq(r4.nums.reduce((a, b) => a + b, 0), r4.den, '分子の合計＝分母');
}
// 分数の入力
eq(JSON.stringify(C.parseFrac('3分の1')), JSON.stringify({ ok: true, num: 1, den: 3 }), '3分の1');
eq(JSON.stringify(C.parseFrac('２/４')), JSON.stringify({ ok: true, num: 1, den: 2 }), '2/4 は約分');
eq(C.parseFrac('全部').num, 1, '全部');
ok(!C.parseFrac('4/3').ok, '1 を超える分数');
ok(!C.parseFrac('三分の一').ok, '漢数字は不可');

// ---- 主文例（架空の事例） ----
const st = (parties, claims, extra) => Object.assign({ parties: parties.map((name) => ({ name })), claims, overrides: {}, options: {} }, extra || {});
{
  // 2 当事者・一部認容 → 「これを５分し」
  const r = C.run(st(['原告', '被告'], [{ from: 0, to: [1], claim: '100万', allowed: '60万' }]));
  eq(r.decree.full, '訴訟費用は、原告に生じた費用の５分の２及び被告に生じた費用の５分の２を原告の、原告に生じた費用の５分の３及び被告に生じた費用の５分の３を被告の負担とする。', '2 当事者 full');
  eq(r.decree.short, '訴訟費用はこれを５分し、その２を原告の負担とし、その余を被告の負担とする。', '2 当事者 short');
}
{
  // 全部認容 → 「被告の負担とする」
  const r = C.run(st(['原告', '被告'], [{ from: 0, to: [1], claim: '100万', allowed: '100万' }]));
  eq(r.decree.short, '訴訟費用は被告の負担とする。', '全部認容 short');
  eq(r.decree.full, '訴訟費用は、原告に生じた費用の全部及び被告に生じた費用の全部を被告の負担とする。', '全部認容 full');
}
{
  // 本訴・反訴・連帯・参加（画面の「例を読み込む」と同じ）
  const r = C.run(st(['原告Ａ社', '被告Ｂ', '被告Ｃ', '参加人Ｄ'], [
    { from: 0, to: [1, 2], claim: '600万', allowed: '400万' },
    { from: 1, to: [0], claim: '150万', allowed: '50万' },
    { from: 3, to: [0], claim: '100万', allowed: '0' },
  ]));
  ok(!r.hasErr, '例: 誤りなし');
  eq(r.decree.full, '訴訟費用は、原告Ａ社に生じた費用の３分の１、被告Ｂに生じた費用の３分の１及び被告Ｃに生じた費用の３分の１を原告Ａ社の、原告Ａ社に生じた費用の３分の１及び被告Ｂに生じた費用の３分の２を被告Ｂの、原告Ａ社に生じた費用の９分の２及び被告Ｃに生じた費用の３分の２を被告Ｃの、原告Ａ社に生じた費用の９分の１及び参加人Ｄに生じた費用の全部を参加人Ｄの負担とする。', '例 full');
  eq(r.decree.short, '', '例: 簡潔な形は無い');
  eq(Math.round(r.z[0][0] * 10000), 2941, '例: z[1][1] = 250/850');
  // 「及び」を使わない
  const r2 = C.run(Object.assign(st(['Ａ', 'Ｂ'], [{ from: 0, to: [1], claim: '100', allowed: '60' }]), { options: { andLast: false } }));
  ok(r2.decree.full.includes('５分の２、Ｂに生じた'), '及びを使わない');
  // 名前が空 → 当事者１
  const r3 = C.run(st(['', ''], [{ from: 0, to: [1], claim: '100', allowed: '100' }]));
  eq(r3.decree.short, '訴訟費用は当事者２の負担とする。', '名前が空');
}
{
  // 手で直した分数（合計が 1 にならないと誤り・主文なし）
  const base = st(['原告', '被告'], [{ from: 0, to: [1], claim: '100', allowed: '60' }]);
  const r = C.run(Object.assign({}, base, { overrides: { '0,0': '1/2' } }));
  ok(r.hasErr && r.decree.full === '', '合計が 1 でない手直しは誤り');
  const r2 = C.run(Object.assign({}, base, { overrides: { '0,0': '1/2', '1,0': '1/2' } }));
  ok(!r2.hasErr && r2.decree.full.startsWith('訴訟費用は、原告に生じた費用の２分の１及び被告に生じた費用の５分の２を原告の'), '手直しが主文に入る');
}
{
  // 誤り: 認容額が請求額を超える・自分への請求・式の誤り
  const r = C.run(st(['原告', '被告'], [{ from: 0, to: [1], claim: '100', allowed: '200' }]));
  ok(r.hasErr && r.issues.some((e) => /上回って/.test(e.msg)), '認容額＞請求額');
  const r2 = C.run(st(['原告', '被告'], [{ from: 0, to: [0], claim: '100', allowed: '0' }]));
  ok(r2.hasErr, '自分への請求');
  const r3 = C.run(st(['原告', '被告', '補助'], [{ from: 0, to: [1], claim: '1万万', allowed: '0' }]));
  ok(r3.hasErr && r3.issues.some((e) => e.level === 'warn' && /関わっていません/.test(e.msg)), '式の誤り・関わらない当事者');
}

console.log(`engine: PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
