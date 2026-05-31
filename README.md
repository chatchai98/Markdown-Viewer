# 📝 Markdown Viewer

Markdown Viewer is a lightweight local-first Markdown reader and editor built with React, TypeScript, and Vite. It focuses on reading Markdown files safely in the browser, with rich rendering for GitHub Flavored Markdown, code blocks, and Mermaid diagrams.

## ✨ Features

- 📂 Open `.md`, `.markdown`, and `.txt` files by drag and drop or file picker.
- 👀 Preview GitHub Flavored Markdown with tables, task lists, links, and formatting.
- 🧭 Render Mermaid diagrams from fenced `mermaid` code blocks.
- 🎨 Highlight code blocks with copy buttons.
- ✍️ Edit loaded Markdown and save changes when the browser supports the File System Access API.
- 💾 Save As fallback for browsers without direct file write support.
- 📋 Copy raw Markdown and print/export through the browser print dialog.
- 🕘 Track recent documents locally using `localStorage` and IndexedDB.
- 🛡️ Block remote images and sanitize rendered HTML to reduce unsafe content exposure.
- 🌗 Switch between multiple light and dark themes.

## 🧰 Tech Stack

- React 19
- TypeScript
- Vite
- react-markdown
- remark-gfm
- rehype-sanitize
- highlight.js
- Mermaid
- lucide-react

## ✅ Requirements

- Node.js 18 or newer
- npm

## 🚀 Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite runs on `http://127.0.0.1:5173` by default unless the port is already in use.

## 📜 Available Scripts

```bash
npm run dev
```

Run the local development server.

```bash
npm run build
```

Type-check the project and build production assets into `dist/`.

```bash
npm run preview
```

Preview the production build locally.

## 🗂️ Project Structure

```text
.
|-- index.html
|-- package.json
|-- src
|   |-- App.tsx
|   |-- main.tsx
|   |-- styles.css
|   |-- components
|   |   |-- CodeBlock.tsx
|   |   |-- FileLoader.tsx
|   |   `-- MarkdownViewer.tsx
|   `-- utils
|       |-- format.ts
|       `-- recentFiles.ts
|-- tsconfig.json
|-- tsconfig.node.json
`-- vite.config.ts
```

## 🔐 Privacy and Security Notes

Opened files are processed in the browser. Recent document metadata is stored in `localStorage`, and recent file content is stored in IndexedDB on the same device. The app does not include a backend service.

Rendered Markdown is sanitized with `rehype-sanitize`, Mermaid is initialized with strict security mode, and remote images are blocked by the Markdown renderer.

## 🌐 Deployment

Build the app:

```bash
npm run build
```

Deploy the generated `dist/` folder to any static hosting provider such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or an ordinary web server.

## 🧹 Repository Hygiene

This repository intentionally ignores local dependencies, build output, environment files, logs, temporary files, IDE settings, and local agent workspace folders. Keep secrets in `.env.local` or another ignored environment file, and commit only non-sensitive examples such as `.env.example`.
