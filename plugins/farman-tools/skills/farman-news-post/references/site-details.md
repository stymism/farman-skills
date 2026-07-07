# farman.jp サイト固有情報

## 基本

- 管理画面: `https://farman.jp/wp/wp-admin/`（WordPress、**Classic Editor / TinyMCE**）
- 「お知らせ」= 投稿(posts)。一覧 `https://farman.jp/wp/wp-admin/edit.php`
- 投稿のパーマリンク: `https://farman.jp/news/{id}/`
- REST APIルート: `https://farman.jp/wp-json/`（`/wp-json/wp/v2/...`）
- 代表: 井上能孝（いのうえ よしたか）。俳優 **工藤阿須加** が井上農場で農業（有吉ゼミ放映の縁）。

## カテゴリID

| ID | 名前 | slug | 使いどころ |
|----|------|------|-----------|
| 1 | お知らせ | info | 一般的な告知（求人・HP更新など） |
| 2 | メディア | media | TV放映・新聞/WEB報道・掲載・寄稿・動画公開・プレスリリース |
| 3 | イベント | event | （ほぼ未使用） |
| 4 | 活動報告 | report | 講演・登壇・イベント協力・審議会委員など「参加した活動」 |

分類の目安: **報じられた/載った=メディア(2)**、**自ら参加した/登壇した=活動報告(4)**。
プレスリリースは基本メディア(2)だが、内容が「井上が登壇/協力」中心ならば活動報告(4)でもよい。

## タイトルの命名規則（弊社視点で書く）

- TV放映: `【番組名（放送局）】…が放映されました`
  例: `【有吉ゼミ 工藤阿須賀の楽しい農園生活（日本テレビ）】が放映されました`
  ※有吉ゼミの既存タイトルは「阿須**賀**」表記。既存記事に合わせる。
- メディア掲載/報道/寄稿/動画: `【媒体名】…が掲載されました / 紹介されました / 報道されました / 公開されました`
  例: `【読売新聞】「キラリ成長のヒント 農業軸に活動広げる」に弊社代表井上が掲載されました`
- 登壇/イベント: `【主催者・イベント名】弊社代表井上が登壇しました / 協力しました / 出席しました`
  未来の予定なら「登壇します／講師を務めます」。
  例: `【農林水産省】「ノウフクの日」制定 記念イベントに弊社代表井上が登壇します`

## 本文フォーマット

### A. メディア掲載・報道・活動報告（外部リンクあり）
説明文（1〜2文、ファーマンとの関係が分かるように）＋空行＋リンク。

```
{説明文}

<a href="{URL}">{URL}</a>
```

（既存記事では活動報告で「URLをそのまま1行」置く例もある＝自動リンク/埋め込み。
`<a>` タグ形式の方が表示が安定するので推奨。）

### B. TV放映（有吉ゼミ系）— 既存テンプレを流用
アイキャッチ画像ID=**220**、本文にも同じ画像を入れる。

本文HTML:
```
<img class="alignnone size-full wp-image-220" src="https://farman.jp/wp/wp-content/uploads/2025/03/farman-proposal-deck_page-0009.jpg" alt="" width="400" height="300" />

<article class="entry">
<div class="body">

{YYYY年M月D日}放送、日本テレビ『有吉ゼミ 工藤阿須賀の楽しい農園生活』にて、弊社農場で撮影された番組が放映されました

</div>
</article>
```
POST時に `featured_media: 220` も指定する。

## REST APIでの投稿（wp-admin タブの javascript_tool で実行）

nonce は wp-admin ページの `wpApiSettings.nonce` から取得（管理画面タブで実行すること）。
`items` 配列を作って一括POSTする。**戻り値にクエリ文字列URLを含めない**（id/date/statusのみ）。

```javascript
const nonce = wpApiSettings.nonce;
const base = 'https://farman.jp/wp-json/wp/v2/';
function link(desc,url){ return desc + "\n\n<a href=\"" + url + "\">" + url + "</a>"; }
// 有吉ゼミ放映用テンプレ
const ARIYOSHI_IMG='<img class="alignnone size-full wp-image-220" src="https://farman.jp/wp/wp-content/uploads/2025/03/farman-proposal-deck_page-0009.jpg" alt="" width="400" height="300" />';
function ari(jp){ return ARIYOSHI_IMG + "\n\n<article class=\"entry\">\n<div class=\"body\">\n\n" + jp + "放送、日本テレビ『有吉ゼミ 工藤阿須賀の楽しい農園生活』にて、弊社農場で撮影された番組が放映されました\n\n</div>\n</article>"; }

const items = [
  // 例: メディア掲載
  {title:'【媒体名】…が掲載されました', content:link('説明文。','https://example.com/article'), cat:[2], date:'2025-12-19'},
  // 例: 活動報告
  {title:'【主催】弊社代表井上が登壇しました', content:link('説明文。','https://example.com/event'), cat:[4], date:'2025-09-29'},
  // 例: TV放映
  {title:'【有吉ゼミ 工藤阿須賀の楽しい農園生活（日本テレビ）】が放映されました', content:ari('2026年4月27日'), cat:[2], fm:220, date:'2026-04-27'},
];

const results = [];
for (const it of items){
  const payload = {title:it.title, content:it.content, status:'draft', categories:it.cat, date: it.date+'T10:00:00'};
  if (it.fm) payload.featured_media = it.fm;
  try{
    const r = await fetch(base+'posts', {method:'POST', headers:{'X-WP-Nonce':nonce,'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(payload)});
    const j = await r.json();
    results.push({date:it.date, id:j.id||null, status:j.status||('ERR:'+(j.code||r.status))});
  }catch(e){ results.push({date:it.date, id:null, status:'EXC'}); }
}
JSON.stringify({created:results.filter(x=>x.id).length, total:results.length, results}, null, 2);
```

`status` を `'publish'` にすればそのまま公開（**必ず事前承認を得てから**）。

### 検証
```javascript
const nonce = wpApiSettings.nonce;
const r = await fetch('https://farman.jp/wp-json/wp/v2/posts?status=draft&per_page=100&orderby=date&order=asc&_fields=id,date,categories,title', {headers:{'X-WP-Nonce':nonce}, credentials:'include'});
const j = await r.json();
JSON.stringify({total:j.length, rows:j.map(p=>({id:p.id,date:p.date.slice(0,10),cat:p.categories,title:p.title.rendered}))}, null, 2);
```

### 下書きをまとめて公開する
承認後、作成した下書きID配列を publish に更新:
```javascript
const nonce = wpApiSettings.nonce;
const base = 'https://farman.jp/wp-json/wp/v2/';
const ids = [/* 下書きのID配列 */];
const out=[];
for (const id of ids){
  const r = await fetch(base+'posts/'+id, {method:'POST', headers:{'X-WP-Nonce':nonce,'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({status:'publish'})});
  const j = await r.json();
  out.push({id:id, status:j.status||('ERR:'+r.status)});
}
JSON.stringify(out);
```
