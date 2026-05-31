import { DragEvent, useRef, useState } from "react";
import { FileUp } from "lucide-react";

type LoadedFile = {
  name: string;
  size: number;
  content: string;
};

type FileLoaderProps = {
  onLoad: (file: LoadedFile) => void;
  onError: (message: string) => void;
  variant?: "compact" | "hero";
  labels?: {
    unsupportedFile: string;
    readError: string;
    dragDrop: string;
    supports: string;
    or: string;
    browse: string;
    openNewFile: string;
    dropFileHere: string;
  };
};

const acceptedExtensions = [".md", ".markdown", ".txt"];

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return acceptedExtensions.some((extension) => lowerName.endsWith(extension));
}

export function FileLoader({
  onLoad,
  onError,
  variant = "compact",
  labels = {
    unsupportedFile: "Only .md, .markdown, and .txt files are supported.",
    readError: "Could not read this file.",
    dragDrop: "Drag & drop your Markdown file",
    supports: "Supports .md, .markdown, or .txt files",
    or: "or",
    browse: "Browse Files",
    openNewFile: "Open new file",
    dropFileHere: "or drop file here",
  },
}: FileLoaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function loadFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isAcceptedFile(file)) {
      onError(labels.unsupportedFile);
      return;
    }

    try {
      const content = await file.text();
      onLoad({ name: file.name, size: file.size, content });
    } catch {
      onError(labels.readError);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files[0]);
  }

  return (
    <div
      className={[
        "drop-zone",
        `drop-zone-${variant}`,
        isDragging ? "is-dragging" : "",
      ].join(" ")}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        onChange={(event) => void loadFile(event.target.files?.[0])}
      />
      {variant === "hero" ? (
        <div className="drop-zone-content">
          <div className="drop-icon-wrapper">
            <FileUp className="drop-zone-icon" size={32} aria-hidden="true" />
          </div>
          <h3>{labels.dragDrop}</h3>
          <p className="drop-zone-tip">{labels.supports}</p>
          <div className="drop-divider">
            <span>{labels.or}</span>
          </div>
          <button type="button" className="btn-browse" onClick={() => inputRef.current?.click()}>
            {labels.browse}
          </button>
        </div>
      ) : (
        <div className="drop-zone-sidebar-content">
          <button type="button" className="btn-sidebar-open" onClick={() => inputRef.current?.click()}>
            <FileUp size={16} aria-hidden="true" />
            <span>{labels.openNewFile}</span>
          </button>
          <span className="sidebar-drop-tip">{labels.dropFileHere}</span>
        </div>
      )}
    </div>
  );
}
