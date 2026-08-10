const { app, BrowserWindow, ipcMain, shell, nativeTheme, clipboard, dialog } = require("electron");
const path = require("node:path");
const brew = require("./brew.cjs");
const icons = require("./icons.cjs");
const pkg = require("../package.json");

let mainWindow = null;
let brewPathPromise = null;

function resetBrewPathCache() {
  brewPathPromise = null;
}

const WINDOW_BG = {
  light: "#e8eef5",
  dark: "#0d121c",
};

function getBrewPath() {
  if (!brewPathPromise) {
    brewPathPromise = brew.resolveBrew().catch((err) => {
      brewPathPromise = null;
      throw err;
    });
  }
  return brewPathPromise;
}

function applyNativeTheme(preference) {
  const source =
    preference === "light" || preference === "dark" || preference === "system"
      ? preference
      : "system";
  nativeTheme.themeSource = source;
  const backgroundColor = nativeTheme.shouldUseDarkColors
    ? WINDOW_BG.dark
    : WINDOW_BG.light;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(backgroundColor);
  }
  return {
    ok: true,
    themeSource: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors
      ? WINDOW_BG.dark
      : WINDOW_BG.light,
    icon: path.join(__dirname, "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function sendProgress(channel, payload) {
  mainWindow?.webContents.send(channel, payload);
}

app.whenReady().then(() => {
  process.on("uncaughtException", (err) => {
    console.error(err);
  });
  process.on("unhandledRejection", (err) => {
    console.error(err);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("brew:info", async () => brew.getBrewInfo());

ipcMain.handle("brew:status", async () => brew.probeBrew());

ipcMain.handle("brew:recheck", async () => {
  resetBrewPathCache();
  return brew.probeBrew();
});

ipcMain.handle("brew:install-homebrew", async () => {
  resetBrewPathCache();
  await brew.installHomebrew((text) => {
    sendProgress("brew:progress", { action: "setup-homebrew", text });
  });
  resetBrewPathCache();
  return brew.probeBrew();
});

ipcMain.handle("clipboard:write-text", async (_event, text) => {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false };
  }
  clipboard.writeText(text);
  return { ok: true };
});

ipcMain.handle("catalog:load", async (_event, { force = false } = {}) => {
  return brew.loadCatalog(app.getPath("userData"), { force });
});

ipcMain.handle("trending:load", async (_event, { force = false } = {}) => {
  return brew.loadTrending(app.getPath("userData"), { force });
});

ipcMain.handle("brew:installed", async () => {
  const brewPath = await getBrewPath();
  return brew.getInstalled(brewPath);
});

ipcMain.handle("brew:outdated", async () => {
  const brewPath = await getBrewPath();
  return brew.getOutdated(brewPath);
});

ipcMain.handle("brew:install", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await brew.installPackage(brewPath, pkg, (text) => {
    sendProgress("brew:progress", { action: "install", id: pkg.id, text });
  });
  return { ok: true };
});

ipcMain.handle("brew:uninstall", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await brew.uninstallPackage(brewPath, pkg, (text) => {
    sendProgress("brew:progress", { action: "uninstall", id: pkg.id, text });
  });
  return { ok: true };
});

ipcMain.handle("brew:upgrade", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await brew.upgradePackage(brewPath, pkg, (text) => {
    sendProgress("brew:progress", { action: "upgrade", id: pkg.id, text });
  });
  return { ok: true };
});

ipcMain.handle("brew:upgrade-all", async () => {
  const brewPath = await getBrewPath();
  await brew.upgradeAll(brewPath, (text) => {
    sendProgress("brew:progress", { action: "upgrade-all", text });
  });
  return { ok: true };
});

ipcMain.handle("app:get-version", async () => ({
  version: app.getVersion() || pkg.version || "0.0.0",
  name: pkg.productName || "BrewStore",
}));

ipcMain.handle("brew:taps", async () => {
  const brewPath = await getBrewPath();
  return brew.listTaps(brewPath);
});

ipcMain.handle("brew:tap-add", async (_event, name) => {
  const brewPath = await getBrewPath();
  await brew.addTap(brewPath, name, (text) => {
    sendProgress("brew:progress", { action: "tap-add", text });
  });
  return brew.listTaps(brewPath);
});

