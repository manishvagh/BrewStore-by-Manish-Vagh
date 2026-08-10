# BrewStore

Native macOS desktop app for browsing and managing [Homebrew](https://brew.sh) packages — casks and formulae — with an App Store–style interface.

**Author:** Manish Vagh

BrewStore is a frontend for Homebrew. It does not replace Homebrew, and it does not claim ownership of any packaged software. Every app and library remains the property of its respective authors and maintainers.

---

## Why BrewStore?

| Advantage | What you get |
|---|---|
| **Visual instead of terminal-only** | Install, update, and remove packages without memorizing `brew` commands |
| **App Store–style discovery** | Featured apps, categories, and search across thousands of casks & formulae |
| **Updates at a glance** | Badge + Updates list with one-click Update or Update All |
| **Live feedback** | Sidebar Activity panel shows real `brew` output as commands run |
| **Clear ownership** | Credits and per-package links to homepage / formula / authors |
| **Light, dark, or system** | Appearance follows macOS by default, or lock Light / Dark in the sidebar |

---

## Screenshots

### Discover
Browse featured GUI apps, jump into categories, and search the catalog.

![Discover view](docs/screenshots/discover.png)

### Categories
Explore Homebrew like the App Store — Developer Tools, Utilities, Browsers, and more.

![Categories view](docs/screenshots/categories.png)

### Installed
See what’s on this Mac, spot updates, and open package details.

![Installed view](docs/screenshots/installed.png)

### Updates
Review outdated packages and update individually or all at once.

![Updates view](docs/screenshots/updates.png)

### Credits
Attribution for BrewStore, Homebrew, and the authors of every package you install.

![Credits view](docs/screenshots/credits.png)

---

## Features

- Browse and search Homebrew casks and formulae
- Category-based discovery (Developer Tools, Productivity, Browsers, and more)
- Install, uninstall, and update packages
- Updates view with per-package and Update All flows
- Package icons (local `.app` icons when installed, with remote fallbacks)
- Live activity log for brew output
- Appearance: System, Light, or Dark (persisted)
- Credits and attribution for Homebrew and package owners

---

## Requirements

| Dependency | Notes |
|---|---|
| macOS | Apple Silicon or Intel |
| [Homebrew](https://brew.sh) | Must be installed and working in Terminal |
| [Node.js](https://nodejs.org/) 20+ | Required only to build or run from source |

Check Homebrew:

```bash
brew --version
```

---

## Quick start (development)

```bash
git clone https://github.com/manishvagh/BrewStore-by-Manish-Vagh.git
cd BrewStore-by-Manish-Vagh
npm install
npm run dev
```

This starts the Vite dev server and opens the Electron window. Use this while hacking on the UI or brew integration.

---

## Install as a macOS app

Build a packaged `.app` and copy it into `/Applications`:

```bash
git clone https://github.com/manishvagh/BrewStore-by-Manish-Vagh.git
cd BrewStore-by-Manish-Vagh
npm install
npm run install:mac
```

Then open **BrewStore** from Launchpad, Spotlight, or Applications.

### Manual package (without copying to Applications)

```bash
npm install
npm run dist
open release/mac-arm64/BrewStore.app
```

On Intel Macs the output folder may be `release/mac` instead of `release/mac-arm64`.

### First launch / Gatekeeper

The app is unsigned by default. If macOS blocks it:

1. System Settings → Privacy & Security → allow the app, **or**
2. Right-click BrewStore → Open → Open, **or**
3. Clear quarantine attributes:

```bash
xattr -cr /Applications/BrewStore.app
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development mode (Vite + Electron) |
| `npm run build` | Typecheck and build the renderer |
| `npm run dist` | Build renderer and package the macOS `.app` |
| `npm run install:mac` | Package and install into `/Applications` |
| `npm start` | Run Electron against the built `dist/` folder |
| `npm run lint` | Run Oxlint |

---

## Using the app

1. **Discover** — featured apps, categories, and search  
2. **Categories** — browse by App Store–style groups  
3. **Installed** — packages currently on your Mac  
4. **Updates** — outdated packages; Update or Update All  
5. **Credits** — author and third-party attribution  

The sidebar **Activity** panel shows live `brew` output. Use **Refresh catalog** to force a fresh download of the Homebrew formulae/cask index (otherwise cached for 12 hours).

---

## Project layout

```
BrewStore/
├── electron/          # Main process, brew bridge, icons
├── src/               # React UI
├── docs/screenshots/  # README screenshots
├── scripts/           # electron-builder hooks
├── build/             # App icons (.icns / .png)
├── public/            # Static assets bundled into the renderer
└── package.json
```

Homebrew is invoked through the local `brew` CLI. Catalog metadata is loaded from the official Homebrew APIs:

- https://formulae.brew.sh/api/cask.json  
- https://formulae.brew.sh/api/formula.json  

---

## Contributing

Direct commits to `main` are not allowed. Open a pull request and wait for review/approval from the repository owner. See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Credits

- **BrewStore** — developed by Manish Vagh  
- **Homebrew** — Max Howell, Mike McQuaid, and the Homebrew project  
- **Packages** — all casks and formulae belong to their respective owners (open-source and proprietary). Open a package’s detail view for homepage, license, and formula links.

BrewStore is not affiliated with Apple or the App Store.

---

## License

MIT — see [LICENSE](./LICENSE).

Homebrew and third-party packages are covered by their own licenses.
