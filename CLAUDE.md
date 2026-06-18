# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vocaliz** is a vanilla HTML/CSS/JS text-to-speech web app. No build step, no framework, no server. Hosted on GitHub Pages: `https://nankov-ai.github.io/Vocaliz/`

## Running the App

No install required. Open `index.html` in Chrome (recommended — best Web Speech API + WebGPU support).

```
npx serve .
# or
python -m http.server
```

The PWA service worker requires HTTPS or localhost to register. On `file://` the SW is skipped, but the app still works.

## Architecture

| File | Role |
|---|---|
| [index.html](index.html) | UI structure. Loads 3 CDN libs then `app.js` as ES module |
| [app.js](app.js) | All logic (~850 lines). Clear section comments throughout |
| [style.css](style.css) | Dark theme, mobile-first responsive. CSS custom properties |
| [manifest.json](manifest.json) | PWA manifest with `share_target` for Android share sheet |
| [sw.js](sw.js) | Service worker: caches app shell + CDN libs |
| [icons/](icons/) | PNG icons (192×192 and 512×512) required for PWA install on Android |
| [extension/](extension/) | Chrome extension (MV3) to send selected text/page to Vocaliz |

## Input Modes (4 tabs)

| Tab | Handler |
|---|---|
| 📎 Ficheiro | File drag/drop or browse. Dispatches by extension |
| 🔗 URL | Fetches via `api.allorigins.win` CORS proxy, strips noise elements, extracts article body |
| 📷 Câmara | Opens camera, runs OCR with Tesseract.js (lazy-loaded, `por+eng`, fully local) |
| 📚 Lista | Reading list saved in localStorage (`vocaliz-library`, max 30 items) |

## File Format Support

| Format | Handler |
|---|---|
| txt, md | `readAsText` → display |
| srt, vtt | `stripSubtitleTimestamps` |
| html, htm | `stripHTML` |
| csv | `parseDelimited` → `tableToSpeechScript` |
| pdf | `extractPDF` (pdf.js CDN) |
| docx | `extractDOCX` (mammoth.js CDN) |
| xlsx, xls | `handleXLSX` (SheetJS CDN) → `tableToSpeechScript` |

When a table is detected, `speechScript` holds a structured narration string and `tableDetected = true`. TTS reads `speechScript` instead of raw display text.

## Two TTS Engines

### Web Speech (default)
Uses `window.speechSynthesis`. Instant, no download. `onboundary` provides word highlighting. Less reliable for background/lock-screen audio on Android.

### Kokoro AI
Lazy-loaded via `import('https://cdn.jsdelivr.net/npm/kokoro-js@1/+esm')` on first play. Downloads `onnx-community/Kokoro-82M-v1.0` (~80 MB, q8 quantized) from Hugging Face on first use, cached by Transformers.js. Tries WebGPU first, falls back to WASM. PT-BR voices: `pf_dora` (F), `pm_alex` (M), `pm_santa` (M). Generates and plays audio sentence-by-sentence via Web Audio API — continues when screen locks.

The `ttsEngine` state variable (`'webspeech'` | `'kokoro'`) controls which engine is used in `play()`.

## Android PWA / Share Target

- `manifest.json` declares `share_target` with GET method and params `text`, `title`, `url`
- On load, `app.js` reads URL params and populates the display box automatically
- **PNG icons are required** for Chrome Android to show the install prompt. Open `icons/generate.html` once in a browser to download `icon-192.png` and `icon-512.png`, place them in `icons/`
- Install flow: Chrome → `https://nankov-ai.github.io/Vocaliz/` → "Adicionar ao ecrã principal" → after install, Vocaliz appears in Android share sheet
- `MediaSession API` provides lockscreen controls (play/pause/stop without unlocking)
- `WakeLock API` (optional toggle) prevents automatic screen sleep during reading

## Chrome Extension (extension/)

MV3 extension with three actions:
- **Ler texto selecionado** — executes `window.getSelection().toString()` on active tab, opens Vocaliz with text as URL param
- **Ler página completa** — extracts `body.innerText` (strips nav/header/footer/aside), opens Vocaliz
- **Abrir Vocaliz** — opens the app directly

Install: `chrome://extensions` → Developer mode → "Load unpacked" → select `extension/` folder.

## Key Behaviours to Preserve

- `clearTableMode()` must be called whenever display text changes — resets `speechScript` + `tableDetected`
- `wrapWords()` must NOT be called in Kokoro mode or table mode — it replaces innerHTML with `<span class="word">` elements
- Space key: `else-if` logic — if playing/paused → pause/resume; else → play. Never both in same event
- Kokoro stop: sets `kokoroPlaying = false` and resolves `resumeResolver` so the async sentence loop exits cleanly
- Pronunciation dictionary stored in localStorage as `vocaliz-dict`: `{ word: replacement }`. Applied via `applyDict()` before TTS
- Reading list stored in localStorage as `vocaliz-library`: array of `{ id, title, text, words, date }`, max 30 items
- SW must NOT intercept `huggingface.co` requests — Transformers.js manages its own cache
- CDN versions are pinned (pdf.js 3.11.174, mammoth 1.6.0, xlsx 0.18.5, Tesseract.js 5) — update with care

## CSS Architecture

Mobile-first responsive layout:
- `.settings` grid: **1 column by default**, 3 columns at `min-width: 600px`
- Grid uses `repeat(3, minmax(0, 1fr))` to prevent overflow from select/input elements
- `select` elements have `width: 100%; max-width: 100%` to stay within grid cells
- `[hidden]` enforced with `!important` at the top of the file to survive CSS resets
- Input tabs use `data-tab` attribute; JS activates corresponding `#tab{Name}` panel
