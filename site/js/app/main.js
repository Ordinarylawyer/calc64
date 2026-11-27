// Calc64 ― 画面
// 入力はこのページの変数（state）にだけ持つ。外部への送信・ブラウザの保存領域は使わない（tests/privacy.mjs）。
(function () {
  'use strict';
  const C = window.C64;
  // リポジトリの URL は index.html の a.repo から取る（JS に外部の URL を書かない。tests/privacy.mjs）
  const repoLink = document.querySelector('a.repo');
  const REPO = repoLink ? repoLink.href.replace(/\/$/, '') : '';
  const FORMAT = 'calc64';

  const blankState = () => ({
    parties: [{ name: '' }, { name: '' }],
    claims: [{ from: 0, to: [1], claim: '', allowed: '', memo: '' }],
    overrides: {},
    options: Object.assign({}, C.DEFAULT_OPTIONS),
  });
  // 例（架空の事件）
  const sampleState = () => ({
    parties: [{ name: '原告Ａ社' }, { name: '被告Ｂ' }, { name: '被告Ｃ' }, { name: '参加人Ｄ' }],
    claims: [
      { from: 0, to: [1, 2], claim: '600万', allowed: '400万', memo: '本訴（連帯）' },
      { from: 1, to: [0], claim: '150万', allowed: '50万', memo: '反訴' },
      { from: 3, to: [0], claim: '100万', allowed: '0', memo: '独立当事者参加' },
    ],
    overrides: {},
    options: Object.assign({}, C.DEFAULT_OPTIONS),
  });
  let state = blankState();
  let last = null; // 直近の計算結果

  // ---- 小道具 ----
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
    return el;
  }
  const yen = (v) => {
    const r = Math.round(v * 100) / 100;
    const [a, b] = String(r).split('.');
    return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '') + '円';
  };
  const pct = (v) => (v * 100).toFixed(2) + '%';
  const partyLabel = (k) => `${k + 1}：${(state.parties[k].name || '').trim() || '当事者' + (k + 1)}`;
  // 当事者名を表示する箇所（請求の選択肢など）。名前を打つたびに、ここだけ直す（入力欄のフォーカスを保つ）
  const plabel = (k) => h('span', { 'data-plabel': String(k) }, partyLabel(k));
  function refreshLabels() {
    for (const el of app.querySelectorAll('[data-plabel]')) el.textContent = partyLabel(Number(el.getAttribute('data-plabel')));
  }
  function toast(msg, cls) {
    const t = h('div', { class: 'toast' + (cls ? ' ' + cls : '') }, msg);
    document.getElementById('toasts').append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  // ---- 全体の描画 ----
  const app = document.getElementById('app');
  function renderAll() {
    app.replaceChildren(intro(), partiesCard(), claimsCard(), h('div', { id: 'results' }), ioCard());
    renderResults();
  }

  function intro() {
    return h('details', { class: 'intro', open: true },
      h('summary', {}, 'この画面について（使い方・計算の考え方）'),
      h('p', {}, '当事者が多く、本訴・反訴・参加などで請求が入り組んだ事件で、各当事者に生じた訴訟費用のうち、どの当事者がどれだけ負担するかを、訴額と勝訴の割合で按分して計算し、主文例を作ります（民訴法61条・64条本文）。'),
      h('ol', {},
        h('li', {}, '「当事者」に当事者を入れます（名前は任意。主文例に使います）。'),
        h('li', {}, '「請求と認容」に、請求ごとに、請求する当事者・請求される当事者・請求額・認容額を入れます。全部棄却は認容額 0（空欄でも可）です。'),
        h('li', {}, '「負担割合と主文例」に、厳密な割合（%）、提案する分数、主文例が出ます。分数は直せます（各列の合計は 1 に）。')),
      h('ul', {},
        h('li', {}, '金額は「668919」「66万8919」「66万8919円」「1,000,000」のほか、四則演算（＋ − × ÷ ／ * と括弧）でも入れられます。'),
        h('li', {}, '請求される当事者を複数選ぶと（連帯請求など）、請求額・認容額をその人数で等分して計算します。等分が相当でないときは、相手方ごとに行を分けて額を入れてください。'),
        h('li', {}, '表は、行が負担する当事者、列が費用の生じた当事者です。各列の合計は 100% になります。'),
        h('li', {}, '分数は、厳密な割合とのずれが ±15% 以内で、各列の分子の合計が分母と一致する、なるべく小さな分母のものを提案します（0.5% 未満は 0 にできます。民訴法64条ただし書）。条件は「提案の条件」で変えられます。')),
      h('p', {}, '負担の定めは裁判所の裁量によります（民訴法64条）。計算の結果と主文例は、確かめてから使ってください。計算式と分数の選び方は ',
        h('a', { href: REPO + '/blob/main/docs/00_設計.md', target: '_blank', rel: 'noopener noreferrer' }, '設計（計算の考え方）'), ' にあります。'),
      h('p', { class: 'issue-links' }, '誤りの報告・改善の提案：',
        h('a', { href: REPO + '/issues/new?template=report.yml', target: '_blank', rel: 'noopener noreferrer' }, '誤りの報告'), '／',
        h('a', { href: REPO + '/issues/new?template=suggest.yml', target: '_blank', rel: 'noopener noreferrer' }, '改善の提案'),
        '（GitHub の Issue。事件を特定できる情報は書かないでください）'));
  }

  // ---- 当事者 ----
  function partiesCard() {
    const rows = state.parties.map((p, k) => h('tr', {},
      h('td', { class: 'id' }, String(k + 1)),
      h('td', {}, h('input', {
        class: 'in name', value: p.name, placeholder: '当事者' + (k + 1), 'aria-label': `当事者${k + 1}の名前`,
        oninput: (e) => { p.name = e.target.value; refreshLabels(); renderResults(); },
      })),
      h('td', {}, h('button', { class: 'btn icon danger', title: 'この当事者を削除', 'aria-label': `当事者${k + 1}を削除`, disabled: state.parties.length <= 2, onclick: () => removeParty(k) }, '✕'))));
    return h('section', { class: 'card' },
      h('h2', {}, '1　当事者'),
      h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, h('th', {}, '番号'), h('th', {}, '名前（主文例に使う。例：原告Ａ社）'), h('th', {}, ''))), h('tbody', {}, rows)),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { state.parties.push({ name: '' }); state.overrides = {}; renderAll(); } }, '＋ 当事者を足す')));
  }
  function removeParty(k) {
    const name = partyLabel(k);
    state.parties.splice(k, 1);
    const map = (t) => (t > k ? t - 1 : t);
    const before = state.claims.length;
    let shrunk = 0;
    state.claims = state.claims
      .filter((c) => c.from !== k)
      .map((c) => {
        if (c.to.includes(k)) shrunk++;
        return Object.assign(c, { from: map(c.from), to: c.to.filter((t) => t !== k).map(map) });
      });
    state.overrides = {};
    renderAll();
    const removed = before - state.claims.length;
    toast(`${name} を削除しました` + (removed ? `（この当事者からの請求 ${removed} 件も削除）` : '') + (shrunk ? `。相手方から外した請求が ${shrunk} 件あります。額を確かめてください` : ''), shrunk ? 'err' : '');
  }

  // ---- 請求と認容 ----
  function claimsCard() {
    const n = state.parties.length;
    const rows = state.claims.map((c, r) => {
      const fromSel = h('select', { class: 'in', 'aria-label': `請求${r + 1}の請求する当事者`, onchange: (e) => { c.from = Number(e.target.value); renderAll(); } },
        state.parties.map((_, k) => h('option', { value: String(k), selected: c.from === k ? 'selected' : null, 'data-plabel': String(k) }, partyLabel(k))));
      const tos = h('div', { class: 'tos', role: 'group', 'aria-label': `請求${r + 1}の請求される当事者` },
        state.parties.map((_, k) => k === c.from ? null : h('label', { class: 'chk' },
          h('input', { type: 'checkbox', checked: c.to.includes(k), onchange: (e) => {
            c.to = e.target.checked ? [...c.to, k].sort((a, b) => a - b) : c.to.filter((t) => t !== k);
            renderResults();
          } }), plabel(k))));
      const amt = (field, label) => h('td', {},
        h('input', { class: 'in amt', value: c[field], inputmode: 'text', placeholder: field === 'allowed' ? '0（棄却）' : '', 'aria-label': `請求${r + 1}の${label}`, 'data-row': String(r), 'data-field': field,
          oninput: (e) => { c[field] = e.target.value; renderResults(); } }),
        h('span', { class: 'val', 'data-val': `${r}:${field}` }));
      return h('tr', { 'data-claim': String(r) },
        h('td', { class: 'id' }, String(r + 1)),
        h('td', {}, fromSel),
        h('td', {}, tos),
        amt('claim', '請求額'),
        amt('allowed', '認容額'),
        h('td', {}, h('input', { class: 'in memo', value: c.memo || '', placeholder: '本訴・反訴など', 'aria-label': `請求${r + 1}のメモ`, oninput: (e) => { c.memo = e.target.value; } })),
        h('td', {}, h('button', { class: 'btn icon danger', title: 'この請求を削除', 'aria-label': `請求${r + 1}を削除`, onclick: () => { state.claims.splice(r, 1); renderAll(); } }, '✕')));
    });
    return h('section', { class: 'card' },
      h('h2', {}, '2　請求と認容'),
      h('p', { class: 'hint' }, '請求の趣旨ごとに 1 行。附帯請求（遅延損害金など）は、通常は訴額に入らないので入れません。'),
      h('p', { class: 'hint' }, '連帯請求の場合は、請求額満額を被告側の数で頭割りしたり、請求額全額を全被告に割り付けたりするなど、適宜の方法で割り付けてください。なお、四則演算（＋ − × ÷ ／ * と括弧）も使用可能です。'),
      h('div', { class: 'scroll' }, h('table', { class: 'grid' },
        h('thead', {}, h('tr', {}, h('th', {}, '番号'), h('th', {}, '請求する当事者'), h('th', {}, '請求される当事者（複数可）'), h('th', {}, '請求額'), h('th', {}, '認容額'), h('th', {}, 'メモ'), h('th', {}, ''))),
        h('tbody', {}, rows))),
      h('div', { class: 'row' }, h('button', { class: 'btn small', disabled: n < 2, onclick: () => {
        const prev = state.claims[state.claims.length - 1];
        state.claims.push({ from: prev ? prev.from : 0, to: prev ? prev.to.slice() : [1], claim: '', allowed: '', memo: '' });
        renderAll();
      } }, '＋ 請求を足す')));
  }
  function updateClaimHints() {
    for (const el of app.querySelectorAll('[data-val]')) {
      const [r, field] = el.getAttribute('data-val').split(':');
      const c = state.claims[Number(r)];
      if (!c) continue;
      const p = C.parseAmount(c[field]);
      const input = app.querySelector(`input[data-row="${r}"][data-field="${field}"]`);
      const k = c.to.length;
      if (!p.ok) { el.textContent = p.error; el.className = 'val err'; input.classList.add('bad'); continue; }
      input.classList.remove('bad');
      el.className = 'val';
      const raw = C.normalizeExpr(c[field]);
      const plain = /^\d+$/.test(raw);
      let t = p.empty || plain ? '' : '＝ ' + yen(p.value);
      if (!p.empty && k >= 2) t += `（1人当たり ${yen(p.value / k)}）`;
      el.textContent = t;
    }
    for (const tr of app.querySelectorAll('tr[data-claim]')) {
      const r = Number(tr.getAttribute('data-claim')) + 1;
      const bad = last && last.issues.some((e) => e.row === r && e.level === 'err' && e.field === 'allowed');
      tr.classList.toggle('bad', !!bad);
    }
  }

  // ---- 結果 ----
  function renderResults() {
    const box = document.getElementById('results');
    if (!box) return;
    last = C.run(state);
    updateClaimHints();
    const n = last.n;
    const card = h('section', { class: 'card' }, h('h2', {}, '3　負担割合と主文例'));
    const issues = [...last.issues, ...last.fracIssues];
    if (issues.length) card.append(h('ul', { class: 'issues' }, issues.map((e) => h('li', { class: e.level }, e.msg))));
    if (last.active.every((a) => !a)) {
      card.append(h('p', { class: 'hint' }, '請求額を入れると、ここに結果が出ます。'));
      box.replaceChildren(card);
      return;
    }

    // 主文例
    const d = last.decree;
    if (last.hasErr) card.append(h('p', { class: 'err' }, '上の誤りを直すと、主文例が出ます。'));
    else {
      const decreeBox = (label, text) => h('div', { class: 'decree-box' },
        h('div', { class: 'label' }, label),
        h('textarea', { class: 'decree', readonly: true, rows: Math.min(8, Math.max(2, Math.ceil(text.length / 60))), 'aria-label': label, onfocus: (e) => e.target.select() }, text),
        h('div', { class: 'row noprint' }, h('button', { class: 'btn small primary', onclick: () => copy(text) }, 'コピー')));
      card.append(decreeBox('主文例（当事者ごとに、各当事者に生じた費用の負担割合を定める形）', d.full));
      if (d.short && d.short !== d.full) card.append(decreeBox('主文例（簡潔な形。どの当事者に生じた費用も同じ割合で負担させるので、この形でも同じ内容です）', d.short));
      const edited = Object.keys(state.overrides).length;
      if (edited) card.append(h('p', { class: 'hint warn' }, `手で直した分数が ${edited} か所あります（黄色の欄）。`, h('button', { class: 'btn small', onclick: () => { state.overrides = {}; renderResults(); } }, '提案に戻す')));
    }

    // 負担割合の表
    card.append(h('h3', {}, '負担割合（上段：提案する分数〔直せます〕、下段：厳密な割合）'));
    card.append(h('p', { class: 'axis' }, '行 ＝ 負担する当事者 ／ 列 ＝ 費用が生じた当事者。例：2 行 1 列は「当事者1に生じた費用のうち、当事者2が負担する割合」。'));
    const head1 = h('tr', {}, h('th', { class: 'rh' }, '負担する当事者 ＼ 費用が生じた当事者'), state.parties.map((_, j) => h('th', {}, partyLabel(j))));
    const head2 = h('tr', {}, h('th', { class: 'rh sub' }, '関わる請求の額の合計'), last.den.map((v) => h('th', { class: 'sub' }, v > 0 ? yen(v) : '—')));
    const body = [];
    for (let i = 0; i < n; i++) {
      body.push(h('tr', {}, h('th', { class: 'rh' }, partyLabel(i)), state.parties.map((_, j) => {
        if (!last.active[j]) return h('td', { class: 'na' }, '—');
        const key = `${i},${j}`;
        const sugg = C.fracToText(last.suggested[i][j]);
        const cur = key in state.overrides ? state.overrides[key] : sugg;
        const zero = last.z[i][j] === 0;
        return h('td', { class: 'cell' + (i === j ? ' diag' : '') + (zero ? ' zero' : '') },
          h('input', { class: 'in frac' + (key in state.overrides ? ' edited' : ''), value: cur, 'aria-label': `${partyLabel(i)}が負担する、${partyLabel(j)}に生じた費用の割合`, title: `提案：${sugg}`,
            onchange: (e) => {
              const v = e.target.value.trim();
              if (v === sugg || (v === '' && sugg === '0')) delete state.overrides[key]; else state.overrides[key] = v;
              renderResults();
            } }),
          h('span', { class: 'pct' }, pct(last.z[i][j])));
      })));
    }
    const sumRow = h('tr', { class: 'sum' }, h('th', { class: 'rh' }, '列の合計'), state.parties.map((_, j) => {
      if (!last.active[j]) return h('td', { class: 'na' }, '—');
      const s = last.z.reduce((a, r) => a + r[j], 0);
      return h('td', {}, h('span', { class: last.colCheck[j] ? 'ok' : 'err' }, last.colCheck[j] ? '分数 ✓' : '分数 ✕'), ' ', pct(s));
    }));
    card.append(h('div', { class: 'scroll' }, h('table', { class: 'grid ratio' }, h('thead', {}, head1, head2), h('tbody', {}, body, sumRow))));

    // 請求額・認容額の行列（入力の集計）
    const mat = (m, other, over) => h('table', { class: 'grid mat' },
      h('thead', {}, h('tr', {}, h('th', {}, '請求する ＼ される'), state.parties.map((_, j) => h('th', {}, partyLabel(j))))),
      h('tbody', {}, m.map((row, i) => h('tr', {}, h('th', {}, partyLabel(i)), row.map((v, j) => h('td', { class: i === j ? 'diag' : over && v > other[i][j] + 1e-9 ? 'over' : '' }, i === j ? '—' : v ? yen(v) : ''))))));
    card.append(h('details', { class: 'opts' }, h('summary', {}, '請求額・認容額の行列（入力の集計。行が請求する当事者）'),
      h('h3', {}, '請求額 X'), h('div', { class: 'scroll' }, mat(last.x, last.y, false)),
      h('h3', {}, '認容額 Y'), h('div', { class: 'scroll' }, mat(last.y, last.x, true))));

    card.append(optionsBox());
    box.replaceChildren(card);
  }

  function optionsBox() {
    const o = state.options;
    const num = (key, label, unit, scale, min, max, step) => h('label', {}, label,
      h('input', { class: 'in opt', type: 'number', min, max, step, value: String(+(o[key] * scale).toFixed(4)),
        onchange: (e) => {
          const v = Number(e.target.value);
          if (!isFinite(v) || v < min || v > max) { toast(`${label}は ${min}〜${max} で入れてください`, 'err'); e.target.value = String(+(o[key] * scale).toFixed(4)); return; }
          o[key] = scale === 1 ? Math.round(v) : v / scale;
          state.overrides = {};
          renderResults();
        } }), unit);
    return h('details', { class: 'opts' }, h('summary', {}, '提案の条件（分数の選び方・主文例の書き方）'),
      h('div', { class: 'row' },
        num('tolerance', '厳密な割合からのずれ ±', '%', 100, 0, 100, 1),
        num('zeroBelow', '0 にしてよい割合', '% 未満', 100, 0, 50, 0.1),
        num('smallMax', 'ずれが最小の分母を探す範囲：分母', 'まで', 1, 1, 100, 1),
        num('maxDen', '分母の上限', '', 1, 2, 1000, 1)),
      h('div', { class: 'row' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: o.andLast, onchange: (e) => { o.andLast = e.target.checked; renderResults(); } }), '主文例で、最後の費用の前を「及び」でつなぐ')),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { state.options = Object.assign({}, C.DEFAULT_OPTIONS); state.overrides = {}; renderResults(); } }, '初めの条件に戻す')),
      h('p', { class: 'hint' }, '条件を変えると、手で直した分数は提案に戻ります。'));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('主文例をコピーしました');
    } catch (e) {
      toast('コピーできませんでした。欄の中を選んでコピーしてください', 'err');
    }
  }

  // ---- 保存・読込 ----
  function ioCard() {
    const file = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden-file', 'aria-label': 'JSON ファイルを選ぶ', onchange: (e) => load(e.target.files[0]) });
    return h('section', { class: 'card noprint' },
      h('h2', {}, '保存・読込'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: save }, 'JSON に保存'),
        h('label', { class: 'btn' }, 'JSON を読み込む', file),
        h('button', { class: 'btn', onclick: () => { if (dirty() && !confirm('いまの入力を消して、例（架空の事件）を読み込みますか。')) return; state = sampleState(); renderAll(); toast('例を読み込みました'); } }, '例を読み込む'),
        h('button', { class: 'btn danger', onclick: () => { if (dirty() && !confirm('入力をすべて消しますか。')) return; state = blankState(); renderAll(); } }, 'すべて消す')),
      h('p', { class: 'hint' }, 'JSON の保存・読込もブラウザの中で行い、どこにも送りません。JSON は暗号化されていないので、取扱いは所属の定めに従ってください。'));
  }
  const dirty = () => state.parties.some((p) => p.name) || state.claims.some((c) => c.claim || c.allowed);
  function save() {
    const data = { format: FORMAT, version: 1, savedAt: new Date().toISOString(), parties: state.parties, claims: state.claims, overrides: state.overrides, options: state.options };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'calc64_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.json' });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function load(f) {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        state = fromJson(JSON.parse(String(rd.result)));
        renderAll();
        toast('読み込みました');
      } catch (e) {
        toast('読み込めませんでした：' + e.message, 'err');
      }
    };
    rd.readAsText(f, 'utf-8');
  }
  function fromJson(d) {
    if (!d || d.format !== FORMAT) throw new Error('Calc64 で保存した JSON ではありません');
    const parties = (d.parties || []).map((p) => ({ name: String((p && p.name) || '') }));
    if (parties.length < 2) throw new Error('当事者が 2 人未満です');
    const n = parties.length;
    const ok = (k) => Number.isInteger(k) && k >= 0 && k < n;
    const claims = (d.claims || []).map((c) => ({
      from: ok(c.from) ? c.from : 0,
      to: (Array.isArray(c.to) ? c.to : [c.to]).filter(ok),
      claim: String(c.claim ?? ''), allowed: String(c.allowed ?? ''), memo: String(c.memo ?? ''),
    }));
    const overrides = {};
    for (const [k, v] of Object.entries(d.overrides || {})) if (/^\d+,\d+$/.test(k)) overrides[k] = String(v);
    const options = Object.assign({}, C.DEFAULT_OPTIONS);
    for (const k of Object.keys(options)) if (d.options && typeof d.options[k] === typeof options[k]) options[k] = d.options[k];
    return { parties, claims, overrides, options };
  }

  // テストから使う
  window.Calc64App = { getState: () => state, setState: (s) => { state = fromJson(s); renderAll(); }, sampleState, fromJson };
  renderAll();
})();
