# LAYR GOLF 検索サイト — 公開確認と公式サイト相互リンク

対象レポジトリ：`kitaoka-andmellow/layrgolf`（Vercel Root Directory = `web`）

## 完成版で実装したもの

- 検索サイト → LAYR GOLF公式サイト（ヘッダー・フッター・商品紹介）のリンク
- 画像が変形しない16:9コース一覧、最大5枚のコース写真、公式ブランド画像
- 楽天GORAの予約リンクと、提供されたロゴによるサービス名表示
- トップ（静的）、コース詳細（サーバーレンダリング）、47都道府県別一覧（SSR）、全国一覧、服装ガイド
- 一意のtitle、description、canonical、Open Graph、パンくず、GolfCourse/BreadcrumbList/ItemListのJSON-LD
- 自動更新される`/sitemap.xml`、`/robots.txt`、prefecture・course個別ページへの内部リンク
- 元の自然文検索APIとデータベース運用を変更しない（全国の再投入は不要）

## 公式ブランド側に必要な1箇所の変更（※別ホスティングのため未反映）

ブランド公式 `https://layrgolf.andmellow.jp/` はこのGitHubリポジトリの`web`とは別サイトです。
公式ブランドページのヘッダーメニューまたはフッターに次のリンクを追加してください：

```html
<a href="https://supabase-phi-brown.vercel.app/" target="_blank" rel="noopener noreferrer">
  全国のゴルフ場を探す ↗
</a>
```

現行のブランド`index.html`で`<nav class="desktop-nav">`のメニューに加えると見つけやすくなります。
同じ導線をスマホ用`<nav aria-label="モバイルナビゲーション">`にも追加すると、スマホでも相互導線が成立します。
ブランド本体のソースは当該GitHub repoにないため、このコミットから公開サイトへ書き込むことはできません。
公式サイトのデプロイ手段（ロリポップ、FTP、別GitHub repoなど）が必要です。

## 公開時の注意

- Supabase `layrgolf` を`Resume project`で再開してください。停止中はDB依存ページが503となり、データが破損したわけではありません。
- Vercelの`SITE_URL`は、公開用の実ドメインに設定してください。現状のデフォルトは`https://supabase-phi-brown.vercel.app`です。将来本独自ドメイン・`/course/`へ移す際は、canonical・OG・サイトマップ・内部URLを同時に改修し301リダイレクトしてください。
- Vercel `Root Directory`が`web`で、既存の`COURSE_SUPABASE_URL`と`COURSE_SUPABASE_PUBLISHABLE_KEY`が本番に設定されていることを確認してください。サービスロールキーをクライアントやGitHubへ公開しないでください。
- 楽天GORAのロゴは提供された画像を表示します。ブランド素材の外部利用については楽天のブランドガイドラインと必要な許諾を確認してください。
- APIで提供される`gora_reserve_url`は利用します。アフィリエイト成果の計測・報酬率は「楽天GORA専用アフィリエイトリンク」かを別途確認してください（楽天ウェブサービス経由などは条件が異なります）。偽の予約ボタンや架空の空き枠は表示しません。
- Search Consoleには`/sitemap.xml`を送信し、コース詳細3ページ・都道府県3ページ・服装ガイドをURL検査してください。サイトマップは登録・順位を保証しません。

## 公開チェック

1. `/`：検索してゴルフ場名・画像・料金を確認
2. `/course/90107`：GORAの写真・服装・複数画像・予約リンクを確認（コースがDBにある場合）
3. `/courses`：全国一覧の2ページ目へ移動
4. `/prefecture/osaka` と`/prefecture/kumamoto`：表示コース数と詳細リンクを確認
5. `/guide`：服装の確認事項を表示
6. `/robots.txt`：sitemapのURLと検索エンジンの許可
7. `/sitemap.xml`：適正な絶対URL（上限5万URL、今回は約2300URL）を返す
8. ブランドから検索サイト、検索サイトからブランドに双方向遷移（ブランド側追加後）
