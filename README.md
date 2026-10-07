# 空の時計 — 時刻で変わる空を Astro で実装する

時刻（またはスライダー）に応じて空の色・太陽・月・星を変化させるフルスクリーン背景の実装解説。

## セットアップ

```sh
npm install
npm run dev
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動（`localhost:4321`） |
| `npm run build` | 本番ビルド（`./dist`） |
| `npm run preview` | ビルド結果のプレビュー |

## この記事のテーマ

- 時刻キーフレーム間の色補間
- 太陽・月の半円軌道配置
- Astro コンポーネントと TypeScript スクリプトの役割分担

## プロジェクト構成

```text
src/
├── pages/index.astro          # ルートページ
├── layouts/Layout.astro       # HTML シェル・グローバル CSS
├── components/SkyClock.astro  # マークアップ・スコープ付き CSS・script 入口
└── scripts/sky-clock.ts       # 色補間・軌道・描画ロジック
```

- ページはレイアウトとコンポーネントを組み立てるだけ
- 見た目はコンポーネント、計算ロジックは `scripts/` に分離
- 関心の分離により、ロジック単体の読みやすさが上がる

```astro
---
import Layout from '../layouts/Layout.astro';
import SkyClock from '../components/SkyClock.astro';
---

<Layout title="空の時計">
	<SkyClock />
</Layout>
```

```astro
<!-- SkyClock.astro 内 -->
<script>
	import { initSkyClock } from '../scripts/sky-clock';

	const root = document.querySelector<HTMLElement>('[data-sky-clock]');
	if (root) initSkyClock(root);
</script>
```

- Astro の `<script>` はバンドル・TypeScript・重複排除が効く
- ロジックは TypeScript モジュールとして分離
- `data-*` 属性で DOM を特定し、セレクタの結合度を下げる

> 参照: [Astro — Project structure](https://docs.astro.build/en/basics/project-structure/) / [Astro — Client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/)

## レイアウトとグローバルスタイル

- `Layout.astro` が `<html>` / `<head>` / `<body>` を担当
- ページ全体に効くリセット（`height: 100%`、`overflow: hidden`）は `is:global`
- コンポーネント固有の見た目は `SkyClock.astro` のスコープ付き `<style>` に閉じる

### 悪い例：ページごとに html/body を書く

```astro
<!-- index.astro に全部書く -->
<html lang="ja">
  <head>...</head>
  <body>...</body>
</html>
```

- ページが増えると head や共通 CSS が重複
- タイトル変更のたびにコピペが発生

### 良い例：layout + slot

```astro
---
interface Props {
	title?: string;
}
const { title = '空の時計' } = Astro.props;
---
<!doctype html>
<html lang="ja">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<title>{title}</title>
	</head>
	<body>
		<slot />
	</body>
</html>

<style is:global>
	html, body {
		height: 100%;
		margin: 0;
		overflow: hidden;
		background: #000;
	}
