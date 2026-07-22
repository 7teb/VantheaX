# VantheaX

A private, local code agent for Windows. A desktop app (Electron + React) that talks to coding models through OpenRouter (and, optionally, NVIDIA's hosted models) and can read, edit, and run things inside a project folder you point it at.

Everything stays on your machine: your API keys, settings, and chats live in `%APPDATA%\VantheaX\` and never leave it except to call the model provider you picked.

## What it does

**Code agent**
- Reads, searches, outlines, edits, and writes files in the selected project. Writes are path-scoped to that project, so the agent can never touch anything outside it.
- Runs shell commands (PowerShell) under three permission modes (see below).
- Plan mode (read-only, drafts a plan for your approval before touching anything) and Goal mode (works toward a goal, with a second model verifying it is actually done).
- Built-in terminal: a real ConPTY shell with tabs, resizable, opened in the project root, for when you want to type commands yourself.

**Web search**
- Optional web search through [Tavily](https://tavily.com). Two depths: basic walks the sources it reads one at a time, advanced returns a synthesized answer (built with Gemini) plus the clickable sources. Needs a Tavily key, added in Settings.

**Images**
- Attach or paste an image in any chat, with any model. Vision-incapable models still "see" it: a Gemini vision sidecar turns the picture into text the model reads. No raw image data is stored in your chat history.

**Personalization** (Settings > Personalization)
- Personality: pick a tone (pragmatic, friendly, or cynical) that is applied across every chat.
- Custom instructions: standing rules the agent follows in every chat, like a personal AGENTS.md.
- Memory (experimental, off by default): when enabled, the app remembers durable facts about you across chats, extracted automatically after each turn and injected into every chat.
- Reasoning narrator (off by default): instead of a plain "Thinking", a small model turns the main model's live reasoning into short status lines while you wait.

**MCP servers** (Settings > MCP servers)
- Connect local MCP servers (IDA, CheatEngine, or any stdio MCP server) and the model can call their tools like any other tool. Add one by pasting its config, picking its folder (auto-detected), or just asking the agent to connect it.
- Every MCP tool is risk-classified (read-only / state-changing / dangerous / shell). Read and inspect run smoothly; anything that writes, patches, injects, or executes always asks first, even in Full auto.

**The rest**
- Markdown rendering with code highlighting, tables, and math (KaTeX).
- Local chat history and search, a per-project chat tree, pin / rename / delete.
- A context-usage indicator with automatic between-turns compaction, so long sessions stay under budget.
- The model knows the current date and time (it calls a datetime tool), so it will not assume it is still its training-cutoff year.

## Models

Two providers. OpenRouter is the default and the only one required.

**OpenRouter** (needs an OpenRouter key)
- DeepSeek V4 Flash, DeepSeek V4 Pro
- GLM 5.2 (pinned to the first-party Z.ai provider)
- Qwen 3.7 Plus, Qwen 3.7 Max (vision-capable)

**NVIDIA NIM** (optional second provider, needs an NVIDIA key)
- DeepSeek V4 Flash, DeepSeek V4 Pro, GLM 5.2, MiniMax M3, Nemotron 3 Ultra 550B
- NVIDIA's hosted endpoint has a free trial (currently 40 requests/minute, 1000 trial credits). Their trial terms are evaluation-only and state that your content and the generated content are collected to improve their products, including their AI models, so do not send private code through it. The app says the same in the "Model eval" settings tab.

The side jobs (chat naming, summaries, the Auto-mode safety check, image analysis, web-search synthesis, memory extraction) always run on OpenRouter, so a working OpenRouter key is expected even when the main model is an NVIDIA one.

## Permission modes

Every command runs under one of three modes, chosen in the composer:

- **Ask**: every command is proposed and waits for you.
- **Auto**: read-only commands run immediately; everything else goes to a Gemini overseer that judges whether it is safe to run or should ask you first.
- **Full auto**: everything runs.

Under all three there is one hard, non-overridable block: a catastrophic-command floor (formatting a drive, deleting Windows / System32, wiping the registry, and the like). It never runs and cannot be approved, in any mode. File writes are additionally locked to the open project by path, independent of the mode.

## Requirements

- Windows
- Node.js 20 or newer (tested on 24)
- An OpenRouter API key: https://openrouter.ai/keys
- Optional: a Tavily key for web search (https://tavily.com), an NVIDIA API key for the NVIDIA models

## Setup

```powershell
git clone https://github.com/7teb/VantheaX.git
cd VantheaX
npm install
```

## Run

Dev mode (hot reload):

```powershell
npm run dev
```

Or build a standalone Windows app:

```powershell
npm run dist
```

That produces an installer under `outputs\`. For a portable build instead, run `npm run package` and launch `outputs\electron\win-unpacked\VantheaX.exe`.

## First start

1. Open Settings (gear icon).
2. Paste your OpenRouter API key. It is stored locally through Electron safe storage and only ever leaves your machine to call the provider.
3. Optional: add a Tavily key under Web search to enable web search, and an NVIDIA key under Model eval to use the NVIDIA models.
4. Pick a model, choose a project folder, and start a chat.

## Notes

- Your API keys, settings, and chats live in `%APPDATA%\VantheaX\` and are never part of the repo. Keys are encrypted with Electron safe storage.
- Provider routing is pinned per model (for example, GLM runs only on the first-party Z.ai provider).
- MCP servers are ordinary local processes you configure yourself, the same trust model as Claude Desktop or Cursor. The risk-tier gating protects against the model triggering a dangerous tool, not against a server you deliberately install.
