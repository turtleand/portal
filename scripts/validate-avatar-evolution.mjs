import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDirectory = path.join(root, 'src/images/avatar/evolution');
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

const filenames = (await readdir(assetDirectory))
  .filter((filename) => filename.endsWith('.svg'))
  .sort();

assert.equal(filenames.length, 6, `Expected exactly six evolution SVGs, found ${filenames.length}`);

/** @type {Map<string, string>} */
const globalIds = new Map();

for (const filename of filenames) {
  const source = await readFile(path.join(assetDirectory, filename), 'utf8');
  assert.match(source, /^<svg\b[^>]*viewBox="0 0 1024 1024"[^>]*>/, `${filename}: missing shared viewBox`);
  assert.match(source, /<title\b[^>]*>[^<]+<\/title>/, `${filename}: missing accessible title`);
  assert.match(source, /<desc\b[^>]*>[^<]+<\/desc>/, `${filename}: missing accessible description`);
  assert.doesNotMatch(source, /<(?:defs|image|script|style|foreignObject)\b/i, `${filename}: forbidden embedded content`);
  assert.doesNotMatch(source, /<!DOCTYPE|<!ENTITY/i, `${filename}: unsafe XML declaration`);
  assert.doesNotMatch(source, /\bon[a-z]+\s*=/i, `${filename}: inline event handler`);
  assert.doesNotMatch(source, /\b(?:href|xlink:href)="(?!#)[^"]+"/i, `${filename}: external resource reference`);
  assert.doesNotMatch(source, /@import\b/i, `${filename}: external stylesheet import`);
  assert.doesNotMatch(source, /data-morph-key=/, `${filename}: legacy morph geometry`);
  assert.doesNotMatch(source, /<path\b[^>]*\bd="\s*"/i, `${filename}: empty path data`);

  const groupNames = [...source.matchAll(/data-group="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(groupNames, ['artwork'], `${filename}: expected exactly one canonical artwork group`);
  forbiddenGroups.forEach((group) => {
    assert(!groupNames.includes(group), `${filename}: contains legacy synthetic ${group} group`);
  });

  const openingGroups = [...source.matchAll(/<g\b/g)].length;
  const closingGroups = [...source.matchAll(/<\/g>/g)].length;
  assert.equal(openingGroups, 1, `${filename}: visible geometry must use only the canonical artwork group`);
  assert.equal(closingGroups, 1, `${filename}: unbalanced artwork group`);
  assert.match(
    source,
    new RegExp(`^<svg\\b[^>]*>\\s*<title\\b[^>]*>[^<]+<\\/title>\\s*<desc\\b[^>]*>[^<]+<\\/desc>\\s*<g\\b[^>]*data-group="artwork"[^>]*>\\s*<(?:${visibleElements})\\b`, 'i'),
    `${filename}: visible geometry exists outside the canonical artwork layer`,
  );
  assert.match(source, /<\/g>\s*<\/svg>\s*$/, `${filename}: unexpected root content after canonical artwork`);

  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${filename}: duplicate IDs inside file`);
  ids.forEach((id) => {
    assert(!globalIds.has(id), `${filename}: ID "${id}" also exists in ${globalIds.get(id)}`);
    globalIds.set(id, filename);
  });

  const localIdSet = new Set(ids);
  const references = [
    ...[...source.matchAll(/url\(#([^\)]+)\)/g)].map((match) => match[1]),
    ...[...source.matchAll(/\b(?:href|xlink:href)="#([^"]+)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/aria-labelledby="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
  ];
  references.forEach((id) => assert(localIdSet.has(id), `${filename}: unresolved reference #${id}`));
}

console.log(`Validated ${filenames.length} standalone avatar SVGs with one canonical artwork layer each.`);
