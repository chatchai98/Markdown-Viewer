import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Eraser,
  FileText,
  Plus,
  MonitorCheck,
  ArrowLeft,
  Copy,
  Printer,
  Trash2,
  Check,
  FileUp,
  Palette,
  Languages,
  Settings,
  Save,
  Download,
  Eye,
  Edit3,
  Columns,
  HelpCircle,
  Info,
  ExternalLink,
  X,
  Search,
  Replace,
  ChevronUp,
  ChevronDown,
  ListTree,
  Maximize2,
  Minimize2,
  Table2,
  WrapText,
  Type,
  PanelLeft,
  ListChecks,
  Code2,
  Link2,
  Image as ImageIcon,
  Quote,
} from "lucide-react";
import { FileLoader } from "./components/FileLoader";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { formatBytes } from "./utils/format";
import {
  clearRecentFiles,
  getRecentFiles,
  openRecentFile,
  RecentFile,
  saveRecentFile,
  deleteRecentFile,
  updateRecentFilePath,
  createFileId,
} from "./utils/recentFiles";

type LoadedFile = {
  id?: string;
  name: string;
  path?: string;
  size: number;
  content: string;
  lastModified?: number;
};

type FileRef =
  | { kind: "browser"; handle: FileSystemFileHandle }
  | { kind: "desktop"; path: string };

type Theme =
  | "midnight-dark"
  | "forest-dark"
  | "cyber-dark"
  | "lavender-pastel"
  | "sage-pastel"
  | "rose-pastel";

type ViewMode = "edit" | "preview" | "split";
type Language = "en" | "th";
type HeadingItem = {
  id: string;
  text: string;
  level: number;
};
type SnippetId = "table" | "checklist" | "code" | "link" | "image" | "quote";

const themeOptions: Array<{ value: Theme; label: string; previewClass: string; group: "dark" | "pastel" }> = [
  { value: "midnight-dark", label: "Midnight", previewClass: "midnight-preview", group: "dark" },
  { value: "forest-dark", label: "Forest", previewClass: "forest-preview", group: "dark" },
  { value: "cyber-dark", label: "Cyber", previewClass: "cyber-preview", group: "dark" },
  { value: "lavender-pastel", label: "Lavender", previewClass: "lavender-preview", group: "pastel" },
  { value: "sage-pastel", label: "Sage Mint", previewClass: "sage-preview", group: "pastel" },
  { value: "rose-pastel", label: "Rose Quartz", previewClass: "rose-preview", group: "pastel" },
];

const languageOptions: Array<{ value: Language; label: string; nativeLabel: string }> = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "th", label: "Thai", nativeLabel: "ไทย" },
];

const appVersion = "0.2.0";
const githubUrl = "https://github.com/chatchai98/Markdown-Viewer";
const appCreator = "chatchai98";
const copyrightYear = "2026";
const storageKeys = {
  language: "markdown-viewer:language",
  theme: "markdown-viewer:theme",
  readerSettings: "markdown-viewer:reader-settings",
} as const;
const defaultReaderSettings = {
  showOutline: true,
  fontSize: 16,
  lineWidth: 95,
  tableWrap: false,
  stickyTables: true,
  mermaidEnabled: true,
};

type ReaderSettings = typeof defaultReaderSettings;

function getDisplayPath(file: File) {
  const fileWithPath = file as File & { path?: string };
  return fileWithPath.path || file.webkitRelativePath || undefined;
}

function readStorageValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore unavailable storage; settings can fall back to defaults.
  }
}

function isTheme(value: string | null): value is Theme {
  return Boolean(value && themeOptions.some((option) => option.value === value));
}

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "th";
}

function getStoredTheme(): Theme {
  const storedTheme = readStorageValue(storageKeys.theme);
  return isTheme(storedTheme) ? storedTheme : "lavender-pastel";
}

function getStoredLanguage(): Language {
  const storedLanguage = readStorageValue(storageKeys.language);
  return isLanguage(storedLanguage) ? storedLanguage : "en";
}

function getStoredReaderSettings(): ReaderSettings {
  const storedSettings = readStorageValue(storageKeys.readerSettings);
  if (!storedSettings) {
    return defaultReaderSettings;
  }

  try {
    const parsed = JSON.parse(storedSettings) as Partial<ReaderSettings>;
    return {
      showOutline: typeof parsed.showOutline === "boolean" ? parsed.showOutline : defaultReaderSettings.showOutline,
      fontSize: getBoundedNumber(parsed.fontSize, defaultReaderSettings.fontSize, 14, 22),
      lineWidth: getBoundedNumber(parsed.lineWidth, defaultReaderSettings.lineWidth, 65, 100),
      tableWrap: typeof parsed.tableWrap === "boolean" ? parsed.tableWrap : defaultReaderSettings.tableWrap,
      stickyTables: typeof parsed.stickyTables === "boolean" ? parsed.stickyTables : defaultReaderSettings.stickyTables,
      mermaidEnabled: typeof parsed.mermaidEnabled === "boolean" ? parsed.mermaidEnabled : defaultReaderSettings.mermaidEnabled,
    };
  } catch {
    return defaultReaderSettings;
  }
}

function getBoundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function getDistinctPath(path: string | undefined, name: string) {
  return path && path !== name ? path : undefined;
}

function formatDateTime(timestamp: number | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function slugifyHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripMarkdownFormatting(text: string): string {
  return text
    // Strip links: [Text](url) -> Text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Strip images: ![Alt](url) -> empty
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    // Strip bold/italic: **bold**, *italic*, __bold__, _italic_
    .replace(/[\*_]{1,3}([^*_]+)[\*_]{1,3}/g, "$1")
    // Strip inline code: `code` -> code
    .replace(/`([^`]+)`/g, "$1");
}

function extractHeadings(markdown: string): HeadingItem[] {
  // Strip code blocks to avoid extracting headers from inside them
  const cleanedMarkdown = markdown.replace(/```[\s\S]*?```/g, "");
  const usedIds = new Map<string, number>();

  return cleanedMarkdown
    .split(/\r?\n/)
    .map((line) => /^(#{1,3})\s+(.+?)\s*#*$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => {
      const rawText = match[2].trim();
      const text = stripMarkdownFormatting(rawText);
      const baseId = slugifyHeading(text) || "section";
      const count = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, count + 1);

      return {
        id: count === 0 ? baseId : `${baseId}-${count + 1}`,
        text,
        level: match[1].length as 1 | 2 | 3,
      };
    });
}


function countSearchMatches(markdown: string, query: string) {
  return getSearchMatchRanges(markdown, query).length;
}

function getSearchMatchRanges(markdown: string, query: string) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const ranges: Array<{ start: number; end: number }> = [];
  const matcher = trimmedQuery.toLowerCase();
  const lowerMarkdown = markdown.toLowerCase();
  let position = lowerMarkdown.indexOf(matcher);
  while (position !== -1) {
    ranges.push({ start: position, end: position + trimmedQuery.length });
    position = lowerMarkdown.indexOf(matcher, position + trimmedQuery.length);
  }
  return ranges;
}

function replaceMarkdownMatches(markdown: string, query: string, replacement: string, activeIndex: number, all: boolean) {
  const ranges = getSearchMatchRanges(markdown, query);
  if (ranges.length === 0) {
    return { markdown, replaced: 0 };
  }

  if (!all) {
    const range = ranges[Math.min(activeIndex, ranges.length - 1)];
    return {
      markdown: `${markdown.slice(0, range.start)}${replacement}${markdown.slice(range.end)}`,
      replaced: 1,
    };
  }

  let nextMarkdown = markdown;
  for (const range of [...ranges].reverse()) {
    nextMarkdown = `${nextMarkdown.slice(0, range.start)}${replacement}${nextMarkdown.slice(range.end)}`;
  }
  return { markdown: nextMarkdown, replaced: ranges.length };
}

function buildMarkdownSnippet(id: SnippetId, selectedText: string) {
  const selected = selectedText.trim();
  const fromLines = (prefix: string, fallback: string) =>
    selected
      ? selected.split(/\r?\n/).map((line) => `${prefix}${line}`).join("\n")
      : fallback;

  switch (id) {
    case "table":
      return {
        text: "| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |",
        selectText: "Column 1",
      };
    case "checklist":
      return {
        text: fromLines("- [ ] ", "- [ ] Task"),
        selectText: selected ? null : "Task",
      };
    case "code":
      return {
        text: `\`\`\`js\n${selected || 'console.log("Hello");'}\n\`\`\``,
        selectText: selected ? null : "js",
      };
    case "link":
      return {
        text: `[${selected || "link text"}](https://example.com)`,
        selectText: selected ? "https://example.com" : "link text",
      };
    case "image":
      return {
        text: `![${selected || "alt text"}](./image.png)`,
        selectText: selected ? "./image.png" : "alt text",
      };
    case "quote":
      return {
        text: fromLines("> ", "> Quote"),
        selectText: selected ? null : "Quote",
      };
  }
}

