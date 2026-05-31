import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Eraser,
  FileText,
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

type Theme =
  | "midnight-dark"
  | "forest-dark"
  | "cyber-dark"
  | "lavender-pastel"
  | "sage-pastel"
  | "rose-pastel";

type ViewMode = "edit" | "preview" | "split";
type Language = "en" | "th";

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

const appVersion = "0.1.0";
const githubUrl = "https://github.com/chatchai98/Markdown-Viewer";
const appCreator = "chatchai98";
const copyrightYear = "2026";

function getDisplayPath(file: File, handle?: FileSystemFileHandle | null) {
  const fileWithPath = file as File & { path?: string };
  return fileWithPath.path || file.webkitRelativePath || undefined;
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

function App() {
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [theme, setTheme] = useState<Theme>("lavender-pastel");
  const [language, setLanguage] = useState<Language>("en");
  const [error, setError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  const headerInputRef = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const t = translations[language];

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

  useEffect(() => {
    setRecentFiles(getRecentFiles());
    const storedLanguage = localStorage.getItem("markdown-viewer:language");
    if (storedLanguage === "en" || storedLanguage === "th") {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("markdown-viewer:language", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (guideRef.current && !guideRef.current.contains(event.target as Node)) {
        setIsGuideOpen(false);
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
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadedFile, editContent, fileHandle]);

  useEffect(() => {
    if (!loadedFile || !fileHandle) {
      return;
    }

    const activeFile = loadedFile;
    const activeHandle = fileHandle;
    let isCurrent = true;

    async function syncExternalChanges() {
      try {
        const diskFile = await activeHandle.getFile();
        if (!isCurrent || diskFile.lastModified === activeFile.lastModified) {
          return;
        }

        const nextContent = await diskFile.text();
        const nextFile = {
          id: activeFile.id,
          name: diskFile.name,
          path: getDisplayPath(diskFile, activeHandle),
          size: diskFile.size,
          content: nextContent,
          lastModified: diskFile.lastModified,
        };

        if (editContent !== activeFile.content) {
          setError(t.externalChangeConflict);
          setLoadedFile((current) =>
            current ? { ...current, lastModified: diskFile.lastModified } : current,
          );
          return;
        }

        setLoadedFile(nextFile);
        setEditContent(nextContent);
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
  }, [loadedFile, editContent, fileHandle, t.externalChangeConflict, t.syncedFromDisk]);

  async function handleLoadFile(file: LoadedFile, handle: FileSystemFileHandle | null = null) {
    const fileId = file.id || createFileId(file.name, file.path, file.size, file.content, file.lastModified);
    const fileWithId = { ...file, id: fileId };

    setLoadedFile(fileWithId);
    setEditContent(file.content);
    setFileHandle(handle);
    setError(null);
    setViewMode("preview");
    setSaveStatus("idle");

    try {
      setRecentFiles(await saveRecentFile(fileWithId));
    } catch {
      setError(t.openedButRecentFailed);
    }
  }

  async function handleOpenRecent(id: string) {
    try {
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

  async function triggerOpenFilePicker() {
    try {
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
          path: getDisplayPath(file, handle),
          size: file.size,
          content,
          lastModified: file.lastModified,
        }, handle);
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
      if (fileHandle) {
        const handleAny = fileHandle as any;
        const opts = { mode: "readwrite" as const };
        if (typeof handleAny.queryPermission === "function" && (await handleAny.queryPermission(opts)) !== "granted") {
          if (typeof handleAny.requestPermission === "function" && (await handleAny.requestPermission(opts)) !== "granted") {
            throw new Error("Write permission denied.");
          }
        }

        const writable = await handleAny.createWritable();
        await writable.write(editContent);
        await writable.close();

        const savedFile = await fileHandle.getFile();
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

        setFileHandle(handle);
        
        const savedFile = await handle.getFile();
        const sizeBytes = savedFile.size;
        const path = getDisplayPath(savedFile, handle);
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
    setFileHandle(null);
  }

  return (
    <main className="app" data-theme={theme}>
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
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t.back}</span>
            </button>
          ) : null}
          <div className="app-logo">
            <h1>{t.appName}</h1>
          </div>
        </div>

        {loadedFile && (
          <>
            <div className="header-view-toggle">
              <button
                className={`btn-toggle-view ${viewMode === "edit" ? "active" : ""}`}
                type="button"
                title={t.editTitle}
                onClick={() => setViewMode("edit")}
              >
                <Edit3 size={13} aria-hidden="true" />
                <span>{t.edit}</span>
              </button>
              <button
                className={`btn-toggle-view ${viewMode === "split" ? "active" : ""}`}
                type="button"
                title={t.splitTitle}
                onClick={() => setViewMode("split")}
              >
                <Columns size={13} aria-hidden="true" />
                <span>{t.split}</span>
              </button>
              <button
                className={`btn-toggle-view ${viewMode === "preview" ? "active" : ""}`}
                type="button"
                title={t.previewTitle}
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
              {/* Group 1: File Actions */}
              <div className="header-btn-group">
                <button
                  className="btn-header-action"
                  type="button"
                  title={t.openTitle}
                  onClick={() => void triggerOpenFilePicker()}
                >
                  <FileUp size={14} aria-hidden="true" />
                  <span>{t.open}</span>
                </button>
                <button
                  className={`btn-header-action btn-save ${isModified ? "modified" : ""} ${saveStatus === "saved" ? "saved" : ""}`}
                  type="button"
                  title={t.saveTitle}
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
                  onClick={() => void handleSaveAsFile()}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>{t.saveAs}</span>
                </button>
              </div>

              {/* Group 2: Document Actions */}
              <div className="header-btn-group">
                <button
                  className={copiedRaw ? "btn-header-action copied" : "btn-header-action"}
                  type="button"
                  title={t.copyRawTitle}
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
                  onAboutOpen={() => {
                    setIsSettingsOpen(false);
                    setIsAboutOpen(true);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="header-btn-group">
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

      <section className="document-shell" aria-label="Markdown preview">
        {loadedFile ? (
          <div className="viewer-content-wrapper">
            {viewMode === "edit" && (
              <div className="editor-pane-full">
                <textarea
                  className="editor-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder={t.typePlaceholder}
                  spellCheck="false"
                />
              </div>
            )}
            {viewMode === "preview" && (
              <div className="viewer-content">
                <MarkdownViewer markdown={editContent} labels={t.markdownViewer} />
              </div>
            )}
            {viewMode === "split" && (
              <div className="editor-layout-split">
                <div className="editor-pane">
                  <textarea
                    className="editor-textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder={t.typePlaceholder}
                    spellCheck="false"
                  />
                </div>
                <div className="preview-pane">
                  <MarkdownViewer markdown={editContent} labels={t.markdownViewer} />
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
            onOpenRecent={(id) => void handleOpenRecent(id)}
            onClearRecent={() => void handleClearRecent()}
            onDeleteRecent={handleDeleteRecent}
            onUpdateRecentPath={handleUpdateRecentPath}
            labels={t}
          />
        )}
      </section>

      {loadedFile && (
        <footer className="status-bar">
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
            {fileHandle && <span className="status-sync-badge">{t.syncLive}</span>}
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
        </footer>
      )}

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
  onToggle: () => void;
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: Theme) => void;
  onAboutOpen: () => void;
};

const SettingsMenu = React.forwardRef<HTMLDivElement, SettingsMenuProps>(
  (
    {
      isOpen,
      language,
      theme,
      labels,
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
        <FileLoader onLoad={onLoadFile} onError={onError} variant="hero" labels={labels.fileLoader} />
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
