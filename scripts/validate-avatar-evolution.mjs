import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { avatarGaits, avatarRegions, walkPoses } from './avatar-walk-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const avatarDirectory = path.join(root, 'src/images/avatar');
const assetDirectory = path.join(root, 'src/images/avatar/evolution');
const walkingDirectory = path.join(assetDirectory, 'walking');
const rasterArchiveDirectory = path.join(avatarDirectory, 'archive/raster');
const versionManifestPath = path.join(root, 'src/data/avatarVersions.json');
const evolutionDataPath = path.join(root, 'src/data/avatarEvolution.ts');
const forbiddenGroups = [
  'accessories',
  'circuits',
  'face',
  'head',
  'highlights',
  'limbs',
  'map',
  'shadows',
  'shell',
  'torso',
];
const visibleElements = 'circle|ellipse|line|path|polygon|polyline|rect|text|use';

const listFiles = async (directory, relativeDirectory = '') => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files.sort();
};

const avatarVersions = JSON.parse(await readFile(versionManifestPath, 'utf8'));
assert(Array.isArray(avatarVersions) && avatarVersions.length > 0, 'Avatar version manifest must be a nonempty array');

const requiredMetadata = ['id', 'version', 'date', 'title', 'description', 'titleEs', 'descriptionEs'];
avatarVersions.forEach((entry, index) => {
  assert(entry && typeof entry === 'object' && !Array.isArray(entry), `Manifest entry ${index + 1}: expected an object`);
  requiredMetadata.forEach((field) => {
    assert.equal(typeof entry[field], 'string', `Manifest entry ${index + 1}: ${field} must be a string`);
    assert(entry[field].trim(), `Manifest entry ${index + 1}: ${field} must not be empty`);
  });
  assert.match(entry.version, /^v\d+\.\d+\.\d+$/, `Manifest entry ${index + 1}: invalid semantic version`);
  assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `Manifest entry ${index + 1}: invalid date`);
});

const ids = avatarVersions.map((entry) => entry.id);
const versions = avatarVersions.map((entry) => entry.version.slice(1));
const dates = avatarVersions.map((entry) => entry.date);
assert.equal(new Set(ids).size, ids.length, 'Avatar manifest IDs must be unique');
assert.equal(new Set(versions).size, versions.length, 'Avatar manifest versions must be unique');
assert.deepEqual(dates, [...dates].sort(), 'Avatar manifest must remain in chronological order');

const expectedVersionSet = [...versions].sort();
assert.deepEqual(Object.keys(avatarRegions).sort(), expectedVersionSet, 'Walk-region config must match the avatar manifest');
assert.deepEqual(Object.keys(avatarGaits).sort(), expectedVersionSet, 'Walk-gait config must match the avatar manifest');
assert.deepEqual(walkPoses, ['contact-a', 'passing', 'contact-b'], 'Walk poses must preserve the three-frame contract');
versions.forEach((version) => {
  const regions = avatarRegions[version];
  const gait = avatarGaits[version];
  assert.equal(regions?.length, 4, `v${version}: expected four articulated limb regions`);
  regions.forEach((region, index) => {
    assert(Array.isArray(region) && region.length === 3, `v${version}: region ${index} must be [path, pivotX, pivotY]`);
    assert.equal(typeof region[0], 'string', `v${version}: region ${index} path must be a string`);
    assert.match(region[0], /^\s*[Mm]\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)/, `v${version}: region ${index} must begin with an SVG move command`);
    assert(Number.isFinite(region[1]) && Number.isFinite(region[2]), `v${version}: region ${index} pivots must be finite numbers`);
  });
  assert(gait && typeof gait === 'object', `v${version}: missing gait configuration`);
  assert.equal(typeof gait.mechanical, 'boolean', `v${version}: mechanical must be a boolean`);
  if ('coherentPassing' in gait) {
    assert.equal(typeof gait.coherentPassing, 'boolean', `v${version}: coherentPassing must be a boolean`);
  }
  for (const [field, expectedLength] of [['pairA', 2], ['behindBody', 2]]) {
    const indices = gait[field];
    assert(Array.isArray(indices), `v${version}: ${field} must be an array`);
    assert.equal(indices.length, expectedLength, `v${version}: ${field} must contain ${expectedLength} limb indices`);
    assert.equal(new Set(indices).size, indices.length, `v${version}: ${field} indices must be unique`);
    indices.forEach((index) => {
      assert(Number.isInteger(index) && index >= 0 && index < regions.length, `v${version}: ${field} index ${index} is out of range`);
    });
  }
  if ('animatedLimbs' in gait) {
    assert(Array.isArray(gait.animatedLimbs), `v${version}: animatedLimbs must be an array`);
    assert.equal(gait.animatedLimbs.length, 2, `v${version}: animatedLimbs must contain two limb indices`);
    assert.equal(new Set(gait.animatedLimbs).size, gait.animatedLimbs.length, `v${version}: animatedLimbs indices must be unique`);
    gait.animatedLimbs.forEach((index) => {
      assert(Number.isInteger(index) && gait.behindBody.includes(index), `v${version}: animated limb ${index} must be a behind-body limb`);
    });
    assert.deepEqual(
      [...gait.animatedLimbs].sort((a, b) => a - b),
      [...gait.behindBody].sort((a, b) => a - b),
      `v${version}: every behind-body limb must participate in the articulated gait`,
    );
    assert.equal(
      gait.pairA.filter((index) => gait.animatedLimbs.includes(index)).length,
      1,
      `v${version}: pairA must contain exactly one animated behind-body limb`,
    );
    assert.equal(gait.coherentPassing, true, `v${version}: animated limbs require a coherent passing pose`);
  }
});

