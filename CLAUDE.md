# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vocaliz** is a vanilla HTML/CSS/JS text-to-speech web app. No build step, no framework, no server. Open `index.html` directly in a browser or serve via any static host (GitHub Pages: `https://nankov-ai.github.io/Vocaliz/`).

## Running the App

No install required. Open `index.html` in Chrome (recommended — best Web Speech API + WebGPU support).

```
npx serve .
# or
python -m http.server
```

The PWA service worker requires HTTPS or localhost to register. On `file://` the SW is skipped, but the app still works.

## Architecture

Five source files:

| File | Role |
|---|---|
| [index.html](index.html) | UI structure. Loads 3 CDN libs then `app.js` as ES module |
| [app.js](app.js) | All logic (~600 lines). Clear section comments throughout |
| [style.css](style.css) | Dark theme via CSS custom properties. Engine selector, dictionary panel, toggles |
| [manifest.json](manifest.json) | PWA manifest with `share_target` for Android share sheet |
| [sw.js](sw.js) | Service worker: caches app shell + CDN libs; never intercepts Hugging Face |

## Two TTS Engines

### Web Speech (default)
Uses `window.speechSynthesis`. Instant — no download. `onboundary` provides word highlighting. Less reliable for background/lock-screen audio on Android.

### Kokoro AI
Lazy-loaded via `import('https://cdn.jsdelivr.net/npm/kokoro-js@1/+esm')` on first play. Downloads `onnx-community/Kokoro-82M-v1.0` (~80 MB, q8 quantized) from Hugging Face on first use, then cached by Transformers.js. Tries WebGPU first, falls back to WASM. Supported PT-BR voices: `pf_dora` (F), `pm_alex` (M), `pm_santa` (M). Generates audio sentence-by-sentence; plays via Web Audio API — continues when screen locks.

The `ttsEngine` state variable (`'webspeech'` | `'kokoro'`) controls which engine is used in `play()`.

## Android PWA / Share Target

- `manifest.json` declares `share_target` with GET method and params `text`, `title`, `url`
- On load, `app.js` reads URL params and populates the display box automatically
- The user installs via Chrome → "Add to Home Screen" → Vocaliz appears in Android's share sheet
- `MediaSession API` provides lockscreen controls (play/pause/stop without unlocking)
- `WakeLock API` (optional toggle) prevents automatic screen sleep during reading

## Key Behaviours to Preserve

- `clearTableMode()` must be called whenever display text changes (resets `speechScript` + `tableDetected`)
- `wrapWords()` must NOT be called in Kokoro mode or table mode — it replaces innerHTML with `<span class="word">` elements
- Space key: `else-if` logic — if paused → resume; else if idle → play. Never both.
- Kokoro stop: sets `kokoroPlaying = false` and resolves `resumeResolver` so the async loop exits cleanly
- Pronunciation dictionary is stored in `localStorage` under key `vocaliz-dict` as a JSON object `{ word: replacement }`
- CDN versions are pinned (pdf.js 3.11.174, mammoth 1.6.0, xlsx 0.18.5) — update with care
- The SW must NOT intercept `huggingface.co` requests — Transformers.js manages its own cache

## File Format Support

| Format | Handler |
|---|---|
| txt, md | `readAsText` → display |
| srt, vtt | `stripSubtitleTimestamps` |
| html, htm | `stripHTML` |
| csv | `parseDelimited` → `tableToSpeechScript` |
| pdf | `extractPDF` (pdf.js) |
| docx | `extractDOCX` (mammoth.js) |
| xlsx, xls | `handleXLSX` (SheetJS) → `tableToSpeechScript` |

When a table is detected, `speechScript` holds a structured narration string and `tableDetected = true`. TTS reads `speechScript` instead of raw display text.
