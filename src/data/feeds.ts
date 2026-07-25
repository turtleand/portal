export type TurtleandFeed = {
  surface: string;
  url: string;
  siteUrl: string;
  description: string;
  type: 'rss';
};

export const turtleandFeeds: TurtleandFeed[] = [
  {
    surface: 'Growth',
    url: 'https://growth.turtleand.com/rss.xml',
    siteUrl: 'https://growth.turtleand.com/',
    description: 'Reflective essays on AI, technology, growth, and human agency.',
    type: 'rss',
  },
  {
    surface: 'Build',
    url: 'https://build.turtleand.com/rss.xml',
    siteUrl: 'https://build.turtleand.com/',
    description: 'Engineering craft, implementation notes, and software reasoning.',
    type: 'rss',
  },
  {
    surface: 'AI Lab',
    url: 'https://lab.turtleand.com/rss.xml',
    siteUrl: 'https://lab.turtleand.com/',
    description: 'AI learning topics, agent patterns, and capability-building modules.',
    type: 'rss',
  },
  {
    surface: 'OpenClaw Lab',
    url: 'https://openclaw.turtleand.com/rss.xml',
    siteUrl: 'https://openclaw.turtleand.com/',
    description: 'Applied agent-systems notes and operational trade-offs.',
    type: 'rss',
  },
  {
    surface: 'Hermes Lab',
    url: 'https://hermes.turtleand.com/rss.xml',
    siteUrl: 'https://hermes.turtleand.com/',
    description: 'Hermes Agent field notes, troubleshooting guides, and voice workflows.',
    type: 'rss',
  },
  {
    surface: 'Handbook',
    url: 'https://handbook.turtleand.com/rss.xml',
    siteUrl: 'https://handbook.turtleand.com/',
    description: 'Compressed operating principles for human-AI collaboration.',
    type: 'rss',
  },
  {
    surface: 'Energy',
    url: 'https://energy.turtleand.com/rss.xml',
    siteUrl: 'https://energy.turtleand.com/',
    description: 'Electricity and physical-systems learning articles.',
    type: 'rss',
  },
  {
    surface: 'Chain Lab',
    url: 'https://decentralized.turtleand.com/rss.xml',
    siteUrl: 'https://decentralized.turtleand.com/',
    description: 'Blockchain systems literacy and protocol trade-offs.',
    type: 'rss',
  },
];
