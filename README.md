# VantheaX

Private local Electron code agent for Windows.

## Run

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

## Package

```powershell
npm.cmd run package
```

The unpacked Windows app is written to:

```text
outputs\electron\win-unpacked\VantheaX.exe
```

## Features

- Electron desktop shell.
- React and Vite renderer.
- Dark Vanthea-style UI.
- UI language switch (English / German) in settings — UI-only, never sent to the model.
- Live OpenRouter key balance in settings (remaining of the key's spend limit).
- Default AppData workspace when no project is open, so the agent is never scoped to the app folder.
- Local project selection.
- File index and preview.
- Local chat persistence and chat search overlay.
- Markdown rendering with code highlighting, tables, and KaTeX math.
- OpenRouter model picker.
- DeepSeek effort picker.
- Three permission modes (Ask / Auto / Full auto), with a Gemini classifier escalating the grey zone in Auto.
- Image attachment architecture with model vision gating.
- Local tools for reading, searching, outlining, writing/editing files, and running guarded commands.
- Path-scoped file writes/edits (`write_file` / `replace_in_file`), atomic and secret-blocked.
- Plan mode (read-only → approval card) and Goal mode (works toward a goal, verified by a second model).
- Secure local OpenRouter key storage through Electron safe storage.
