# NagisinnraLinux

[![License: MIT](https://shields.io)](https://opensource.org)
[![Developer: nagisinnra](https://shields.io)](https://zenn.dev)

**NagisinnraLinux（ナギシンラ・リナックス）**は、13歳の学生開発者「nagisinnra」によって2026年8月に開発された、Debianベースの超軽量カスタムLinuxディストリビューション（およびその自動ビルド環境）です。

日常使いできる実用性を保ちながら、古いPCや低スペックPCでも快適に動作させることを目指して極限までチューニングされています。

---

## 🚀 主な特徴 (Features)

- **圧倒的な超軽量設計**
  - 起動直後のRAM（メモリ）使用量はわずか **約476MB**。
  - ディスク使用量も **約2.45GB** にまで徹底的に削減。
- **快適な日本語環境**
  - 軽量化と日本語入力を両立するため、**fcitx5 + mozc** を初期状態で標準搭載。
- **メモリ最適化 (zram搭載)**
  - 少ないメモリでも快適に動作するよう、**zram**（メモリ圧縮機能）を標準で最適化構成。

## 🛠️ 技術スタック (Technical Stack)

- **ベースOS**: Debian (GNU/Linux)
- **メモリ最適化**: zram
- **入力フレームワーク**: fcitx5
- **日本語入力エンジン**: mozc

---

## 💻 起動・インストール方法 (How to Use)

```bash
# リポジトリのクローン
git clone https://github.com
cd NagisinnraLinux
```

---

## 👤 開発者について (Developer)

- **名前**: nagisinnra
- **年齢**: 13歳 (2026年時点)
- **ブログ / 開発記**: [Zenn (nagisinnra)](https://zenn.dev)
- **開発のきっかけ**: 「削る ➔ 起動する」の感動を追求し、自分だけの最高に軽い普段使いのOSを作りたくて開発を始めました。

## 📄 ライセンス (License)

このプロジェクトは MIT ライセンス のもとで公開されています。
