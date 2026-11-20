/* Offline shading and embedded surface detail for the gallery models. */
const THREE = require("three");

const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const smooth = (lo, hi, value) => {
  const t = clamp((value - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

function applySurfaceDetail(geometry, kind, look) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const surface = Math.sin(x * 19.7 + y * 12.1 + z * 8.3) *
      Math.sin(x * 8.9 - y * 17.3 + z * 13.1);
    const value = kind === "skin"
      ? .91 + .08 * smooth(.19, .81, y) - .06 * smooth(.15, .84, -normals.getY(i)) + surface * look.grain * .019
      : .91 + .085 * smooth(.13, .81, y);
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value * .97;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// The living finish uses a small tile of rounded, irregular scales. Baking
// relief into a tangent-space normal map keeps the pores off the silhouette.
function makeSkinNormalTile() {
  const { crc32, deflateSync } = require("node:zlib");
  const size = 128, cells = 13;
  const wrap = (value, extent) => ((value % extent) + extent) % extent;
  const jitter = (x, y, seed) => {
    const value = Math.sin(wrap(x, cells) * 127.1 + wrap(y, cells) * 311.7 + seed) * 43758.5453;
    return value - Math.floor(value);
  };
  function height(x, y) {
    const baseX = Math.floor(x), baseY = Math.floor(y);
    let first = Infinity, second = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = baseX + dx, cy = baseY + dy;
        const sx = cx + .2 + jitter(cx, cy, 2.17) * .6;
        const sy = cy + .2 + jitter(cx, cy, 9.78) * .6;
        const distance = (x - sx) ** 2 + (y - sy) ** 2;
        if (distance < first) {
          second = first;
          first = distance;
        } else if (distance < second) second = distance;
      }
    }
    const seam = smooth(.018, .43, Math.sqrt(second) - Math.sqrt(first));
    const softness = 1 - .32 * smooth(.16, .9, Math.sqrt(first));
    return seam * softness;
  }

  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) heights[y * size + x] = height(x / size * cells, y / size * cells);
  }
  const sample = (x, y) => heights[wrap(y, size) * size + wrap(x, size)];
  const bytes = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * .83;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * .83;
      const n = Math.hypot(dx, dy, 1);
      const offset = y * (1 + size * 3) + 1 + x * 3;
      for (const [i, component] of [dx, dy, 1].entries()) {
        bytes[offset + i] = Math.round(127.5 * (1 + component / n));
      }
    }
  }
  function chunk(name, data) {
    const buffer = Buffer.alloc(data.length + 12);
    buffer.writeUInt32BE(data.length);
    buffer.write(name, 4, "ascii");
    data.copy(buffer, 8);
    buffer.writeUInt32BE(crc32(buffer.subarray(4, -4)), buffer.length - 4);
    return buffer;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return new Blob([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(bytes)), chunk("IEND", Buffer.alloc(0)),
  ], { type: "image/png" });
}

function unwrapSkin(geometry, origin, tiles) {
  const positions = geometry.attributes.position;
  const uv = new Float32Array(positions.count * 2);
  const turn = Math.PI * 2;
  for (let i = 0; i < positions.count; i += 3) {
    const arc = [0, 1, 2].map(j => Math.atan2(positions.getX(i + j) - origin[0], positions.getZ(i + j) - origin[1]) / turn);
    if (Math.max(...arc) - Math.min(...arc) > .5) {
      for (let j = 0; j < 3; j++) if (arc[j] < 0) arc[j] += 1;
    }
    for (let j = 0; j < 3; j++) {
      uv[(i + j) * 2] = arc[j] * tiles;
      uv[(i + j) * 2 + 1] = positions.getY(i + j) * 3.4;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function skinNormalPlugin(tile, scales) {
  return writer => {
    let texture;
    return {
      async writeMaterialAsync(material, definition) {
        const scale = scales.get(material);
        if (!scale) return;
        if (texture === undefined) {
          const bufferView = await writer.processBufferViewImage(tile);
          const json = writer.json;
          json.images ??= [];
          json.samplers ??= [];
          json.textures ??= [];
          const source = json.images.push({ bufferView, mimeType: 'image/png', name: 'Living Shell skin relief' }) - 1;
          const sampler = json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }) - 1;
          texture = json.textures.push({ source, sampler }) - 1;
        }
        definition.normalTexture = { index: texture, scale };
      },
    };
  };
}

module.exports = { applySurfaceDetail, makeSkinNormalTile, unwrapSkin, skinNormalPlugin };
