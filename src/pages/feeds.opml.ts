import { turtleandFeeds } from '../data/feeds';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export async function GET() {
  const outlines = turtleandFeeds
    .map(
      (feed) =>
        `    <outline text="${escapeXml(feed.surface)}" title="${escapeXml(feed.surface)}" type="rss" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl)}" />`
    )
    .join('\n');

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    '    <title>Turtleand Feeds</title>',
    '  </head>',
    '  <body>',
    outlines,
    '  </body>',
    '</opml>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/x-opml; charset=utf-8',
    },
  });
}
