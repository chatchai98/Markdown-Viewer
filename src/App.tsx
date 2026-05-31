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
  Save,
  Download,
  Eye,
  Edit3,
  Columns,
  HelpCircle,
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
} from "./utils/recentFiles";

type LoadedFile = {
  name: string;
  size: number;
  content: string;
};

type Theme =
  | "midnight-dark"
  | "forest-dark"
  | "cyber-dark"
  | "lavender-pastel"
  | "sage-pastel"
  | "rose-pastel";

type ViewMode = "edit" | "preview" | "split";

function App() {
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [theme, setTheme] = useState<Theme>("lavender-pastel");
  const [error, setError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
  const headerInputRef = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);

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
  }, []);

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

  async function handleLoadFile(file: LoadedFile, handle: FileSystemFileHandle | null = null) {
    setLoadedFile(file);
    setEditContent(file.content);
    setFileHandle(handle);
    setError(null);
    setViewMode("preview");
    setSaveStatus("idle");

    try {
      setRecentFiles(await saveRecentFile(file));
    } catch {
      setError("Opened file, but could not save it to recent files.");
    }
  }

  async function handleOpenRecent(id: string) {
    try {
      const file = await openRecentFile(id);
      if (!file) {
        setError("This recent file is no longer available.");
        setRecentFiles(getRecentFiles().filter((item) => item.id !== id));
        return;
      }

      await handleLoadFile(file, null);
    } catch {
      setError("Could not open this recent file.");
    }
  }

  async function handleClearRecent() {
    try {
      await clearRecentFiles();
      setRecentFiles([]);
      setError(null);
    } catch {
      setError("Could not clear recent files.");
    }
  }

  async function handleDeleteRecent(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    try {
      const nextRecent = await deleteRecentFile(id);
      setRecentFiles(nextRecent);
      setError(null);
    } catch {
      setError("Could not delete this recent file.");
    }
  }

  async function handleCopyRaw() {
    if (!loadedFile) return;
    try {
      await navigator.clipboard.writeText(editContent);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1500);
    } catch {
      setError("Failed to copy raw text.");
    }
  }

  async function triggerOpenFilePicker() {
    try {
      const win = window as any;
      if ("showOpenFilePicker" in win) {
        const [handle] = await win.showOpenFilePicker({
          types: [{
            description: "Markdown Files",
            accept: {
              "text/markdown": [".md", ".markdown"],
              "text/plain": [".txt"]
            }
          }]
        });
        const file = await handle.getFile();
        const content = await file.text();
        void handleLoadFile({ name: file.name, size: file.size, content }, handle);
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

        const sizeBytes = new Blob([editContent]).size;
        setLoadedFile({
          ...loadedFile,
          content: editContent,
          size: sizeBytes,
        });

        const updatedRecent = await saveRecentFile({
          name: loadedFile.name,
          size: sizeBytes,
          content: editContent,
        });
        setRecentFiles(updatedRecent);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        await handleSaveAsFile();
      }
    } catch (err) {
      setSaveStatus("error");
      setError("Could not save the file directly. Try Save As.");
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
              description: "Markdown Files",
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
        
        const sizeBytes = new Blob([editContent]).size;
        setLoadedFile({
          name: handle.name,
          size: sizeBytes,
          content: editContent,
        });

        const updatedRecent = await saveRecentFile({
          name: handle.name,
          size: sizeBytes,
          content: editContent,
        });
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
      const confirm = window.confirm("You have unsaved changes. Are you sure you want to go back?");
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
              void handleLoadFile({ name: file.name, size: file.size, content }, null);
            }).catch(() => {
              setError("Could not read this file.");
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
              title="Back to Home"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back</span>
            </button>
          ) : null}
          <div className="app-logo">
            <h1>Markdown Viewer</h1>
          </div>
        </div>

        {loadedFile && (
          <>
            <div className="header-view-toggle">
              <button
                className={`btn-toggle-view ${viewMode === "edit" ? "active" : ""}`}
                type="button"
                title="Editor Mode"
                onClick={() => setViewMode("edit")}
              >
                <Edit3 size={13} aria-hidden="true" />
                <span>Editor</span>
              </button>
              <button
                className={`btn-toggle-view ${viewMode === "split" ? "active" : ""}`}
                type="button"
                title="Split Mode"
                onClick={() => setViewMode("split")}
              >
                <Columns size={13} aria-hidden="true" />
                <span>Split</span>
              </button>
              <button
                className={`btn-toggle-view ${viewMode === "preview" ? "active" : ""}`}
                type="button"
                title="Preview Mode"
                onClick={() => setViewMode("preview")}
              >
                <Eye size={13} aria-hidden="true" />
                <span>Preview</span>
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
                  title="Open another file"
                  onClick={() => void triggerOpenFilePicker()}
                >
                  <FileUp size={14} aria-hidden="true" />
                  <span>Open</span>
                </button>
                <button
                  className={`btn-header-action btn-save ${isModified ? "modified" : ""} ${saveStatus === "saved" ? "saved" : ""}`}
                  type="button"
                  title="Save changes (Ctrl+S)"
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
                      ? "Saving..."
                      : saveStatus === "saved"
                      ? "Saved"
                      : saveStatus === "error"
                      ? "Error"
                      : "Save"}
                  </span>
                </button>
                <button
                  className="btn-header-action"
                  type="button"
                  title="Save file as..."
                  onClick={() => void handleSaveAsFile()}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>Save As</span>
                </button>
              </div>

              {/* Group 2: Document Actions */}
              <div className="header-btn-group">
                <button
                  className={copiedRaw ? "btn-header-action copied" : "btn-header-action"}
                  type="button"
                  title="Copy Raw Markdown"
                  onClick={() => void handleCopyRaw()}
                >
                  {copiedRaw ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  <span>{copiedRaw ? "Copied" : "Copy Raw"}</span>
                </button>
                <button
                  className="btn-header-action"
                  type="button"
                  title="Print to PDF"
                  onClick={() => window.print()}
                >
                  <Printer size={14} aria-hidden="true" />
                  <span>Print</span>
                </button>
              </div>

              {/* Group 3: Help & Settings */}
              <div className="header-btn-group">
                {viewMode !== "preview" && (
                  <div className="guide-settings-container" ref={guideRef}>
                    <button
                      className={`btn-guide-toggle ${isGuideOpen ? "active" : ""}`}
                      type="button"
                      title="Markdown Syntax Guide"
                      onClick={() => setIsGuideOpen(!isGuideOpen)}
                    >
                      <HelpCircle size={14} aria-hidden="true" />
                      <span>Guide</span>
                    </button>
                    
                    {isGuideOpen && (
                      <div className="guide-dropdown-menu">
                        <div className="dropdown-header">
                          <span>Markdown Cheat Sheet</span>
                        </div>
                        <div className="guide-scrollable-content">
                          <div className="guide-row">
                            <code># หัวข้อ 1</code>
                            <span>Heading ใหญ่สุด</span>
                          </div>
                          <div className="guide-row">
                            <code>## หัวข้อ 2</code>
                            <span>Heading ขนาดกลาง</span>
                          </div>
                          <div className="guide-row">
                            <code>### หัวข้อ 3</code>
                            <span>Heading ขนาดเล็ก</span>
                          </div>
                          <div className="guide-row">
                            <code>**ตัวหนา**</code>
                            <span>ข้อความตัวหนา</span>
                          </div>
                          <div className="guide-row">
                            <code>*ตัวเอียง*</code>
                            <span>ข้อความตัวเอียง</span>
                          </div>
                          <div className="guide-row">
                            <code>[ชื่อลิงก์](URL)</code>
                            <span>สร้างลิงก์เชื่อมโยง</span>
                          </div>
                          <div className="guide-row">
                            <code>- รายการ</code>
                            <span>รายการหัวข้อหลัก</span>
                          </div>
                          <div className="guide-row">
                            <code>1. รายการ</code>
                            <span>รายการแบบลำดับเลข</span>
                          </div>
                          <div className="guide-row">
                            <code>[ ] งานย่อย</code>
                            <span>สร้าง Checklist</span>
                          </div>
                          <div className="guide-row">
                            <code>&gt; ข้อความอ้างอิง</code>
                            <span>กล่องคำพูด (Quote)</span>
                          </div>
                          <div className="guide-row">
                            <code>`โค้ด`</code>
                            <span>โค้ดบรรทัดเดียว</span>
                          </div>
                          <div className="guide-row">
                            <code>```ภาษา...```</code>
                            <span>โค้ดบล็อกหลายบรรทัด</span>
                          </div>
                          <div className="guide-row">
                            <code>| คอลัมน์ |</code>
                            <span>สร้างตารางข้อมูล</span>
                          </div>
                          <div className="guide-row">
                            <code>```mermaid...```</code>
                            <span>เรนเดอร์ชาร์ต/ไดอะแกรม</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="theme-settings-container" ref={settingsRef}>
                  <button
                    className={`btn-theme-toggle ${isSettingsOpen ? "active" : ""}`}
                    type="button"
                    title="Choose Theme"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  >
                    <Palette size={14} aria-hidden="true" />
                  </button>
                  
                  {isSettingsOpen && (
                    <div className="theme-dropdown-menu">
                      <div className="dropdown-header">
                        <span>Color Themes</span>
                      </div>
                      
                      <div className="dropdown-section">
                        <span className="section-label">Dark Themes</span>
                        <div className="theme-grid">
                          <button
                            className={`theme-option-btn ${theme === "midnight-dark" ? "active" : ""}`}
                            type="button"
                            onClick={() => { setTheme("midnight-dark"); setIsSettingsOpen(false); }}
                          >
                            <span className="color-preview midnight-preview" />
                            <span>Midnight</span>
                          </button>
                          <button
                            className={`theme-option-btn ${theme === "forest-dark" ? "active" : ""}`}
                            type="button"
                            onClick={() => { setTheme("forest-dark"); setIsSettingsOpen(false); }}
                          >
                            <span className="color-preview forest-preview" />
                            <span>Forest</span>
                          </button>
                          <button
                            className={`theme-option-btn ${theme === "cyber-dark" ? "active" : ""}`}
                            type="button"
                            onClick={() => { setTheme("cyber-dark"); setIsSettingsOpen(false); }}
                          >
                            <span className="color-preview cyber-preview" />
                            <span>Cyber</span>
                          </button>
                        </div>
                      </div>
                      
                      <div className="dropdown-section">
                        <span className="section-label">Pastel Themes</span>
                        <div className="theme-grid">
                          <button
                            className={`theme-option-btn ${theme === "lavender-pastel" ? "active" : ""}`}
                            type="button"
                            onClick={() => { setTheme("lavender-pastel"); setIsSettingsOpen(false); }}
                          >
                            <span className="color-preview lavender-preview" />
                            <span>Lavender</span>
                          </button>
                          <button
                            className={`theme-option-btn ${theme === "sage-pastel" ? "active" : ""}`}
                            type="button"
                            onClick={() => { setTheme("sage-pastel"); setIsSettingsOpen(false); }}
                          >
                            <span className="color-preview sage-preview" />
                            <span>Sage Mint</span>
                          </button>
                          <button
                            className={`theme-option-btn ${theme === "rose-pastel" ? "active" : ""}`}
                            type="button"
                            onClick={() => { setTheme("rose-pastel"); setIsSettingsOpen(false); }}
                          >
                            <span className="color-preview rose-preview" />
                            <span>Rose Quartz</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="header-btn-group">
              <div className="theme-settings-container" ref={settingsRef}>
                <button
                  className={`btn-theme-toggle ${isSettingsOpen ? "active" : ""}`}
                  type="button"
                  title="Choose Theme"
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                >
                  <Palette size={14} aria-hidden="true" />
                </button>
                
                {isSettingsOpen && (
                  <div className="theme-dropdown-menu">
                    <div className="dropdown-header">
                      <span>Color Themes</span>
                    </div>
                    
                    <div className="dropdown-section">
                      <span className="section-label">Dark Themes</span>
                      <div className="theme-grid">
                        <button
                          className={`theme-option-btn ${theme === "midnight-dark" ? "active" : ""}`}
                          type="button"
                          onClick={() => { setTheme("midnight-dark"); setIsSettingsOpen(false); }}
                        >
                          <span className="color-preview midnight-preview" />
                          <span>Midnight</span>
                        </button>
                        <button
                          className={`theme-option-btn ${theme === "forest-dark" ? "active" : ""}`}
                          type="button"
                          onClick={() => { setTheme("forest-dark"); setIsSettingsOpen(false); }}
                        >
                          <span className="color-preview forest-preview" />
                          <span>Forest</span>
                        </button>
                        <button
                          className={`theme-option-btn ${theme === "cyber-dark" ? "active" : ""}`}
                          type="button"
                          onClick={() => { setTheme("cyber-dark"); setIsSettingsOpen(false); }}
                        >
                          <span className="color-preview cyber-preview" />
                          <span>Cyber</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="dropdown-section">
                      <span className="section-label">Pastel Themes</span>
                      <div className="theme-grid">
                        <button
                          className={`theme-option-btn ${theme === "lavender-pastel" ? "active" : ""}`}
                          type="button"
                          onClick={() => { setTheme("lavender-pastel"); setIsSettingsOpen(false); }}
                        >
                          <span className="color-preview lavender-preview" />
                          <span>Lavender</span>
                        </button>
                        <button
                          className={`theme-option-btn ${theme === "sage-pastel" ? "active" : ""}`}
                          type="button"
                          onClick={() => { setTheme("sage-pastel"); setIsSettingsOpen(false); }}
                        >
                          <span className="color-preview sage-preview" />
                          <span>Sage Mint</span>
                        </button>
                        <button
                          className={`theme-option-btn ${theme === "rose-pastel" ? "active" : ""}`}
                          type="button"
                          onClick={() => { setTheme("rose-pastel"); setIsSettingsOpen(false); }}
                        >
                          <span className="color-preview rose-preview" />
                          <span>Rose Quartz</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                  placeholder="Type your markdown here..."
                  spellCheck="false"
                />
              </div>
            )}
            {viewMode === "preview" && (
              <div className="viewer-content">
                <MarkdownViewer markdown={editContent} />
              </div>
            )}
            {viewMode === "split" && (
              <div className="editor-layout-split">
                <div className="editor-pane">
                  <textarea
                    className="editor-textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Type your markdown here..."
                    spellCheck="false"
                  />
                </div>
                <div className="preview-pane">
                  <MarkdownViewer markdown={editContent} />
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
            {isModified && <span className="status-modified-dot" title="Unsaved changes">•</span>}
          </div>
          <div className="status-right">
            <span className="status-item">{formatBytes(new Blob([editContent]).size)}</span>
            {stats && (
              <>
                <span className="status-divider">|</span>
                <span className="status-item">{stats.wordCount} words</span>
                <span className="status-divider">|</span>
                <span className="status-item status-read-time">
                  <Clock3 size={11} aria-hidden="true" />
                  <span>{stats.readTime} min read</span>
                </span>
              </>
            )}
          </div>
        </footer>
      )}
    </main>
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
};

function HomeScreen({
  recentFiles,
  error,
  onLoadFile,
  onError,
  onOpenRecent,
  onClearRecent,
  onDeleteRecent,
}: HomeScreenProps) {
  return (
    <section className="home-screen" aria-label="Markdown viewer home">
      <div className="home-hero">
        <div className="hero-badge">
          <MonitorCheck size={14} aria-hidden="true" />
          <span>Offline-first Markdown reader</span>
        </div>
        <p className="eyebrow">Local workspace</p>
        <h2>Open a Markdown file</h2>
        <p className="hero-description">
          All processing happens locally on your computer. Your files never touch the cloud, providing complete privacy and secure offline viewing.
        </p>
        <FileLoader onLoad={onLoadFile} onError={onError} variant="hero" />
        {error && <p className="home-error">{error}</p>}
      </div>

      <div className="recent-panel">
        <div className="recent-header">
          <div className="recent-header-text">
            <span className="status-label">Recent documents</span>
            <strong>{recentFiles.length ? "Saved on this device" : "No recent items"}</strong>
          </div>
          {recentFiles.length > 0 && (
            <button className="btn-clear-recent" type="button" onClick={onClearRecent}>
              <Eraser size={14} aria-hidden="true" />
              <span>Clear History</span>
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
                    <span className="recent-meta">
                      {formatBytes(file.size)} • {new Date(file.openedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="recent-actions">
                  <button
                    className="btn-delete-recent"
                    type="button"
                    title="Remove from history"
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
              No files opened recently. Your viewing history will be shown here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default App;