const translations = {
  en: {
    appName: "Markdown Viewer",
    back: "Back",
    backTitle: "Back to Home",
    edit: "Editor",
    split: "Split",
    preview: "Preview",
    editTitle: "Editor Mode",
    splitTitle: "Split Mode",
    previewTitle: "Preview Mode",
    newFile: "New File",
    newFileTitle: "Create a new Markdown file",
    untitledFileName: "Untitled.md",
    open: "Open",
    openTitle: "Open another file",
    save: "Save",
    saving: "Saving...",
    saved: "Saved",
    error: "Error",
    saveTitle: "Save changes (Ctrl+S)",
    saveAs: "Save As",
    saveAsTitle: "Save file as...",
    copied: "Copied",
    copyRaw: "Copy Raw",
    copyRawTitle: "Copy Raw Markdown",
    print: "Print",
    printTitle: "Print to PDF",
    guide: "Guide",
    guideTitle: "Markdown Syntax Guide",
    settings: "Settings",
    settingsTitle: "Settings",
    settingsHeader: "Settings",
    about: "About",
    aboutTitle: "About Markdown Viewer",
    aboutDescription: "A local-first Markdown viewer and editor for reading, editing, previewing, and printing Markdown files safely in the browser.",
    creator: "Creator",
    version: "Version",
    copyright: "Copyright",
    github: "GitHub",
    close: "Close",
    language: "Language",
    theme: "Theme",
    darkThemes: "Dark Themes",
    pastelThemes: "Pastel Themes",
    markdownCheatSheet: "Markdown Cheat Sheet",
    heroBadge: "Offline-first Markdown reader",
    eyebrow: "Local workspace",
    heroTitle: "Open a Markdown file",
    heroDescription: "All processing happens locally on your computer. Your files never touch the cloud, providing complete privacy and secure offline viewing.",
    recentDocuments: "Recent documents",
    savedOnDevice: "Saved on this device",
    noRecentItems: "No recent items",
    clearHistory: "Clear History",
    removeFromHistory: "Remove from history",
    recentEmpty: "No files opened recently. Your viewing history will be shown here.",
    typePlaceholder: "Type your markdown here...",
    unsavedChanges: "Unsaved changes",
    confirmBack: "You have unsaved changes. Are you sure you want to go back?",
    openedButRecentFailed: "Opened file, but could not save it to recent files.",
    recentUnavailable: "This recent file is no longer available.",
    openRecentFailed: "Could not open this recent file.",
    clearRecentFailed: "Could not clear recent files.",
    deleteRecentFailed: "Could not delete this recent file.",
    copyFailed: "Failed to copy raw text.",
    readFailed: "Could not read this file.",
    saveDirectFailed: "Could not save the file directly. Try Save As.",
    markdownFiles: "Markdown Files",
    location: "Location",
    editLocation: "Edit location/project",
    editLocationPlaceholder: "Enter file path or project name...",
    noLocation: "No location set (click to edit)",
    saveLocation: "Save location",
    cancelLocation: "Cancel",
    syncLive: "Live sync",
    syncedFromDisk: "File updated from disk.",
    externalChangeConflict: "The file changed on disk, but you have unsaved edits. Save or reopen the file before continuing.",
    opened: "Opened",
    modified: "Modified",
    modifiedUnknown: "Modified time unavailable",
    words: "words",
    minRead: "min read",
    search: "Search",
    searchPlaceholder: "Find in document...",
    replacePlaceholder: "Replace...",
    replaceOne: "Replace",
    replaceAll: "All",
    searchPrevious: "Previous match",
    searchNext: "Next match",
    noMatches: "No matches",
    outline: "Outline",
    noOutline: "No headings",
    readerTools: "Reader Tools",
    showOutline: "Outline",
    readMode: "Read Mode",
    exitReadMode: "Exit Read Mode",
    fontSize: "Font Size",
    lineWidth: "Line Width",
    tableTools: "Tables",
    wrapTables: "Wrap cells",
    stickyTables: "Sticky headers",
    markdownExtras: "Markdown Extras",
    mermaidDiagrams: "Mermaid diagrams",
    insertMarkdown: "Insert Markdown",
    insertTable: "Table",
    insertChecklist: "Checklist",
    insertCodeBlock: "Code block",
    insertLink: "Link",
    insertImage: "Image",
    insertQuote: "Quote",
    previewRenderError: "Markdown preview could not render this edit.",
    previewRenderHint: "Keep editing or remove the last incomplete Markdown tag.",
    fileLoader: {
      unsupportedFile: "Only .md, .markdown, and .txt files are supported.",
      readError: "Could not read this file.",
      dragDrop: "Drag & drop your Markdown file",
      supports: "Supports .md, .markdown, or .txt files",
      or: "or",
      browse: "Browse Files",
      openNewFile: "Open new file",
      dropFileHere: "or drop file here",
    },
    markdownViewer: {
      blockedRemoteImage: "Remote image blocked:",
      copy: "Copy",
      copied: "Copied",
      mermaid: "Mermaid",
      mermaidError: "Could not render this Mermaid diagram.",
      copyCsv: "Copy CSV",
      csvCopied: "CSV copied",
      csvCopyFailed: "Could not copy CSV.",
      mermaidDisabled: "Mermaid rendering is disabled.",
    },
    guideRows: [
      ["# Heading 1", "Largest heading"],
      ["## Heading 2", "Medium heading"],
      ["### Heading 3", "Small heading"],
      ["**bold**", "Bold text"],
      ["*italic*", "Italic text"],
      ["[link text](URL)", "Create a link"],
      ["- item", "Bullet list"],
      ["1. item", "Numbered list"],
      ["[ ] task", "Create a checklist"],
      ["> quote", "Quote block"],
      ["`code`", "Inline code"],
      ["```lang...```", "Multi-line code block"],
      ["| column |", "Create a table"],
      ["```mermaid...```", "Render a chart or diagram"],
    ],
  },
  th: {
    appName: "Markdown Viewer",
    back: "กลับ",
    backTitle: "กลับหน้าแรก",
    edit: "แก้ไข",
    split: "แบ่งจอ",
    preview: "พรีวิว",
    editTitle: "โหมดแก้ไข",
    splitTitle: "โหมดแบ่งจอ",
    previewTitle: "โหมดพรีวิว",
    newFile: "ไฟล์ใหม่",
    newFileTitle: "สร้างไฟล์ Markdown ใหม่",
    untitledFileName: "Untitled.md",
    open: "เปิดไฟล์",
    openTitle: "เปิดไฟล์อื่น",
    save: "บันทึก",
    saving: "กำลังบันทึก...",
    saved: "บันทึกแล้ว",
    error: "ผิดพลาด",
    saveTitle: "บันทึกการแก้ไข (Ctrl+S)",
    saveAs: "บันทึกเป็น",
    saveAsTitle: "บันทึกไฟล์เป็น...",
    copied: "คัดลอกแล้ว",
    copyRaw: "คัดลอกดิบ",
    copyRawTitle: "คัดลอก Markdown ดิบ",
    print: "พิมพ์",
    printTitle: "พิมพ์เป็น PDF",
    guide: "คู่มือ",
    guideTitle: "คู่มือ Markdown",
    settings: "ตั้งค่า",
    settingsTitle: "ตั้งค่า",
    settingsHeader: "ตั้งค่า",
    about: "เกี่ยวกับ",
    aboutTitle: "เกี่ยวกับ Markdown Viewer",
    aboutDescription: "แอปอ่านและแก้ไข Markdown แบบ local-first สำหรับอ่าน แก้ไข พรีวิว และพิมพ์ไฟล์ Markdown อย่างปลอดภัยในเบราว์เซอร์",
    creator: "ผู้สร้าง",
    version: "เวอร์ชัน",
    copyright: "ลิขสิทธิ์",
    github: "GitHub",
    close: "ปิด",
    language: "ภาษา",
    theme: "ธีม",
    darkThemes: "ธีมมืด",
    pastelThemes: "ธีมพาสเทล",
    markdownCheatSheet: "สรุปคำสั่ง Markdown",
    heroBadge: "อ่าน Markdown แบบออฟไลน์ก่อน",
    eyebrow: "พื้นที่ทำงานบนเครื่อง",
    heroTitle: "เปิดไฟล์ Markdown",
    heroDescription: "ทุกอย่างประมวลผลบนเครื่องของคุณ ไฟล์ไม่ถูกส่งขึ้นคลาวด์ เพื่อความเป็นส่วนตัวและการใช้งานแบบออฟไลน์ที่ปลอดภัย",
    recentDocuments: "เอกสารล่าสุด",
    savedOnDevice: "บันทึกไว้บนอุปกรณ์นี้",
    noRecentItems: "ยังไม่มีรายการล่าสุด",
    clearHistory: "ล้างประวัติ",
    removeFromHistory: "ลบออกจากประวัติ",
    recentEmpty: "ยังไม่มีไฟล์ที่เปิดล่าสุด ประวัติการใช้งานจะแสดงที่นี่",
    typePlaceholder: "พิมพ์ Markdown ของคุณที่นี่...",
    unsavedChanges: "มีการแก้ไขที่ยังไม่ได้บันทึก",
    confirmBack: "มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการกลับจริงไหม?",
    openedButRecentFailed: "เปิดไฟล์แล้ว แต่ไม่สามารถบันทึกลงรายการล่าสุดได้",
    recentUnavailable: "ไฟล์ล่าสุดนี้ไม่พร้อมใช้งานแล้ว",
    openRecentFailed: "ไม่สามารถเปิดไฟล์ล่าสุดนี้ได้",
    clearRecentFailed: "ไม่สามารถล้างประวัติไฟล์ล่าสุดได้",
    deleteRecentFailed: "ไม่สามารถลบไฟล์นี้จากประวัติได้",
    copyFailed: "ไม่สามารถคัดลอกข้อความดิบได้",
    readFailed: "ไม่สามารถอ่านไฟล์นี้ได้",
    saveDirectFailed: "ไม่สามารถบันทึกไฟล์โดยตรงได้ ลองใช้บันทึกเป็น",
    markdownFiles: "ไฟล์ Markdown",
    location: "ตำแหน่ง",
    editLocation: "แก้ไขตำแหน่ง/โปรเจค",
    editLocationPlaceholder: "ระบุพาธของไฟล์หรือชื่อโปรเจค...",
    noLocation: "ยังไม่มีตำแหน่ง (คลิกเพื่อแก้ไข)",
    saveLocation: "บันทึกตำแหน่ง",
    cancelLocation: "ยกเลิก",
    syncLive: "ซิงก์สด",
    syncedFromDisk: "อัปเดตไฟล์จากดิสก์แล้ว",
    externalChangeConflict: "ไฟล์บนดิสก์ถูกแก้ไข แต่คุณมีงานที่ยังไม่ได้บันทึก กรุณาบันทึกหรือเปิดไฟล์ใหม่ก่อนทำต่อ",
    opened: "เปิดล่าสุด",
    modified: "แก้ไขล่าสุด",
    modifiedUnknown: "ไม่พบเวลาแก้ไข",
    words: "คำ",
    minRead: "นาทีในการอ่าน",
    replacePlaceholder: "แทนที่...",
    replaceOne: "แทนที่",
    replaceAll: "ทั้งหมด",
    insertMarkdown: "เพิ่ม Markdown",
    insertTable: "ตาราง",
    insertChecklist: "Checklist",
    insertCodeBlock: "โค้ดบล็อก",
    insertLink: "ลิงก์",
    insertImage: "รูปภาพ",
    insertQuote: "คำพูด",
    fileLoader: {
      unsupportedFile: "รองรับเฉพาะไฟล์ .md, .markdown และ .txt",
      readError: "ไม่สามารถอ่านไฟล์นี้ได้",
      dragDrop: "ลากและวางไฟล์ Markdown ของคุณ",
      supports: "รองรับไฟล์ .md, .markdown หรือ .txt",
      or: "หรือ",
      browse: "เลือกไฟล์",
      openNewFile: "เปิดไฟล์ใหม่",
      dropFileHere: "หรือลากไฟล์มาวางที่นี่",
    },
    markdownViewer: {
      blockedRemoteImage: "บล็อกรูปภาพภายนอก:",
      copy: "คัดลอก",
      copied: "คัดลอกแล้ว",
      mermaid: "Mermaid",
      mermaidError: "ไม่สามารถเรนเดอร์ไดอะแกรม Mermaid นี้ได้",
    },
    guideRows: [
      ["# หัวข้อ 1", "Heading ใหญ่สุด"],
      ["## หัวข้อ 2", "Heading ขนาดกลาง"],
      ["### หัวข้อ 3", "Heading ขนาดเล็ก"],
      ["**ตัวหนา**", "ข้อความตัวหนา"],
      ["*ตัวเอียง*", "ข้อความตัวเอียง"],
      ["[ชื่อลิงก์](URL)", "สร้างลิงก์เชื่อมโยง"],
      ["- รายการ", "รายการหัวข้อหลัก"],
      ["1. รายการ", "รายการแบบลำดับเลข"],
      ["[ ] งานย่อย", "สร้าง Checklist"],
      ["> ข้อความอ้างอิง", "กล่องคำพูด (Quote)"],
      ["`โค้ด`", "โค้ดบรรทัดเดียว"],
      ["```ภาษา...```", "โค้ดบล็อกหลายบรรทัด"],
      ["| คอลัมน์ |", "สร้างตารางข้อมูล"],
      ["```mermaid...```", "เรนเดอร์ชาร์ต/ไดอะแกรม"],
    ],
  },
} satisfies Record<Language, Record<string, any>>;