const canonicalFiles = versions.map((version) => `turtleand-${version}.svg`).sort();
const actualCanonicalFiles = (await readdir(assetDirectory))
  .filter((filename) => filename.endsWith('.svg'))
  .sort();
assert.deepEqual(actualCanonicalFiles, canonicalFiles, 'Canonical evolution SVG set changed unexpectedly');

const expectedWalkingFiles = versions.flatMap((version) => walkPoses.map((pose) => `${version}/${pose}.svg`)).sort();

const listSvgFiles = async (directory, relativeDirectory = '') => {
  return (await listFiles(directory, relativeDirectory)).filter((filename) => filename.endsWith('.svg'));
};

const actualWalkingFiles = await listSvgFiles(walkingDirectory);
assert.deepEqual(actualWalkingFiles, expectedWalkingFiles, 'Expected exactly three walking poses for every avatar version');

const rasterReferenceFiles = (await readdir(rasterArchiveDirectory))
  .filter((filename) => /\.(?:png|jpe?g|webp)$/i.test(filename))
  .sort();
const archivedVersions = rasterReferenceFiles.map((filename) => {
  const match = filename.match(/^turtleand-(\d+\.\d+\.\d+)-(?:reference|transparent)-(\d{4}-\d{2}-\d{2})\.(?:png|jpe?g|webp)$/i);
  assert(match, `${filename}: archived raster must use the versioned reference naming convention`);
  const [, version, date] = match;
  const manifestEntry = avatarVersions.find((entry) => entry.version === `v${version}`);
  assert(manifestEntry, `${filename}: archived raster has no manifest entry`);
  assert.equal(date, manifestEntry.date, `${filename}: archived raster date must match the manifest`);
  return version;
}).sort();
assert.deepEqual(archivedVersions, expectedVersionSet, 'Expected exactly one archived raster reference for every avatar version');

const avatarAssetFiles = await listFiles(avatarDirectory);
const rasterFilesOutsideArchive = avatarAssetFiles.filter(
  (filename) => /\.(?:png|jpe?g|webp)$/i.test(filename) && !filename.startsWith('archive/raster/'),
);
assert.deepEqual(rasterFilesOutsideArchive, [], 'Avatar raster references must live only in archive/raster');

const productionSourceFiles = (await listFiles(path.join(root, 'src'))).filter((filename) =>
  /\.(?:astro|cjs|css|js|json|jsx|md|mdx|mjs|ts|tsx)$/.test(filename),
);
for (const filename of productionSourceFiles) {
  const source = await readFile(path.join(root, 'src', filename), 'utf8');
  assert.doesNotMatch(source, /images\/avatar\/archive\/raster|turtleand-\d+\.\d+\.\d+-(?:reference|transparent)-\d{4}-\d{2}-\d{2}\.(?:png|jpe?g|webp)/i, `${filename}: production source references an archived raster avatar`);
}

const evolutionDataSource = await readFile(evolutionDataPath, 'utf8');
assert.doesNotMatch(evolutionDataSource, /\b(?:avatarGallery|fallbackImage|finalImage|sketchImage)\b/, 'SVG evolution data contains a raster-gallery contract');

const obsoleteRuntimePaths = [
  'src/components/avatar/AvatarGallery.astro',
  'src/components/avatar/gallery-controller.js',
  'src/components/avatar/gallery-tabs-controller.js',
  'src/data/avatarGallery.ts',
];
for (const relativePath of obsoleteRuntimePaths) {
  await assert.rejects(access(path.join(root, relativePath)), { code: 'ENOENT' }, `${relativePath}: obsolete raster-gallery runtime still exists`);
}

