const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("brewStore", {
  getBrewInfo: () => ipcRenderer.invoke("brew:info"),
  getBrewStatus: () => ipcRenderer.invoke("brew:status"),
  recheckBrew: () => ipcRenderer.invoke("brew:recheck"),
  openBrewInstaller: () => ipcRenderer.invoke("brew:open-installer"),
  writeClipboardText: (text) => ipcRenderer.invoke("clipboard:write-text", text),
  loadCatalog: (opts) => ipcRenderer.invoke("catalog:load", opts),
  getInstalled: () => ipcRenderer.invoke("brew:installed"),
  getOutdated: () => ipcRenderer.invoke("brew:outdated"),
  install: (pkg) => ipcRenderer.invoke("brew:install", pkg),
  uninstall: (pkg) => ipcRenderer.invoke("brew:uninstall", pkg),
  upgrade: (pkg) => ipcRenderer.invoke("brew:upgrade", pkg),
  upgradeAll: () => ipcRenderer.invoke("brew:upgrade-all"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  resolveIcons: (packages) => ipcRenderer.invoke("icons:resolve", packages),
  setTheme: (preference) => ipcRenderer.invoke("theme:set", preference),
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("brew:progress", listener);
    return () => ipcRenderer.removeListener("brew:progress", listener);
  },
});
