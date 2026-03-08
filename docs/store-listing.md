# Chrome Web Store 掲載文

## 拡張機能名
X Image Catcher

---

## 短い説明文（132文字以内）
Xのタイムラインに流れた画像を自動保存。スクロールするだけでギャラリーに蓄積。見逃した画像をあとから一覧・@handle検索できます。

---

## 詳細説明文（日本語）

### Xの画像を流し見しながら自動保存

Xのタイムラインは次々と流れていくため、「さっき見た画像を後から見つけたい」と思っても探し出すのが難しい。X Image Catcher はそんな悩みを解決します。

**スクロールするだけ — 特別な操作は不要**
x.com を普通に使っているだけで、タイムラインに表示された画像が自動的にギャラリーに保存されます。いいねもブックマークも不要です。

**主な機能**
- 🖼️ タイムラインの画像を自動キャプチャ（x.com / twitter.com 対応）
- 📷 最大1,000件のギャラリーに蓄積
- 🔍 @handle で投稿者を絞り込み検索
- ⌨️ Alt+X キーボードショートカットでポップアップを瞬時に開く
- 🚫 広告投稿の画像は自動スキップ
- 🔒 データは外部サーバーに送信されない（完全ローカル保存）
- 📌 画像をクリックすると元ツイートをすぐに開ける

**プライバシーについて**
収集したデータは一切外部サーバーに送信しません。すべてのデータはあなたのブラウザ（chrome.storage.local）にのみ保存されます。

---

## 詳細説明文（英語）

### Auto-save images from your X (Twitter) timeline

X Image Catcher automatically captures images as you scroll through your X timeline — no extra clicks needed. Browse back through your personal image gallery and jump to any tweet with one click.

**Features**
- 🖼️ Auto-captures media images from x.com / twitter.com timeline
- 📷 Gallery stores up to 1,000 images
- 🔍 Filter by @handle in real time
- ⌨️ Alt+X keyboard shortcut to open the popup instantly
- 🚫 Automatically skips promoted (ad) posts
- 🔒 100% local storage — no data sent to external servers
- 📌 Click any image to open the original tweet in a new tab

**Privacy**
No data is ever sent to external servers. Everything is stored locally in your browser using chrome.storage.local.

---

## カテゴリ
- **主カテゴリ**: Productivity
- **副カテゴリ**: Social & Communication

## タグ / キーワード
twitter, x, image saver, tweet images, timeline, gallery, screenshot, social media, bookmark

---

## スクリーンショット撮影ガイド

Chrome Web Store には最低1枚（推奨5枚）の1280×800 または 640×400 のスクリーンショットが必要です。

### 推奨スクリーンショット構成

1. **ポップアップ全体（画像が多数保存された状態）**
   - 撮影方法: 拡張機能ポップアップを開き、スクリーンショットを撮る
   - キャプション: "タイムラインに流れた画像をギャラリー表示"

2. **@handle 検索でフィルタリング中**
   - 検索バーに "@" を入力して絞り込んでいる状態
   - キャプション: "@handle で投稿者を絞り込み"

3. **初回起動時のオンボーディング画面**
   - 拡張機能をインストールしてすぐの空の状態
   - キャプション: "シンプルな3ステップで始められる"

4. **元ツイートに飛ぶデモ**
   - 画像をクリックしてツイートが開く様子（並べた画像で示す）
   - キャプション: "クリックで元ツイートを即表示"

5. **バッジ通知**
   - 拡張機能アイコンに未確認件数バッジが表示されている様子
   - キャプション: "新しく保存された件数をバッジで通知"

### プロモーションタイル（440×280）
ランディングページ (docs/index.html) の Hero セクションを参考にデザイン。
背景: #000、アクセントカラー: #1d9bf0、フォント: 太字サンセリフ。

---

## 権限の説明（審査対策）

| 権限 | 理由 |
|------|------|
| `storage` | キャプチャした画像URL・メタデータをローカルに保存するため |
| `host_permissions: x.com, twitter.com` | タイムライン上の画像を検出するためのコンテンツスクリプト実行 |

外部への通信: **なし**
個人情報の収集: **なし**
