// Small shaping helpers used by the beats.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/** 0 → 1 as x goes from e0 to e1, with eased ends. */
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Progress (0..1) of `t` through the window [start, start + length]. */
export const progress = (t, start, length) => clamp((t - start) / length);
