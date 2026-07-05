import { turtleandFeeds } from '../data/feeds';

export async function GET() {
  return new Response(
    JSON.stringify(
      {
        name: 'Turtleand Feeds',
        canonical: 'https://turtleand.com/feeds.json',
        feeds: turtleandFeeds,
      },
      null,
      2
    ),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}
