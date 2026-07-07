■ plaud 新PCセットアップZIP

このZIPひとつで、新しいPCに plaud スキル環境一式をセットアップします。
（スキル17個はGitHubから、サイトデータはサイトrepoから自動取得。
　このZIPに入っている固有物は「鍵」= plaud-config.json だけです）

【手順（ほとんどのPCはこれだけ）】
 1. 新PCに Claude Code をインストールし、いつものアカウントでログイン
 2. このZIPを展開（右クリック→すべて展開）
 3. SETUP.cmd をダブルクリック
 4. 「=== 完了 ===」と出たら Claude Code を再起動

【そのPCから公開（デプロイ）もする場合だけ・追加手順】
 1. PowerShell で:  winget install --id Git.Git
                    winget install --id GitHub.cli
 2. PowerShell を開き直して:  gh auth login
    （GitHub.com → HTTPS → Login with a web browser → stymism で承認）
 3. SETUP.cmd をもう一度ダブルクリック（サイトデータが自動で入る）

【セキュリティ上の注意】
 - このZIPには APIトークン・パスワード入りの設定ファイルが含まれます。
   共有は自分のアカウント管理下の手段（OneDriveの特定ユーザー宛て共有リンク等）
   に限定し、メーリングリスト・チャットの公開チャンネル・GitHub には
   絶対に置かないでください。
 - 新PCへの設置が終わったら、共有リンクは削除して構いません。

【このZIPの作り直し】
 自動です。どのPCでも /plaud-html を実行するたび（トークン再取得時）に
 ドキュメントフォルダの ZIP が最新へ自動更新されます。手動で作り直したい
 場合は Claude に「新PC用ZIPを作り直して」と頼めば即時再生成できます。