const localeDictionaries = {
  en: JSON.parse(await readFile(path.join(root, 'src/content/i18n/en.json'), 'utf8')),
  es: JSON.parse(await readFile(path.join(root, 'src/content/i18n/es.json'), 'utf8')),
};
assert(!('tabs' in localeDictionaries.en.avatar), 'English avatar translations still expose obsolete gallery tabs');
assert(!('tabs' in localeDictionaries.es.avatar), 'Spanish avatar translations still expose obsolete gallery tabs');
for (const section of ['modal', 'evolution']) {
  const english = localeDictionaries.en.avatar[section];
  const spanish = localeDictionaries.es.avatar[section];
  assert.deepEqual(Object.keys(spanish).sort(), Object.keys(english).sort(), `${section}: English and Spanish keys differ`);
  for (const key of Object.keys(english)) {
    assert.equal(typeof english[key], 'string', `avatar.${section}.${key}: English value must be a string`);
    assert.equal(typeof spanish[key], 'string', `avatar.${section}.${key}: Spanish value must be a string`);
    assert(english[key].trim() && spanish[key].trim(), `avatar.${section}.${key}: translations must not be empty`);
    const englishPlaceholders = [...english[key].matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
    const spanishPlaceholders = [...spanish[key].matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
    assert.deepEqual(spanishPlaceholders, englishPlaceholders, `avatar.${section}.${key}: placeholder parity mismatch`);
  }
}

/** @type {Map<string, string>} */
const globalIds = new Map();

const validateCommonSafety = (source, filename) => {
  assert.match(source, /^<svg\b[^>]*viewBox="0 0 1024 1024"[^>]*>/, `${filename}: missing shared viewBox`);
  assert.match(source, /<title\b[^>]*>[^<]+<\/title>/, `${filename}: missing accessible title`);
  assert.match(source, /<desc\b[^>]*>[^<]+<\/desc>/, `${filename}: missing accessible description`);
  assert.doesNotMatch(source, /<(?:image|script|style|foreignObject)\b/i, `${filename}: forbidden embedded content`);
  assert.doesNotMatch(source, /<!DOCTYPE|<!ENTITY/i, `${filename}: unsafe XML declaration`);
  assert.doesNotMatch(source, /\bon[a-z]+\s*=/i, `${filename}: inline event handler`);
  assert.doesNotMatch(source, /\b(?:href|xlink:href)\s*=\s*(['"])(?!#)[^'"]*\1/i, `${filename}: external resource reference`);
  assert.doesNotMatch(source, /@import\b/i, `${filename}: external stylesheet import`);
  assert.doesNotMatch(source, /data-morph-key\s*=/, `${filename}: legacy morph geometry`);
  assert.doesNotMatch(source, /<path\b[^>]*\bd\s*=\s*(['"])\s*\1/i, `${filename}: empty path data`);

  const groupNames = [...source.matchAll(/data-group\s*=\s*(['"])([^'"]+)\1/g)].map((match) => match[2]);
  assert.deepEqual(groupNames, ['artwork'], `${filename}: expected exactly one canonical artwork group`);
  forbiddenGroups.forEach((group) => {
    assert(!groupNames.includes(group), `${filename}: contains legacy synthetic ${group} group`);
  });

  const ids = [...source.matchAll(/\bid\s*=\s*(['"])([^'"]+)\1/g)].map((match) => match[2]);
  assert.equal(ids.length, new Set(ids).size, `${filename}: duplicate IDs inside file`);
  ids.forEach((id) => {
    assert(!globalIds.has(id), `${filename}: ID "${id}" also exists in ${globalIds.get(id)}`);
    globalIds.set(id, filename);
  });

  const localIdSet = new Set(ids);
  const urlTargets = [...source.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi)].map((match) => match[2]);
  urlTargets.forEach((target) => assert.match(target, /^#[^\s]+$/, `${filename}: external URL reference`));
  const references = [
    ...urlTargets.map((target) => target.slice(1)),
    ...[...source.matchAll(/\b(?:href|xlink:href)\s*=\s*(['"])#([^'"]+)\1/g)].map((match) => match[2]),
    ...[...source.matchAll(/aria-labelledby\s*=\s*(['"])([^'"]+)\1/g)].flatMap((match) => match[2].split(/\s+/)),
  ];
  references.forEach((id) => assert(localIdSet.has(id), `${filename}: unresolved reference #${id}`));
};

/** @type {Map<string, string>} */
const canonicalArtwork = new Map();

for (const filename of canonicalFiles) {
  const source = await readFile(path.join(assetDirectory, filename), 'utf8');
  validateCommonSafety(source, filename);
  assert.doesNotMatch(source, /<(?:defs|clipPath|mask|use)\b/i, `${filename}: canonical rest must remain direct artwork`);

  const openingGroups = [...source.matchAll(/<g\b/g)].length;
  const closingGroups = [...source.matchAll(/<\/g>/g)].length;
  assert.equal(openingGroups, 1, `${filename}: canonical rest must use only its artwork group`);
  assert.equal(closingGroups, 1, `${filename}: unbalanced artwork group`);
  assert.match(
    source,
    new RegExp(`^<svg\\b[^>]*>\\s*<title\\b[^>]*>[^<]+<\\/title>\\s*<desc\\b[^>]*>[^<]+<\\/desc>\\s*<g\\b[^>]*data-group="artwork"[^>]*>\\s*<(?:${visibleElements})\\b`, 'i'),
    `${filename}: visible geometry exists outside the canonical artwork layer`,
  );
  assert.match(source, /<\/g>\s*<\/svg>\s*$/, `${filename}: unexpected root content after canonical artwork`);

  const version = filename.match(/turtleand-(.+)\.svg$/)?.[1];
  const artwork = source.match(/<g\b[^>]*data-group="artwork"[^>]*>([\s\S]*)<\/g>\s*<\/svg>/)?.[1]?.trim();
  assert(version && artwork, `${filename}: unable to capture canonical artwork`);
  assert.doesNotMatch(artwork, /\bid\s*=/i, `${filename}: canonical artwork children must remain ID-free`);
  canonicalArtwork.set(version, artwork);
}

/** @type {Map<string, Set<string>>} */
const poseGeometry = new Map();

for (const relativeFilename of expectedWalkingFiles) {
  const filename = `walking/${relativeFilename}`;
  const [version, poseFilename] = relativeFilename.split('/');
  const pose = poseFilename.replace(/\.svg$/, '');
  const source = await readFile(path.join(walkingDirectory, relativeFilename), 'utf8');
  validateCommonSafety(source, filename);

  assert.match(source, new RegExp(`^<svg\\b[^>]*data-avatar-version="${version}"[^>]*data-walk-pose="${pose}"[^>]*>`), `${filename}: missing pose identity attributes`);
  assert.match(source, /<defs>[\s\S]+<\/defs>/, `${filename}: missing local vector definitions`);
  assert.match(source, /<mask\b[^>]*maskUnits="userSpaceOnUse"[^>]*maskContentUnits="userSpaceOnUse"[^>]*x="0"[^>]*y="0"[^>]*width="1024"[^>]*height="1024"/, `${filename}: inverse body mask must use explicit shared coordinates`);
  assert.equal([...source.matchAll(/<mask\b/g)].length, 1, `${filename}: expected one body mask`);
  assert.equal([...source.matchAll(/<clipPath\b/g)].length, 4, `${filename}: expected four articulated limb clips`);
  assert.equal([...source.matchAll(/<clipPath\b[^>]*clipPathUnits="userSpaceOnUse"/g)].length, 4, `${filename}: limb clips need explicit shared coordinates`);
  assert.equal([...source.matchAll(/<use\b/g)].length, 5, `${filename}: expected one masked body and four articulated limb references`);
  assert.equal([...source.matchAll(/<g\b[^>]*data-group="artwork"/g)].length, 1, `${filename}: missing visible artwork layer`);
  assert.match(
    source,
    /^<svg\b[^>]*>\s*<title\b[^>]*>[^<]+<\/title>\s*<desc\b[^>]*>[^<]+<\/desc>\s*<defs>[\s\S]+<\/defs>\s*<g\b[^>]*data-group="artwork"[^>]*>[\s\S]+<\/g>\s*<\/svg>\s*$/,
    `${filename}: visible pose geometry must remain inside the artwork group`,
  );

  const prefix = `v${version.replaceAll('.', '')}-${pose}`;
  const sourceArtwork = source.match(new RegExp(`<g id="${prefix}-source">\\s*([\\s\\S]*?)\\s*<\\/g>\\s*<mask`))?.[1]?.trim();
  assert.equal(sourceArtwork, canonicalArtwork.get(version), `${filename}: embedded avatar differs from its canonical vector`);

  const visibleArtwork = source.match(new RegExp(`<g id="${prefix}-artwork"[^>]*>([\\s\\S]*)<\\/g>\\s*<\\/svg>`))?.[1];
  assert(visibleArtwork, `${filename}: unable to capture visible pose geometry`);
  const geometrySignature = visibleArtwork.replaceAll(prefix, 'pose').replace(/\s+/g, ' ').trim();
  const versionGeometry = poseGeometry.get(version) ?? new Set();
  assert(!versionGeometry.has(geometrySignature), `${filename}: rendered pose geometry duplicates another v${version} pose`);
  versionGeometry.add(geometrySignature);
  poseGeometry.set(version, versionGeometry);
}

versions.forEach((version) => {
  assert.equal(poseGeometry.get(version)?.size, walkPoses.length, `v${version}: expected three unique pose geometries`);
});

console.log(`Validated ${canonicalFiles.length} SVG-first avatar versions, ${expectedWalkingFiles.length} articulated walking poses, and ${rasterReferenceFiles.length} archived raster references.`);
