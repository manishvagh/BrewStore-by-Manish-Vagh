const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("brewStore", {
  getBrewInfo: () => ipcRenderer.invoke("brew:info"),
  getBrewStatus: () => ipcRenderer.invoke("brew:status"),
  recheckBrew: () => ipcRenderer.invoke("brew:recheck"),
  installHomebrew: () => ipcRenderer.invoke("brew:install-homebrew"),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdate: () => ipcRenderer.invoke("app:check-update"),
  writeClipboardText: (text) => ipcRenderer.invoke("clipboard:write-text", text),
  loadCatalog: (opts) => ipcRenderer.invoke("catalog:load", opts),
  loadTrending: (opts) => ipcRenderer.invoke("trending:load", opts),
  getInstalled: () => ipcRenderer.invoke("brew:installed"),
  getOutdated: () => ipcRenderer.invoke("brew:outdated"),
  install: (pkg) => ipcRenderer.invoke("brew:install", pkg),
  uninstall: (pkg) => ipcRenderer.invoke("brew:uninstall", pkg),
  upgrade: (pkg) => ipcRenderer.invoke("brew:upgrade", pkg),
  upgradeAll: () => ipcRenderer.invoke("brew:upgrade-all"),
  getDiskUsage: (packages) => ipcRenderer.invoke("brew:disk-usage", packages),
  listTaps: () => ipcRenderer.invoke("brew:taps"),
  addTap: (name) => ipcRenderer.invoke("brew:tap-add", name),
  removeTap: (name) => ipcRenderer.invoke("brew:tap-remove", name),
  listPinned: () => ipcRenderer.invoke("brew:pinned"),
  pin: (pkg) => ipcRenderer.invoke("brew:pin", pkg),
  unpin: (pkg) => ipcRenderer.invoke("brew:unpin", pkg),
  cleanupDryRun: () => ipcRenderer.invoke("brew:cleanup-dry-run"),
  cleanup: () => ipcRenderer.invoke("brew:cleanup"),
  doctor: () => ipcRenderer.invoke("brew:doctor"),
  listServices: () => ipcRenderer.invoke("brew:services"),
  serviceAction: (payload) => ipcRenderer.invoke("brew:service-action", payload),
  getDeps: (pkg) => ipcRenderer.invoke("brew:deps", pkg),
  getDependents: (pkg) => ipcRenderer.invoke("brew:dependents", pkg),
  bundleExport: () => ipcRenderer.invoke("brew:bundle-export"),
  bundleImport: () => ipcRenderer.invoke("brew:bundle-import"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  openInstalledApp: (pkg) => ipcRenderer.invoke("shell:open-app", pkg),
  resolveIcons: (packages) => ipcRenderer.invoke("icons:resolve", packages),
  setTheme: (preference) => ipcRenderer.invoke("theme:set", preference),
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("brew:progress", listener);
    return () => ipcRenderer.removeListener("brew:progress", listener);
  },
});
