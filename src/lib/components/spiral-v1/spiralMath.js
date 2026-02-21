const ANGLE_STEP = 0.4;
const RADIUS = 700;
const Y_STEP = 70;
const VISIBLE_RANGE = 20;
const MAX_ROTATE = 75;

// Deterministic noise from integer index — returns -1..1
const noise = (i) => Math.sin(i * 127.1 + Math.cos(i * 311.7) * 43758.5453) % 1;
const noise2 = (i) => Math.sin(i * 269.3 + Math.cos(i * 183.1) * 21317.1291) % 1;
const noise3 = (i) => Math.sin(i * 419.7 + Math.cos(i * 571.3) * 63793.7113) % 1;

const computeSpiralPosition = (d, index) => {
	const absD = Math.abs(d);

	// Organic jitter — scales up away from center so active album stays clean
	const jitterStrength = Math.min(1, absD / 3);
	const angleJitter = noise(index) * 0.22 * jitterStrength;
	const radiusJitter = noise2(index) * 90 * jitterStrength;
	const yJitter = noise3(index) * 22 * jitterStrength;

	const angle = d * ANGLE_STEP + angleJitter;
	const r = RADIUS + radiusJitter;

	const x = r * Math.sin(angle);
	const z = r * Math.cos(angle) - r;
	const y = d * Y_STEP + yJitter;

	// Rotation: ramps quickly toward ±75° but never past — always face-forward
	const rawRotate = -(angle * 180) / Math.PI;
	const rotateY = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, rawRotate));

	// X-tilt: cards tilt back (toward ground) as they move away from center
	const rotateX = Math.min(absD, 10) * 4.0 * jitterStrength;

	// Scale: tight gaussian peak at center, only active album gets the boost
	// Card CSS is 450px; divide by 3 so max visual size stays ~435px (scale ≤ 1.0)
	// This ensures the browser rasterizes at 450px and always downscales — never upscales a low-res texture
	const scale = (0.9 + 2.0 * Math.exp(-absD * absD * 2.5)) / 3;

	// Opacity: smooth falloff from center
	const opacity = 0.12 + 0.88 * Math.exp(-absD * 0.12);

	// zIndex: higher for items closer to center
	const zIndex = 1000 - Math.round(absD * 10);

	return { x, y, z, rotateX, rotateY, scale, opacity, zIndex };
};

const positionToTransform = (pos) =>
	`translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, ${pos.z.toFixed(1)}px) rotateX(${pos.rotateX.toFixed(1)}deg) rotateY(${pos.rotateY.toFixed(1)}deg) scale(${pos.scale.toFixed(3)})`;

export { computeSpiralPosition, positionToTransform, VISIBLE_RANGE, Y_STEP };
