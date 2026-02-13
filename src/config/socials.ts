export type SocialLink = {
  name: 'Github' | 'Mail';
  href: string;
  linkTitle: string;
  icon: 'github' | 'mail';
  active: boolean;
};

const siteTitle = 'Turtleand';

export const SOCIAL_LINKS: SocialLink[] = [
  {
    name: 'Github',
    href: 'https://github.com/turtleand',
    linkTitle: `${siteTitle} on Github`,
    icon: 'github',
    active: true,
  },
  {
    name: 'Mail',
    href: 'mailto:hello@turtleand.com',
    linkTitle: `Send an email to ${siteTitle}`,
    icon: 'mail',
    active: true,
  },
];
