import avatarVersions from './avatarVersions.json';

/** A dimensional derivative of an existing canonical avatar, never a new identity. */
export type Avatar3dAsset = Readonly<{
  id: string;
  version: string;
  modelUrl: string;
}>;

// Resolves build-managed URLs. The browser requests these only after 3D opt-in.
const assets = import.meta.glob<string>('../images/avatar/3d/**/*', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});

const prefix = '../images/avatar/3d/';
const environmentPath = `${prefix}warm.hdr`;
const expectedPaths = new Set([environmentPath]);
const ids = new Set<string>();
const versions = new Set<string>();
const entries: [string, Avatar3dAsset][] = [];

for (const entry of avatarVersions) {
  if (!entry.id || !/^v\d+\.\d+\.\d+$/.test(entry.version)) {
    throw new Error('[avatar-3d] Every model needs a valid manifest ID and semantic version.');
  }
  if (ids.has(entry.id) || versions.has(entry.version)) {
    throw new Error(`[avatar-3d] Duplicate manifest identity: ${entry.id} (${entry.version}).`);
  }
  ids.add(entry.id);
  versions.add(entry.version);

  const modelPath = `${prefix}turtleand-${entry.version.slice(1)}.glb`;
  expectedPaths.add(modelPath);
  const modelUrl = assets[modelPath];
  if (!modelUrl) throw new Error(`[avatar-3d] Missing ${entry.version} model: ${modelPath}`);
  entries.push([entry.id, Object.freeze({ id: entry.id, version: entry.version, modelUrl })]);
}

if (entries.length === 0) throw new Error('[avatar-3d] Avatar manifest must not be empty.');
if (!assets[environmentPath]) throw new Error('[avatar-3d] Missing Sculpted Warmth lighting environment.');

for (const assetPath of Object.keys(assets)) {
  if (!expectedPaths.has(assetPath)) throw new Error(`[avatar-3d] Orphan derivative asset: ${assetPath}`);
}

/** The existing manifest remains the only source of chronology and localized copy. */
export const avatar3dById: Readonly<Record<string, Avatar3dAsset>> = Object.freeze(Object.fromEntries(entries));
export const avatar3dEnvironmentUrl: string = assets[environmentPath];
