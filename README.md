# calc64

<p align="center"><img src="site/icon-192.png" width="128" height="128" alt="Calc64 のアイコン（民訴法64条の「64」をモチーフにしたロゴ）"></p>

訴訟費用の負担割合（民訴法61条・64条）を、当事者間の請求額と認容額から計算し、主文例を作る Web アプリです（Calc64 ― 訴訟費用負担割合計算機）。**ブラウザの中だけで動き、入力した情報をどこにも送りません。**

本訴・反訴・別訴の併合、独立当事者参加などで当事者が多く、請求が入り組んだ事件で、**各当事者について、自分と他の当事者に生じた費用のうち負担すべき割合を定める形**の主文を作るのに使います。

- 請求ごとに請求額・認容額を入れると、厳密な負担割合（%）を計算します。
- 主文に書きやすい分数を提案します（ずれ ±15% 以内・各列の合計がちょうど 1。分数は直せます）。
- 当事者名を入れておけば、そのまま貼り付けられる主文例を作ります（2 当事者などでは「訴訟費用はこれを５分し、…」の形もあわせて示します）。

計算の考え方は [docs/00_設計.md](docs/00_設計.md) にあります。

## 使い方

公開ページ: **https://ordinarylawyer.github.io/calc64/** をブラウザ（Edge・Chrome）で開きます。

手元で使うときは、このリポジトリを ZIP でダウンロードして展開し（GitHub の［Code］→［Download ZIP］）、`site/index.html` をダブルクリックして開きます。動きは公開ページと同じです。

1. 「当事者」に当事者を入れます（名前は任意。主文例に使います）。
2. 「請求と認容」に、請求ごとに、請求する当事者・請求される当事者・請求額・認容額を入れます。
   - 金額は `668919`、`66万8919円`、`1,000,000` のほか、四則演算（`+ - × ÷ * /` と括弧）でも入れられます。
   - 請求される当事者を複数選ぶと（連帯請求など）、額をその人数で等分します。
3. 「負担割合と主文例」に、負担割合の表（行＝負担する当事者、列＝費用が生じた当事者）と主文例が出ます。

続きをするときは「保存・読込」で JSON ファイルを保存し、読み込みます。

## 入力を外に出さないために

- 計算は、すべてブラウザの中で行います。サーバーで動くものはありません。
- `site/index.html` の CSP（Content-Security-Policy）で、外部との通信を禁止しています（`connect-src 'none'` など）。
- 外部の CDN・フォント・アクセス解析は使いません。ブラウザの保存領域（localStorage など）・Cookie も使いません。閉じると入力は消えます。
- GitHub Pages で配信する場合、GitHub はセキュリティのために閲覧者の IP アドレスを記録します（[About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) の Data collection）。入力した内容は含まれません。
- 保存は、利用者が JSON ファイルを手元に保存する方式です（読込みもブラウザの中で行い、アップロードはしません）。JSON は暗号化されていないので、取扱いは所属の定めに従ってください。
- これらは `tests/privacy.mjs` で確かめています。

## 中身

| 場所 | 内容 |
|---|---|
| `site/` | Web アプリ（HTML・CSS・JavaScript。ビルド不要） |
| `site/js/engine/calc64.js` | 計算エンジン |
| `site/js/app/main.js` | 画面 |
| `tests/` | テスト（`node tests/run.mjs`。Node.js 18 以上、追加のパッケージは不要） |
| `docs/00_設計.md` | 設計（計算の考え方） |

## 誤りの報告・改善の提案

GitHub の Issue（[誤りの報告](https://github.com/Ordinarylawyer/calc64/issues/new?template=report.yml)／[改善の提案](https://github.com/Ordinarylawyer/calc64/issues/new?template=suggest.yml)）へお寄せください。直接直す場合の手順は [CONTRIBUTING.md](CONTRIBUTING.md) にあります。事件の当事者名・事件番号など、個別の事件を特定できる情報は書かないでください。

## ライセンス

[MIT License](LICENSE)

負担の定めは裁判所の裁量によります（民訴法64条）。計算の結果や主文例は、利用者の責任で確かめてから使ってください。
