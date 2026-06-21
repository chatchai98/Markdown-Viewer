const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("markdownViewerDesktop", {
  openFile: () => ipcRenderer.invoke("desktop:open-file"),
  readFile: (path) => ipcRenderer.invoke("desktop:read-file", path),
  saveFile: (path, content) => ipcRenderer.invoke("desktop:save-file", { path, content }),
  saveFileAs: (suggestedName, content) =>
    ipcRenderer.invoke("desktop:save-file-as", { suggestedName, content }),
  readAsset: (markdownPath, assetSrc) =>
    ipcRenderer.invoke("desktop:read-asset", { markdownPath, assetSrc }),
});
