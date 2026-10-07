type RGB = [number, number, number];
type Keyframe = [number, RGB, RGB];

const K: Keyframe[] = [
	[0, [2, 3, 12], [10, 18, 48]],
	[5, [12, 18, 56], [70, 50, 100]],
	[6.5, [110, 130, 190], [255, 150, 90]],
	[9, [190, 225, 255], [255, 255, 255]],
	[15, [200, 225, 250], [255, 255, 255]],
	[17, [255, 170, 100], [255, 235, 200]],
	[18, [255, 120, 50], [255, 190, 110]],
	[19.5, [70, 45, 95], [220, 100, 90]],
	[21, [5, 6, 18], [14, 20, 52]],
	[24, [2, 3, 12], [10, 18, 48]],
];

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

const rgb = (c: RGB) => `rgb(${c.map(Math.round).join(',')})`;

export function initSkyClock(root: HTMLElement) {
	const sky = root.querySelector<HTMLElement>('[data-sky]')!;
	const sun = root.querySelector<HTMLElement>('[data-sun]')!;
	const moon = root.querySelector<HTMLElement>('[data-moon]')!;
	const stars = root.querySelector<HTMLCanvasElement>('[data-stars]')!;
	const ui = root.querySelector<HTMLElement>('[data-ui]')!;
	const clock = root.querySelector<HTMLElement>('[data-clock]')!;
	const slider = root.querySelector<HTMLInputElement>('[data-slider]')!;
	const liveBtn = root.querySelector<HTMLButtonElement>('[data-live]')!;

	let live = true;

	function drawStars() {
		stars.width = innerWidth;
		stars.height = innerHeight;
		const g = stars.getContext('2d')!;
		g.fillStyle = '#fff';
		for (let i = 0; i < 120; i++) {
			g.globalAlpha = 0.3 + Math.random() * 0.7;
			g.beginPath();
			g.arc(
				Math.random() * stars.width,
				Math.random() * stars.height * 0.75,
				Math.random() * 1.4 + 0.3,
				0,
				Math.PI * 2,
			);
			g.fill();
		}
	}

	function place(el: HTMLElement, t: number) {
		const w = innerWidth;
		const h = innerHeight;
		const r = Math.min(w * 0.44, h * 0.55);
		const cx = w / 2;
		const cy = h * 0.82;
		el.style.left = `${cx - Math.cos(Math.PI * t) * r}px`;
		el.style.top = `${cy - Math.sin(Math.PI * t) * r}px`;
	}

	function current() {
		if (live) {
			const d = new Date();
			return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
		}
		return parseFloat(slider.value);
	}

	function render(h: number) {
		const top = colorAt(h, 1);
		const bot = colorAt(h, 2);
		sky.style.background = `linear-gradient(to bottom, ${rgb(top)}, ${rgb(bot)})`;

		const ts = (h - 6) / 12;
		if (ts >= -0.05 && ts <= 1.05) {
			place(sun, Math.min(1, Math.max(0, ts)));
			sun.style.opacity = String(Math.min(1, Math.min(ts + 0.05, 1.05 - ts) * 10));
			const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, ts)));
			sun.style.filter = `blur(7px) saturate(${1.3 - lift * 0.4})`;
		} else {
			sun.style.opacity = '0';
		}

		const hm = h < 6 ? h + 24 : h;
		const tm = (hm - 18) / 12;
		if (tm >= -0.05 && tm <= 1.05) {
			place(moon, Math.min(1, Math.max(0, tm)));
			moon.style.opacity = String(
				Math.min(1, Math.min(tm + 0.05, 1.05 - tm) * 10) * 0.95,
			);
		} else {
			moon.style.opacity = '0';
		}

		const night =
			h < 5 || h > 21
				? 1
				: h < 6.5
					? (6.5 - h) / 1.5
					: h > 19.5
						? (h - 19.5) / 1.5
						: 0;
		stars.style.opacity = String(night);

		const lum = 0.3 * bot[0] + 0.59 * bot[1] + 0.11 * bot[2];
		ui.style.color = lum > 140 ? '#222' : '#eee';

		const hh = Math.floor(h);
		const mm = Math.floor((h - hh) * 60);
		clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
		if (live) slider.value = String(h);
	}

	drawStars();
	addEventListener('resize', () => {
		drawStars();
		render(current());
	});

	slider.addEventListener('input', () => {
		live = false;
		render(current());
	});
	liveBtn.addEventListener('click', () => {
		live = true;
		render(current());
	});
	setInterval(() => {
		if (live) render(current());
	}, 1000);
	render(current());
}