ipcMain.handle("brew:tap-remove", async (_event, name) => {
  const brewPath = await getBrewPath();
  await brew.removeTap(brewPath, name, (text) => {
    sendProgress("brew:progress", { action: "tap-remove", text });
  });
  return brew.listTaps(brewPath);
});

ipcMain.handle("brew:pinned", async () => {
  const brewPath = await getBrewPath();
  return brew.listPinned(brewPath);
});

ipcMain.handle("brew:pin", async (_event, pkgInfo) => {
  const brewPath = await getBrewPath();
  await brew.pinPackage(brewPath, pkgInfo, (text) => {
    sendProgress("brew:progress", { action: "pin", id: pkgInfo.id, text });
  });
  return { ok: true, pinned: await brew.listPinned(brewPath) };
});

ipcMain.handle("brew:unpin", async (_event, pkgInfo) => {
  const brewPath = await getBrewPath();
  await brew.unpinPackage(brewPath, pkgInfo, (text) => {
    sendProgress("brew:progress", { action: "unpin", id: pkgInfo.id, text });
  });
  return { ok: true, pinned: await brew.listPinned(brewPath) };
});

ipcMain.handle("brew:cleanup-dry-run", async () => {
  const brewPath = await getBrewPath();
  return brew.cleanupDryRun(brewPath, (text) => {
    sendProgress("brew:progress", { action: "cleanup-dry-run", text });
  });
});

ipcMain.handle("brew:cleanup", async () => {
  const brewPath = await getBrewPath();
  await brew.cleanup(brewPath, (text) => {
    sendProgress("brew:progress", { action: "cleanup", text });
  });
  return { ok: true };
});

ipcMain.handle("brew:doctor", async () => {
  const brewPath = await getBrewPath();
  return brew.doctor(brewPath, (text) => {
    sendProgress("brew:progress", { action: "doctor", text });
  });
});

ipcMain.handle("brew:services", async () => {
  const brewPath = await getBrewPath();
  return brew.listServices(brewPath);
});

ipcMain.handle("brew:service-action", async (_event, payload) => {
  const brewPath = await getBrewPath();
  await brew.serviceAction(brewPath, payload, (text) => {
    sendProgress("brew:progress", {
      action: `service-${payload.action}`,
      id: payload.name,
      text,
    });
  });
  return brew.listServices(brewPath);
});

ipcMain.handle("brew:deps", async (_event, pkgInfo) => {
  const brewPath = await getBrewPath();
  return brew.getDeps(brewPath, pkgInfo);
});

ipcMain.handle("brew:dependents", async (_event, pkgInfo) => {
  const brewPath = await getBrewPath();
  return brew.getDependents(brewPath, pkgInfo);
});

ipcMain.handle("brew:bundle-export", async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Brewfile",
    defaultPath: "Brewfile",
    filters: [{ name: "Brewfile", extensions: ["", "brewfile"] }],
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  const brewPath = await getBrewPath();
  await brew.bundleDump(brewPath, result.filePath, (text) => {
    sendProgress("brew:progress", { action: "bundle-export", text });
  });
  return { ok: true, path: result.filePath };
});

ipcMain.handle("brew:bundle-import", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import Brewfile",
    properties: ["openFile"],
    filters: [{ name: "Brewfile", extensions: ["", "brewfile", "rb"] }],
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }
  const filePath = result.filePaths[0];
  const brewPath = await getBrewPath();
  await brew.bundleInstall(brewPath, filePath, (text) => {
    sendProgress("brew:progress", { action: "bundle-import", text });
  });
  return { ok: true, path: filePath };
});

ipcMain.handle("shell:open-external", async (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle("icons:resolve", async (_event, packages) => {
  if (!Array.isArray(packages)) return {};
  return icons.resolveIcons(app.getPath("userData"), packages.slice(0, 40));
});

ipcMain.handle("theme:set", async (_event, preference) => applyNativeTheme(preference));

nativeTheme.on("updated", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setBackgroundColor(
    nativeTheme.shouldUseDarkColors ? WINDOW_BG.dark : WINDOW_BG.light,
  );
});
