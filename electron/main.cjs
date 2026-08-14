const { app, BrowserWindow, ipcMain, shell, nativeTheme, clipboard, dialog } = require("electron");
const path = require("node:path");
const brew = require("./brew.cjs");
const icons = require("./icons.cjs");
const queue = require("./queue.cjs");
const updater = require("./updater.cjs");
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

function sendQueue() {
  mainWindow?.webContents.send("brew:queue", queue.listTxns());
}

function jobPkgId(pkg) {
  if (!pkg || !pkg.id) return null;
  return pkg.type ? `${pkg.type}:${pkg.id}` : String(pkg.id);
}

function locked(meta, fn) {
  return queue.enqueue(
    {
      ...meta,
      onData: (text) => {
        sendProgress("brew:progress", {
          action: meta.action,
          id: meta.pkgId,
          text,
        });
      },
    },
    fn,
  );
}

app.whenReady().then(async () => {
  process.on("uncaughtException", (err) => {
    console.error(err);
  });
  process.on("unhandledRejection", (err) => {
    console.error(err);
  });

  queue.setUserData(app.getPath("userData"));
  await queue.load();
  queue.onChange(() => sendQueue());

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
  await locked({ action: "setup-homebrew" }, async (onData) => {
    await brew.installHomebrew(onData);
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
  return locked({ action: "list-installed" }, async () => brew.getInstalled(brewPath));
});

ipcMain.handle("brew:outdated", async () => {
  const brewPath = await getBrewPath();
  return locked({ action: "list-outdated" }, async () => brew.getOutdated(brewPath));
});

ipcMain.handle("brew:install", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await locked({ action: "install", pkgId: jobPkgId(pkg) }, async (onData) => {
    await brew.installPackage(brewPath, pkg, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:uninstall", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await locked({ action: "uninstall", pkgId: jobPkgId(pkg) }, async (onData) => {
    await brew.uninstallPackage(brewPath, pkg, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:upgrade", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await locked({ action: "upgrade", pkgId: jobPkgId(pkg) }, async (onData) => {
    await brew.upgradePackage(brewPath, pkg, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:upgrade-all", async () => {
  const brewPath = await getBrewPath();
  await locked({ action: "upgrade-all" }, async (onData) => {
    await brew.upgradeAll(brewPath, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:reinstall", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await locked({ action: "reinstall", pkgId: jobPkgId(pkg) }, async (onData) => {
    await brew.reinstallPackage(brewPath, pkg, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:zap", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  await locked({ action: "zap", pkgId: jobPkgId(pkg) }, async (onData) => {
    await brew.uninstallPackage(brewPath, { ...pkg, zap: true }, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:zap-dry-run", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  return locked({ action: "zap-dry-run", pkgId: jobPkgId(pkg) }, async (onData) =>
    brew.zapDryRun(brewPath, pkg, onData),
  );
});

ipcMain.handle("brew:update", async () => {
  const brewPath = await getBrewPath();
  const userData = app.getPath("userData");
  await locked({ action: "brew-update" }, async (onData) => {
    await brew.brewUpdate(brewPath, onData, userData);
  });
  return brew.getFreshness(brewPath, userData);
});

ipcMain.handle("brew:freshness", async () => {
  const brewPath = await getBrewPath();
  return brew.getFreshness(brewPath, app.getPath("userData"));
});

ipcMain.handle("brew:install-plan", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  return locked({ action: "install-plan", pkgId: jobPkgId(pkg) }, async () => {
    const installed = await brew.getInstalled(brewPath);
    return brew.getInstallPlan(brewPath, pkg, installed);
  });
});

ipcMain.handle("brew:uninstall-plan", async (_event, pkg) => {
  const brewPath = await getBrewPath();
  return brew.getUninstallPlan(brewPath, pkg);
});

ipcMain.handle("brew:leaves", async () => {
  const brewPath = await getBrewPath();
  return locked({ action: "leaves" }, async () => brew.listLeaves(brewPath));
});

ipcMain.handle("brew:autoremove-dry-run", async () => {
  const brewPath = await getBrewPath();
  return locked({ action: "autoremove-dry-run" }, async (onData) =>
    brew.autoremoveDryRun(brewPath, onData),
  );
});

ipcMain.handle("brew:autoremove", async () => {
  const brewPath = await getBrewPath();
  await locked({ action: "autoremove" }, async (onData) => {
    await brew.autoremove(brewPath, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:activity", async () => queue.listTxns());

ipcMain.handle("brew:retry", async (_event, txnId) => {
  const snap = queue.listTxns();
  const txn = snap.recent.find((row) => row.id === txnId && row.status === "error");
  if (!txn) throw new Error("Nothing to retry");
  const brewPath = await getBrewPath();
  const [kind, id] = String(txn.pkgId || "").includes(":")
    ? String(txn.pkgId).split(":")
    : [null, txn.pkgId];
  const pkg = id ? { id, type: kind === "cask" ? "cask" : "formula" } : null;
  if (txn.action === "install" && pkg) {
    await locked({ action: "install", pkgId: jobPkgId(pkg) }, async (onData) => {
      await brew.installPackage(brewPath, pkg, onData);
    });
  } else if (txn.action === "upgrade" && pkg) {
    await locked({ action: "upgrade", pkgId: jobPkgId(pkg) }, async (onData) => {
      await brew.upgradePackage(brewPath, pkg, onData);
    });
  } else if (txn.action === "uninstall" && pkg) {
    await locked({ action: "uninstall", pkgId: jobPkgId(pkg) }, async (onData) => {
      await brew.uninstallPackage(brewPath, pkg, onData);
    });
  } else if (txn.action === "reinstall" && pkg) {
    await locked({ action: "reinstall", pkgId: jobPkgId(pkg) }, async (onData) => {
      await brew.reinstallPackage(brewPath, pkg, onData);
    });
  } else if (txn.action === "zap" && pkg) {
    await locked({ action: "zap", pkgId: jobPkgId(pkg) }, async (onData) => {
      await brew.uninstallPackage(brewPath, { ...pkg, zap: true }, onData);
    });
  } else {
    throw new Error(`Cannot retry ${txn.action}`);
  }
  return { ok: true };
});

ipcMain.handle("app:get-version", async () => ({
  version: app.getVersion() || pkg.version || "0.0.0",
  name: pkg.productName || "BrewStore",
}));

ipcMain.handle("app:check-update", async () => {
  const current = app.getVersion() || pkg.version || "0.0.0";
  return brew.checkAppUpdate(current);
});

ipcMain.handle("app:apply-update", async (_event, info) => {
  const url = info?.zipUrl || info?.downloadUrl || info?.dmgUrl;
  await locked({ action: "app-update" }, async (onData) => {
    await updater.applyAppUpdate({
      downloadUrl: url,
      onData,
    });
  });
  setTimeout(() => {
    app.quit();
  }, 800);
  return { ok: true };
});

ipcMain.handle("brew:disk-usage", async (_event, packages) => {
  const brewPath = await getBrewPath();
  return brew.getDiskUsageMap(brewPath, packages);
});

ipcMain.handle("shell:open-app", async (_event, pkgInfo) => {
  if (!pkgInfo || pkgInfo.type !== "cask") {
    return { ok: false, error: "Only installed casks can be opened" };
  }
  return brew.openInstalledCask(pkgInfo);
});

ipcMain.handle("brew:taps", async () => {
  const brewPath = await getBrewPath();
  return brew.listTaps(brewPath);
});

ipcMain.handle("brew:tap-add", async (_event, name) => {
  const brewPath = await getBrewPath();
  await locked({ action: "tap-add", pkgId: name }, async (onData) => {
    await brew.addTap(brewPath, name, onData);
  });
  return brew.listTaps(brewPath);
});

ipcMain.handle("brew:tap-remove", async (_event, name) => {
  const brewPath = await getBrewPath();
  await locked({ action: "tap-remove", pkgId: name }, async (onData) => {
    await brew.removeTap(brewPath, name, onData);
  });
  return brew.listTaps(brewPath);
});

ipcMain.handle("brew:pinned", async () => {
  const brewPath = await getBrewPath();
  return brew.listPinned(brewPath);
});

ipcMain.handle("brew:pin", async (_event, pkgInfo) => {
  const brewPath = await getBrewPath();
  await locked({ action: "pin", pkgId: pkgInfo.id }, async (onData) => {
    await brew.pinPackage(brewPath, pkgInfo, onData);
  });
  return { ok: true, pinned: await brew.listPinned(brewPath) };
});

ipcMain.handle("brew:unpin", async (_event, pkgInfo) => {
  const brewPath = await getBrewPath();
  await locked({ action: "unpin", pkgId: pkgInfo.id }, async (onData) => {
    await brew.unpinPackage(brewPath, pkgInfo, onData);
  });
  return { ok: true, pinned: await brew.listPinned(brewPath) };
});

ipcMain.handle("brew:cleanup-dry-run", async () => {
  const brewPath = await getBrewPath();
  return locked({ action: "cleanup-dry-run" }, async (onData) =>
    brew.cleanupDryRun(brewPath, onData),
  );
});

ipcMain.handle("brew:cleanup", async () => {
  const brewPath = await getBrewPath();
  await locked({ action: "cleanup" }, async (onData) => {
    await brew.cleanup(brewPath, onData);
  });
  return { ok: true };
});

ipcMain.handle("brew:doctor", async () => {
  const brewPath = await getBrewPath();
  return locked({ action: "doctor" }, async (onData) => brew.doctor(brewPath, onData));
});

ipcMain.handle("brew:services", async () => {
  const brewPath = await getBrewPath();
  return brew.listServices(brewPath);
});

ipcMain.handle("brew:service-action", async (_event, payload) => {
  const brewPath = await getBrewPath();
  if (payload?.action === "restart-failed") {
    await locked({ action: "service-restart-failed" }, async (onData) => {
      const list = await brew.listServices(brewPath);
      const failed = list.filter((row) =>
        /error|stopped|unknown/i.test(String(row.status || "")),
      );
      for (const row of failed) {
        await brew.serviceAction(
          brewPath,
          { name: row.name, action: "restart" },
          onData,
        );
      }
    });
    return brew.listServices(brewPath);
  }
  await locked(
    { action: `service-${payload.action}`, pkgId: payload.name },
    async (onData) => {
      await brew.serviceAction(brewPath, payload, onData);
    },
  );
  return brew.listServices(brewPath);
});

ipcMain.handle("brew:service-log", async (_event, name) => {
  const home = process.env.HOME || "";
  const candidates = [
    path.join(home, "Library/Logs/Homebrew", `${name}.log`),
    path.join(home, "Library/Logs", `${name}.log`),
  ];
  const fs = require("node:fs/promises");
  for (const file of candidates) {
    try {
      await fs.access(file);
      await shell.openPath(file);
      return { ok: true, path: file };
    } catch {
      // continue
    }
  }
  return { ok: false, error: "No log file found" };
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
  await locked({ action: "bundle-export" }, async (onData) => {
    await brew.bundleDump(brewPath, result.filePath, onData);
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
  await locked({ action: "bundle-import" }, async (onData) => {
    await brew.bundleInstall(brewPath, filePath, onData);
  });
  return { ok: true, path: filePath };
});

ipcMain.handle("brew:bundle-preview", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Preview Brewfile",
    properties: ["openFile"],
    filters: [{ name: "Brewfile", extensions: ["", "brewfile", "rb"] }],
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }
  const filePath = result.filePaths[0];
  const brewPath = await getBrewPath();
  const parsed = await brew.readBrewfile(filePath);
  const installed = await brew.getInstalled(brewPath);
  const taps = await brew.listTaps(brewPath);
  return {
    ok: true,
    path: filePath,
    diff: brew.diffBrewfile(
      parsed,
      installed,
      taps.map((t) => t.name),
    ),
  };
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
  return icons.resolveIcons(app.getPath("userData"), packages.slice(0, 80));
});

ipcMain.handle("theme:set", async (_event, preference) => applyNativeTheme(preference));

nativeTheme.on("updated", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setBackgroundColor(
    nativeTheme.shouldUseDarkColors ? WINDOW_BG.dark : WINDOW_BG.light,
  );
});
