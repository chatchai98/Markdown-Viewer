import { Children, isValidElement, type CSSProperties, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

type MarkdownViewerProps = {
  markdown: string;
  labels?: {
    blockedRemoteImage: string;
    copy: string;
    copied: string;
    mermaid: string;
    mermaidError: string;
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

export function MarkdownViewer({
  markdown,
  labels = {
    blockedRemoteImage: "Remote image blocked:",
    copy: "Copy",
    copied: "Copied",
    mermaid: "Mermaid",
    mermaidError: "Could not render this Mermaid diagram.",
  },
}: MarkdownViewerProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          table({ children }) {
            const columnCount = getTableColumnCount(children);
            const tableStyle =
              columnCount > 0
                ? ({ "--markdown-table-columns": columnCount } as CSSProperties)
                : undefined;

            return (
              <div className="markdown-table-scroll" style={tableStyle}>
                {children}
              </div>
            );
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const code = String(children).replace(/\n$/, "");

            if (match) {
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
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
