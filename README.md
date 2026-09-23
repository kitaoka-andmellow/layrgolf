# COURSE CODE — Production Stack

全国の楽天GORA掲載コースを固定IPのVPSから同期し、Supabaseへ保存し、Vercel上の検索サイトから公開する構成です。

## 1. 構成

```text
Browser
  │
  ▼
Vercel (static UI + /api/search + /api/course)
  │  read-only / anon key
  ▼
Supabase PostgreSQL
  ▲
  │ secret key (or legacy service-role key)
Fixed IPv4 VPS
  │
  ├─ daily  : GORA Search API → コース追加/閉鎖/改称を同期
  ├─ weekly : GORA Detail API → 料金/ホール/ドレスコードを再取得
  └─ daily  : Rakuten Ichiba Item Search API → 用品アフィリエイト枠更新
  │
  ▼
Rakuten Web Service
```

楽天のApplication ID / Access KeyはVPSにしか置きません。Vercelとブラウザには渡しません。

## 2. この版で実装済み

- 全国47都道府県のGORAコース自動列挙
- コース詳細、料金、ホール数、画像、`dressCode`、`shoes`の取得
- FORMAL / SMART / RELAXEDへの構造化
- ジャケット、襟、デニム、Tシャツ、サンダル、靴の検索フラグ
- 独自難易度、独自愛称、春夏秋冬ガイド
- Supabaseへのupsert / 閉鎖コースの非表示化
- 新規コースは詳細取得完了まで公開しない `detail_ready` 制御
- 自然言語風検索（LLM不使用）
- ゴルフ場詳細ページ
- ドレスコードを最上位に置いたUI
- 季節別ウェア提案
- 楽天GORA予約CTA
- 楽天市場用品アフィリエイト枠
- VPS用Docker / systemd timer
- APIキーをURLに出さず `accessKey` ヘッダーで送信

## 3. 初回構築

### A. Supabase

1. Supabaseで新規Projectを作成
2. SQL Editorで順番に実行
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_search_view.sql`
3. Project Settings → API から以下を控える
   - Project URL
   - publishable key
   - secret key（推奨）または legacy service_role key

`secret key`（またはlegacy `service_role`）はVPSだけに置きます。

### B. Vercel

`web/` をVercel Projectとしてデプロイします。

Environment Variables:

```text
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=xxxxx
```

GitHub連携する場合、Root Directoryを `web` に設定すれば自動デプロイできます。

### C. 固定IPv4 VPS

Ubuntu 24.04を想定しています。VPS自体のPublic IPv4を楽天Web Serviceの「許可されたIPアドレス」に登録します。

```bash
sudo ./infra/vps/bootstrap_ubuntu.sh
```

プロジェクトを `/opt/course-code` に配置した後:

```bash
cd /opt/course-code/infra/vps
cp .env.example .env
nano .env
```

`.env`:

```text
RAKUTEN_APP_ID=...
RAKUTEN_ACCESS_KEY=...
RAKUTEN_AFFILIATE_ID=...        # 後からでも可
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=...             # 推奨
# SUPABASE_SERVICE_ROLE_KEY=...      # legacy fallback
```

VPSの外向きIPv4を確認:

```bash
curl -4 https://api.ipify.org && echo
```

このIPv4と楽天に登録したIPが一致することを確認します。

Dockerをビルド:

```bash
docker compose build
```

Rakuten認証確認:

```bash
docker compose run --rm --entrypoint python3 worker check_rakuten_auth.py
```

### D. 初回フル同期

公開前は必ず `full` を先に実行します。

```bash
docker compose run --rm worker full
```

約1,900コースの詳細を逐次取得します。`RAKUTEN_MIN_INTERVAL=0.8` なら、API応答時間を除いても詳細取得だけで約25分かかります。

Affiliate IDと楽天市場API権限を設定済みなら:

```bash
docker compose run --rm worker ads
```

### E. 定期同期

```bash
sudo ./install_timers.sh
```

既定スケジュール:

- 毎日 03:15 JST: コース検索マスター同期
- 毎週日曜 04:00 JST: 全コース詳細再取得
- 毎日 05:15 JST: 楽天市場アフィリエイト商品更新（Affiliate ID設定時）

確認:

```bash
systemctl list-timers 'course-code-*'
journalctl -u course-code-search.service -n 100 --no-pager
journalctl -u course-code-full.service -n 100 --no-pager
```

## 4. 検索仕様

LLMは使っていません。入力文からルールで条件を抽出します。

例:

```text
関西で1.3万円以下、初心者、ジャケット不要
夏涼しい、評価4以上、戦略的
関東 フォーマル デニム禁止
大阪から1時間、初心者
```

抽出対象:

- 都道府県 / 地方
- 予算
- 初心者 / 戦略的 / 難関
- ジャケット要否
- FORMAL / RELAXED
- デニム / サンダル規定
- 評価
- ホール数
- 夏涼しい地域

`大阪から1時間` 等は現段階では周辺府県を使う概算検索です。実走時間ではありません。将来Google Routes等を接続する場合も、楽天APIとは別のサーバー処理に分離してください。

## 5. ドレスコードの扱い

事実と編集を混ぜません。

### 事実

- `dress_code_raw`
- `shoes_raw`
- 料金、住所、ホール数、GORA URL
- API取得日時

### 構造化

- `dress_level`
- `jacket_required`
- `denim_banned`
- `sandals_banned`
- その他検索フラグ

### 独自編集

- `editorial_nickname`
- `difficulty_index`
- 春夏秋冬ウェアガイド

GORAの`dressCode`が空欄でも「服装自由」とは表示しません。`api_blank`として扱います。

## 6. アフィリエイト

### 楽天GORA

`RAKUTEN_AFFILIATE_ID`をGORA API入力に含めると、APIが返す予約URLがアフィリエイト対応URLになります。

### ゴルフ用品

`sync_rakuten_ads.py` は `affiliate_slots` 内の検索語を重複排除し、楽天市場商品検索APIを数回だけ呼び出します。同じ検索意図を持つコースへ商品画像・価格・アフィリエイトURLを配布するため、1,900コース × 4枠を個別検索しません。

楽天市場商品検索APIを使う場合、Rakuten Web Service側で同APIのaccess scopeも有効化してください。

## 7. セキュリティ

- `RAKUTEN_ACCESS_KEY` はVPSのみ
- `SUPABASE_SECRET_KEY`（またはlegacy `SUPABASE_SERVICE_ROLE_KEY`）はVPSのみ
- Vercelは `SUPABASE_PUBLISHABLE_KEY` のみ
- ブラウザはRakuten APIを直接呼ばない
- VPSはWebポートを公開せずSSHのみ
- Access KeyはURLではなくHTTP headerで送信
- `.env` はGit管理しない

詳細は `SECURITY.md` を参照してください。
