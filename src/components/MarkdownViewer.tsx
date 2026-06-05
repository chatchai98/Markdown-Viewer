import {
  Children,
  isValidElement,
  useEffect,
  useRef,
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

export function MarkdownViewer({
  markdown,
  searchQuery = "",
  activeSearchIndex = 0,
  fontSize = 16,
  lineWidth = 95,
  tableWrap = false,
  stickyTables = true,
  mermaidEnabled = true,
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

  useEffect(() => {
    const article = articleRef.current;
    const query = searchQuery.trim();
    if (!article) {
      return;
    }

    article.querySelectorAll(".search-mark").forEach((mark) => {
      mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
    });
    article.normalize();

    if (query.length < 2) {
      return;
    }

    const matcher = query.toLowerCase();
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

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    let matchIndex = 0;
    for (const textNode of textNodes) {
      const text = textNode.textContent ?? "";
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      let lowerText = text.toLowerCase();
      let foundAt = lowerText.indexOf(matcher);

      while (foundAt !== -1) {
        if (foundAt > cursor) {
          fragment.append(text.slice(cursor, foundAt));
        }

        const mark = document.createElement("mark");
        mark.className = "search-mark";
        mark.dataset.searchIndex = String(matchIndex);
        mark.textContent = text.slice(foundAt, foundAt + query.length);
        fragment.append(mark);
        matchIndex += 1;
        cursor = foundAt + query.length;
        foundAt = lowerText.indexOf(matcher, cursor);
      }

      if (cursor < text.length) {
        fragment.append(text.slice(cursor));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }, [markdown, searchQuery]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article || !searchQuery.trim()) {
      return;
    }

    const marks = Array.from(article.querySelectorAll<HTMLElement>(".search-mark"));
    marks.forEach((mark) => mark.classList.remove("active"));
    const activeMark = marks[activeSearchIndex];
    if (activeMark) {
      activeMark.classList.add("active");
      activeMark.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }, [activeSearchIndex, searchQuery]);

  const articleStyle = {
    "--markdown-font-size": `${fontSize}px`,
    "--markdown-line-width": `${lineWidth}%`,
  } as CSSProperties;
  const usedHeadingIds = new Map<string, number>();

  function getHeadingId(text: string) {
    const baseId = slugify(text) || "section";
    const count = usedHeadingIds.get(baseId) ?? 0;
    usedHeadingIds.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}-${count + 1}`;
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
          img({ src, alt }) {
            if (isRemoteUrl(src)) {
              return (
                <span className="blocked-media">
                  {labels.blockedRemoteImage} {alt || src}
                </span>
              );
            }

            return <img src={src} alt={alt ?? ""} />;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          h1({ children }) {
            const text = getPlainText(children);
            const id = getHeadingId(text);
            return <h1 id={id} data-heading-id={id}>{children}</h1>;
          },
          h2({ children }) {
            const text = getPlainText(children);
            const id = getHeadingId(text);
            return <h2 id={id} data-heading-id={id}>{children}</h2>;
          },
          h3({ children }) {
            const text = getPlainText(children);
            const id = getHeadingId(text);
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
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
