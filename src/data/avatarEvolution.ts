import avatar001Svg from '../images/avatar/evolution/turtleand-0.0.1.svg?url';
import avatar002Svg from '../images/avatar/evolution/turtleand-0.0.2.svg?url';
import avatar003Svg from '../images/avatar/evolution/turtleand-0.0.3.svg?url';
import avatar004Svg from '../images/avatar/evolution/turtleand-0.0.4.svg?url';
import avatar010Svg from '../images/avatar/evolution/turtleand-0.1.0.svg?url';
import avatar011Svg from '../images/avatar/evolution/turtleand-0.1.1.svg?url';
import avatar001ContactA from '../images/avatar/evolution/walking/0.0.1/contact-a.svg?url';
import avatar001Passing from '../images/avatar/evolution/walking/0.0.1/passing.svg?url';
import avatar001ContactB from '../images/avatar/evolution/walking/0.0.1/contact-b.svg?url';
import avatar002ContactA from '../images/avatar/evolution/walking/0.0.2/contact-a.svg?url';
import avatar002Passing from '../images/avatar/evolution/walking/0.0.2/passing.svg?url';
import avatar002ContactB from '../images/avatar/evolution/walking/0.0.2/contact-b.svg?url';
import avatar003ContactA from '../images/avatar/evolution/walking/0.0.3/contact-a.svg?url';
import avatar003Passing from '../images/avatar/evolution/walking/0.0.3/passing.svg?url';
import avatar003ContactB from '../images/avatar/evolution/walking/0.0.3/contact-b.svg?url';
import avatar004ContactA from '../images/avatar/evolution/walking/0.0.4/contact-a.svg?url';
import avatar004Passing from '../images/avatar/evolution/walking/0.0.4/passing.svg?url';
import avatar004ContactB from '../images/avatar/evolution/walking/0.0.4/contact-b.svg?url';
import avatar010ContactA from '../images/avatar/evolution/walking/0.1.0/contact-a.svg?url';
import avatar010Passing from '../images/avatar/evolution/walking/0.1.0/passing.svg?url';
import avatar010ContactB from '../images/avatar/evolution/walking/0.1.0/contact-b.svg?url';
import avatar011ContactA from '../images/avatar/evolution/walking/0.1.1/contact-a.svg?url';
import avatar011Passing from '../images/avatar/evolution/walking/0.1.1/passing.svg?url';
import avatar011ContactB from '../images/avatar/evolution/walking/0.1.1/contact-b.svg?url';
import { avatarGalleryEntries } from './avatarGallery';

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
  fallbackImage: string;
  walkPoses: AvatarWalkPoses;
};

const vectorImages: Record<string, string> = {
  'genesis-shell': avatar001Svg,
  'quantum-shell': avatar002Svg,
  'tech-nomad': avatar003Svg,
  'network-visitor': avatar004Svg,
  'hydraulic-brace': avatar010Svg,
  'frontier-cartographer': avatar011Svg,
};

const walkPoses: Record<string, AvatarWalkPoses> = {
  'genesis-shell': {
    contactA: avatar001ContactA,
    passing: avatar001Passing,
    contactB: avatar001ContactB,
  },
  'quantum-shell': {
    contactA: avatar002ContactA,
    passing: avatar002Passing,
    contactB: avatar002ContactB,
  },
  'tech-nomad': {
    contactA: avatar003ContactA,
    passing: avatar003Passing,
    contactB: avatar003ContactB,
  },
  'network-visitor': {
    contactA: avatar004ContactA,
    passing: avatar004Passing,
    contactB: avatar004ContactB,
  },
  'hydraulic-brace': {
    contactA: avatar010ContactA,
    passing: avatar010Passing,
    contactB: avatar010ContactB,
  },
  'frontier-cartographer': {
    contactA: avatar011ContactA,
    passing: avatar011Passing,
    contactB: avatar011ContactB,
  },
};

export const avatarEvolutionStages: AvatarEvolutionStage[] = avatarGalleryEntries
  .map((entry) => ({
    id: entry.id,
    version: entry.version,
    date: entry.date,
    title: entry.title,
    description: entry.description,
    titleEs: entry.titleEs,
    descriptionEs: entry.descriptionEs,
    vectorImage: vectorImages[entry.id],
    fallbackImage: entry.finalImage,
    walkPoses: walkPoses[entry.id],
  }))
  .sort((a, b) => a.date.localeCompare(b.date));
