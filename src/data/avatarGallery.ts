import avatar001 from '../images/avatar/turtleand-0.0.1-transparent-2025-03-10.png';
import avatar002 from '../images/avatar/turtleand-0.0.2-transparent-2025-04-21.png';
import avatar003 from '../images/avatar/turtleand-0.0.3-transparent-2025-05-17.png';
import avatar004 from '../images/avatar/turtleand-0.0.4-transparent-2025-06-29.png';
import avatar010 from '../images/avatar/turtleand-0.1.0-transparent-2026-02-07.png';

export type AvatarPaletteToken = 'seafoam' | 'tide' | 'sand' | 'ember';

export type AvatarTransitionPreferences = {
  transition: 'fade' | 'morph';
  blur: 'none' | 'soft';
};

export type AvatarGalleryEntry = {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  finalImage: string;
  sketchImage?: string | null;
  palette: AvatarPaletteToken[];
  preferences: AvatarTransitionPreferences;
};

export type AvatarGalleryConfig = {
  timelineOrientation: 'vertical' | 'horizontal';
  defaultMode: 'timeline' | 'grid';
  animation: 'fade' | 'morph';
};

export const avatarGalleryConfig: AvatarGalleryConfig = {
  timelineOrientation: 'vertical',
  defaultMode: 'timeline',
  animation: 'fade',
};

export const avatarGalleryEntries: AvatarGalleryEntry[] = [
  {
    id: 'hydraulic-brace',
    version: 'v0.1.0',
    date: '2026-02-07',
    title: 'The Hydraulic Brace',
    description: '*clanks pistons* Vado al lavoro! Grazie mille!',
    titleEs: 'El Exoesqueleto Hidráulico',
    descriptionEs: '*activa pistones* Vado al lavoro! Grazie mille!',
    finalImage: avatar010.src,
    sketchImage: null,
    palette: ['seafoam', 'tide', 'ember'],
    preferences: {
      transition: 'fade',
      blur: 'soft',
    },
  },
  {
    id: 'genesis-shell',
    version: 'v0.0.1',
    date: '2025-03-10',
    title: 'The Genesis Shell',
    description: '*peeks out of shell* Ciao, come stai? Mi chiamo Marco!',
    titleEs: 'Caparazón Génesis',
    descriptionEs: '*asoma del caparazón* Ciao, come stai? Mi chiamo Marco!',
    finalImage: avatar001.src,
    sketchImage: null,
    palette: ['seafoam', 'tide'],
    preferences: {
      transition: 'fade',
      blur: 'soft',
    },
  },
  {
    id: 'quantum-shell',
    version: 'v0.0.2',
    date: '2025-04-21',
    title: 'The Quantum Shell',
    description: '*glows softly* Oggi fa bel tempo... Il gatto dorme.',
    titleEs: 'Caparazón Cuántico',
    descriptionEs: '*brilla suavemente* Oggi fa bel tempo... Il gatto dorme.',
    finalImage: avatar002.src,
    sketchImage: null,
    palette: ['tide', 'ember'],
    preferences: {
      transition: 'fade',
      blur: 'soft',
    },
  },
  {
    id: 'tech-nomad',
    version: 'v0.0.3',
    date: '2025-05-17',
    title: 'The Tech Nomad',
    description: '*adjusts visor* Ho fame! Bevo acqua.',
    titleEs: 'El Nómada Tecno',
    descriptionEs: '*ajusta visor* Ho fame! Bevo acqua.',
    finalImage: avatar003.src,
    sketchImage: null,
    palette: ['seafoam', 'sand'],
    preferences: {
      transition: 'fade',
      blur: 'none',
    },
  },
  {
    id: 'network-visitor',
    version: 'v0.0.4',
    date: '2025-06-29',
    title: 'The Network Visitor',
    description: '*transmits excitedly* Questo è un libro! Io vivo in Italia!',
    titleEs: 'El Visitante de la Red',
    descriptionEs: '*transmite emocionado* Questo è un libro! Io vivo in Italia!',
    finalImage: avatar004.src,
    sketchImage: null,
    palette: ['seafoam', 'tide', 'ember'],
    preferences: {
      transition: 'fade',
      blur: 'soft',
    },
  },
];
