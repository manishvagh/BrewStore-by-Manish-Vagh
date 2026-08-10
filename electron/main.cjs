const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const brew = require("./brew.cjs");
const icons = require("./icons.cjs");

let mainWindow = null;
let brewPathPromise = null;

function getBrewPath() {
  if (!brewPathPromise) brewPathPromise = brew.resolveBrew();
  return brewPathPromise;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#e8eef5",
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

ipcMain.handle("catalog:load", async (_event, { force = false } = {}) => {
  return brew.loadCatalog(app.getPath("userData"), { force });
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
