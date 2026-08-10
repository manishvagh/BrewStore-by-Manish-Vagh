import type { BrewPackage } from "./types";

export interface Category {
  id: string;
  name: string;
  blurb: string;
  keywords: string[];
  accent: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "developer-tools",
    name: "Developer Tools",
    blurb: "IDEs, CLIs, containers, and languages",
    keywords: [
      "developer",
      "ide",
      "editor",
      "git",
      "docker",
      "kubernetes",
      "compiler",
      "sdk",
      "debug",
      "terminal",
      "cli",
      "programming",
      "code",
      "node",
      "python",
      "rust",
      "go ",
      "java",
      "database",
      "sql",
      "api",
    ],
    accent: "#0a7ea4",
  },
  {
    id: "productivity",
    name: "Productivity",
    blurb: "Notes, calendars, and focus apps",
    keywords: [
      "note",
      "todo",
      "task",
      "calendar",
      "markdown",
      "productivity",
      "reminder",
      "organize",
      "project management",
      "kanban",
    ],
    accent: "#2f6fed",
  },
  {
    id: "utilities",
    name: "Utilities",
    blurb: "System helpers and everyday tools",
    keywords: [
      "utility",
      "utilities",
      "system",
      "monitor",
      "clipboard",
      "finder",
      "file manager",
      "archive",
      "compress",
      "converter",
      "cleaner",
      "launcher",
    ],
    accent: "#5b6b7c",
  },
  {
    id: "graphics-design",
    name: "Graphics & Design",
    blurb: "Drawing, design, and creative tools",
    keywords: [
      "design",
      "vector",
      "illustration",
      "figma",
      "sketch",
      "paint",
      "draw",
      "graphic",
      "svg",
      "font",
      "typography",
      "icon",
    ],
    accent: "#c2410c",
  },
  {
    id: "photo-video",
    name: "Photo & Video",
    blurb: "Cameras, editors, and media tools",
    keywords: [
      "photo",
      "image",
      "video",
      "camera",
      "ffmpeg",
      "media",
      "editor",
      "screen record",
      "streaming",
      "obs",
      "gif",
    ],
    accent: "#a21caf",
  },
  {
    id: "music",
    name: "Music",
    blurb: "Players, DAWs, and audio tools",
    keywords: [
      "music",
      "audio",
      "sound",
      "spotify",
      "player",
      "midi",
      "synthesizer",
      "podcast",
      "equalizer",
    ],
    accent: "#be185d",
  },
  {
    id: "browsers",
    name: "Browsers",
    blurb: "Web browsers and browsing tools",
    keywords: ["browser", "web browser", "chromium", "firefox", "safari", "chrome"],
    accent: "#0369a1",
  },
  {
    id: "communication",
    name: "Communication",
    blurb: "Chat, mail, and collaboration",
    keywords: [
      "chat",
      "messenger",
      "email",
      "mail",
      "slack",
      "discord",
      "zoom",
      "meeting",
      "voip",
      "telegram",
      "whatsapp",
      "collaboration",
    ],
    accent: "#0f766e",
  },
  {
    id: "security",
    name: "Security",
    blurb: "Passwords, VPN, and privacy",
    keywords: [
      "password",
      "security",
      "vpn",
      "encrypt",
      "privacy",
      "firewall",
      "auth",
      "2fa",
      "gpg",
      "certificate",
      "malware",
    ],
    accent: "#b45309",
  },
  {
    id: "games",
    name: "Games",
    blurb: "Games and gaming utilities",
    keywords: ["game", "gaming", "steam", "emulator", "controller", "minecraft"],
    accent: "#15803d",
  },
  {
    id: "education",
    name: "Education",
    blurb: "Learning and reference",
    keywords: ["learn", "education", "tutorial", "course", "dictionary", "language learning"],
    accent: "#4f46e5",
  },
  {
    id: "science",
    name: "Science & Math",
    blurb: "Research, data, and computation",
    keywords: [
      "science",
      "math",
      "statistics",
      "biology",
      "chemistry",
      "physics",
      "data science",
      "machine learning",
      "ai ",
      "neural",
    ],
    accent: "#047857",
  },
  {
    id: "finance",
    name: "Finance",
    blurb: "Money, crypto, and accounting",
    keywords: ["finance", "banking", "crypto", "bitcoin", "accounting", "budget", "invoice"],
    accent: "#0f766e",
  },
  {
    id: "entertainment",
    name: "Entertainment",
    blurb: "Streaming, reading, and leisure",
    keywords: ["entertainment", "streaming", "movie", "tv", "ebook", "reader", "comic"],
    accent: "#9d174d",
  },
];

function haystack(pkg: BrewPackage): string {
  return `${pkg.name} ${pkg.token} ${pkg.desc} ${pkg.tap}`.toLowerCase();
}

export function categorizePackage(pkg: BrewPackage): string {
  const text = haystack(pkg);

  for (const category of CATEGORIES) {
    if (category.keywords.some((keyword) => text.includes(keyword))) {
      return category.id;
    }
  }

  return "utilities";
}

export function withCategories(packages: BrewPackage[]): BrewPackage[] {
  return packages.map((pkg) => ({
    ...pkg,
    category: categorizePackage(pkg),
  }));
}

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function packageKey(pkg: { id: string; type: string }): string {
  return `${pkg.type}:${pkg.id}`;
}
