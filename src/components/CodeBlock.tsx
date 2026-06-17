import { useEffect, useId, useState } from "react";
import { Check, Copy } from "lucide-react";

type CodeBlockProps = {
  code: string;
  language?: string;
  labels?: {
    copy: string;
    copied: string;
    mermaid: string;
    mermaidError: string;
  };
};

export function CodeBlock({
  code,
  language,
  labels = {
    copy: "Copy",
    copied: "Copied",
    mermaid: "Mermaid",
    mermaidError: "Could not render this Mermaid diagram.",
  },
}: CodeBlockProps) {
  const normalizedLanguage = language?.toLowerCase();

  if (normalizedLanguage === "mermaid") {
    return <MermaidBlock code={code} labels={labels} />;
  }

  return (
    <HighlightedCodeBlock
      code={code}
      language={normalizedLanguage}
      labels={labels}
    />
  );
}

function HighlightedCodeBlock({
  code,
  language,
  labels,
}: {
  code: string;
  language?: string;
  labels: {
    copy: string;
    copied: string;
  };
}) {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function highlightCode() {
      try {
        const hljs = (await import("highlight.js/lib/common")).default;
        const result =
          language && hljs.getLanguage(language)
            ? hljs.highlight(code, { language }).value
            : hljs.highlightAuto(code).value;

        if (isCurrent) {
          setHighlighted(result);
        }
      } catch {
        if (isCurrent) {
          setHighlighted(null);
        }
      }
    }

    setHighlighted(null);
    void highlightCode();

    return () => {
      isCurrent = false;
    };
  }, [code, language]);

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
        <span className="code-lang">{language ?? "text"}</span>
        <button
          className={copied ? "btn-copy copied" : "btn-copy"}
          type="button"
          onClick={() => void copyCode()}
        >
          {copied ? (
            <>
              <Check size={13} aria-hidden="true" />
              <span>{labels.copied}</span>
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden="true" />
              <span>{labels.copy}</span>
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

function MermaidBlock({
  code,
  labels,
}: {
  code: string;
  labels: {
    mermaid: string;
    mermaidError: string;
  };
}) {
  const rawId = useId();
  const diagramId = `mermaid-${rawId.replace(/:/g, "")}`;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function renderDiagram() {
      try {
        if (isCurrent) {
          setSvg("");
          setError(null);
        }

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
          setError(labels.mermaidError);
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
        <span>{labels.mermaid}</span>
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
