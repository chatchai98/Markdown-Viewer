export type DesktopLoadedFile = {
  name: string;
  path: string;
  size: number;
  content: string;
  lastModified?: number;
};

export type MarkdownViewerDesktopApi = {
  openFile: () => Promise<DesktopLoadedFile | null>;
  readFile: (path: string) => Promise<DesktopLoadedFile>;
  saveFile: (path: string, content: string) => Promise<DesktopLoadedFile>;
  saveFileAs: (suggestedName: string, content: string) => Promise<DesktopLoadedFile | null>;
  readAsset: (markdownPath: string, assetSrc: string) => Promise<string | null>;
};

declare global {
  interface Window {
    markdownViewerDesktop?: MarkdownViewerDesktopApi;
  }
}

export {};
