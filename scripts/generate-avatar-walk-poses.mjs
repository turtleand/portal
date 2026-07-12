import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { avatarGaits, avatarRegions, walkPoses } from './avatar-walk-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(root, 'src/images/avatar/evolution');
const outputDirectory = path.join(sourceDirectory, 'walking');

const createPoseConfig = (pose, gait) => {
  if (pose === 'passing') {
    return {
      bodyY: 5,
      limbs: [0, 1, 2, 3].map(() => ({ x: 0, y: 0, angle: 0 })),
    };
  }

  const advancing = pose === 'contact-a'
    ? new Set(gait.pairA)
    : new Set([0, 1, 2, 3].filter((index) => !gait.pairA.includes(index)));
  const forward = gait.mechanical
    ? { x: 2, y: -1, angle: -1.8 }
    : { x: 0, y: -1, angle: -1.8 };
  const supporting = gait.mechanical
    ? { x: -2, y: 0, angle: 1.5 }
    : { x: 0, y: 0, angle: 1.6 };
  return {
    bodyY: 0,
    limbs: [0, 1, 2, 3].map((index) => advancing.has(index) ? forward : supporting),
  };
};

const extractArtwork = (source, version) => {
  const match = source.match(/<g\b[^>]*data-group="artwork"[^>]*>([\s\S]*)<\/g>\s*<\/svg>/);
  if (!match) throw new Error(`v${version}: canonical artwork group not found`);
  return match[1].trim();
};

const createPoseSvg = ({ version, pose, poseConfig, gait, regions, artwork }) => {
  const prefix = `v${version.replaceAll('.', '')}-${pose}`;
  const masks = regions
    .map(([shape]) => `<path d="${shape}" fill="#000"/>`)
    .join('');
  const clips = regions
    .map(([shape], index) => `    <clipPath id="${prefix}-limb-${index}" clipPathUnits="userSpaceOnUse"><path d="${shape}"/></clipPath>`)
    .join('\n');
  const limbGroups = poseConfig.limbs
    .map(({ x, y, angle }, index) => {
      const [, pivotX, pivotY] = regions[index];
      return `    <g transform="translate(${x} ${y}) rotate(${angle} ${pivotX} ${pivotY})"><g clip-path="url(#${prefix}-limb-${index})"><use href="#${prefix}-source"/></g></g>`;
    });
  const body = poseConfig.bodyY
    ? `    <g transform="translate(0 ${poseConfig.bodyY})"><use href="#${prefix}-source" mask="url(#${prefix}-base-mask)"/></g>`
    : `    <use href="#${prefix}-source" mask="url(#${prefix}-base-mask)"/>`;
  const behindBody = gait.behindBody.map((index) => limbGroups[index]).join('\n');
  const inFrontOfBody = limbGroups.filter((_, index) => !gait.behindBody.includes(index)).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" data-avatar-version="${version}" data-walk-pose="${pose}" aria-labelledby="${prefix}-title ${prefix}-desc">
  <title id="${prefix}-title">Turtleand v${version}, ${pose} walk pose</title>
  <desc id="${prefix}-desc">A faithful articulated walking pose derived from the canonical Turtleand v${version} vector.</desc>
  <defs>
    <g id="${prefix}-source">
${artwork}
    </g>
    <mask id="${prefix}-base-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/>
      ${masks}
    </mask>
${clips}
  </defs>
  <g id="${prefix}-artwork" data-group="artwork">
${behindBody}
${body}
${inFrontOfBody}
  </g>
</svg>
`;
};

await mkdir(outputDirectory, { recursive: true });

for (const [version, regions] of Object.entries(avatarRegions)) {
  const canonicalPath = path.join(sourceDirectory, `turtleand-${version}.svg`);
  const source = await readFile(canonicalPath, 'utf8');
  const artwork = extractArtwork(source, version);
  const versionDirectory = path.join(outputDirectory, version);
  await mkdir(versionDirectory, { recursive: true });

  const gait = avatarGaits[version];
  for (const pose of walkPoses) {
    const poseConfig = createPoseConfig(pose, gait);
    const svg = createPoseSvg({ version, pose, poseConfig, gait, regions, artwork });
    await writeFile(path.join(versionDirectory, `${pose}.svg`), svg);
  }
}

console.log(`Generated ${Object.keys(avatarRegions).length * walkPoses.length} articulated avatar walk poses.`);
