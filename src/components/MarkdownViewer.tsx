import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

type MarkdownViewerProps = {
  markdown: string;
};

function isRemoteUrl(src: string | undefined) {
  return Boolean(src && /^https?:\/\//i.test(src));
}

export function MarkdownViewer({ markdown }: MarkdownViewerProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const code = String(children).replace(/\n$/, "");

            if (match) {
              return <CodeBlock code={code} language={match[1]} />;
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
                  Remote image blocked: {alt || src}
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
