import { createReadStream } from "node:fs";

const maxLineChars = 100000;

const tokenEstimate = (text) => {
  const value = String(text || "");
  const nonAscii = Buffer.byteLength(value, "utf8") - value.length;
  return Math.ceil(value.length / 4 + nonAscii / 2);
};

export const readTextWindow = async (file, displayPath, startLine, limit, maxLines, maxTokens) => {
  const start = Math.max(1, Number(startLine) || 1);
  const count = Math.min(maxLines, Math.max(1, Number(limit) || maxLines));
  const selected = [];
  let selectedTokens = 0;
  let lineNumber = 0;
  let pending = "";
  let discarding = false;
  let oversized = false;

  const consume = () => {
    lineNumber += 1;
    const inWindow = lineNumber >= start && lineNumber < start + count;
    if (inWindow && discarding) {
      oversized = true;
    }
    if (inWindow && !oversized) {
      const suffix = discarding ? " …[line truncated]" : "";
      const rendered = `${lineNumber}: ${pending}${suffix}`;
      const tokens = tokenEstimate(rendered) + 1;
      if (selectedTokens + tokens > maxTokens) {
        oversized = true;
      } else {
        selected.push(rendered);
        selectedTokens += tokens;
      }
    }
    pending = "";
    discarding = false;
  };

  const stream = createReadStream(file, { encoding: "utf8", highWaterMark: 64 * 1024 });
  for await (const chunk of stream) {
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf("\n", offset);
      const end = newline < 0 ? chunk.length : newline;
      if (!discarding && pending.length < maxLineChars) {
        const room = maxLineChars - pending.length;
        pending += chunk.slice(offset, Math.min(end, offset + room));
        if (end - offset > room) {
          discarding = true;
        }
      }
      if (newline < 0) {
        break;
      }
      if (pending.endsWith("\r")) {
        pending = pending.slice(0, -1);
      }
      consume();
      offset = newline + 1;
    }
  }
  if (pending.endsWith("\r")) {
    pending = pending.slice(0, -1);
  }
  consume();

  return {
    path: String(displayPath || "").replaceAll("\\", "/"),
    startLine: start,
    endLine: start + selected.length - 1,
    totalLines: lineNumber,
    content: selected.join("\n"),
    tooLarge: oversized,
    tokenLimit: maxTokens,
  };
};
