# 画像（アイキャッチ＋本文画像）を全件に入れる

各投稿に「アイキャッチ画像(featured_media)」と「本文先頭の画像」を両方入れる運用。
素材は各記事の元ページから拾い、REST の media エンドポイントにアップロードして使う。

## 手順の全体像

1. **素材URLを集める**（元ページの og:image / 記事内の主要画像 / 動画サムネ）。
2. **ブラウザ内で画像を取得 → REST で media にアップロード → media ID取得**。
3. 各投稿を PATCH: `featured_media` に ID をセットし、本文先頭に `<img>` を prepend。

## 素材の探し方

- **PR TIMES / 一般サイト**: `og:image` を使う。curl で
  `curl -sL <url> | grep -oiE '<meta[^>]+og:image[^>]*>'`。
  PR TIMESの og:image は `prcdn.freetls.fastly.net/release_image/...` 形式で、
  `?format=jpeg&fit=bounds&width=1600` を付けるとJPEGで取れる。
- **og:image がサイト共通ロゴだった場合**（例: 山梨県移住ポータル、埼玉NBC）は、
  記事内の主要画像を拾う: `curl -sL <url> | grep -oiE '<img[^>]+src=...'` から
  ロゴ/アイコン/バナーを除いた本文写真を選ぶ。相対パスはドメインを補う。
- **YouTube**: サムネイル `https://img.youtube.com/vi/{VIDEO_ID}/maxresdefault.jpg`。
- **PDFや画像が無い記事**: 素材無し。**フォールバック**として既存メディアの
  井上登壇写真（media ID 169, `.../2024/03/0309.jpg`, 1414x2000）を featured と本文に流用する。
- **WebFetchやcurlが弾かれる報道系**（読売・TBS等）は、Chromeでそのページを開いて
  `document.querySelector('meta[property="og:image"]').content` で og:image を取る。

## アップロード（ブラウザ内 fetch → REST media）

CORS が通るホスト（fastly/prcdn, st-note, img.youtube 等）は直接 fetch できる:

```javascript
const nonce = wpApiSettings.nonce;               // 投稿編集ページ(post.php)で実行すること
const base = 'https://farman.jp/wp-json/wp/v2/';  // ※edit.php一覧ページには wpApiSettings が無い
const blob = await (await fetch(IMG_URL,{credentials:'omit'})).blob();
const up = await (await fetch(base+'media',{method:'POST',headers:{
  'X-WP-Nonce':nonce,'Content-Type':blob.type||'image/jpeg',
  'Content-Disposition':'attachment; filename="farman-news-'+POSTID+'.jpg"'
},credentials:'include',body:blob})).json();
// up.id, up.source_url, up.media_details.width/height
```

### CORSで弾かれるホスト → 画像プロキシ wsrv.nl を噛ませる
読売・TBS(ismcdn)・pref.yamanashi・saitama-nbc・農業自衛隊などは
ブラウザからの直接 fetch が `TypeError: Failed to fetch`（CORS）になる。
公開画像プロキシ **wsrv.nl** はCORSヘッダ付きで返すので、これ経由なら取得できる:

```javascript
const proxied = 'https://wsrv.nl/?url='+encodeURIComponent(IMG_URL)+'&w=1200&output=jpg';
const blob = await (await fetch(proxied,{credentials:'omit'})).blob();
```

（公開画像を公開プロキシに通すだけ。機微データには使わない。）

### 使えなかった手段（メモ）
- `file_upload` ツールはスクラッチパッドや作業フォルダのパスを弾く
  （「ユーザーが共有したファイルのみ」）ので、この用途では使えなかった。
- 画像を base64 にして javascript_tool に渡す方法は動くが、巨大な文字列が
  結果に載って重い/切り詰められるので非推奨。**wsrv.nl 経由の直接アップロードが最善。**

## 本文への画像挿入とサイズのフォーマット化

本文表示は **幅400px** に統一（既存の有吉ゼミ記事に合わせる）。高さは比率から計算:

```javascript
const h400 = Math.round(400 * up.media_details.height / up.media_details.width);
const img = '<img class="alignnone wp-image-'+up.id+'" src="'+up.source_url+'" alt="" width="400" height="'+h400+'" />';
const cur = (await (await fetch(base+'posts/'+POSTID+'?context=edit&_fields=content',{headers:{'X-WP-Nonce':nonce},credentials:'include'})).json()).content.raw;
await fetch(base+'posts/'+POSTID,{method:'POST',headers:{'X-WP-Nonce':nonce,'Content-Type':'application/json'},credentials:'include',
  body:JSON.stringify({featured_media:up.id, content: img+"\n\n"+cur})});
```

アップロード画像が大きくても width=400 指定で表示は統一される。アイキャッチは
ネイティブ寸法のままでよい（テーマ側が一覧で縮小表示する）。

## 注意
- 報道各社（読売・TBS等）の写真は各社の著作物。自社サイトへの転載は権利上の
  懸念があるため、**どの画像が報道機関由来かを最後にユーザーへ報告**し、差し替え可能にする。
- 検証: `GET posts?status=draft,publish&_fields=id,featured_media,content` で
  `featured_media>0` かつ本文に `<img` があるかを全件チェックする。
