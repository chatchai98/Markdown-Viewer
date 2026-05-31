import { useEffect, useId, useState } from "react";
import { Check, Copy } from "lucide-react";

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const normalizedLanguage = language?.toLowerCase();

  if (normalizedLanguage === "mermaid") {
    return <MermaidBlock code={code} />;
  }

  useEffect(() => {
    let isCurrent = true;

    async function highlightCode() {
      const hljs = (await import("highlight.js/lib/common")).default;
      const result =
        normalizedLanguage && hljs.getLanguage(normalizedLanguage)
          ? hljs.highlight(code, { language: normalizedLanguage }).value
          : hljs.highlightAuto(code).value;

      if (isCurrent) {
        setHighlighted(result);
      }
    }

    setHighlighted(null);
    void highlightCode();

    return () => {
      isCurrent = false;
    };
  }, [code, normalizedLanguage]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-card">
      <div className="code-toolbar">
        <span className="code-lang">{normalizedLanguage ?? "text"}</span>
        <button
          className={copied ? "btn-copy copied" : "btn-copy"}
          type="button"
          onClick={() => void copyCode()}
        >
          {copied ? (
            <>
              <Check size={13} aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre>
        {highlighted ? (
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}

function MermaidBlock({ code }: { code: string }) {
  const rawId = useId();
  const diagramId = `mermaid-${rawId.replace(/:/g, "")}`;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        const result = await mermaid.render(diagramId, code);
        if (isCurrent) {
          setSvg(result.svg);
          setError(null);
        }
      } catch {
        if (isCurrent) {
          setSvg("");
          setError("Could not render this Mermaid diagram.");
        }
      }
    }

    void renderDiagram();

    return () => {
      isCurrent = false;
    };
  }, [code, diagramId]);

  return (
    <div className="diagram-card">
      <div className="code-toolbar">
        <span>Mermaid</span>
      </div>
      {error ? (
        <pre className="diagram-error">{error}</pre>
      ) : (
        <div
          className="diagram-output"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
