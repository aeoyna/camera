Snapshot created: 2026-02-05

Files in this snapshot (camera/):
- index.html  — メインUI（Apple風カメラ）
- styles.css  — UIスタイル（プレビュー/オーバーレイ/ギャラリー）
- app.js      — カメラ操作、IndexedDB保存、ギャラリー、プレビュー制御
- requirements.txt — Flask（旧版サーバー用、現在は未使用）
- server.py   — 旧サーバー実装（ローカル保存用）。現在はサーバー不要版を実装済み。
- photos/     — （存在）静的保存ディレクトリ（サーバー版）

Notes:
- 現在はブラウザ単体で動作するよう `app.js` が IndexedDB を使って画像を保存・表示します。
- 以前のサーバー実装 (`server.py`) と `requirements.txt` は残していますが、デフォルト動作はサーバー不要です。

Quick run (browser only):
- 開くだけ: camera/index.html をブラウザで開く（Chrome/Edge 推奨）。
- カメラ権限を許可してシャッターを押すと自動で IndexedDB に保存されます。
- 左上の「ギャラリー」ボタンで保存画像を確認できます。

If you want an archive (zip) of the current project, tell me and I will create `camera.zip` in the workspace.