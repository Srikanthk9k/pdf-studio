# PDF Studio

> A production-ready, browser-based PDF editor — a free alternative to Adobe Acrobat Premium.

![PDF Studio](https://img.shields.io/badge/PDF%20Studio-v1.0.0-indigo)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 📄 **PDF Viewer** — Multi-page rendering via PDF.js, virtual scrolling, zoom, thumbnails
- ✏️ **Annotation Tools** — Text, highlight, underline, strikethrough, freehand drawing, shapes, sticky notes
- 📐 **Page Management** — Drag-to-reorder, insert, delete, rotate, extract, merge PDFs
- 📝 **Form Tools** — Add and fill text, checkbox, radio, dropdown, and signature fields
- ✍️ **Digital Signatures** — Draw, type, or upload; place anywhere on document
- 🔍 **OCR** — Client-side text recognition via Tesseract.js
- 🔄 **Conversion** — PDF ↔ Word/Excel/PowerPoint/PNG/JPG via LibreOffice
- 🔒 **Security** — Password protect, set permissions, redact sensitive content
- 🗜️ **Compression** — Reduce PDF size with quality presets via Ghostscript
- 🔗 **Share Links** — Generate 24-hour expiring share links
- ↩️ **Undo/Redo** — Full history stack

---

## Tech Stack

| Layer     | Technologies                                              |
|-----------|-----------------------------------------------------------|
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, Zustand        |
| Rendering | PDF.js (Mozilla), Fabric.js                              |
| Backend   | Node.js, Express, TypeScript                             |
| PDF Ops   | pdf-lib, Ghostscript, LibreOffice (headless)             |
| OCR       | Tesseract.js (client-side)                               |
| Images    | Sharp                                                    |
| Deploy    | Docker, Render.com                                       |

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js     | 18+     | Required |
| npm         | 9+      | Required |
| LibreOffice | Latest  | Optional — only needed for PDF↔Office conversion |
| Ghostscript | Latest  | Optional — only needed for compression |

### Install LibreOffice (macOS)
```bash
brew install --cask libreoffice
```

### Install Ghostscript (macOS)
```bash
brew install ghostscript
```

---

## Local Development

```bash
# 1. Clone / enter project
cd pdf-studio

# 2. Install all dependencies (root + client + server)
npm install

# 3. Start dev servers concurrently (client: 5173, server: 3001)
npm run dev

---

## Environment Variables

### Server (`/server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment |
| `JWT_SECRET` | — | Secret for JWT signing (required if AUTH_ENABLED=true) |
| `AUTH_ENABLED` | `false` | Enable JWT auth middleware |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `UPLOAD_DIR` | `/tmp/pdf-studio-uploads` | File upload directory |
| `MAX_FILE_SIZE_MB` | `100` | Max upload file size |

Create `/server/.env`:
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-here
AUTH_ENABLED=false
```

### Client (`/client/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | API base URL |

Create `/client/.env`:
```env
VITE_API_URL=/api
```

---

## Build for Production

```bash
# Build both client and server
npm run build

# Start production server (serves static client + API)
npm start
```

---

## Deployment — Render.com

1. **Fork/push** this repo to GitHub
2. Go to [Render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` and configures:
   - Docker build with LibreOffice + Ghostscript
   - Port 10000
   - Auto-deploy on push
5. Add environment variables in Render dashboard if needed

> **Note**: The free tier has ephemeral disk — uploaded files are stored in `/tmp` and lost on restart. For persistent storage, add a Render Disk or configure AWS S3 (see `server/src/utils/fileStorage.ts`).

---

## Docker

```bash
# Build image
docker build -t pdf-studio .

# Run container
docker run -p 10000:10000 pdf-studio
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload PDF or image |
| GET | `/api/files/:id` | Download processed file |
| POST | `/api/convert` | Convert PDF ↔ Office/Image |
| POST | `/api/compress` | Compress PDF |
| POST | `/api/merge` | Merge multiple PDFs |
| POST | `/api/split` | Split PDF by page ranges |
| POST | `/api/protect` | Password protect PDF |
| POST | `/api/unlock` | Remove PDF password |
| POST | `/api/export` | Flatten annotations into PDF |
| POST | `/api/pages/rotate` | Rotate pages |
| POST | `/api/pages/delete` | Delete pages |
| POST | `/api/pages/insert-blank` | Insert blank page |
| POST | `/api/pages/extract` | Extract pages to new PDF |
| POST | `/api/pages/reorder` | Reorder pages |
| POST | `/api/share` | Generate share link |
| GET | `/api/share/:token` | Access shared file |
| GET | `/api/health` | Health check |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open PDF file |
| `Ctrl+S` | Save / download |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+P` | Print |
| `Delete` | Remove selected element |
| `Escape` | Deselect / cancel tool |

---

## Project Structure

```
pdf-studio/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── store/       # Zustand state
│   │   ├── utils/       # PDF.js, Fabric.js, export helpers
│   │   └── types/       # TypeScript interfaces
│   └── vite.config.ts
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # PDF & conversion logic
│   │   ├── middleware/  # Multer, auth
│   │   └── utils/       # File storage
│   └── tsconfig.json
├── shared/              # Shared types (client + server)
├── Dockerfile
├── render.yaml
└── README.md
```

---

## License

MIT © PDF Studio
