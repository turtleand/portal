import en from '../content/i18n/en.json';

export type TurtleandFeed = {
  id: keyof typeof en.feeds.descriptions;
  surface: string;
  url: string;
  siteUrl: string;
  description: string;
  type: 'rss';
};

export const turtleandFeeds: TurtleandFeed[] = [
  {
    id: 'growth',
    surface: 'Growth',
    url: 'https://growth.turtleand.com/rss.xml',
    siteUrl: 'https://growth.turtleand.com/',
    description: en.feeds.descriptions.growth,
    type: 'rss',
  },
  {
    id: 'handbook',
    surface: 'Handbook',
    url: 'https://handbook.turtleand.com/rss.xml',
    siteUrl: 'https://handbook.turtleand.com/',
    description: en.feeds.descriptions.handbook,
    type: 'rss',
  },
  {
    id: 'build',
    surface: 'Build',
    url: 'https://build.turtleand.com/rss.xml',
    siteUrl: 'https://build.turtleand.com/',
    description: en.feeds.descriptions.build,
    type: 'rss',
  },
  {
    id: 'lab',
    surface: 'AI Lab',
    url: 'https://lab.turtleand.com/rss.xml',
    siteUrl: 'https://lab.turtleand.com/',
    description: en.feeds.descriptions.lab,
    type: 'rss',
  },
];
