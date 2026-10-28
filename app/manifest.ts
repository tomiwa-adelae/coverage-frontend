import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coverage",
    short_name: "Coverage",
    description: "Your prospects, follow-ups and progress in one place.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#30444f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Share a voice note (e.g. from WhatsApp) straight into a debrief. The
    // service worker handles the post; see receiveShare in public/sw.js.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [
          {
            name: "audio",
            accept: [
              "audio/*",
              ".opus",
              ".ogg",
              ".m4a",
              ".mp3",
              ".aac",
              ".wav",
            ],
          },
        ],
      },
    },
    shortcuts: [
      { name: "Today", url: "/" },
      { name: "Debrief", url: "/debrief" },
      { name: "Add prospect", url: "/prospects?p=new" },
      { name: "Balances", url: "/balances" },
    ],
  }
}
