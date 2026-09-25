# X Negative Filter

X（Twitter）のツイートを表示前に Vercel AI Gateway の **Jev**（`typesafe-ai/jev`）でポジティブ/ネガティブ判定し、ネガティブと判定されたツイートに「見せられないよ！」イラスト付きのモザイクをかける Chrome 拡張です。

## 動作の流れ

1. 拡張機能ポップアップ（メニュー）で「ネガティブ判定を有効にする」をオンにする
2. x.com のタイムラインに挿入されるツイート（`article[data-testid="tweet"]`）を MutationObserver で検出し、読み取れる前に即ブラー表示
3. バックグラウンドのサービスワーカーが `POST https://ai-gateway.vercel.sh/v1/evaluate` を呼び、Jev でネガティブ確率を取得
4. 確率がしきい値（既定 0.5）以上 → 「見せられないよ！」オーバーレイ＋モザイク。未満またはエラー時 → 表示を解放

判定結果はセッション内でキャッシュし、同じツイートの再評価は行いません。評価リクエストは最大3並列です。

## セットアップ

1. [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) で API キー（`AI_GATEWAY_API_KEY`）を発行
2. `chrome://extensions` を開き「デベロッパーモード」をオン → 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選択
3. 拡張機能の「オプション」ページで API キーとしきい値を保存
4. 拡張機能ポップアップで「ネガティブ判定を有効にする」をオンにして x.com を開く

### API キーなしで試す（デモモード）

オプションの「デモモード」をオンにすると、AI Gateway を呼ばずにキーワードベースの簡易判定でモザイク表示を確認できます（精度は実際の Jev 判定と無関係です）。

## ファイル構成

```
manifest.json          MV3 マニフェスト
src/background.js      Jev 評価呼び出し（同時実行制御・デモモード）
src/content.js         ツイート検出・即ブラー・モザイク適用
src/content.css        モザイク/ブラーのスタイル
src/popup.*            有効/無効トグル（メニュー）
src/options.*          API キー・しきい値・デモモード設定
assets/miserarenaiyo.png  モザイク用イラスト
icons/                 拡張機能アイコン
test/                  ローカル動作確認用モックタイムライン
```

## プライバシー・注意点

- ツイート本文が Vercel AI Gateway 経由で TypeSafe AI（Jev）の評価に送信されます。タイムラインの内容を外部サービスに送りたくない場合は有効化しないでください
- API キーは `chrome.storage.local` に保存され、`ai-gateway.vercel.sh` へのリクエスト以外には使われません
- X の DOM 構造変更に依存するため、構造が変わると動作しなくなる可能性があります