</style>
```

- `viewport-fit=cover` でノッチ端末のセーフエリアに対応しやすい
- UI 側は `env(safe-area-inset-bottom)` で下余白を確保

> 参照: [Astro — Layouts](https://docs.astro.build/en/basics/layouts/) / [MDN — env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)

## 時刻キーフレームと色補間

- 空の色は「時刻 → 上部色・下部色」のキーフレーム配列 `K` で定義
- 各エントリは `[時刻(時), 上部 RGB, 下部 RGB]`
- 現在時刻が挟まる 2 キーフレーム間を線形補間（lerp）

```ts
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function colorAt(h: number, idx: 1 | 2): RGB {
	for (let i = 0; i < K.length - 1; i++) {
		const [h0] = K[i];
		const [h1] = K[i + 1];
		if (h >= h0 && h <= h1) {
			const t = (h - h0) / (h1 - h0);
			const a = K[i][idx];
			const b = K[i + 1][idx];
			return a.map((v, j) => lerp(v, b[j], t)) as RGB;
		}
	}
	return K[0][idx];
}
```

- `t` は区間内の進捗（0〜1）
- RGB 各チャンネルを個別に補間し、`linear-gradient` に渡す
- 日の出（6.5）・夕方（18）など変化が大きい時刻にキーを denser に置くのがコツ

### 悪い例：if の羅列で色を固定

```ts
if (h < 6) sky.style.background = '#02030c';
else if (h < 12) sky.style.background = '#bee1ff';
else if (h < 18) sky.style.background = '#ff7832';
else sky.style.background = '#050612';
```

- 境界で色が飛び、タイムラプス感が消える
- 上と下のグラデーションを表現しづらい

### 良い例：キーフレーム + 補間

- 連続的に色が移る
- キーを増やすだけで見た目を調整できる（ロジック変更不要）

> 参照: [MDN — linear-gradient()](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient) / 線形補間の一般式

## 太陽・月の半円軌道

- 画面下部中央を中心とした半円上に天体を配置
- パラメータ `t`（0→1）で左地平線 → 頂点 → 右地平線

```ts
function place(el: HTMLElement, t: number) {
	const w = innerWidth;
	const h = innerHeight;
	const r = Math.min(w * 0.44, h * 0.55);
	const cx = w / 2;
	const cy = h * 0.82;
	el.style.left = `${cx - Math.cos(Math.PI * t) * r}px`;
	el.style.top = `${cy - Math.sin(Math.PI * t) * r}px`;
}
```

- `Math.cos` / `Math.sin` に `Math.PI * t` を渡すと半円（π ラジアン）になる
- CSS 側で `transform: translate(-50%, -50%)` し、座標を中心基準にする
- 太陽: 6時〜18時（`ts = (h - 6) / 12`）
- 月: 18時〜翌6時（深夜は `h + 24` して連続区間にする）

### 悪い例：left だけ動かして直線移動

```ts
el.style.left = `${(h / 24) * innerWidth}px`;
el.style.top = '20%';
```

- 空を横切る実感が薄い
- 地平線の出入り（フェード）と合わせにくい

### 良い例：半円 + 端での opacity フェード

```ts
sun.style.opacity = String(
	Math.min(1, Math.min(ts + 0.05, 1.05 - ts) * 10),
);
```

- 地平線付近で徐々に消え、頂点付近で不透明
- 太陽は頂点付近ほど彩度を下げ、地平線付近は赤みを残す（`saturate`）

> 参照: [MDN — Math.cos()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/cos) / [MDN — CSS filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)

## 星空（Canvas）と夜の不透明度

- 星は `<canvas>` にランダムな点を一度描画
- リサイズ時に再描画
- 表示のオンオフは CSS `opacity`（夜だけ 1、昼は 0、薄明は中間）

```ts
const night =
	h < 5 || h > 21
		? 1
		: h < 6.5
			? (6.5 - h) / 1.5
			: h > 19.5
				? (h - 19.5) / 1.5
				: 0;
stars.style.opacity = String(night);
```

### 悪い例：毎フレーム星を再抽選

```ts
setInterval(() => {
	drawStars(); // 毎秒ランダム再配置
	render(current());
}, 1000);
```

- 星がチカチカして不自然
- 描画コストが増える

### 良い例：星はリサイズ時だけ、夜の見え方は opacity

- 星の配置は安定
- 空の色変化と独立して昼夜のフェードを制御できる
- 装飾用 canvas には `aria-hidden="true"` を付与

> 参照: [MDN — CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) / [WAI-ARIA — aria-hidden](https://www.w3.org/WAI/ARIA/apg/)

## ライブ時刻と手動スクラブ

- `live === true` のとき `Date` から小数時を算出
- スライダー操作で `live = false` に切り替え、手動時刻を表示
- 「リアルタイムに戻す」で再び `Date` 連動
- ライブ中は 1 秒ごとに `render`、スライダー値も同期

```ts
function current() {
	if (live) {
		const d = new Date();
		return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
	}
	return parseFloat(slider.value);
}
```

### 悪い例：スライダーを動かしてもライブ更新が上書きする

```ts
setInterval(() => render(new Date().getHours()), 1000);
slider.addEventListener('input', () => render(parseFloat(slider.value)));
```

- 手動操作直後に interval が実時刻で上書き
- スクラブ体験が壊れる

### 良い例：live フラグで入力源を一本化

- `current()` が唯一の「いまの時刻」供給源
- UI イベントはフラグ切り替えに専念

## UI 文字色の自動切替

- 空の下部色の相対輝度に近い簡易計算で明暗を判定
- 明るい空 → 暗い文字、暗い空 → 明るい文字

```ts
const lum = 0.3 * bot[0] + 0.59 * bot[1] + 0.11 * bot[2];
ui.style.color = lum > 140 ? '#222' : '#eee';
```

- コントラストを完全に WCAG 準拠で保証する用途ではない
- フルスクリーン装飾 UI での可読性維持が目的

> 参照: [WCAG — Relative luminance](https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)（係数の由来）

## まとめ

- 本実装は「時刻キーフレームの補間」と「半円軌道の配置」が核
- レイアウト・コンポーネント・TypeScript スクリプトに役割を分けて構成する
- 悪い例の多くは「見た目は動くが、境界で飛ぶ・状態が競合する」パターン

> 参照: [Astro — Styles and CSS](https://docs.astro.build/en/guides/styling/) / [Astro — Client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/)
