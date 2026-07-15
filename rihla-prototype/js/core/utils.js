export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Framerate-independent exponential smoothing (Lerp toward target).
// `smoothing` in [0..1], higher = snappier. dt in seconds.
export function damp(current, target, smoothing, dt) {
  return current + (target - current) * (1 - Math.exp(-smoothing * dt));
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}
