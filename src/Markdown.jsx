import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import csharp from "highlight.js/lib/languages/csharp";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import lua from "highlight.js/lib/languages/lua";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import bash from "highlight.js/lib/languages/bash";
import powershell from "highlight.js/lib/languages/powershell";
import shell from "highlight.js/lib/languages/shell";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import scss from "highlight.js/lib/languages/scss";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";
import ini from "highlight.js/lib/languages/ini";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import diff from "highlight.js/lib/languages/diff";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import plaintext from "highlight.js/lib/languages/plaintext";
import "highlight.js/styles/github-dark-dimmed.css";
import "katex/dist/katex.min.css";

const languages = {
  javascript, typescript, python, cpp, c, csharp, rust, go, java, lua, ruby,
  php, bash, powershell, shell, json, yaml, xml, css, scss, sql, markdown,
  ini, dockerfile, diff, kotlin, swift, plaintext,
};

for (const [name, def] of Object.entries(languages)) {
  hljs.registerLanguage(name, def);
}

const langAlias = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", "c++": "cpp", cs: "csharp",
  rs: "rust", golang: "go", sh: "bash", zsh: "bash", ps1: "powershell",
  ps: "powershell", yml: "yaml", html: "xml", htm: "xml", svg: "xml",
  vue: "xml", md: "markdown", kt: "kotlin", text: "plaintext", txt: "plaintext",
  console: "shell", terminal: "shell", dockerfile: "dockerfile", toml: "ini",
};

const resolveLang = (raw) => {
  const key = (raw || "").toLowerCase();
  const mapped = langAlias[key] || key;
  return hljs.getLanguage(mapped) ? mapped : "";
};

const CodeBlock = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);
  const resolved = resolveLang(lang);
  const html = useMemo(() => {
    if (!resolved) {
      return null;
    }
    try {
      return hljs.highlight(code, { language: resolved, ignoreIllegal: true }).value;
    } catch {
      return null;
    }
  }, [code, resolved]);

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  };

  return (
    <div className="code-card">
      <div className="code-card-head">
        <span className="code-lang">{resolved || lang || "text"}</span>
        <button className="code-copy" onClick={copy} title="Copy">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="code-pre">
        {html
          ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
          : <code className="hljs">{code}</code>}
      </pre>
    </div>
  );
};

const ExternalLink = ({ href, children }) => {
  const safe = typeof href === "string" && /^(https?:|mailto:)/i.test(href);
  const onClick = (event) => {
    event.preventDefault();
    if (safe) {
      window.agentApi?.openExternal?.(href);
    }
  };
  return <a href={safe ? href : undefined} className="md-link" onClick={onClick}>{children}</a>;
};

const components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...rest }) => {
    const match = /language-([\w+#-]+)/.exec(className || "");
    const text = String(children ?? "").replace(/\n$/, "");
    if (match || text.includes("\n")) {
      return <CodeBlock lang={match ? match[1] : ""} code={text} />;
    }
    return <code className="inline-code" {...rest}>{children}</code>;
  },
  a: ExternalLink,
  table: ({ children }) => <div className="md-table-wrap"><table>{children}</table></div>,
  img: ({ src, alt }) => <img className="md-img" src={src} alt={alt || ""} loading="lazy" />,
};

// models emit \( \) and \[ \], which remark-math ignores and markdown strips to bare parens
const normalizeMath = (raw) => String(raw || "")
  .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
  .map((part, idx) => (idx % 2 === 1 ? part : part
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => `$$${inner}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => `$${inner}$`)))
  .join("");

const MarkdownMessage = React.memo(({ content }) => {
  const text = useMemo(() => normalizeMath(content), [content]);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false, trust: false }]]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
});

export default MarkdownMessage;
