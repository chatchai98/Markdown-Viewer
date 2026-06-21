import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Default sanitize schema strips data-* attributes, which removes the
// data-heading-id used by the outline panel to locate and scroll to headings.
// Allow all (inert) data attributes so outline navigation works.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "data*"],
  },
};
import { CodeBlock } from "./CodeBlock";

type MarkdownViewerProps = {
  markdown: string;
  searchQuery?: string;
  activeSearchIndex?: number;
  fontSize?: number;
  lineWidth?: number;
  tableWrap?: boolean;
  stickyTables?: boolean;
  mermaidEnabled?: boolean;
  sourcePath?: string;
  labels?: {
    blockedRemoteImage: string;
    copy: string;
    copied: string;
    mermaid: string;
    mermaidError: string;
    copyCsv?: string;
    csvCopied?: string;
    csvCopyFailed?: string;
    mermaidDisabled?: string;
  };
};

function isRemoteUrl(src: string | undefined) {
  return Boolean(src && /^https?:\/\//i.test(src));
}

function isInlineOrAbsoluteUrl(src: string | undefined) {
  return Boolean(src && /^(data|blob|file):/i.test(src));
}

function getTableColumnCount(children: ReactNode): number {
  let columnCount = 0;

  function visit(node: ReactNode) {
    if (columnCount > 0 || !isValidElement<{ children?: ReactNode }>(node)) {
      return;
    }

    if (node.type === "tr") {
      columnCount = Children.toArray(node.props.children).filter(
        (child) => isValidElement(child) && (child.type === "th" || child.type === "td"),
      ).length;
      return;
    }

    Children.forEach(node.props.children, visit);
  }

  Children.forEach(children, visit);
  return columnCount;
}

function getPlainText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return getPlainText(child.props.children);
      }

      return "";
    })
    .join("");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function copyTableAsCsv(button: HTMLButtonElement) {
  const table = button.closest(".markdown-table-shell")?.querySelector("table");
  if (!table) {
    return "";
  }

  const rows = Array.from(table.querySelectorAll("tr"));
  return rows
    .map((row) =>
      Array.from(row.querySelectorAll("th,td"))
        .map((cell) => {
          const value = cell.textContent?.trim().replace(/\s+/g, " ") ?? "";
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");
}

function getHtmlAttribute(attributes: string, name: string) {
  const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function decodeBasicHtml(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeMarkdownAlt(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function htmlImagesToMarkdown(value: string) {
  return value.replace(/<img\s+([^>]*?)\/?>/gi, (tag, attributes: string) => {
    const src = decodeBasicHtml(getHtmlAttribute(attributes, "src"));
    if (!src) {
      return tag;
    }

    const alt = escapeMarkdownAlt(decodeBasicHtml(getHtmlAttribute(attributes, "alt")));
    const width = getHtmlAttribute(attributes, "width");
    const title = width ? ` "width=${width}"` : "";
    return `![${alt}](<${src}>${title})`;
  });
}

function getImageStyle(title: string | null | undefined): CSSProperties | undefined {
  const width = /^width=([\w.%+-]+)$/i.exec(title ?? "")?.[1];
  return width ? { width: /^\d+$/.test(width) ? `${width}px` : width, maxWidth: "100%" } : undefined;
}

function getSearchRanges(article: HTMLElement, query: string) {
  const matcher = query.toLowerCase();
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.toLowerCase().includes(matcher)) {
        return NodeFilter.FILTER_REJECT;
      }

      const parent = node.parentElement;
      if (!parent || parent.closest("button, textarea, input, .code-card, .diagram-card")) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent ?? "";
    const lowerText = text.toLowerCase();
    let foundAt = lowerText.indexOf(matcher);
    while (foundAt !== -1) {
      const range = document.createRange();
      range.setStart(textNode, foundAt);
      range.setEnd(textNode, foundAt + query.length);
      ranges.push(range);
      foundAt = lowerText.indexOf(matcher, foundAt + query.length);
    }
  }

  return ranges;
}

function LocalMarkdownImage({
  markdownPath,
  src,
  alt,
  style,
}: {
  markdownPath: string;
  src: string;
  alt: string;
  style?: CSSProperties;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setResolvedSrc(null);
    setFailed(false);

    const readAsset = window.markdownViewerDesktop?.readAsset;
    if (!readAsset) {
      setFailed(true);
      return () => {
        isCurrent = false;
      };
    }

    void readAsset(markdownPath, src)
      .then((assetSrc) => {
        if (!isCurrent) {
          return;
        }
        if (assetSrc) {
          setResolvedSrc(assetSrc);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setFailed(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [markdownPath, src]);

  if (resolvedSrc) {
    return <img src={resolvedSrc} alt={alt} style={style} />;
  }

  if (failed) {
    return <span className="blocked-media">{alt || src}</span>;
  }

  return <span className="blocked-media">{alt || src}</span>;
}

export function MarkdownViewer({
  markdown,
  searchQuery = "",
  activeSearchIndex = 0,
  fontSize = 16,
  lineWidth = 95,
  tableWrap = false,
  stickyTables = true,
  mermaidEnabled = true,
  sourcePath,
  labels = {
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
}: MarkdownViewerProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const normalizedMarkdown = htmlImagesToMarkdown(markdown);

  useEffect(() => {
    const article = articleRef.current;
    const query = searchQuery.trim();
    const highlightApi = CSS as typeof CSS & {
      highlights?: Map<string, Highlight>;
    };
    highlightApi.highlights?.delete("markdown-search");
    highlightApi.highlights?.delete("markdown-search-active");
    if (!article || query.length < 2 || !highlightApi.highlights || typeof Highlight === "undefined") {
      return;
    }

    try {
      const ranges = getSearchRanges(article, query);
      const activeRange = ranges[activeSearchIndex];
      const inactiveRanges = ranges.filter((_, index) => index !== activeSearchIndex);
      highlightApi.highlights.set("markdown-search", new Highlight(...inactiveRanges));
      if (activeRange) {
        highlightApi.highlights.set("markdown-search-active", new Highlight(activeRange));
        const rect = activeRange.getBoundingClientRect();
        if (rect.width || rect.height) {
          const scrollPane = article.closest<HTMLElement>(".viewer-content, .preview-pane");
          if (scrollPane) {
            const paneRect = scrollPane.getBoundingClientRect();
            scrollPane.scrollTo({
              top: scrollPane.scrollTop + rect.top - paneRect.top - scrollPane.clientHeight / 3,
              behavior: "smooth",
            });
          }
        }
      }
    } catch (error) {
      console.warn("Search highlighting failed", error);
    }

    return () => {
      highlightApi.highlights?.delete("markdown-search");
      highlightApi.highlights?.delete("markdown-search-active");
    };
  }, [activeSearchIndex, normalizedMarkdown, searchQuery]);

  const articleStyle = {
    "--markdown-font-size": `${fontSize}px`,
    "--markdown-line-width": `${lineWidth}%`,
  } as CSSProperties;
  const usedHeadingIds = new Map<string, number>();
  const headingIdCache = new WeakMap<object, string>();

  // React (StrictMode) renders each heading component twice in development.
  // Cache the id by AST node so the second pass reuses it instead of
  // bumping the counter again, which would desync ids from the outline panel.
  function getHeadingId(text: string, node: unknown) {
    if (node && typeof node === "object") {
      const cached = headingIdCache.get(node);
      if (cached) {
        return cached;
      }
    }

    const baseId = slugify(text) || "section";
    const count = usedHeadingIds.get(baseId) ?? 0;
    usedHeadingIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    if (node && typeof node === "object") {
      headingIdCache.set(node, id);
    }

    return id;
  }

  return (
    <article
      ref={articleRef}
      className={[
        "markdown-body",
        tableWrap ? "tables-wrap" : "",
        stickyTables ? "tables-sticky" : "",
      ].join(" ")}
      style={articleStyle}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          table({ children }) {
            const columnCount = getTableColumnCount(children);
            const tableStyle =
              columnCount > 0
                ? ({ "--markdown-table-columns": columnCount } as CSSProperties)
                : undefined;

            return (
              <div className="markdown-table-shell">
                <div className="markdown-table-toolbar">
                  <button
                    className="btn-table-tool"
                    type="button"
                    onClick={(event) => {
                      const csv = copyTableAsCsv(event.currentTarget);
                      if (!csv) {
                        return;
                      }
                      void navigator.clipboard.writeText(csv);
                    }}
                  >
                    {labels.copyCsv ?? "Copy CSV"}
                  </button>
                </div>
                <div className="markdown-table-scroll" style={tableStyle}>
                  <table>{children}</table>
                </div>
              </div>
            );
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const code = String(children).replace(/\n$/, "");

            if (match) {
              if (match[1].toLowerCase() === "mermaid" && !mermaidEnabled) {
                return <pre className="diagram-error">{labels.mermaidDisabled}</pre>;
              }
              return <CodeBlock code={code} language={match[1]} labels={labels} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          img({ src, alt, title }) {
            if (isRemoteUrl(src)) {
              return (
                <span className="blocked-media">
                  {labels.blockedRemoteImage} {alt || src}
                </span>
              );
            }

            const imageStyle = getImageStyle(title);
            if (sourcePath && src && !isInlineOrAbsoluteUrl(src)) {
              return <LocalMarkdownImage markdownPath={sourcePath} src={src} alt={alt ?? ""} style={imageStyle} />;
            }

            return <img src={src} alt={alt ?? ""} style={imageStyle} />;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          h1({ children, node }) {
            const text = getPlainText(children);
            const id = getHeadingId(text, node);
            return <h1 id={id} data-heading-id={id}>{children}</h1>;
          },
          h2({ children, node }) {
            const text = getPlainText(children);
            const id = getHeadingId(text, node);
            return <h2 id={id} data-heading-id={id}>{children}</h2>;
          },
          h3({ children, node }) {
            const text = getPlainText(children);
            const id = getHeadingId(text, node);
            return <h3 id={id} data-heading-id={id}>{children}</h3>;
          },
          blockquote({ children }) {
            const text = getPlainText(children).trim();
            const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(text);
            if (!match) {
              return <blockquote>{children}</blockquote>;
            }

            return (
              <blockquote className={`admonition admonition-${match[1].toLowerCase()}`}>
                {children}
              </blockquote>
            );
          },
        }}
      >
        {normalizedMarkdown}
      </ReactMarkdown>
    </article>
  );
}