type MarkdownPreviewBoundaryProps = {
  resetKey: string;
  labels: {
    previewRenderError: string;
    previewRenderHint: string;
  };
  children: React.ReactNode;
};

type MarkdownPreviewBoundaryState = {
  error: string | null;
  resetKey: string;
};

class MarkdownPreviewBoundary extends React.Component<
  MarkdownPreviewBoundaryProps,
  MarkdownPreviewBoundaryState
> {
  state: MarkdownPreviewBoundaryState = {
    error: null,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromProps(
    props: MarkdownPreviewBoundaryProps,
    state: MarkdownPreviewBoundaryState,
  ): Partial<MarkdownPreviewBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return {
        error: null,
        resetKey: props.resetKey,
      };
    }

    return null;
  }

  static getDerivedStateFromError(error: unknown): Partial<MarkdownPreviewBoundaryState> {
    return {
      error: error instanceof Error ? error.message : "Unknown render error",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("Markdown preview failed", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="preview-error" role="alert">
          <strong>{this.props.labels.previewRenderError}</strong>
          <p>{this.props.labels.previewRenderHint}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [fileRef, setFileRef] = useState<FileRef | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [error, setError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [showOutline, setShowOutline] = useState(() => getStoredReaderSettings().showOutline);
  const [isReadMode, setIsReadMode] = useState(false);
  const [fontSize, setFontSize] = useState(() => getStoredReaderSettings().fontSize);
  const [lineWidth, setLineWidth] = useState(() => getStoredReaderSettings().lineWidth);
  const [tableWrap, setTableWrap] = useState(() => getStoredReaderSettings().tableWrap);
  const [stickyTables, setStickyTables] = useState(() => getStoredReaderSettings().stickyTables);
  const [mermaidEnabled, setMermaidEnabled] = useState(() => getStoredReaderSettings().mermaidEnabled);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [snippetMenu, setSnippetMenu] = useState<{ x: number; y: number } | null>(null);
  
  const headerInputRef = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const splitEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const splitPreviewRef = useRef<HTMLDivElement | null>(null);
  const syncingPaneRef = useRef<HTMLElement | null>(null);
  const editorSelectionRef = useRef<{ start: number; end: number; target: HTMLTextAreaElement } | null>(null);
  const t = {
    ...translations.en,
    ...translations[language],
    fileLoader: {
      ...translations.en.fileLoader,
      ...translations[language].fileLoader,
    },
    markdownViewer: {
      ...translations.en.markdownViewer,
      ...translations[language].markdownViewer,
    },
  };
  const snippetOptions: Array<{ id: SnippetId; label: string; icon: React.ReactNode }> = [
    { id: "table", label: t.insertTable, icon: <Table2 size={14} aria-hidden="true" /> },
    { id: "checklist", label: t.insertChecklist, icon: <ListChecks size={14} aria-hidden="true" /> },
    { id: "code", label: t.insertCodeBlock, icon: <Code2 size={14} aria-hidden="true" /> },
    { id: "link", label: t.insertLink, icon: <Link2 size={14} aria-hidden="true" /> },
    { id: "image", label: t.insertImage, icon: <ImageIcon size={14} aria-hidden="true" /> },
    { id: "quote", label: t.insertQuote, icon: <Quote size={14} aria-hidden="true" /> },
  ];

  const isModified = useMemo(() => {
    if (!loadedFile) return false;
    return editContent !== loadedFile.content;
  }, [loadedFile, editContent]);

  const stats = useMemo(() => {
    if (!loadedFile) return null;
    const text = editContent;
    const charCount = text.length;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));
    return { charCount, wordCount, readTime };
  }, [loadedFile, editContent]);

  const headings = useMemo(() => extractHeadings(previewContent), [previewContent]);
  const searchMatchCount = useMemo(
    () => countSearchMatches(previewContent, searchQuery),
    [previewContent, searchQuery],
  );

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  useEffect(() => {
    writeStorageValue(storageKeys.language, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    writeStorageValue(storageKeys.theme, theme);
  }, [theme]);

  useEffect(() => {
    writeStorageValue(
      storageKeys.readerSettings,
      JSON.stringify({
        showOutline,
        fontSize,
        lineWidth,
        tableWrap,
        stickyTables,
        mermaidEnabled,
      }),
    );
  }, [showOutline, fontSize, lineWidth, tableWrap, stickyTables, mermaidEnabled]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const maxSearchIndex = Math.max(0, searchMatchCount - 1);
    if (activeSearchIndex > maxSearchIndex) {
      setActiveSearchIndex(maxSearchIndex);
    }
  }, [activeSearchIndex, searchMatchCount]);

  useEffect(() => {
    const nextHeadingId =
      activeHeadingId && headings.some((heading) => heading.id === activeHeadingId)
        ? activeHeadingId
        : headings[0]?.id ?? null;

    if (activeHeadingId !== nextHeadingId) {
      setActiveHeadingId(nextHeadingId);
    }
  }, [activeHeadingId, headings]);

  useEffect(() => {
    const previewUpdateId = window.setTimeout(() => {
      setPreviewContent(editContent);
    }, 80);

    return () => window.clearTimeout(previewUpdateId);
  }, [editContent]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (guideRef.current && !guideRef.current.contains(event.target as Node)) {
        setIsGuideOpen(false);
      }
      if (!(event.target as Element).closest(".markdown-snippet-menu")) {
        setSnippetMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+S for saving
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (loadedFile) {
          void handleSaveFile();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key === "f" && loadedFile) {
        event.preventDefault();
        window.setTimeout(() => document.getElementById("document-search")?.focus());
      } else if (event.key === "Escape" && snippetMenu) {
        setSnippetMenu(null);
      } else if (event.key === "Escape" && isReadMode) {
        setIsReadMode(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadedFile, editContent, fileRef, isReadMode, snippetMenu]);

  useEffect(() => {
    if (!loadedFile || !fileRef) {
      return;
    }

    const activeFile = loadedFile;
    const activeRef = fileRef;
    let isCurrent = true;

    async function syncExternalChanges() {
      try {
        let nextFile: LoadedFile;

        if (activeRef.kind === "desktop") {
          const desktopApi = window.markdownViewerDesktop;
          if (!desktopApi) {
            return;
          }

          nextFile = {
            ...(await desktopApi.readFile(activeRef.path)),
            id: activeFile.id,
          };
        } else {
          const diskFile = await activeRef.handle.getFile();
          const nextContent = await diskFile.text();
          nextFile = {
            id: activeFile.id,
            name: diskFile.name,
            path: getDisplayPath(diskFile),
            size: diskFile.size,
            content: nextContent,
            lastModified: diskFile.lastModified,
          };
        }

        if (!isCurrent || nextFile.lastModified === activeFile.lastModified) {
          return;
        }

        if (editContent !== activeFile.content) {
          setError(t.externalChangeConflict);
          setLoadedFile((current) =>
            current ? { ...current, lastModified: nextFile.lastModified } : current,
          );
          return;
        }

        setLoadedFile(nextFile);
        setEditContent(nextFile.content);
        setPreviewContent(nextFile.content);
        setError(t.syncedFromDisk);
        setRecentFiles(await saveRecentFile(nextFile));
      } catch {
        // Ignore transient permission or file access failures during background sync.
      }
    }

    const intervalId = window.setInterval(() => {
      void syncExternalChanges();
    }, 2000);

    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, [loadedFile, editContent, fileRef, t.externalChangeConflict, t.syncedFromDisk]);

  async function handleLoadFile(file: LoadedFile, ref: FileRef | null = null) {
    const fileId = file.id || createFileId(file.name, file.path, file.size, file.content, file.lastModified);
    const fileWithId = { ...file, id: fileId };

    setLoadedFile(fileWithId);
    setEditContent(file.content);
    setPreviewContent(file.content);
    setFileRef(ref);
    setError(null);
    setViewMode("preview");
    setSaveStatus("idle");
    setSearchQuery("");
    setReplaceQuery("");
    setActiveSearchIndex(0);
    setIsReadMode(false);
    setActiveHeadingId(null);

    try {
      setRecentFiles(await saveRecentFile(fileWithId));
    } catch {
      setError(t.openedButRecentFailed);
    }
  }

  function handleNewFile() {
    if (isModified && !window.confirm(t.confirmBack)) {
      return;
    }

    const now = Date.now();
    const newFile: LoadedFile = {
      id: createFileId(t.untitledFileName, undefined, 0, "", now),
      name: t.untitledFileName,
      size: 0,
      content: "",
      lastModified: now,
    };

    setLoadedFile(newFile);
    setEditContent("");
    setPreviewContent("");
    setFileRef(null);
    setError(null);
    setViewMode("edit");
    setSaveStatus("idle");
    setSearchQuery("");
    setReplaceQuery("");
    setActiveSearchIndex(0);
    setIsReadMode(false);
    setActiveHeadingId(null);
  }

  async function handleOpenRecent(id: string) {
    try {
      const recentFile = getRecentFiles().find((item) => item.id === id);
      const desktopApi = window.markdownViewerDesktop;
      if (desktopApi && recentFile?.path) {
        try {
          const diskFile = await desktopApi.readFile(recentFile.path);
          await handleLoadFile({ ...diskFile, id }, { kind: "desktop", path: diskFile.path });
          return;
        } catch {
          // Fall back to the locally cached snapshot below.
        }
      }

      const file = await openRecentFile(id);
      if (!file) {
        setError(t.recentUnavailable);
        setRecentFiles(getRecentFiles().filter((item) => item.id !== id));
        return;
      }

      await handleLoadFile({ ...file, id }, null);
    } catch {
      setError(t.openRecentFailed);
    }
  }

  async function handleClearRecent() {
    try {
      await clearRecentFiles();
      setRecentFiles([]);
      setError(null);
    } catch {
      setError(t.clearRecentFailed);
    }
  }

  async function handleDeleteRecent(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    try {
      const nextRecent = await deleteRecentFile(id);
      setRecentFiles(nextRecent);
      setError(null);
    } catch {
      setError(t.deleteRecentFailed);
    }
  }

  async function handleUpdateRecentPath(id: string, path: string) {
    try {
      const nextRecent = await updateRecentFilePath(id, path);
      setRecentFiles(nextRecent);
      setError(null);
    } catch {
      setError("Could not update file location.");
    }
  }

  async function handleCopyRaw() {
    if (!loadedFile) return;
    try {
      await navigator.clipboard.writeText(editContent);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1500);
    } catch {
      setError(t.copyFailed);
    }
  }

  function openSnippetMenu(event: React.MouseEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    editorSelectionRef.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
      target,
    };
    setSnippetMenu({
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 260),
    });
  }

  function insertSnippet(id: SnippetId) {
    const selection = editorSelectionRef.current;
    if (!selection) {
      return;
    }

    const { start, end, target } = selection;
    const value = target.value;
    const selectedText = value.slice(start, end);
    const snippet = buildMarkdownSnippet(id, selectedText);
    const isBlock = id === "table" || id === "checklist" || id === "code" || id === "quote";
    const prefix = isBlock && start > 0 && !value.slice(0, start).endsWith("\n") ? "\n" : "";
    const suffix = isBlock && end < value.length && !value.slice(end).startsWith("\n") ? "\n" : "";
    const insertText = `${prefix}${snippet.text}${suffix}`;
    const nextContent = `${value.slice(0, start)}${insertText}${value.slice(end)}`;
    const selectOffset = snippet.selectText ? insertText.indexOf(snippet.selectText) : -1;

    setEditContent(nextContent);
    setSnippetMenu(null);
    window.setTimeout(() => {
      target.focus();
      if (selectOffset >= 0 && snippet.selectText) {
        const selectionStart = start + selectOffset;
        target.setSelectionRange(selectionStart, selectionStart + snippet.selectText.length);
      } else {
        const cursor = start + insertText.length;
        target.setSelectionRange(cursor, cursor);
      }
    });
  }

  async function triggerOpenFilePicker() {
    try {
      const desktopApi = window.markdownViewerDesktop;
      if (desktopApi) {
        const file = await desktopApi.openFile();
        if (file) {
          void handleLoadFile(file, { kind: "desktop", path: file.path });
        }
        return;
      }

      const win = window as any;
      if ("showOpenFilePicker" in win) {
        const [handle] = await win.showOpenFilePicker({
          types: [{
            description: t.markdownFiles,
            accept: {
              "text/markdown": [".md", ".markdown"],
              "text/plain": [".txt"]
            }
          }]
        });
        const file = await handle.getFile();
        const content = await file.text();
        void handleLoadFile({
          name: file.name,
          path: getDisplayPath(file),
          size: file.size,
          content,
          lastModified: file.lastModified,
        }, { kind: "browser", handle });
      } else {
        headerInputRef.current?.click();
      }
    } catch {
      // User cancelled
    }
  }

  async function handleSaveFile() {
    if (!loadedFile) return;
    setSaveStatus("saving");
    try {
      if (fileRef?.kind === "desktop") {
        const savedFile = await window.markdownViewerDesktop?.saveFile(fileRef.path, editContent);
        if (!savedFile) {
          throw new Error("Desktop file API unavailable.");
        }

        const updatedFile = {
          ...savedFile,
          id: loadedFile.id,
        };
        setLoadedFile(updatedFile);
        setFileRef({ kind: "desktop", path: savedFile.path });

        const updatedRecent = await saveRecentFile(updatedFile);
        setRecentFiles(updatedRecent);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else if (fileRef?.kind === "browser") {
        const handleAny = fileRef.handle as any;
        const opts = { mode: "readwrite" as const };
        if (typeof handleAny.queryPermission === "function" && (await handleAny.queryPermission(opts)) !== "granted") {
          if (typeof handleAny.requestPermission === "function" && (await handleAny.requestPermission(opts)) !== "granted") {
            throw new Error("Write permission denied.");
          }
        }

        const writable = await handleAny.createWritable();
        await writable.write(editContent);
        await writable.close();

        const savedFile = await fileRef.handle.getFile();
        const sizeBytes = savedFile.size;
        const updatedFile = {
          ...loadedFile,
          content: editContent,
          size: sizeBytes,
          lastModified: savedFile.lastModified,
        };
        setLoadedFile(updatedFile);

        const updatedRecent = await saveRecentFile(updatedFile);
        setRecentFiles(updatedRecent);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        await handleSaveAsFile();
      }
    } catch (err) {
      setSaveStatus("error");
      setError(t.saveDirectFailed);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  async function handleSaveAsFile() {
    if (!loadedFile) return;
    setSaveStatus("saving");
    try {
      const desktopApi = window.markdownViewerDesktop;
      if (desktopApi) {
        const savedFile = await desktopApi.saveFileAs(loadedFile.name, editContent);
        if (!savedFile) {
          setSaveStatus("idle");
          return;
        }

        const newId = createFileId(savedFile.name, savedFile.path, savedFile.size, savedFile.content, savedFile.lastModified);
        const newFile = {
          ...savedFile,
          id: newId,
        };
        setLoadedFile(newFile);
        setFileRef({ kind: "desktop", path: savedFile.path });

        const updatedRecent = await saveRecentFile(newFile);
        setRecentFiles(updatedRecent);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
        return;
      }

      const win = window as any;
      if ("showSaveFilePicker" in win) {
        const handle = await win.showSaveFilePicker({
          suggestedName: loadedFile.name,
          types: [
            {
              description: t.markdownFiles,
              accept: {
                "text/markdown": [".md", ".markdown"],
                "text/plain": [".txt"],
              },
            },
          ],
        });

        const writable = await handle.createWritable();
        await writable.write(editContent);
        await writable.close();

        setFileRef({ kind: "browser", handle });
        
        const savedFile = await handle.getFile();
        const sizeBytes = savedFile.size;
        const path = getDisplayPath(savedFile);
        const newId = createFileId(savedFile.name, path, sizeBytes, editContent, savedFile.lastModified);
        const newFile = {
          id: newId,
          name: savedFile.name,
          path,
          size: sizeBytes,
          content: editContent,
          lastModified: savedFile.lastModified,
        };
        setLoadedFile(newFile);

        const updatedRecent = await saveRecentFile(newFile);
        setRecentFiles(updatedRecent);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        const blob = new Blob([editContent], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = loadedFile.name;
        link.click();
        URL.revokeObjectURL(url);
        
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      }
    } catch (err) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function handleBack() {
    if (isModified) {
      const confirm = window.confirm(t.confirmBack);
      if (!confirm) return;
    }
    setLoadedFile(null);
    setFileRef(null);
    setSearchQuery("");
    setReplaceQuery("");
    setIsReadMode(false);
    setActiveHeadingId(null);
  }

  function moveSearch(direction: 1 | -1) {
    if (searchMatchCount === 0) {
      return;
    }

    setActiveSearchIndex((current) =>
      (current + direction + searchMatchCount) % searchMatchCount,
    );
  }

  function replaceSearch(all = false) {
    const result = replaceMarkdownMatches(editContent, searchQuery, replaceQuery, activeSearchIndex, all);
    if (result.replaced === 0) {
      return;
    }

    setEditContent(result.markdown);
    setActiveSearchIndex(0);
  }

  function updateActiveHeading(scrollPane: HTMLElement) {
    const headingElements = Array.from(
      scrollPane.querySelectorAll<HTMLElement>("[data-heading-id]"),
    );

    if (headingElements.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const paneTop = scrollPane.getBoundingClientRect().top;
    const threshold = paneTop + 80;
    const currentHeading =
      [...headingElements]
        .reverse()
        .find((heading) => heading.getBoundingClientRect().top <= threshold) ??
      headingElements[0];

    setActiveHeadingId(currentHeading.dataset.headingId ?? null);
  }

  function syncSplitScroll(source: HTMLElement) {
    const target =
      source === splitEditorRef.current ? splitPreviewRef.current : splitEditorRef.current;
    if (!target) {
      return;
    }

    if (syncingPaneRef.current && syncingPaneRef.current !== source) {
      return;
    }

    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    if (sourceRange <= 0 || targetRange <= 0) {
      return;
    }

    syncingPaneRef.current = source;
    target.scrollTop = (source.scrollTop / sourceRange) * targetRange;
    requestAnimationFrame(() => {
      syncingPaneRef.current = null;
    });
  }

  function scrollToHeading(id: string) {
    setActiveHeadingId(id);

    const target =
      Array.from(document.querySelectorAll<HTMLElement>("[data-heading-id]")).find(
        (heading) => heading.dataset.headingId === id,
      ) ??
      document.getElementById(id);

    if (!target) {
      return;
    }

    const scrollPane = target.closest<HTMLElement>(".viewer-content, .preview-pane");
    if (!scrollPane) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const targetTop = target.getBoundingClientRect().top;
    const paneTop = scrollPane.getBoundingClientRect().top;
    scrollPane.scrollTo({
      top: scrollPane.scrollTop + targetTop - paneTop - 16,
      behavior: "smooth",
    });
  }

  const viewerProps = {
    markdown: previewContent,
    labels: t.markdownViewer,
    searchQuery,
    activeSearchIndex,
    fontSize,
    lineWidth,
    tableWrap,
    stickyTables,
    mermaidEnabled,
    sourcePath: loadedFile?.path,
  };

  return (
    <main className={`app ${isReadMode ? "app-read-mode" : ""}`} data-theme={theme}>
      {isReadMode && loadedFile && (
        <button
          className="btn-exit-read-mode"
          type="button"
          title={t.exitReadMode}
          onClick={() => setIsReadMode(false)}
        >
          <Minimize2 size={15} aria-hidden="true" />
          <span>{t.exitReadMode}</span>
        </button>
      )}

      <input
        ref={headerInputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            file.text().then((content) => {
              void handleLoadFile({
                name: file.name,
                path: getDisplayPath(file),
                size: file.size,
                content,
                lastModified: file.lastModified,
              }, null);
            }).catch(() => {
              setError(t.readFailed);
            });
          }
        }}
      />
      
      <header className="app-header">
        <div className="header-left">
          {loadedFile ? (
            <button
              className="btn-back"
              type="button"
              onClick={handleBack}
              title={t.backTitle}
              aria-label={t.backTitle}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t.back}</span>
            </button>
          ) : null}
        </div>

        {loadedFile && (
          <>
            <div className="header-view-toggle">
              <button
                className={`btn-toggle-view ${viewMode === "edit" ? "active" : ""}`}
                type="button"
                title={t.editTitle}
                aria-label={t.editTitle}
                onClick={() => setViewMode("edit")}
              >
                <Edit3 size={13} aria-hidden="true" />
              </button>
              <button
                className={`btn-toggle-view ${viewMode === "split" ? "active" : ""}`}
                type="button"
                title={t.splitTitle}
                aria-label={t.splitTitle}
                onClick={() => setViewMode("split")}
              >
                <Columns size={13} aria-hidden="true" />
                <span>{t.split}</span>
              </button>
              <button
                className={`btn-toggle-view ${viewMode === "preview" ? "active" : ""}`}
                type="button"
                title={t.previewTitle}
                aria-label={t.previewTitle}
                onClick={() => setViewMode("preview")}
              >
                <Eye size={13} aria-hidden="true" />
                <span>{t.preview}</span>
              </button>
            </div>
          </>
        )}        <div className="header-right">
          {loadedFile ? (
            <>
              <div className="header-search-group">
                  <Search size={14} aria-hidden="true" />
                  <input
                    id="document-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.search}
                  />
                  {searchMatchCount > 0 && (
                    <input
                      className="replace-input"
                      type="text"
                      value={replaceQuery}
                      onChange={(event) => setReplaceQuery(event.target.value)}
                      placeholder={t.replacePlaceholder}
                      aria-label={t.replacePlaceholder}
                    />
                  )}
                  <span className="search-count">
                    {searchQuery.trim().length >= 2
                      ? searchMatchCount > 0
                        ? `${activeSearchIndex + 1}/${searchMatchCount}`
                        : t.noMatches
                      : ""}
                  </span>
                  <button
                    className="btn-search-step"
                    type="button"
                    title={t.searchPrevious}
                    onClick={() => moveSearch(-1)}
                    disabled={searchMatchCount === 0}
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    className="btn-search-step"
                    type="button"
                    title={t.searchNext}
                    onClick={() => moveSearch(1)}
                    disabled={searchMatchCount === 0}
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {searchMatchCount > 0 && (
                    <>
                      <button
                        className="btn-search-step btn-replace-one"
                        type="button"
                        title={t.replaceOne}
                        onClick={() => replaceSearch(false)}
                      >
                        <Replace size={14} aria-hidden="true" />
                      </button>
                      <button
                        className="btn-replace-all"
                        type="button"
                        title={t.replaceAll}
                        onClick={() => replaceSearch(true)}
                      >
                        {t.replaceAll}
                      </button>
                    </>
                  )}
                </div>

              {/* Group 1: File Actions */}
              <div className="header-btn-group">
                <button
                  className="btn-header-action"
                  type="button"
                  title={t.newFileTitle}
                  aria-label={t.newFileTitle}
                  onClick={handleNewFile}
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>{t.newFile}</span>
                </button>
                <button
                  className="btn-header-action"
                  type="button"
                  title={t.openTitle}
                  aria-label={t.openTitle}
                  onClick={() => void triggerOpenFilePicker()}
                >
                  <FileUp size={14} aria-hidden="true" />
                  <span>{t.open}</span>
                </button>
                <button
                  className={`btn-header-action btn-save ${isModified ? "modified" : ""} ${saveStatus === "saved" ? "saved" : ""}`}
                  type="button"
                  title={t.saveTitle}
                  aria-label={t.saveTitle}
                  onClick={() => void handleSaveFile()}
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saved" ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Save size={14} aria-hidden="true" />
                  )}
                  <span>
                    {saveStatus === "saving"
                      ? t.saving
                      : saveStatus === "saved"
                      ? t.saved
                      : saveStatus === "error"
                      ? t.error
                      : t.save}
                  </span>
                </button>
                <button
                  className="btn-header-action"
                  type="button"
                  title={t.saveAsTitle}
                  aria-label={t.saveAsTitle}
                  onClick={() => void handleSaveAsFile()}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>{t.saveAs}</span>
                </button>
              </div>

              {/* Group 2: Document Actions */}
              <div className="header-btn-group">
                <button
                  className={`btn-header-action ${showOutline ? "copied" : ""}`}
                  type="button"
                  title={t.outline}
                  aria-label={t.outline}
                  onClick={() => setShowOutline((current) => !current)}
                >
                  <PanelLeft size={14} aria-hidden="true" />
                  <span>{t.outline}</span>
                </button>
                <button
                  className={`btn-header-action ${isReadMode ? "copied" : ""}`}
                  type="button"
                  title={isReadMode ? t.exitReadMode : t.readMode}
                  aria-label={isReadMode ? t.exitReadMode : t.readMode}
                  onClick={() => setIsReadMode((current) => !current)}
                >
                  {isReadMode ? (
                    <Minimize2 size={14} aria-hidden="true" />
                  ) : (
                    <Maximize2 size={14} aria-hidden="true" />
                  )}
                  <span>{isReadMode ? t.exitReadMode : t.readMode}</span>
                </button>
                <button
                  className={copiedRaw ? "btn-header-action copied" : "btn-header-action"}
                  type="button"
                  title={t.copyRawTitle}
                  aria-label={t.copyRawTitle}
                  onClick={() => void handleCopyRaw()}
                >
                  {copiedRaw ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  <span>{copiedRaw ? t.copied : t.copyRaw}</span>
                </button>
                <button
                  className="btn-header-action"
                  type="button"
                  title={t.printTitle}
                  aria-label={t.printTitle}
                  onClick={() => window.print()}
                >
                  <Printer size={14} aria-hidden="true" />
                  <span>{t.print}</span>
                </button>
              </div>

              {/* Group 3: Help & Settings */}
              <div className="header-btn-group">
                {viewMode !== "preview" && (
                  <div className="guide-settings-container" ref={guideRef}>
                    <button
                      className={`btn-guide-toggle ${isGuideOpen ? "active" : ""}`}
                      type="button"
                      title={t.guideTitle}
                      aria-label={t.guideTitle}
                      onClick={() => setIsGuideOpen(!isGuideOpen)}
                    >
                      <HelpCircle size={14} aria-hidden="true" />
                      <span>{t.guide}</span>
                    </button>
                    
                    {isGuideOpen && (
                      <div className="guide-dropdown-menu">
                        <div className="dropdown-header">
                          <span>{t.markdownCheatSheet}</span>
                        </div>
                        <div className="guide-scrollable-content">
                          {t.guideRows.map(([syntax, description]) => (
                            <div className="guide-row" key={`${syntax}-${description}`}>
                              <code>{syntax}</code>
                              <span>{description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <SettingsMenu
                  ref={settingsRef}
                  isOpen={isSettingsOpen}
                  language={language}
                  theme={theme}
                  labels={t}
                  onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
                  onLanguageChange={setLanguage}
                  onThemeChange={setTheme}
                  readerOptions={
                    loadedFile
                      ? {
                          fontSize,
                          lineWidth,
                          showOutline,
                          tableWrap,
                          stickyTables,
                          mermaidEnabled,
                          onFontSizeChange: setFontSize,
                          onLineWidthChange: setLineWidth,
                          onShowOutlineChange: setShowOutline,
                          onTableWrapChange: setTableWrap,
                          onStickyTablesChange: setStickyTables,
                          onMermaidEnabledChange: setMermaidEnabled,
                        }
                      : undefined
                  }
                  onAboutOpen={() => {
                    setIsSettingsOpen(false);
                    setIsAboutOpen(true);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="header-btn-group">
              <button
                className="btn-header-action"
                type="button"
                title={t.newFileTitle}
                aria-label={t.newFileTitle}
                onClick={handleNewFile}
              >
                <Plus size={14} aria-hidden="true" />
                <span>{t.newFile}</span>
              </button>
              <SettingsMenu
                ref={settingsRef}
                isOpen={isSettingsOpen}
                language={language}
                theme={theme}
                labels={t}
                onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
                onLanguageChange={setLanguage}
                onThemeChange={setTheme}
                onAboutOpen={() => {
                  setIsSettingsOpen(false);
                  setIsAboutOpen(true);
                }}
              />
            </div>
          )}
        </div>
      </header>

      <section
        className={[
          "document-shell",
          loadedFile && showOutline && viewMode !== "edit" ? "has-outline" : "",
        ].join(" ")}
        aria-label="Markdown preview"
      >
        {loadedFile ? (
          <div className="viewer-content-wrapper">
            {viewMode === "edit" && (
              <div className="editor-pane-full">
                <textarea
                  className="editor-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onContextMenu={openSnippetMenu}
                  placeholder={t.typePlaceholder}
                  spellCheck="false"
                />
              </div>
            )}
            {viewMode === "preview" && (
              <div className="reader-layout">
                {showOutline && (
                  <OutlinePanel
                    headings={headings}
                    activeHeadingId={activeHeadingId}
                    labels={t}
                    onSelect={scrollToHeading}
                  />
                )}
                <div
                  className="viewer-content"
                  onScroll={(event) => updateActiveHeading(event.currentTarget)}
                >
                  <MarkdownPreviewBoundary resetKey={previewContent} labels={t}>
                    <MarkdownViewer {...viewerProps} />
                  </MarkdownPreviewBoundary>
                </div>
              </div>
            )}
            {viewMode === "split" && (
              <div className="reader-layout">
                {showOutline && (
                  <OutlinePanel
                    headings={headings}
                    activeHeadingId={activeHeadingId}
                    labels={t}
                    onSelect={scrollToHeading}
                  />
                )}
                <div className="editor-layout-split">
                  <div className="editor-pane">
                    <textarea
                      ref={splitEditorRef}
                      className="editor-textarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onContextMenu={openSnippetMenu}
                      onScroll={(event) => syncSplitScroll(event.currentTarget)}
                      placeholder={t.typePlaceholder}
                      spellCheck="false"
                    />
                  </div>
                  <div
                    ref={splitPreviewRef}
                    className="preview-pane"
                    onScroll={(event) => {
                      updateActiveHeading(event.currentTarget);
                      syncSplitScroll(event.currentTarget);
                    }}
                  >
                    <MarkdownPreviewBoundary resetKey={previewContent} labels={t}>
                      <MarkdownViewer {...viewerProps} />
                    </MarkdownPreviewBoundary>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <HomeScreen
            recentFiles={recentFiles}
            error={error}
            onLoadFile={(file) => void handleLoadFile(file)}
            onError={setError}
            onBrowseFile={() => void triggerOpenFilePicker()}
            onOpenRecent={(id) => void handleOpenRecent(id)}
            onClearRecent={() => void handleClearRecent()}
            onDeleteRecent={handleDeleteRecent}
            onUpdateRecentPath={handleUpdateRecentPath}
            labels={t}
          />
        )}
      </section>

      {snippetMenu && (
        <div
          className="markdown-snippet-menu"
          style={{ left: snippetMenu.x, top: snippetMenu.y }}
          role="menu"
          aria-label={t.insertMarkdown}
        >
          <div className="markdown-snippet-menu-title">{t.insertMarkdown}</div>
          {snippetOptions.map((snippet) => (
            <button
              key={snippet.id}
              className="markdown-snippet-option"
              type="button"
              role="menuitem"
              onClick={() => insertSnippet(snippet.id)}
            >
              {snippet.icon}
              <span>{snippet.label}</span>
            </button>
          ))}
        </div>
      )}

      <footer className="status-bar">
        {loadedFile ? (
          <>
          <div className="status-left">
            <FileText size={12} className="status-icon" aria-hidden="true" />
            <span className="status-file-name" title={loadedFile.name}>
              {loadedFile.name}
            </span>
            {getDistinctPath(loadedFile.path, loadedFile.name) && (
              <span
                className="status-file-path"
                title={getDistinctPath(loadedFile.path, loadedFile.name)}
              >
                {getDistinctPath(loadedFile.path, loadedFile.name)}
              </span>
            )}
            {isModified && <span className="status-modified-dot" title={t.unsavedChanges}>•</span>}
            {fileRef && <span className="status-sync-badge">{t.syncLive}</span>}
          </div>
          <div className="status-right">
            <span className="status-item">{formatBytes(new Blob([editContent]).size)}</span>
            {loadedFile.lastModified && (
              <>
                <span className="status-divider">|</span>
                <span className="status-item">
                  {t.modified}: {formatDateTime(loadedFile.lastModified)}
                </span>
              </>
            )}
            {stats && (
              <>
                <span className="status-divider">|</span>
                <span className="status-item">{stats.wordCount} {t.words}</span>
                <span className="status-divider">|</span>
                <span className="status-item status-read-time">
                  <Clock3 size={11} aria-hidden="true" />
                  <span>{stats.readTime} {t.minRead}</span>
                </span>
              </>
            )}
          </div>
          </>
        ) : (
          <>
            <div className="status-left" />
            <div className="status-right" />
          </>
        )}
        <div className="status-center" aria-label={t.appName}>
          {t.appName}
        </div>
      </footer>

      {isAboutOpen && (
        <AboutDialog labels={t} onClose={() => setIsAboutOpen(false)} />
      )}
    </main>
  );
}

type SettingsMenuProps = {
  isOpen: boolean;
  language: Language;
  theme: Theme;
  labels: typeof translations.en;
  readerOptions?: {
    fontSize: number;
    lineWidth: number;
    showOutline: boolean;
    tableWrap: boolean;
    stickyTables: boolean;
    mermaidEnabled: boolean;
    onFontSizeChange: (value: number) => void;
    onLineWidthChange: (value: number) => void;
    onShowOutlineChange: (value: boolean) => void;
    onTableWrapChange: (value: boolean) => void;
    onStickyTablesChange: (value: boolean) => void;
    onMermaidEnabledChange: (value: boolean) => void;
  };
  onToggle: () => void;
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: Theme) => void;
  onAboutOpen: () => void;
};

type OutlinePanelProps = {
  headings: HeadingItem[];
  activeHeadingId: string | null;
  labels: typeof translations.en;
  onSelect: (id: string) => void;
};

function OutlinePanel({ headings, activeHeadingId, labels, onSelect }: OutlinePanelProps) {
  return (
    <aside className="outline-panel" aria-label={labels.outline}>
      <div className="outline-panel-header">
        <ListTree size={14} aria-hidden="true" />
        <span>{labels.outline}</span>
      </div>
      {headings.length > 0 ? (
        <nav className="outline-list">
          {headings.map((heading) => (
            <button
              key={`${heading.id}-${heading.text}`}
              className={[
                "outline-item",
                `outline-level-${heading.level}`,
                activeHeadingId === heading.id ? "active" : "",
              ].join(" ")}
              type="button"
              aria-current={activeHeadingId === heading.id ? "location" : undefined}
              onClick={() => onSelect(heading.id)}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      ) : (
        <p className="outline-empty">{labels.noOutline}</p>
      )}
    </aside>
  );
}

const SettingsMenu = React.forwardRef<HTMLDivElement, SettingsMenuProps>(
  (
    {
      isOpen,
      language,
      theme,
      labels,
      readerOptions,
      onToggle,
      onLanguageChange,
      onThemeChange,
      onAboutOpen,
    },
    ref,
  ) => {
    return (
      <div className="settings-container" ref={ref}>
        <button
          className={`btn-settings-toggle ${isOpen ? "active" : ""}`}
          type="button"
          title={labels.settingsTitle}
          aria-label={labels.settingsTitle}
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <Settings size={14} aria-hidden="true" />
          <span>{labels.settings}</span>
        </button>

        {isOpen && (
          <div className="settings-dropdown-menu">
            <div className="dropdown-header settings-dropdown-header">
              <Settings size={14} aria-hidden="true" />
              <span>{labels.settingsHeader}</span>
            </div>

            <div className="dropdown-section">
              <span className="section-label">
                <Languages size={12} aria-hidden="true" />
                {labels.language}
              </span>
              <div className="language-segment">
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`language-option-btn ${language === option.value ? "active" : ""}`}
                    type="button"
                    onClick={() => onLanguageChange(option.value)}
                    aria-pressed={language === option.value}
                  >
                    <span>{option.nativeLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="dropdown-section">
              <span className="section-label">
                <Palette size={12} aria-hidden="true" />
                {labels.theme}
              </span>
              <div className="theme-settings-grid">
                <div className="theme-group">
                  <span className="theme-group-label">{labels.darkThemes}</span>
                  {themeOptions
                    .filter((option) => option.group === "dark")
                    .map((option) => (
                      <button
                        className={`theme-option-btn ${theme === option.value ? "active" : ""}`}
                        type="button"
                        key={option.value}
                        onClick={() => onThemeChange(option.value)}
                        aria-pressed={theme === option.value}
                      >
                        <span className={`color-preview ${option.previewClass}`} />
                        <span>{option.label}</span>
                      </button>
                    ))}
                </div>
                <div className="theme-group">
                  <span className="theme-group-label">{labels.pastelThemes}</span>
                  {themeOptions
                    .filter((option) => option.group === "pastel")
                    .map((option) => (
                      <button
                        className={`theme-option-btn ${theme === option.value ? "active" : ""}`}
                        type="button"
                        key={option.value}
                        onClick={() => onThemeChange(option.value)}
                        aria-pressed={theme === option.value}
                      >
                        <span className={`color-preview ${option.previewClass}`} />
                        <span>{option.label}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {readerOptions && (
              <>
                <div className="dropdown-section">
                  <span className="section-label">
                    <Type size={12} aria-hidden="true" />
                    {labels.readerTools}
                  </span>
                  <label className="range-control">
                    <span>{labels.fontSize}</span>
                    <input
                      type="range"
                      min="14"
                      max="22"
                      value={readerOptions.fontSize}
                      onChange={(event) => readerOptions.onFontSizeChange(Number(event.target.value))}
                    />
                    <strong>{readerOptions.fontSize}px</strong>
                  </label>
                  <label className="range-control">
                    <span>{labels.lineWidth}</span>
                    <input
                      type="range"
                      min="65"
                      max="100"
                      step="5"
                      value={readerOptions.lineWidth}
                      onChange={(event) => readerOptions.onLineWidthChange(Number(event.target.value))}
                    />
                    <strong>{readerOptions.lineWidth}%</strong>
                  </label>
                  <label className="switch-row">
                    <span>
                      <ListTree size={13} aria-hidden="true" />
                      {labels.showOutline}
                    </span>
                    <input
                      type="checkbox"
                      checked={readerOptions.showOutline}
                      onChange={(event) => readerOptions.onShowOutlineChange(event.target.checked)}
                    />
                  </label>
                </div>

                <div className="dropdown-section">
                  <span className="section-label">
                    <Table2 size={12} aria-hidden="true" />
                    {labels.tableTools}
                  </span>
                  <label className="switch-row">
                    <span>
                      <WrapText size={13} aria-hidden="true" />
                      {labels.wrapTables}
                    </span>
                    <input
                      type="checkbox"
                      checked={readerOptions.tableWrap}
                      onChange={(event) => readerOptions.onTableWrapChange(event.target.checked)}
                    />
                  </label>
                  <label className="switch-row">
                    <span>
                      <Table2 size={13} aria-hidden="true" />
                      {labels.stickyTables}
                    </span>
                    <input
                      type="checkbox"
                      checked={readerOptions.stickyTables}
                      onChange={(event) => readerOptions.onStickyTablesChange(event.target.checked)}
                    />
                  </label>
                </div>

                <div className="dropdown-section">
                  <span className="section-label">
                    <FileText size={12} aria-hidden="true" />
                    {labels.markdownExtras}
                  </span>
                  <label className="switch-row">
                    <span>{labels.mermaidDiagrams}</span>
                    <input
                      type="checkbox"
                      checked={readerOptions.mermaidEnabled}
                      onChange={(event) => readerOptions.onMermaidEnabledChange(event.target.checked)}
                    />
                  </label>
                </div>
              </>
            )}

            <button className="about-settings-btn" type="button" onClick={onAboutOpen}>
              <span className="about-settings-icon">
                <Info size={14} aria-hidden="true" />
              </span>
              <span>{labels.about}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  },
);

type AboutDialogProps = {
  labels: typeof translations.en;
  onClose: () => void;
};

function AboutDialog({ labels, onClose }: AboutDialogProps) {
  return (
    <div className="about-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="about-dialog-header">
          <div className="about-dialog-title-row">
            <span className="about-dialog-icon">
              <Info size={18} aria-hidden="true" />
            </span>
            <h2 id="about-dialog-title">{labels.aboutTitle}</h2>
          </div>
          <button
            className="about-dialog-close"
            type="button"
            title={labels.close}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="about-dialog-description">{labels.aboutDescription}</p>

        <dl className="about-dialog-details">
          <div>
            <dt>{labels.creator}</dt>
            <dd>{appCreator}</dd>
          </div>
          <div>
            <dt>{labels.version}</dt>
            <dd>{appVersion}</dd>
          </div>
          <div>
            <dt>{labels.copyright}</dt>
            <dd>Copyright © {copyrightYear} {appCreator}</dd>
          </div>
          <div>
            <dt>{labels.github}</dt>
            <dd>
              <a href={githubUrl} target="_blank" rel="noreferrer">
                <span>{githubUrl}</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

type HomeScreenProps = {
  recentFiles: RecentFile[];
  error: string | null;
  onLoadFile: (file: LoadedFile) => void;
  onError: (message: string) => void;
  onBrowseFile: () => void;
  onOpenRecent: (id: string) => void;
  onClearRecent: () => void;
  onDeleteRecent: (id: string, event: React.MouseEvent) => void;
  onUpdateRecentPath: (id: string, path: string) => Promise<void>;
  labels: typeof translations.en;
};

function HomeScreen({
  recentFiles,
  error,
  onLoadFile,
  onError,
  onBrowseFile,
  onOpenRecent,
  onClearRecent,
  onDeleteRecent,
  onUpdateRecentPath,
  labels,
}: HomeScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempPath, setTempPath] = useState<string>("");

  const handleSavePath = (id: string) => {
    void onUpdateRecentPath(id, tempPath);
    setEditingId(null);
  };

  return (
    <section className="home-screen" aria-label="Markdown viewer home">
      <div className="home-hero">
        <div className="hero-badge">
          <MonitorCheck size={14} aria-hidden="true" />
          <span>{labels.heroBadge}</span>
        </div>
        <p className="eyebrow">{labels.eyebrow}</p>
        <h2>{labels.heroTitle}</h2>
        <p className="hero-description">
          {labels.heroDescription}
        </p>
        <FileLoader
          onLoad={onLoadFile}
          onError={onError}
          onBrowse={onBrowseFile}
          variant="hero"
          labels={labels.fileLoader}
        />
        {error && <p className="home-error">{error}</p>}
      </div>

      <div className="recent-panel">
        <div className="recent-header">
          <div className="recent-header-text">
            <span className="status-label">{labels.recentDocuments}</span>
            <strong>{recentFiles.length ? labels.savedOnDevice : labels.noRecentItems}</strong>
          </div>
          {recentFiles.length > 0 && (
            <button className="btn-clear-recent" type="button" onClick={onClearRecent}>
              <Eraser size={14} aria-hidden="true" />
              <span>{labels.clearHistory}</span>
            </button>
          )}
        </div>

        {recentFiles.length > 0 ? (
          <div className="recent-list">
            {recentFiles.map((file) => (
              <div
                className="recent-item"
                key={file.id}
                onClick={() => onOpenRecent(file.id)}
              >
                <div className="recent-item-left">
                  <FileText className="recent-item-icon" size={18} aria-hidden="true" />
                  <div className="recent-item-details">
                    <span className="recent-name">{file.name}</span>
                    {editingId === file.id ? (
                      <div className="recent-path-edit" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="recent-path-input"
                          value={tempPath}
                          onChange={(e) => setTempPath(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSavePath(file.id);
                            else if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          placeholder={labels.editLocationPlaceholder}
                        />
                        <button
                          type="button"
                          className="btn-save-path"
                          title={labels.saveLocation}
                          onClick={() => handleSavePath(file.id)}
                        >
                          <Check size={12} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn-cancel-path"
                          title={labels.cancelLocation}
                          onClick={() => setEditingId(null)}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="recent-path-row">
                        <span
                          className={`recent-path ${!file.path ? "recent-path-empty" : ""}`}
                          title={file.path || labels.noLocation}
                        >
                          {labels.location}: {file.path || labels.noLocation}
                        </span>
                        <button
                          type="button"
                          className="btn-edit-path"
                          title={labels.editLocation}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(file.id);
                            setTempPath(file.path || "");
                          }}
                        >
                          <Edit3 size={11} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    <div className="recent-meta-list">
                      <span>{formatBytes(file.size)}</span>
                      <span>{labels.opened}: {formatDateTime(file.openedAt)}</span>
                      <span>
                        {labels.modified}: {formatDateTime(file.lastModified) || labels.modifiedUnknown}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="recent-actions">
                  <button
                    className="btn-delete-recent"
                    type="button"
                    title={labels.removeFromHistory}
                    onClick={(event) => onDeleteRecent(file.id, event)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                  <ChevronRight className="recent-arrow" size={16} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="recent-empty-container">
            <p className="recent-empty">
              {labels.recentEmpty}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default App;
