// Calc64 ― 計算エンジン
// 訴訟費用の負担割合（民訴法61条・64条）を、当事者間の請求額と認容額から求め、
// 平易な分数と主文例を作る。計算の考え方は docs/00_設計.md。
// ファイルを開くだけで動くように（file://）、モジュールにせず名前空間 C64 に載せる。
(function (g) {
  'use strict';
  const C64 = (g.C64 = g.C64 || {});

  // ---------------------------------------------------------------
  // 1. 金額の入力（四則演算・括弧・「万」「億」・全角・桁区切り・「円」）
  //    eval は使わず、小さな構文解析で計算する
  // ---------------------------------------------------------------
  function normalizeExpr(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .replace(/[×✕]/g, '*')
      .replace(/÷/g, '/')
      .replace(/[−‐‑–—ー]/g, '-')
      .replace(/[円\s,]/g, '');
  }

  // 戻り値: { ok: true, value, empty } または { ok: false, error }
  function parseAmount(src) {
    const s = normalizeExpr(src);
    if (s === '') return { ok: true, value: 0, empty: true };
    let i = 0;
    const peek = () => s[i];
    const fail = (msg) => { throw new Error(msg); };
    function number() {
      // 数字（小数可）に「億」「万」が続く形（例: 66万8919、1億2000万、3.5万）
      let total = 0, seen = false, lastUnit = Infinity;
      for (;;) {
        const m = /^\d+(?:\.\d+)?/.exec(s.slice(i));
        if (!m) break;
        seen = true;
        i += m[0].length;
        const v = Number(m[0]);
        const u = peek();
        if (u === '億' || u === '万') {
          const unit = u === '億' ? 1e8 : 1e4;
          if (unit >= lastUnit) fail('「億」「万」の順序が正しくありません');
          lastUnit = unit;
          total += v * unit;
          i++;
        } else {
          total += v;
          break;
        }
      }
      if (!seen) fail(i < s.length ? `「${s[i]}」は使えません` : '式が途中で終わっています');
      return total;
    }
    function factor() {
      const c = peek();
      if (c === '(') {
        i++;
        const v = expr();
        if (peek() !== ')') fail('括弧が閉じていません');
        i++;
        return v;
      }
      if (c === '-') { i++; return -factor(); }
      if (c === '+') { i++; return factor(); }
      return number();
    }
    function term() {
      let v = factor();
      for (;;) {
        const c = peek();
        if (c === '*') { i++; v *= factor(); }
        else if (c === '/') {
          i++;
          const d = factor();
          if (d === 0) fail('0 で割っています');
          v /= d;
        } else return v;
      }
    }
    function expr() {
      let v = term();
      for (;;) {
        const c = peek();
        if (c === '+') { i++; v += term(); }
        else if (c === '-') { i++; v -= term(); }
        else return v;
      }
    }
    try {
      const v = expr();
      if (i < s.length) fail(`「${s[i]}」は使えません`);
      if (!isFinite(v)) fail('計算できません');
      if (v < 0) fail('負の額になっています');
      return { ok: true, value: v, empty: false };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ---------------------------------------------------------------
  // 2. 請求の一覧から、行列 X（請求額）・Y（認容額）を作る
  //    x[i][j]: 当事者 i から当事者 j への請求額、y[i][j]: その認容額
  //    相手方を複数選んだ請求（連帯請求など）は、相手方の数で等分する（「100000/2」と入れるのと同じ）
  // ---------------------------------------------------------------
  function zeros(n) { return Array.from({ length: n }, () => new Array(n).fill(0)); }

  function buildMatrices(n, claims) {
    const x = zeros(n), y = zeros(n);
    const issues = [];
    (claims || []).forEach((c, idx) => {
      const row = idx + 1;
      const from = Number(c.from);
      const tos = (Array.isArray(c.to) ? c.to : [c.to]).map(Number).filter((t) => Number.isInteger(t) && t >= 0 && t < n);
      const pc = parseAmount(c.claim), pa = parseAmount(c.allowed);
      if (!pc.ok) issues.push({ level: 'err', row, field: 'claim', msg: `請求 ${row}：請求額 ― ${pc.error}` });
      if (!pa.ok) issues.push({ level: 'err', row, field: 'allowed', msg: `請求 ${row}：認容額 ― ${pa.error}` });
      if (!Number.isInteger(from) || from < 0 || from >= n) { issues.push({ level: 'err', row, field: 'from', msg: `請求 ${row}：請求する当事者を選んでください` }); return; }
      if (tos.length === 0) { issues.push({ level: 'err', row, field: 'to', msg: `請求 ${row}：請求される当事者を選んでください` }); return; }
      if (tos.includes(from)) { issues.push({ level: 'err', row, field: 'to', msg: `請求 ${row}：自分自身には請求できません` }); return; }
      if (!pc.ok || !pa.ok) return;
      if (pc.empty && pa.empty) return;
      if (pa.value > pc.value + 1e-9) issues.push({ level: 'err', row, field: 'allowed', msg: `請求 ${row}：認容額が請求額を上回っています` });
      if (pc.value === 0) issues.push({ level: 'warn', row, field: 'claim', msg: `請求 ${row}：請求額が 0 です` });
      const k = tos.length;
      for (const t of tos) { x[from][t] += pc.value / k; y[from][t] += pa.value / k; }
    });
    return { x, y, issues };
  }

  // ---------------------------------------------------------------
  // 3. 負担割合 z（0〜1 の比で持つ）
  //    z[i][j]: 当事者 i が負担すべき、当事者 j に生じた費用の割合
  //    z[i][i] = (Σk x[i][k] + Σk y[k][i] − Σk y[i][k]) / D_i
  //    z[i][j] = (y[j][i] + x[i][j] − y[i][j]) / D_j   （i ≠ j）
  //    D_j = Σk x[j][k] + Σk x[k][j]（当事者 j が当事者となっている請求の額の合計）
  // ---------------------------------------------------------------
  function computeZ(x, y) {
    const n = x.length;
    const rowSum = (m, i) => m[i].reduce((a, b) => a + b, 0);
    const colSum = (m, j) => m.reduce((a, r) => a + r[j], 0);
    const den = Array.from({ length: n }, (_, j) => rowSum(x, j) + colSum(x, j));
    const z = zeros(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const num = i === j
          ? rowSum(x, i) + colSum(y, i) - rowSum(y, i)
          : y[j][i] + x[i][j] - y[i][j];
        z[i][j] = den[j] === 0 ? 0 : num / den[j];
      }
    }
    return { z, den };
  }

  // ---------------------------------------------------------------
  // 4. 分数（有理数）の小道具
  // ---------------------------------------------------------------
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
  function reduce(num, den) {
    if (num === 0) return { num: 0, den: 1 };
    const g0 = gcd(num, den);
    return { num: num / g0, den: den / g0 };
  }
  // 偶数丸め。浮動小数点の誤差で x.5 が x.4999… になるのを防ぐため、先に 9 桁にそろえる
  function roundHalfEven(v) {
    const s = Math.round(v * 1e9) / 1e9;
    const f = Math.floor(s), d = s - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }

  const DEFAULT_OPTIONS = {
    tolerance: 0.15,      // 厳密な割合からのずれの許容（相対）。±15%
    zeroBelow: 0.005,     // これを下回る割合は 0 としてよい（民訴法64条ただし書）
    smallMax: 10,         // この分母までは、ずれが最小の分母を探す
    maxDen: 100,          // 分母の上限
    andLast: true,        // 主文で、最後の費用の前を「及び」でつなぐ
  };

  // ある当事者 j に生じた費用を、各当事者がどれだけ負担するか（列 j）の分数を提案する。
  //   ratios: その列の厳密な割合（合計 1）
  //   戻り値: { den, nums: [各当事者の分子], fallback: bool, deviation }
  //   条件: 分子の合計 = 分母（費用の全部を割り付ける）／ 0 でない割合は ±tolerance 以内（zeroBelow 未満は 0 にしてよい）
  function suggestColumn(ratios, opt) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opt || {});
    const n = ratios.length;
    const total = ratios.reduce((a, b) => a + b, 0);
    if (total <= 0) return { den: 1, nums: new Array(n).fill(0), fallback: false, deviation: 0, empty: true };
    const r = ratios.map((v) => v / total);
    const tryDen = (d) => {
      const nums = r.map((v) => roundHalfEven(v * d));
      let dev = 0;
      for (let i = 0; i < n; i++) {
        const q = nums[i] / d;
        if (r[i] <= 0) { if (nums[i] !== 0) return null; continue; }
        if (nums[i] === 0) { if (r[i] < o.zeroBelow) { dev += r[i]; continue; } return null; }
        const e = Math.abs(q - r[i]);
        if (e > o.tolerance * r[i] + 1e-12) return null;
        dev += e;
      }
      if (nums.reduce((a, b) => a + b, 0) !== d) return null;
      return { den: d, nums, deviation: dev };
    };
    let best = null;
    for (let d = 1; d <= Math.min(o.smallMax, o.maxDen); d++) {
      const c = tryDen(d);
      if (c && (!best || c.deviation < best.deviation - 1e-12)) best = c;
    }
    if (!best) {
      for (let d = o.smallMax + 1; d <= o.maxDen; d++) {
        const c = tryDen(d);
        if (c) { best = c; break; }
      }
    }
    if (best) return Object.assign(best, { fallback: false });
    // 許容範囲に収まる分母が無いとき: 分母を上限にして、最大剰余法で合計を分母にそろえる
    const d = o.maxDen;
    const raw = r.map((v) => v * d);
    const nums = raw.map((v) => Math.floor(v + 1e-9));
    let rest = d - nums.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => ({ i, f: v - Math.floor(v + 1e-9) })).sort((a, b) => b.f - a.f || a.i - b.i);
    for (let k = 0; rest > 0 && k < order.length; k++, rest--) nums[order[k].i]++;
    const dev = r.reduce((a, v, i) => a + Math.abs(nums[i] / d - v), 0);
    return { den: d, nums, fallback: true, deviation: dev };
  }

  // 全列の提案。frac[i][j] = { num, den }（約分済み）
  function suggestAll(z, den, opt) {
    const n = z.length;
    const frac = Array.from({ length: n }, () => new Array(n));
    const cols = [];
    for (let j = 0; j < n; j++) {
      const col = z.map((row) => row[j]);
      const s = den[j] > 0 ? suggestColumn(col, opt) : { den: 1, nums: new Array(n).fill(0), empty: true, fallback: false, deviation: 0 };
      cols.push(s);
      for (let i = 0; i < n; i++) frac[i][j] = reduce(s.nums[i], s.den);
    }
    return { frac, cols };
  }

  // 分数の文字列（画面の入力欄用）: "全部" / "0" / "1/3"
  function fracToText(f) {
    if (!f || f.num === 0) return '0';
    if (f.num === f.den) return '全部';
    return `${f.num}/${f.den}`;
  }
  // 入力欄の文字列を分数に。"1/3"、"3分の1"、"全部"、"0"、空欄（=0）
  function parseFrac(text) {
    const s = String(text == null ? '' : text).normalize('NFKC').replace(/\s/g, '');
    if (s === '' || s === '0') return { ok: true, num: 0, den: 1 };
    if (s === '全部' || s === '1' || s === '1/1') return { ok: true, num: 1, den: 1 };
    let m = /^(\d+)\/(\d+)$/.exec(s);
    if (m) { const a = +m[1], b = +m[2]; if (b > 0 && a <= b) return Object.assign({ ok: true }, reduce(a, b)); return { ok: false, error: '1 を超える分数です' }; }
    m = /^(\d+)分の(\d+)$/.exec(s);
    if (m) { const b = +m[1], a = +m[2]; if (b > 0 && a <= b) return Object.assign({ ok: true }, reduce(a, b)); return { ok: false, error: '1 を超える分数です' }; }
    return { ok: false, error: '「1/3」「3分の1」「全部」「0」の形で入れてください' };
  }
  // 列 j の分数の合計が 1 か（有理数で厳密に）
  function columnSumIsOne(fracs) {
    let num = 0, den = 1;
    for (const f of fracs) {
      if (!f || f.num === 0) continue;
      num = num * f.den + f.num * den;
      den = den * f.den;
      const g0 = gcd(num, den) || 1;
      num /= g0; den /= g0;
    }
    return { one: num === den, num, den };
  }

  // ---------------------------------------------------------------
  // 5. 主文例
  // ---------------------------------------------------------------
  const ZEN = '０１２３４５６７８９';
  const zen = (v) => String(v).replace(/[0-9]/g, (c) => ZEN[+c]);
  function fracJa(f) { return f.num === f.den ? '全部' : `${zen(f.den)}分の${zen(f.num)}`; }

  // names: 当事者名（空なら「当事者k」）、frac[i][j]、active[j]: 当事者 j に費用が生じうるか（D_j > 0）
  // 戻り値: { full: 原則の形, short: 簡潔な形（使えるときだけ） }
  function makeDecree(names, frac, active, opt) {
    const o = Object.assign({}, DEFAULT_OPTIONS, opt || {});
    const n = names.length;
    const nm = (k) => (names[k] && String(names[k]).trim()) || `当事者${zen(k + 1)}`;
    const cols = [];
    for (let j = 0; j < n; j++) if (active[j]) cols.push(j);
    if (cols.length === 0) return { full: '', short: '' };
    const clauses = [];
    for (let i = 0; i < n; i++) {
      const items = [];
      for (const j of cols) {
        const f = frac[i][j];
        if (f && f.num > 0) items.push(`${nm(j)}に生じた費用の${fracJa(f)}`);
      }
      if (items.length === 0) continue;
      let body;
      if (o.andLast && items.length >= 2) body = items.slice(0, -1).join('、') + '及び' + items[items.length - 1];
      else body = items.join('、');
      clauses.push({ i, body });
    }
    const full = clauses.length === 0 ? ''
      : '訴訟費用は、' + clauses.map((c, k) => `${c.body}を${nm(c.i)}の${k === clauses.length - 1 ? '負担とする。' : ''}`).join('、');

    // 簡潔な形: どの当事者に生じた費用も、同じ割合で負担させるとき
    let short = '';
    const sameAll = cols.every((j) => {
      for (let i = 0; i < n; i++) {
        const a = frac[i][j], b = frac[i][cols[0]];
        if (a.num * b.den !== b.num * a.den) return false;
      }
      return true;
    });
    if (sameAll) {
      const j0 = cols[0];
      const bearers = [];
      for (let i = 0; i < n; i++) if (frac[i][j0].num > 0) bearers.push(i);
      if (bearers.length === 1) short = `訴訟費用は${nm(bearers[0])}の負担とする。`;
      else if (bearers.length >= 2) {
        let L = 1;
        for (const i of bearers) { const d = frac[i][j0].den; L = (L / gcd(L, d)) * d; }
        const parts = bearers.map((i) => ({ i, k: frac[i][j0].num * (L / frac[i][j0].den) }));
        const head = parts.slice(0, -1).map((p) => `その${zen(p.k)}を${nm(p.i)}の`).join('、');
        short = `訴訟費用はこれを${zen(L)}分し、${head}負担とし、その余を${nm(parts[parts.length - 1].i)}の負担とする。`;
      }
    }
    return { full, short };
  }

  // ---------------------------------------------------------------
  // 6. まとめて計算する（画面とテストから使う）
  //    state: { parties: [{ name }], claims: [{ from, to: [..], claim, allowed }], overrides: { "i,j": "1/3" }, options }
  // ---------------------------------------------------------------
  function run(state) {
    const n = (state.parties || []).length;
    const names = state.parties.map((p) => p.name || '');
    const who = (k) => `${k + 1}：${String(names[k]).trim() || '当事者' + (k + 1)}`;
    const { x, y, issues } = buildMatrices(n, state.claims);
    const { z, den } = computeZ(x, y);
    const active = den.map((d) => d > 0);
    const opt = state.options || {};
    const sugg = suggestAll(z, den, opt);
    // 利用者が直した分数を当てる
    const frac = sugg.frac.map((row) => row.slice());
    const fracIssues = [];
    const ov = state.overrides || {};
    for (const key of Object.keys(ov)) {
      const [i, j] = key.split(',').map(Number);
      if (!(i >= 0 && i < n && j >= 0 && j < n)) continue;
      const p = parseFrac(ov[key]);
      if (p.ok) frac[i][j] = { num: p.num, den: p.den };
      else fracIssues.push({ level: 'err', i, j, msg: `${who(i)}が負担する、${who(j)}に生じた費用の分数：${p.error}` });
    }
    const colCheck = [];
    for (let j = 0; j < n; j++) {
      const c = columnSumIsOne(frac.map((row) => row[j]));
      colCheck.push(active[j] ? c.one : c.num === 0);
      if (active[j] && !c.one) fracIssues.push({ level: 'err', j, msg: `${who(j)}に生じた費用の分数の合計が 1 になっていません（${c.num}/${c.den}）` });
      if (!active[j] && c.num !== 0) fracIssues.push({ level: 'err', j, msg: `${who(j)}は請求に関わっていないので、その費用の分数は 0 にしてください` });
      if (active[j] && sugg.cols[j].fallback && !Object.keys(ov).some((k) => k.endsWith(',' + j))) {
        fracIssues.push({ level: 'warn', j, msg: `${who(j)}に生じた費用は、ずれ ±${Math.round((opt.tolerance ?? DEFAULT_OPTIONS.tolerance) * 100)}% に収まる分母が ${opt.maxDen ?? DEFAULT_OPTIONS.maxDen} までに無いため、分母 ${sugg.cols[j].den} で配分しました` });
      }
    }
    for (let i = 0; i < n; i++) if (!active[i] && n > 0) issues.push({ level: 'warn', msg: `${who(i)}は、どの請求にも関わっていません` });
    // 入力に誤りがあるときは、分数の注意は出さない（入力を直すのが先）
    if (issues.some((e) => e.level === 'err')) fracIssues.length = 0;
    const hasErr = issues.some((e) => e.level === 'err') || fracIssues.some((e) => e.level === 'err');
    const zNeg = z.some((row) => row.some((v) => v < -1e-12));
    const decree = hasErr || zNeg ? { full: '', short: '' } : makeDecree(names, frac, active, opt);
    return { n, x, y, z, den, active, suggested: sugg.frac, cols: sugg.cols, frac, colCheck, issues, fracIssues, hasErr: hasErr || zNeg, decree };
  }

  Object.assign(C64, {
    DEFAULT_OPTIONS, normalizeExpr, parseAmount, buildMatrices, computeZ,
    roundHalfEven, reduce, gcd, suggestColumn, suggestAll, fracToText, parseFrac, columnSumIsOne,
    zen, fracJa, makeDecree, run,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
