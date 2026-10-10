/* Geometry-native studio surface detail. Colors multiply the PBR base color;
 * restrained normal relief adds material character without textures or triangles.
 * Call on a world-space geometry clone, after applying the mesh world matrix.
 */
const THREE = require("three");

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (lo, hi, v) => {
  const t = clamp((v - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
const grain = (x, y, z) =>
  Math.sin(x * 19.7 + y * 12.1 + z * 8.3) *
  Math.sin(x * 8.9 - y * 17.3 + z * 13.1);

// The shell authoring surface maps normalized X/Z onto these world axes.
const shellXZ = (positions, i) => [
  positions.getX(i) / 1.06,
  (positions.getZ(i) + 0.12) / 1.2,
];

function shellEnvelope(positions, center) {
  // A directional radius keeps edge shading on irregular scutes. Each vertex
  // samples its nearest envelope direction; gaps interpolate between neighbors.
  const samples = [];
  for (let i = 0; i < positions.count; i++) {
    const [x, z] = shellXZ(positions, i);
    const dx = x - center[0], dz = z - center[1];
    const radius = Math.hypot(dx, dz);
    if (radius > 0.00001) samples.push({ angle: Math.atan2(dz, dx), radius });
  }
  samples.sort((a, b) => a.angle - b.angle);
  const envelope = [];
  for (const sample of samples) {
    const last = envelope[envelope.length - 1];
    if (last && Math.abs(last.angle - sample.angle) < 0.0001) {
      last.radius = Math.max(last.radius, sample.radius);
    } else envelope.push({ ...sample });
  }
  return (angle) => {
    if (!envelope.length) return 1;
    let left = envelope[envelope.length - 1], right = envelope[0];
    for (const sample of envelope) {
      if (sample.angle <= angle) left = sample;
      else { right = sample; break; }
    }
    let a = left.angle, b = right.angle, target = angle;
    if (b <= a) b += Math.PI * 2;
    if (target < a) target += Math.PI * 2;
    const t = clamp((target - a) / Math.max(0.00001, b - a));
    return left.radius + (right.radius - left.radius) * t;
  };
}

/** Decorates the supplied geometry in place and returns it. Existing colors,
 * such as iris fibers, are intentionally preserved. Metal stays entirely PBR.
 * @param {{geometry: import('three').BufferGeometry, userData?: object}} object
 * @param {'skin'|'shell'|'belly'|'metal'} kind
 */
function applySurfaceDetail(object, kind) {
  const geometry = object.geometry;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  if (!positions || !normals || kind === "metal" || geometry.hasAttribute("color")) {
    return geometry;
  }
  if (!["skin", "shell", "belly"].includes(kind)) return geometry;

  const colors = new Float32Array(positions.count * 3);
  const center = object.userData?.scuteCenter;
  const envelope = kind === "shell" && Array.isArray(center)
    ? shellEnvelope(positions, center) : null;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    let nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
    let red = 1, green = 1, blue = 1;
    if (kind === "skin") {
      const ventral = 0.93 + 0.07 * smooth(0.25, 1.9, y);
      const underside = 1 - 0.05 * smooth(0, 0.85, -ny);
      const muzzle = Math.exp(-(((y - 1.24) / 0.19) ** 2) - ((z - 1.88) / 0.26) ** 2);
      const subtle = grain(x, y, z) * 0.004;
      const value = ventral * underside * (1 - muzzle * 0.018) + subtle;
      red = value * 1.012;
      green = value;
      blue = value * 0.974;
    } else if (kind === "belly") {
      const value = 0.92 + 0.08 * smooth(0.13, 0.81, y) + grain(x, y, z) * 0.003;
      red = value * 1.008;
      green = value;
      blue = value * 0.971;
    } else if (envelope) {
      const [sx, sz] = shellXZ(positions, i);
      const dx = sx - center[0], dz = sz - center[1];
      const radius = Math.hypot(dx, dz), angle = Math.atan2(dz, dx);
      const edge = smooth(0.68, 1, radius / Math.max(0.00001, envelope(angle)));
      const phase = radius * 42 + Math.sin(angle * 5) * 0.18 +
        Math.sin(dx * 27 + dz * 17) * 0.14;
      const fade = smooth(0.015, 0.055, radius);
      const growth = Math.sin(phase) * 0.010 * fade;
      const value = 1.025 - edge * 0.14 + growth + grain(x, y, z) * 0.003;
      red = value * 1.012;
      green = value;
      blue = value * 0.962;

      // Analytic bump derivative projected onto the real surface tangent plane.
      // This small relief remains continuous and does not alter the silhouette.
      if (radius > 0.015) {
        const r2 = radius * radius;
        const angular = Math.cos(angle * 5) * 0.9;
        const warp = Math.cos(dx * 27 + dz * 17) * 0.14;
        const amplitude = Math.cos(phase) * 0.0012 * fade;
        const gx = amplitude * (42 * dx / radius - angular * dz / r2 + warp * 27) / 1.06;
        const gz = amplitude * (42 * dz / radius + angular * dx / r2 + warp * 17) / 1.2;
        const normalDot = nx * gx + nz * gz;
        nx -= gx - nx * normalDot;
        ny += ny * normalDot;
        nz -= gz - nz * normalDot;
        const length = Math.hypot(nx, ny, nz);
        normals.setXYZ(i, nx / length, ny / length, nz / length);
      }
    }
    colors[i * 3] = red;
    colors[i * 3 + 1] = green;
    colors[i * 3 + 2] = blue;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  normals.needsUpdate = true;
  return geometry;
}

module.exports = { applySurfaceDetail };
