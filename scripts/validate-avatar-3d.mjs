import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const integer = (value, label, minimum = 0) => {
  assert(Number.isSafeInteger(value) && value >= minimum, `${label}: invalid integer`);
};

const listFiles = async (directory, prefix = '') => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), relative));
    else {
      assert(entry.isFile(), `${relative}: derivatives must be ordinary files`);
      result.push(relative);
    }
  }
  return result.sort();
};

/** Structural checks only. This does not establish art quality or full glTF conformance. */
export function validateGlb(bytes, label = 'GLB', expectedIdentity) {
  assert(bytes.length >= 28, `${label}: truncated GLB`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${label}: invalid GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: expected GLB 2`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: GLB length mismatch`);

  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, `${label}: truncated chunk header`);
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    assert.equal(length % 4, 0, `${label}: chunk must be four-byte aligned`);
    assert(offset + 8 + length <= bytes.length, `${label}: chunk exceeds file length`);
    chunks.push({ type, bytes: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  assert.equal(chunks.length, 2, `${label}: expected one JSON and one embedded binary chunk`);
  assert.equal(chunks[0].type, 0x4e4f534a, `${label}: first chunk must be JSON`);
  assert.equal(chunks[1].type, 0x004e4942, `${label}: second chunk must be binary`);

  let gltf;
  try { gltf = JSON.parse(chunks[0].bytes.toString('utf8')); }
  catch { assert.fail(`${label}: invalid glTF JSON`); }
  assert.equal(gltf.asset?.version, '2.0', `${label}: expected glTF 2.0`);

  // Local buffer views, including embedded texture images, are the only resources.
  const forbidUris = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.notEqual(key, 'uri', `${label}: URI resources are forbidden; embed resources in the GLB`);
      forbidUris(child);
    }
  };
  forbidUris(gltf);
  assert.equal(gltf.buffers?.length, 1, `${label}: expected one embedded buffer`);
  integer(gltf.buffers[0].byteLength, `${label} buffer length`, 1);
  assert(
    gltf.buffers[0].byteLength <= chunks[1].bytes.length
      && chunks[1].bytes.length - gltf.buffers[0].byteLength <= 3,
    `${label}: embedded buffer length mismatch`,
  );
  assert(Array.isArray(gltf.bufferViews) && gltf.bufferViews.length, `${label}: missing buffer views`);
  gltf.bufferViews.forEach((view, index) => {
    assert.equal(view.buffer, 0, `${label}: buffer view ${index} references a missing buffer`);
    integer(view.byteOffset ?? 0, `${label} buffer view ${index} offset`);
    integer(view.byteLength, `${label} buffer view ${index} length`, 1);
    assert((view.byteOffset ?? 0) + view.byteLength <= gltf.buffers[0].byteLength, `${label}: buffer view ${index} exceeds buffer`);
  });
  const reference = (index, list, description) => {
    integer(index, `${label} ${description}`);
    assert(index < (list?.length ?? 0), `${label}: ${description} references a missing entry`);
  };
  for (const [index, image] of (gltf.images ?? []).entries()) {
    reference(image.bufferView, gltf.bufferViews, `image ${index} buffer view`);
    assert(['image/png', 'image/jpeg', 'image/webp', 'image/ktx2'].includes(image.mimeType), `${label}: image ${index} has an unsupported MIME type`);
  }
  assert(Array.isArray(gltf.accessors) && gltf.accessors.length, `${label}: missing accessors`);
  gltf.accessors.forEach((accessor, index) => {
    reference(accessor.bufferView, gltf.bufferViews, `accessor ${index} buffer view`);
    integer(accessor.count, `${label} accessor ${index} count`, 1);
  });
  assert(Array.isArray(gltf.materials) && gltf.materials.length, `${label}: missing materials`);
  assert(Array.isArray(gltf.meshes) && gltf.meshes.length, `${label}: missing geometry`);
  gltf.meshes.forEach((mesh, meshIndex) => {
    assert(Array.isArray(mesh.primitives) && mesh.primitives.length, `${label}: mesh ${meshIndex} has no primitives`);
    mesh.primitives.forEach((primitive, primitiveIndex) => {
      const name = `mesh ${meshIndex} primitive ${primitiveIndex}`;
      reference(primitive.attributes?.POSITION, gltf.accessors, `${name} positions`);
      const positions = gltf.accessors[primitive.attributes.POSITION];
      assert.equal(positions.type, 'VEC3', `${label}: ${name} positions must have three coordinates`);
      assert(positions.count >= 3, `${label}: ${name} has insufficient geometry`);
      if (primitive.indices !== undefined) reference(primitive.indices, gltf.accessors, `${name} indices`);
      reference(primitive.material, gltf.materials, `${name} material`);
    });
  });
  assert(Array.isArray(gltf.nodes) && gltf.nodes.length, `${label}: missing scene nodes`);
  assert(gltf.nodes.some((node) => node.mesh !== undefined), `${label}: no scene node instantiates geometry`);
  if (expectedIdentity) {
    const identities = gltf.nodes.filter((node) => node.extras?.avatarId !== undefined);
    assert.equal(identities.length, 1, `${label}: expected one model identity node`);
    assert.equal(identities[0].extras.avatarId, expectedIdentity.id, `${label}: embedded stable ID does not match the manifest`);
    assert.equal(identities[0].extras.avatarVersion, expectedIdentity.version, `${label}: embedded version does not match the manifest`);
    assert.equal(identities[0].extras.direction, 'Sculpted Warmth', `${label}: model does not use the selected art direction`);
  }
  gltf.nodes.forEach((node, index) => {
    if (node.mesh !== undefined) reference(node.mesh, gltf.meshes, `node ${index} mesh`);
    for (const child of node.children ?? []) reference(child, gltf.nodes, `node ${index} child`);
  });
  reference(gltf.scene ?? 0, gltf.scenes, 'default scene');
  assert(gltf.scenes[gltf.scene ?? 0].nodes?.length, `${label}: default scene is empty`);
  for (const node of gltf.scenes[gltf.scene ?? 0].nodes) reference(node, gltf.nodes, 'scene node');
  return { meshes: gltf.meshes.length, materials: gltf.materials.length, embeddedImages: (gltf.images ?? []).length };
}

