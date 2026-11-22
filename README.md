# PDF Flow — Modern Mobile PDF Manager 📱📄

A high-performance, privacy-focused mobile PDF manager engineered with an **Apple iOS HIG + Google Material 3** hybrid design. Built with React, Vite, TypeScript, Tailwind CSS, PDF.js, and local-first IndexedDB storage.

---

## 🌟 Key Features

- **Local-First & Offline**: 100% client-side storage via IndexedDB; your PDFs and notes never leave your device.
- **In-Page Sticky Notes**: Attach rich sticky notes directly to individual PDF pages with 5 highlight colors and instant persistence.
- **Custom Covers & Themes**: Auto-rendered first page from vector PDF, upload custom images from your camera roll, or choose from 8 Apple Books gradient themes with iconography.
- **Dynamic Grouping**: Organize documents into color-coded categories (Work, Study, Finance, Personal, etc.).
- **Privacy Vault**: Hide confidential documents behind a 4-digit PIN security shield.
- **Mobile PDF Viewer**:
  - Mozilla PDF.js canvas rendering engine
  - Touch pinch-to-zoom & double-tap zoom
  - Light, Dark (inverted), and Sepia reading themes
  - Page scrub bar and quick touch turn buttons
- **1-Click Backup**: Full JSON export and restore for all documents, covers, notes, and settings.

---

## 🚀 Android Installer & Downloads

### Download the Standalone APK
Check the [Releases](https://github.com/p4pos/pdf-flow-mobile/releases) tab or [Actions Artifacts](https://github.com/p4pos/pdf-flow-mobile/actions) to download `PDFFlow-Android-Installer.apk` directly to your phone.

### Or Install via PWA (Instant, No Download Needed)
1. Open the app in Chrome or any mobile browser on Android.
2. Tap the browser menu (⋮) and tap **"Install App"** / **"Add to Home Screen"**.
3. Android will automatically install it as a native WebAPK with full-screen support and home screen icon.

---

## 🛠 Local Development

```bash
# Install dependencies
pnpm install

# Start local mobile dev server
pnpm run dev

# Build production bundle
pnpm run build
```
