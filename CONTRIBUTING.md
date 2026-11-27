# 誤りの報告・改善の提案のしかた

## Issue で知らせる

- 誤りを見つけたときは「[誤りの報告](https://github.com/Ordinarylawyer/calc64/issues/new?template=report.yml)」、使い勝手や機能の提案は「[改善の提案](https://github.com/Ordinarylawyer/calc64/issues/new?template=suggest.yml)」から Issue を作ってください。
- アプリの「この画面について」の末尾と、画面下のリンクからも開けます。
- **事件の当事者名・事件番号など、個別の事件を特定できる情報は書かないでください。** 保存した JSON もそのまま貼らないでください。計算例を示すときは、架空の事例に置き換えてください。

## 直接直す（Pull Request）

### 何を直すか（どのファイルを直すか）

| 直したいもの | 直すファイル |
|---|---|
| 負担割合の計算・分数の提案・主文例の文言 | `site/js/engine/calc64.js` |
| 画面・説明文 | `site/js/app/main.js`・`site/css/app.css` |
| 計算の考え方の説明 | `docs/00_設計.md` |

### 手順

1. 上のファイルを直します。
2. `node tests/run.mjs` を実行し、`ALL PASS` になることを確かめます（Node.js 18 以上。追加のパッケージは要りません）。
3. Pull Request を作ります。根拠（法令・文献などと、確認した日）を書いてください。計算や主文例を変えるときは、`tests/engine.mjs` に架空の事例と期待値を足してください。

### 守ってほしいこと

- 入力した情報をブラウザの外に出さない作りを崩さないでください。外部との通信（fetch など）・ブラウザの保存領域・Cookie・外部の CDN やフォント・アクセス解析は使いません（`tests/privacy.mjs` が確かめます）。JS に外部の URL を書かないでください（リポジトリへのリンクは `site/index.html` の `a.repo` から取ります）。
- テスト用の事例は架空のものにしてください。
