# URLから記事情報を取得する

各項目について「タイトル / 日付(年月日) / 内容の1文要約 / ファーマン(farman/株式会社ファーマン/井上)との関係」を集める。

## 基本: WebFetch

まず `WebFetch` を使う。プロンプト例:

> このページの「タイトル(見出し)」「日付(年月日)」「内容の1文要約」「ファーマン(farman/株式会社ファーマン/井上)との関係」を簡潔に抽出して。日本語で。

- PR TIMES はこれで問題なく取れる。並行して複数URLを同時に投げてよい。
- 配信日/公開日を必ず拾う（投稿日に使う）。

## 取れないサイトの回避策

一部サイトは WebFetch が拒否される。回避策:

- **newsdig.tbs.co.jp / yomiuri.co.jp など報道系** → `WebFetch is unable to fetch` になる。
  Chrome の新規タブでそのURLを `navigate` し、`javascript_tool` でメタ情報を取得:
  ```javascript
  JSON.stringify({
    title: document.title,
    h1: document.querySelector('h1') ? document.querySelector('h1').innerText : null,
    ogTitle: (document.querySelector('meta[property="og:title"]')||{}).content,
    date: (document.querySelector('time')||{}).innerText || (document.querySelector('meta[property="article:published_time"]')||{}).content,
    desc: (document.querySelector('meta[name="description"]')||{}).content
  })
  ```
  （記事本文の逐語コピーはしない。タイトル・日付・概要のみ使う。）

- **YouTube** → 動画ページ本体は本文が取れないことが多い。oembedでタイトル・投稿者を取得:
  `WebFetch` で `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={ID}&format=json`
  → title と author_name が返る。**公開日はoembedに無い**ので、取れなければユーザーに確認するか
  暫定日で下書き作成し、報告時に明記する。

- **PDF（例: 農水省 審議会資料）** → WebFetch はバイナリで読めない旨を返すが、
  ファイルはローカルに保存される（結果メッセージの保存パスを見る）。
  `pypdf` でテキスト抽出（未導入なら `python -m pip install --quiet pypdf`）:
  ```python
  from pypdf import PdfReader
  r = PdfReader(PATH); print('\n'.join((p.extract_text() or '') for p in r.pages))
  ```
  日本語が文字化けする場合でも、日付(令和/西暦)・資料名・「ファーマン」「井上」の登場箇所は
  読み取れることが多い。令和はの西暦換算に注意（令和N年 = 2018+N年）。

## 日付の扱い

- 元記事の配信日/公開日/開催日を投稿日にする。
- 未来の予定イベントはタイトルを未来形（「登壇します」）にし、日付は開催日でよい。
- 取得できなかった日付は暫定で本日にし、報告で「日付不明・要確認」と明示する。