export async function validateAvatar3dAssets(root = repositoryRoot) {
  const manifest = JSON.parse(await readFile(path.join(root, 'src/data/avatarVersions.json'), 'utf8'));
  assert(Array.isArray(manifest) && manifest.length > 0, 'Avatar manifest must be a nonempty array');
  const ids = new Set();
  const versions = new Set();
  const expectedModels = manifest.map((entry) => {
    assert(typeof entry.id === 'string' && entry.id.trim(), 'Every avatar needs a stable ID');
    assert.match(entry.version, /^v\d+\.\d+\.\d+$/, `${entry.id}: invalid version`);
    assert(!ids.has(entry.id), `${entry.id}: duplicate manifest ID`);
    assert(!versions.has(entry.version), `${entry.version}: duplicate manifest version`);
    ids.add(entry.id);
    versions.add(entry.version);
    return `turtleand-${entry.version.slice(1)}.glb`;
  });
  const directory = path.join(root, 'src/images/avatar/3d');
  assert.deepEqual(await listFiles(directory), [...expectedModels, 'warm.hdr'].sort(), '3D assets must match the manifest exactly, with one shared warm.hdr and no missing or orphan files');

  const hashes = new Map();
  const models = [];
  for (let index = 0; index < expectedModels.length; index++) {
    const filename = expectedModels[index];
    const bytes = await readFile(path.join(directory, filename));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    assert(!hashes.has(sha256), `${filename}: duplicates ${hashes.get(sha256)}; versions need distinct derivatives`);
    hashes.set(sha256, filename);
    models.push({ id: manifest[index].id, version: manifest[index].version, filename, rawBytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256, ...validateGlb(bytes, filename, manifest[index]) });
  }
  const environment = await readFile(path.join(directory, 'warm.hdr'));
  const header = environment.subarray(0, 1024).toString('ascii');
  assert.match(header, /^#\?(?:RADIANCE|RGBE)\r?\n/, 'warm.hdr: expected a Radiance HDR header');
  assert.match(header, /FORMAT=32-bit_rle_rgbe\r?\n/, 'warm.hdr: unsupported HDR pixel format');
  assert.match(header, /\n-Y [1-9]\d* \+X [1-9]\d*\r?\n/, 'warm.hdr: missing HDR dimensions');
  return { models, environment: { filename: 'warm.hdr', rawBytes: environment.length, gzipBytes: gzipSync(environment).length } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await validateAvatar3dAssets();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log(`Validated ${report.models.length} distinct, self-contained 3D avatar derivatives and the shared Sculpted Warmth HDR environment.`);
}
