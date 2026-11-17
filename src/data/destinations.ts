export const destinations = [
  {
    "id": "growth",
    "name": "Growth",
    "href": "https://growth.turtleand.com/",
    "source": "https://github.com/turtleand/turtleand-blog"
  },
  {
    "id": "handbook",
    "name": "Handbook",
    "href": "https://handbook.turtleand.com/",
    "source": "https://github.com/turtleand/handbook"
  },
  {
    "id": "atlas",
    "name": "AI Atlas",
    "href": "https://atlas.turtleand.com/",
    "source": "https://github.com/turtleand/ai-atlas"
  },
  {
    "id": "chronicle",
    "name": "Chronicle",
    "href": "https://chronicle.turtleand.com/",
    "source": null
  },
  {
    "id": "lab",
    "name": "AI Lab",
    "href": "https://lab.turtleand.com/",
    "source": "https://github.com/turtleand/ai-lab"
  },
  {
    "id": "build",
    "name": "Build",
    "href": "https://build.turtleand.com/",
    "source": "https://github.com/turtleand/build"
  }
] as const;

export const principalDestinations = destinations.slice(0, 4);
export const technicalDestinations = destinations.slice(4);
