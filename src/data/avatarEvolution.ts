import avatarVersions from './avatarVersions.json';

export type AvatarWalkPose = 'contactA' | 'passing' | 'contactB';

export type AvatarWalkPoses = Record<AvatarWalkPose, string>;

export type AvatarEvolutionStage = {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  vectorImage: string;
  walkPoses: AvatarWalkPoses;
};

const canonicalVectors = import.meta.glob<string>(
  '../images/avatar/evolution/turtleand-*.svg',
  { eager: true, query: '?url', import: 'default' },
);

const walkingVectors = import.meta.glob<string>(
  '../images/avatar/evolution/walking/*/*.svg',
  { eager: true, query: '?url', import: 'default' },
);

const requireVector = (assets: Record<string, string>, path: string, label: string) => {
  const asset = assets[path];
  if (!asset) throw new Error(`[avatar-evolution] Missing ${label}: ${path}`);
  return asset;
};

export const avatarEvolutionStages: AvatarEvolutionStage[] = avatarVersions.map((entry) => {
  const version = entry.version.replace(/^v/, '');
  const canonicalPath = `../images/avatar/evolution/turtleand-${version}.svg`;
  const posePath = (pose: string) => `../images/avatar/evolution/walking/${version}/${pose}.svg`;

  return {
    ...entry,
    vectorImage: requireVector(canonicalVectors, canonicalPath, `${entry.version} canonical vector`),
    walkPoses: {
      contactA: requireVector(walkingVectors, posePath('contact-a'), `${entry.version} contact-a pose`),
      passing: requireVector(walkingVectors, posePath('passing'), `${entry.version} passing pose`),
      contactB: requireVector(walkingVectors, posePath('contact-b'), `${entry.version} contact-b pose`),
    },
  };
});
