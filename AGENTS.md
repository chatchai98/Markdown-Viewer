# Agent Instructions

@C:\Users\Tony Stark\.codex\RTK.md

## Commit, Push, and Release Standard

When edits are done, the user approves them, and the user explicitly asks to commit and push:

1. Commit only the approved task files; leave unrelated dirty files alone.
2. Update `README.md` if user-facing features, commands, release paths, or screenshots changed.
3. Run `npm.cmd run build`.
4. Build the Windows executable with `npm.cmd run desktop:build`.
   - If electron-builder hits Windows rename/lock errors, use the existing `--prepackaged` workaround and report it.
5. Verify artifacts under `release/<version>/`.
6. Commit README/version/release-config follow-up changes if needed.
7. Push the current branch to GitHub.
8. Create a GitHub Release only when requested:
   - Tag: `v<version>`
   - Title: `Markdown Viewer v<version>`
   - Notes: Added, Fixed, Downloads
   - Assets: portable `.exe` and setup `.exe`

Do not push unapproved local work.
