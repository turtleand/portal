import avatar001Svg from '../images/avatar/evolution/turtleand-0.0.1.svg?url';
import avatar002Svg from '../images/avatar/evolution/turtleand-0.0.2.svg?url';
import avatar003Svg from '../images/avatar/evolution/turtleand-0.0.3.svg?url';
import avatar004Svg from '../images/avatar/evolution/turtleand-0.0.4.svg?url';
import avatar010Svg from '../images/avatar/evolution/turtleand-0.1.0.svg?url';
import avatar011Svg from '../images/avatar/evolution/turtleand-0.1.1.svg?url';
import { avatarGalleryEntries } from './avatarGallery';

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
};

const vectorImages: Record<string, string> = {
  'genesis-shell': avatar001Svg,
  'quantum-shell': avatar002Svg,
  'tech-nomad': avatar003Svg,
  'network-visitor': avatar004Svg,
  'hydraulic-brace': avatar010Svg,
  'frontier-cartographer': avatar011Svg,
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
  }))
  .sort((a, b) => a.date.localeCompare(b.date));
