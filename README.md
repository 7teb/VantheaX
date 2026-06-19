# VantheaX

A private, local code agent for Windows. A desktop app (Electron + React) that talks to coding models through OpenRouter and can read, edit, and run things inside a project folder you point it at.

## Requirements

- Windows
- Node.js 20 or newer (tested on 24)
- An OpenRouter API key: https://openrouter.ai/keys

## Setup

```powershell
git clone https://github.com/7yariz/VantheaX.git
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
2. Paste your OpenRouter API key. It is stored locally through Electron safe storage and only ever leaves your machine to call OpenRouter.
3. Pick a model (DeepSeek, Z.ai GLM, or Qwen) and choose a project folder.

## What it does

- Reads, searches, outlines, edits, and writes files in the selected project.
- Runs commands with three permission modes (Ask / Auto / Full), with a safety classifier gating the grey zone in Auto.
- Plan mode (read-only, presents a plan for approval) and Goal mode (works toward a goal, checked by a second model).
- Markdown with code highlighting, tables, and math; local chat history and search.
- MCP support for connecting local tool servers.

## Notes

- Your API key, settings, and chats live in `%APPDATA%\VantheaX\` and are never part of the repo.
- Provider routing is pinned per model (for example, GLM runs only on the first-party Z.ai provider).
