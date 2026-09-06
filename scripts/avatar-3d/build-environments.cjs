const fs = require("node:fs"),
  path = require("node:path");
const out = path.resolve(__dirname, "../../src/images/avatar/3d");
fs.mkdirSync(out, { recursive: true });
const setups = {
  warm: {
    ambient: [0.28, 0.25, 0.2],
    key: [5.5, 4.8, 3.7],
    fill: [1.7, 2.4, 2.4],
    rim: [2.6, 1.9, 1.2],
    width: 0.42,
  },
};
function dir(az, el) {
  return [
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ];
}
function beam(v, d, w) {
  const dot = Math.max(
    -1,
    Math.min(
      1,
      v.reduce((s, x, i) => s + x * d[i], 0),
    ),
  );
  return Math.exp(-(Math.acos(dot) ** 2) / (w * w));
}
for (const [name, s] of Object.entries(setups)) {
  const w = 256,
    h = 128,
    b = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const theta = (x / w) * Math.PI * 2 - Math.PI,
        phi = (y / h) * Math.PI,
        v = [
          -Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        ];
      const a = beam(v, dir(-0.7, 0.9), s.width),
        f = beam(v, dir(1.0, 0.3), 0.8),
        r = beam(v, dir(2.7, 0.65), 0.32);
      const rgb = s.ambient.map(
        (c, i) =>
          c * (0.55 + 0.45 * Math.max(0, v[1])) +
          s.key[i] * a +
          s.fill[i] * f +
          s.rim[i] * r,
      );
      const max = Math.max(...rgb),
        e = Math.ceil(Math.log2(max)),
        scale = 256 / 2 ** e,
        j = (y * w + x) * 4;
      b[j] = Math.min(255, Math.round(rgb[0] * scale));
      b[j + 1] = Math.min(255, Math.round(rgb[1] * scale));
      b[j + 2] = Math.min(255, Math.round(rgb[2] * scale));
      b[j + 3] = e + 128;
    }
  fs.writeFileSync(
    path.join(out, name + ".hdr"),
    Buffer.concat([
      Buffer.from(
        "#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y " + h + " +X " + w + "\n",
      ),
      b,
    ]),
  );
  console.log(name, b.length);
}
