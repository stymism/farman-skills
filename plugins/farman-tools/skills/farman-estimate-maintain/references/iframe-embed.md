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

```html
<iframe
  src="https://script.google.com/macros/s/＜デプロイID＞/exec"
  style="width:100%;max-width:860px;height:1200px;border:0;display:block;margin:0 auto;"
  title="FARMANお見積りシミュレーター"
  loading="lazy"></iframe>
```

- `max-width:860px` はアプリ本体の最大幅（`.app{max-width:820px}`）に合わせた余白込みの値
- `height` は**十分に高く固定**する（下記の理由）

## 二重iframeという構造上の注意

GASは開発者のHTMLを**Google側の内部iframe**（`userCodeAppPanel`）で包んで返す。それを自社HPの
iframeでさらに包むので、実体は **iframe in iframe**。ここから来る制約:

1. **高さが自動フィットしない**
   中身の高さを親ページが検知できないため、`iframe` の高さは自分で決める必要がある。品目グリッドや
   カレンダー展開で縦に伸びるので、**1000〜1200px程度**を見込んでおく。足りないと中身がiframe内スクロールになる。

2. **ステップ遷移時に親ページはスクロールしない**
   「次へ」等で呼ぶ `window.scrollTo({top:0})` は内側フレーム内で完結し、親ページのスクロール位置は動かない。
   高さを十分取っておけば、画面遷移が常に見える範囲に収まり違和感が出ない。

3. **コンソール警告 `An iframe which has both allow-scripts and allow-same-origin...` は無害**
   Google側のサンドボックスiframeが出しているもので、こちらのコード起因ではない。対処不要。

## ログイン不要で動く

`access: ANYONE_ANONYMOUS` / `executeAs: USER_DEPLOYING` のため、閲覧者のGoogleログインや
第三者Cookieに依存せず動作する。埋め込み先で「ログインを求められる」問題は起きない構成。

## 動作確認

埋め込み後、iframe内のフッターに `v＜APP_VERSION＞` が表示され、想定した版数になっているかを確認する。
番号が古ければ再デプロイの「新バージョン」指定が漏れている（`architecture.md` / SKILL.mdのデプロイ手順参照）。
