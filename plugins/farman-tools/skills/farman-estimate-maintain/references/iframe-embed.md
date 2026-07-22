# 自社HPへのiframe埋め込み

FARMAN見積システム（GAS Web App）を自社HPに埋め込むときの手順と注意点。

## 前提: X-Frame許可

`コード.js` の `doGet` に以下が入っていること（既存・消さない）:
```js
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```
これが無いとブラウザが埋め込みをブロックする。

## 埋め込みタグ（推奨）

Web AppのデプロイURL（`.../exec` で終わるもの）を `src` に入れる:

**iframeの開始タグは1行に収める**こと。WordPressのクラシックエディタ（コードタブ）は
自動整形でタグ途中の改行に `<br />` を差し込みタグを壊す。`<script>` / `<style>` の中身は
保護されるので自由に改行してよい。

```html
<div style="max-width:880px;margin:0 auto;">
<iframe id="farman-estimate" src="https://script.google.com/macros/s/＜デプロイID＞/exec" title="FARMAN Estimate system" style="width:100%;height:1250px;border:0;display:block;" loading="lazy"></iframe>
</div>
<script>
(function () {
  var f = document.getElementById('farman-estimate');
  window.addEventListener('message', function (e) {
    if (e.origin.indexOf('google') === -1) return;
    var h = e.data && e.data.farmanEstimateHeight;
    if (typeof h === 'number' && h > 300 && h < 20000) {
      f.style.height = (h + 4) + 'px';
    }
  });
})();
</script>
```

- `max-width:880px` はアプリ本体の最大幅（`.app{max-width:820px}`）に余白を足した値
- `height:1250px` は**読み込み直後の初期値**。すぐ自動調整に上書きされる（下記）

## 高さの自動調整（実装済み・重要）

GASは開発者のHTMLを**Google側の内部iframe**（`userCodeAppPanel`）で包んで返す。それを自社HPの
iframeでさらに包むので実体は **iframe in iframe** で、親ページからは中身の高さが検知できない。
固定高さのままだと**画面によって「下に余白」と「iframe内スクロール」の両方が起きる**ため、
`index.html` 末尾の `initHeightReporter()` が実際の高さを `window.top.postMessage` で親へ送り、
上記のリスナーがiframeを追従させる。実測で全画面とも内部スクロールなし・余白数px・追従1〜12ms。

改修時に壊さないための要点:

- 高さは `document.body.getBoundingClientRect().height` で測る。
  `documentElement.scrollHeight` は**iframeの高さ以上を返すので縮まなくなる**（罠）
- 送信を間引くしきい値は**小さく保つ**（現状2px）。大きくすると数px足りずに
  iframe内スクロールバーが出る。親側で `+4px` の余裕も持たせている
- `showScreen()` / `showStep()` の末尾で `window.__reportHeight()` を直接呼んでいる。
  ResizeObserver任せだと反映に0.3秒ほどかかり切替時にガタつくため。
  **画面遷移の関数を追加したら同じ1行を足す**こと
- 親がリスナーを持たない場合はiframeの `height` 指定のまま（従来動作）になるだけで壊れない

## そのほかの構造上の注意

- **ステップ遷移時に親ページはスクロールしない**。`window.scrollTo({top:0})` は内側フレーム内で
  完結する。高さが自動追従するようになったため、画面全体が常に見えていて実害はない
- **コンソール警告 `An iframe which has both allow-scripts and allow-same-origin...` は無害**。
  Google側のサンドボックスiframeが出しているもので、こちらのコード起因ではない

## ログイン不要で動く

`access: ANYONE_ANONYMOUS` / `executeAs: USER_DEPLOYING` のため、閲覧者のGoogleログインや
第三者Cookieに依存せず動作する。埋め込み先で「ログインを求められる」問題は起きない構成。

## 動作確認

埋め込み後、iframe内のフッターに `v＜APP_VERSION＞` が表示され、想定した版数になっているかを確認する。
番号が古ければ再デプロイの「新バージョン」指定が漏れている（`architecture.md` / SKILL.mdのデプロイ手順参照）。
