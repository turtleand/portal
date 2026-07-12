import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDirectory = path.join(root, 'src/images/avatar/evolution');
const walkingDirectory = path.join(assetDirectory, 'walking');
const versions = ['0.0.1', '0.0.2', '0.0.3', '0.0.4', '0.1.0', '0.1.1'];
const poses = ['contact-a', 'passing', 'contact-b'];
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

const canonicalFiles = versions.map((version) => `turtleand-${version}.svg`);
const actualCanonicalFiles = (await readdir(assetDirectory))
  .filter((filename) => filename.endsWith('.svg'))
  .sort();
assert.deepEqual(actualCanonicalFiles, canonicalFiles, 'Canonical evolution SVG set changed unexpectedly');

const expectedWalkingFiles = versions.flatMap((version) => poses.map((pose) => `${version}/${pose}.svg`)).sort();

const listSvgFiles = async (directory, relativeDirectory = '') => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSvgFiles(path.join(directory, entry.name), relativePath));
    } else if (entry.name.endsWith('.svg')) {
      files.push(relativePath);
    }
  }
  return files.sort();
};

const actualWalkingFiles = await listSvgFiles(walkingDirectory);
assert.deepEqual(actualWalkingFiles, expectedWalkingFiles, 'Expected exactly three walking poses for every avatar version');

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
  assert.doesNotMatch(source, /url\(\s*(['"])?(?!#)[^\)]*\1?\s*\)/i, `${filename}: external URL reference`);
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
  const references = [
    ...[...source.matchAll(/url\(#([^\)]+)\)/g)].map((match) => match[1]),
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
  assert.equal(poseGeometry.get(version)?.size, poses.length, `v${version}: expected three unique pose geometries`);
});

console.log(`Validated ${canonicalFiles.length} canonical rests and ${expectedWalkingFiles.length} articulated walking SVGs.`);
