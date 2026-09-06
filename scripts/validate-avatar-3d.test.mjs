import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateAvatar3dAssets, validateGlb } from './validate-avatar-3d.mjs';

const manifest = [
  { id: 'first-avatar', version: 'v0.0.1' },
  { id: 'second-avatar', version: 'v0.0.2' },
];

const makeGlb = (name, mutate = () => {}) => {
  const binary = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 1].forEach((value, index) => binary.writeFloatLE(value, index * 4));
  const gltf = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] }],
    materials: [{ name: 'Skin', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.6 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ name, mesh: 0, extras: { avatarId: name, avatarVersion: manifest.find((entry) => entry.id === name)?.version ?? 'v0.0.1', direction: 'Sculpted Warmth' } }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  mutate(gltf);
  const json = Buffer.from(JSON.stringify(gltf));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(paddedJson);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + binary.length, 8);
  const jsonChunk = Buffer.alloc(8);
  jsonChunk.writeUInt32LE(paddedJson.length, 0);
  jsonChunk.writeUInt32LE(0x4e4f534a, 4);
  const binChunk = Buffer.alloc(8);
  binChunk.writeUInt32LE(binary.length, 0);
  binChunk.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, paddedJson, binChunk, binary]);
};

const fixture = async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'avatar-3d-assets-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'src/images/avatar/3d');
  const manifestPath = path.join(root, 'src/data/avatarVersions.json');
  await mkdir(directory, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest));
  for (const entry of manifest) await writeFile(path.join(directory, `turtleand-${entry.version.slice(1)}.glb`), makeGlb(entry.id));
  await writeFile(path.join(directory, 'warm.hdr'), Buffer.concat([
    Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n'),
    Buffer.from([128, 128, 128, 128]),
  ]));
  return { root, directory, manifestPath };
};

test('manifest IDs map to distinct self-contained models and one environment', async (t) => {
  const { root } = await fixture(t);
  const result = await validateAvatar3dAssets(root);
  assert.deepEqual(result.models.map(({ id, version }) => ({ id, version })), manifest);
  assert(result.models.every((model) => model.rawBytes > 0 && model.gzipBytes > 0));
});

test('missing and orphan derivatives fail the complete-set contract', async (t) => {
  const { root, directory } = await fixture(t);
  await writeFile(path.join(directory, 'turtleand-9.9.9.glb'), makeGlb('orphan'));
  await assert.rejects(validateAvatar3dAssets(root), /no missing or orphan/);
  await rm(path.join(directory, 'turtleand-9.9.9.glb'));
  await rm(path.join(directory, 'turtleand-0.0.2.glb'));
  await assert.rejects(validateAvatar3dAssets(root), /no missing or orphan/);
});

test('duplicate IDs, duplicate versions, and duplicate model files fail', async (t) => {
  const { root, directory, manifestPath } = await fixture(t);
  await writeFile(manifestPath, JSON.stringify([manifest[0], { ...manifest[1], id: manifest[0].id }]));
  await assert.rejects(validateAvatar3dAssets(root), /duplicate manifest ID/);
  await writeFile(manifestPath, JSON.stringify([manifest[0], { ...manifest[1], version: manifest[0].version }]));
  await assert.rejects(validateAvatar3dAssets(root), /duplicate manifest version/);
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(path.join(directory, 'turtleand-0.0.2.glb'), await readFile(path.join(directory, 'turtleand-0.0.1.glb')));
  await assert.rejects(validateAvatar3dAssets(root), /versions need distinct derivatives/);
});

test('truncated files and corrupt chunk lengths fail before decoding', () => {
  const valid = makeGlb('sample');
  assert.throws(() => validateGlb(valid.subarray(0, -1)), /length mismatch/);
  const corrupt = Buffer.from(valid);
  corrupt.writeUInt32LE(0xfffffffc, 12);
  assert.throws(() => validateGlb(corrupt), /chunk exceeds file length/);
});

test('external resources, missing geometry, and out-of-bounds views fail', () => {
  assert.throws(() => validateGlb(makeGlb('external', (gltf) => { gltf.buffers[0].uri = 'remote.bin'; })), /URI resources are forbidden/);
  assert.throws(() => validateGlb(makeGlb('texture', (gltf) => { gltf.images = [{ uri: 'texture.png' }]; })), /URI resources are forbidden/);
  assert.throws(() => validateGlb(makeGlb('empty', (gltf) => { gltf.meshes = []; })), /missing geometry/);
  assert.throws(() => validateGlb(makeGlb('overflow', (gltf) => { gltf.bufferViews[0].byteLength = 100; })), /exceeds buffer/);
  assert.throws(() => validateGlb(makeGlb('missing-position', (gltf) => { gltf.meshes[0].primitives[0].attributes.POSITION = 9; })), /references a missing entry/);
});

test('invalid lighting environment fails independently from the models', async (t) => {
  const { root, directory } = await fixture(t);
  await writeFile(path.join(directory, 'warm.hdr'), 'not an HDR environment');
  await assert.rejects(validateAvatar3dAssets(root), /Radiance HDR header/);
});

test('a valid model assigned to the wrong identity or direction fails', () => {
  assert.throws(() => validateGlb(makeGlb('second-avatar'), 'renamed-model.glb', manifest[0]), /stable ID does not match/);
  assert.throws(() => validateGlb(makeGlb('first-avatar', (gltf) => { gltf.nodes[0].extras.avatarVersion = 'v9.9.9'; }), 'wrong-version.glb', manifest[0]), /embedded version does not match/);
  assert.throws(() => validateGlb(makeGlb('first-avatar', (gltf) => { gltf.nodes[0].extras.direction = 'Quiet Circuitry'; }), 'wrong-look.glb', manifest[0]), /selected art direction/);
});
