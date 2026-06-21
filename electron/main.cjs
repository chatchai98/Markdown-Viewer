const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");

const acceptedExtensions = new Set([".md", ".markdown", ".txt"]);
const imageMimeTypes = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);
const maxAssetBytes = 20 * 1024 * 1024;
const appRoot = path.join(__dirname, "..");
const distIndex = path.join(appRoot, "dist", "index.html");
const appIcon = path.join(appRoot, "assets", "icon.ico");
const devServerArg = process.argv.find((arg) => arg.startsWith("--dev-server="));
const devServerUrl = devServerArg?.slice("--dev-server=".length);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: "Markdown Viewer",
    icon: appIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) {
      return;
    }

    event.preventDefault();
    if (isExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });

  if (!app.isPackaged && devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(distIndex);
  }
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

function isAppUrl(url) {
  if (devServerUrl && url.startsWith(devServerUrl)) {
    return true;
  }

  return url.startsWith(pathToFileURL(distIndex).href);
}

function getOwnerWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
}

function isMarkdownPath(filePath) {
  return acceptedExtensions.has(path.extname(filePath).toLowerCase());
}

function isImagePath(filePath) {
  return imageMimeTypes.has(path.extname(filePath).toLowerCase());
}

function normalizeReadablePath(filePath) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("A file path is required.");
  }

  const normalizedPath = path.normalize(filePath);
  if (!isMarkdownPath(normalizedPath)) {
    throw new Error("Only Markdown and plain text files are supported.");
  }

  return normalizedPath;
}

function normalizeWritablePath(filePath) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("A file path is required.");
  }

  const normalizedPath = path.normalize(filePath);
  if (!path.extname(normalizedPath)) {
    return `${normalizedPath}.md`;
  }

  if (!isMarkdownPath(normalizedPath)) {
    throw new Error("Only Markdown and plain text files are supported.");
  }

  return normalizedPath;
}

function getSuggestedName(value) {
  const fileName = typeof value === "string" && value.trim() ? path.basename(value) : "document.md";
  if (!path.extname(fileName)) {
    return `${fileName}.md`;
  }

  return isMarkdownPath(fileName) ? fileName : "document.md";
}

async function readMarkdownFile(filePath) {
  const normalizedPath = normalizeReadablePath(filePath);
  const stat = await fs.stat(normalizedPath);
  if (!stat.isFile()) {
    throw new Error("Selected path is not a file.");
  }

  const content = await fs.readFile(normalizedPath, "utf8");
  return {
    name: path.basename(normalizedPath),
    path: normalizedPath,
    size: stat.size,
    content,
    lastModified: Math.round(stat.mtimeMs),
  };
}

async function writeMarkdownFile(filePath, content) {
  const normalizedPath = normalizeWritablePath(filePath);
  if (typeof content !== "string") {
    throw new Error("File content must be a string.");
  }

  await fs.writeFile(normalizedPath, content, "utf8");
  return readMarkdownFile(normalizedPath);
}

async function readMarkdownAsset(markdownPath, assetSrc) {
  const ownerPath = normalizeReadablePath(markdownPath);
  if (typeof assetSrc !== "string" || !assetSrc.trim()) {
    return null;
  }

  const cleanedSrc = assetSrc.split(/[?#]/, 1)[0];
  let decodedSrc;
  try {
    decodedSrc = decodeURIComponent(cleanedSrc);
  } catch {
    decodedSrc = cleanedSrc;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(decodedSrc) && !path.isAbsolute(decodedSrc)) {
    return null;
  }

  const assetPath = path.isAbsolute(decodedSrc)
    ? path.normalize(decodedSrc)
    : path.resolve(path.dirname(ownerPath), decodedSrc);
  if (!isImagePath(assetPath)) {
    return null;
  }

  const stat = await fs.stat(assetPath);
  if (!stat.isFile() || stat.size > maxAssetBytes) {
    return null;
  }

  const content = await fs.readFile(assetPath);
  const mimeType = imageMimeTypes.get(path.extname(assetPath).toLowerCase());
  return `data:${mimeType};base64,${content.toString("base64")}`;
}

ipcMain.handle("desktop:open-file", async () => {
  const result = await dialog.showOpenDialog(getOwnerWindow(), {
    title: "Open Markdown File",
    properties: ["openFile"],
    filters: [
      { name: "Markdown Files", extensions: ["md", "markdown", "txt"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return readMarkdownFile(result.filePaths[0]);
});

ipcMain.handle("desktop:read-file", async (_event, filePath) => {
  return readMarkdownFile(filePath);
});

ipcMain.handle("desktop:save-file", async (_event, payload) => {
  return writeMarkdownFile(payload?.path, payload?.content);
});

ipcMain.handle("desktop:save-file-as", async (_event, payload) => {
  const result = await dialog.showSaveDialog(getOwnerWindow(), {
    title: "Save Markdown File",
    defaultPath: getSuggestedName(payload?.suggestedName),
    filters: [
      { name: "Markdown Files", extensions: ["md", "markdown", "txt"] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return writeMarkdownFile(result.filePath, payload?.content);
});

ipcMain.handle("desktop:read-asset", async (_event, payload) => {
  return readMarkdownAsset(payload?.markdownPath, payload?.assetSrc);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
