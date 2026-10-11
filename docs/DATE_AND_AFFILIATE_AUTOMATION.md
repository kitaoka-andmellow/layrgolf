# LAYR GOLF — 画像・自然文の日付検索・楽天用品アフィリエイト

## 画面と画像

- 公式ブランドの2026年版HTMLに記載された実ファイル名に合わせて写真を読み込みます。
  - トップ: `assets/hero_01_main.png` → `assets/hero.webp` → `assets/first-view.png` の順でフォールバック
  - LAYR商品: `assets/prod_01_long-fit.png` → `assets/core-long-shorts.webp` → `assets/1.png`
  - ロゴ: `assets/brand_02_layr-wordmark.png` → `assets/layr-wordmark.png` → ローカル
- ロゴは正方形にはめず、横長の自然な比率で表示します。
- 楽天GORAのロゴの白背景は `mix-blend-mode:multiply` でページ背景へなじませています。オリジナルのロゴ画像自体は改変していません。
- 実際の公式サイトの画像パスは公開運用環境に依存します。3つの参照先が全て無効ならプレースホルダーへ切り替わるため、デプロイ後に目視確認してください。

## 検索欄での日付

入力例: `10月18日、大阪から1時間くらい、初心者と、13,000円以下`
認識する例: `2026年10月18日`、`10/18`、`明日`、`明後日`、`来週土曜`、`今週末`。
検索結果とコース詳細で希望日を表示します。

**重要:** この段階では希望日・曜日に基づく「平日/土日祝の参考価格」の比較のみです。
該当日の実際の空き枠・その日のプラン料金は未取得であり、楽天GORAでの確認が必要です。
正確な空き状況まで連携するには楽天GORAプラン検索APIと、既存固定IPホスト上の安全なAPIプロキシを追加します。既存データにない空き枠は絶対に推測表示しません。

## 楽天市場アフィリエイト（自動商品選定）

`worker/scripts/sync_ichiba_affiliate.py` を追加しました。
既存DBの `affiliate_slots.rakuten_search_keyword` に基づいて、関連カテゴリの商品を検索します。
新たに全コースに「ゴルフグローブ」「ゴルフボール」を追加し、シューズ・ウェア・季節用品を含め、カテゴリーを分散して表示します。

検索対象は楽天市場商品検索API (2026-07-01)。
`RAKUTEN_APP_ID`、`RAKUTEN_ACCESS_KEY`、`RAKUTEN_AFFILIATE_ID` を使い、
APIが返した **実際の `affiliateUrl`** のみを採用します。
楽天IDやアクセストークンをHTML・ブラウザ・リポジトリに出しません。
在庫切れ・画像なし・HTTPSでないリンク・低評価を除外し、複数商品の中からゴルフ場IDに応じて安定選定します。

### ロリポップ固定IPで最初の1回

ロリポップのSSHにログインしてから:

```sh
cd "$HOME/apps/layrgolf"
git fetch origin main
mkdir -p worker/scripts
# 過去のローカル変更を消さず、新しいスクリプト2つだけ取り出す
git show origin/main:worker/scripts/sync_ichiba_affiliate.py > worker/scripts/sync_ichiba_affiliate.py
git show origin/main:worker/scripts/run_ichiba_affiliate.sh > worker/scripts/run_ichiba_affiliate.sh
sh worker/scripts/run_ichiba_affiliate.sh --dry-run --limit-courses 10
```

Dry-runで `eligible_products>0` と `ready_to_update>0` が出たら、全件更新:

```sh
sh worker/scripts/run_ichiba_affiliate.sh
```

**上記コマンドの実行までは実データにアフィリエイト商品は入らず、用品は表示されません。**
権限・IP制限・楽天のAPI許可が必要です。ログに秘密鍵は出しません。
一度の更新対象は約9千件の既存スロット＋2カテゴリ（約4,500件）ですが、商品APIのリクエストは個々のコースでなく「異なる検索語」単位にまとめます。

### 自動更新を有効にするには

ロリポップのユーザー専用ページのCron等で、
`sh $HOME/apps/layrgolf/worker/scripts/run_ichiba_affiliate.sh`
を1日1回の間隔で実行するよう登録してください。
既存の`~/.course-code.env`ファイルから環境変数を読みます。
Cron設定はホスティングの管理画面でユーザー側の操作が必要です。このGitHubコミットだけでは自動実行は始まりません。

データ更新が成功すれば、追加の商品リンクはVercel側の再デプロイ不要で自動表示されます。
`affiliate_slots`のRLSは既存設定のままで、秘匿キーをブラウザへ公開しません。

### 法務・運用上の確認

- 商品価格は更新時点の参考情報です。
- 自社商品広告と楽天アフィリエイトの商品枠は区別します（用品は「楽天市場 / PR」表記）。
- 楽天GORAロゴの使用は公式のブランドガイドライン・素材使用許諾を確認してください。
- 画像を横長に引き伸ばさず `object-fit:cover` / `object-fit:contain` で表示します。
