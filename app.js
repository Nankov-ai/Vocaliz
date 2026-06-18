// ============================================================
// DOM
// ============================================================
const display             = document.getElementById('display');
const btnPlay             = document.getElementById('btnPlay');
const btnPause            = document.getElementById('btnPause');
const btnStop             = document.getElementById('btnStop');
const btnClear            = document.getElementById('btnClear');
const voiceSelect         = document.getElementById('voiceSelect');
const kokoroVoiceSelect   = document.getElementById('kokoroVoiceSelect');
const rateRange           = document.getElementById('rateRange');
const pitchRange          = document.getElementById('pitchRange');
const rateValue           = document.getElementById('rateValue');
const pitchValue          = document.getElementById('pitchValue');
const progressBar         = document.getElementById('progressBar');
const progressWrapper     = document.getElementById('progressWrapper');
const statusEl            = document.getElementById('status');
const uploadZone          = document.getElementById('uploadZone');
const uploadInner         = document.getElementById('uploadInner');
const fileInput           = document.getElementById('fileInput');
const btnBrowse           = document.getElementById('btnBrowse');
const fileInfoEl          = document.getElementById('fileInfo');
const fileNameEl          = document.getElementById('fileName');
const btnRemoveFile       = document.getElementById('btnRemoveFile');
const tableBadge          = document.getElementById('tableBadge');
const readingInfoEl       = document.getElementById('readingInfo');
const wordCountEl         = document.getElementById('wordCount');
const readingTimeEl       = document.getElementById('readingTime');
const kokoroLoadingEl     = document.getElementById('kokoroLoading');
const kokoroLoadingFill   = document.getElementById('kokoroLoadingFill');
const kokoroLoadingText   = document.getElementById('kokoroLoadingText');
const engineWebSpeech     = document.getElementById('engineWebSpeech');
const engineKokoro        = document.getElementById('engineKokoro');
const voiceGroup          = document.getElementById('voiceGroup');
const kokoroVoiceGroup    = document.getElementById('kokoroVoiceGroup');
const wakeLockToggle      = document.getElementById('wakeLockToggle');
const dictWord            = document.getElementById('dictWord');
const dictReplace         = document.getElementById('dictReplace');
const btnDictAdd          = document.getElementById('btnDictAdd');
const dictList            = document.getElementById('dictList');

// Tabs
const inputTabs           = document.querySelectorAll('.input-tab');
const tabPanels           = document.querySelectorAll('.tab-panel');

// URL fetch
const urlInput            = document.getElementById('urlInput');
const btnFetchUrl         = document.getElementById('btnFetchUrl');
const urlLoadingEl        = document.getElementById('urlLoading');
const urlLoadingFill      = document.getElementById('urlLoadingFill');
const urlLoadingText      = document.getElementById('urlLoadingText');

// Camera / OCR
const cameraInput         = document.getElementById('cameraInput');
const btnCamera           = document.getElementById('btnCamera');
const ocrLoadingEl        = document.getElementById('ocrLoading');
const ocrLoadingFill      = document.getElementById('ocrLoadingFill');
const ocrLoadingText      = document.getElementById('ocrLoadingText');

// Library
const libraryCount        = document.getElementById('libraryCount');
const libraryList         = document.getElementById('libraryList');
const libraryEmpty        = document.getElementById('libraryEmpty');
const btnSaveToLibrary    = document.getElementById('btnSaveToLibrary');
const btnSaveInline       = document.getElementById('btnSaveInline');

// ============================================================
// State
// ============================================================
const synth = window.speechSynthesis;
let voices        = [];
let utterance     = null;
let words         = [];
let isPaused      = false;
let speechScript  = null;
let tableDetected = false;

// Engine
let ttsEngine     = 'webspeech'; // 'webspeech' | 'kokoro'
let kokoroTTS     = null;
let kokoroLoaded  = false;

// Kokoro audio state
let audioCtx         = null;
let kokoroPlaying    = false;
let kokoroPaused     = false;
let kokoroSentences  = [];
let kokoroIndex      = 0;
let resumeResolver   = null;
let currentSource    = null;

// WakeLock
let wakeLock = null;

// Pronunciation dictionary
let pronDict = {};

// ============================================================
// PDF.js worker
// ============================================================
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ============================================================
// Service Worker registration
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/Vocaliz/sw.js').catch(() => {});
}

// ============================================================
// Share Target — read URL params on load
// ============================================================
(function handleShareTarget() {
  const params = new URLSearchParams(window.location.search);
  const sharedText  = params.get('text');
  const sharedTitle = params.get('title');
  const sharedUrl   = params.get('url');

  const text = [sharedText, sharedTitle, sharedUrl].filter(Boolean).join('\n\n').trim();
  if (!text) return;

  // Clear URL without reload
  window.history.replaceState({}, '', window.location.pathname);

  // Small delay so the DOM is settled
  setTimeout(() => {
    setDisplayText(text);
    updateReadingInfo(text);
    setStatus('Texto recebido. Prima ▶ para ouvir.');
    // Auto-open settings to reveal play button on mobile
    document.getElementById('settingsDetails').open = false;
    btnPlay.focus();
  }, 100);
})();

// ============================================================
// Pronunciation dictionary
// ============================================================
function loadDict() {
  try { pronDict = JSON.parse(localStorage.getItem('vocaliz-dict') || '{}'); }
  catch { pronDict = {}; }
  renderDict();
}

function saveDict() {
  localStorage.setItem('vocaliz-dict', JSON.stringify(pronDict));
}

function renderDict() {
  dictList.innerHTML = '';
  Object.entries(pronDict).forEach(([word, replacement]) => {
    const li = document.createElement('li');
    li.className = 'dict-entry';
    li.innerHTML = `
      <span class="dict-word">${escapeHtml(word)}</span>
      <span class="dict-arrow-sm">→</span>
      <span class="dict-repl">${escapeHtml(replacement)}</span>
      <button class="btn-dict-remove" data-word="${escapeHtml(word)}" title="Remover">✕</button>`;
    dictList.appendChild(li);
  });
}

function applyDict(text) {
  let result = text;
  for (const [word, replacement] of Object.entries(pronDict)) {
    result = result.replaceAll(word, replacement);
  }
  return result;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

btnDictAdd.addEventListener('click', () => {
  const word = dictWord.value.trim();
  const repl = dictReplace.value.trim();
  if (!word || !repl) return;
  pronDict[word] = repl;
  saveDict();
  renderDict();
  dictWord.value = '';
  dictReplace.value = '';
});

dictList.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-dict-remove');
  if (!btn) return;
  delete pronDict[btn.dataset.word];
  saveDict();
  renderDict();
});

loadDict();

// ============================================================
// Reading info (word count + estimated time)
// ============================================================
function updateReadingInfo(text) {
  const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
  if (wc === 0) { readingInfoEl.hidden = true; return; }
  const rate = parseFloat(rateRange.value);
  const wpm  = Math.round(130 * rate); // ~130 WPM baseline
  const mins = Math.ceil(wc / wpm);
  wordCountEl.textContent  = `${wc.toLocaleString('pt')} palavras`;
  readingTimeEl.textContent = mins < 60
    ? `~${mins} min de leitura`
    : `~${Math.floor(mins / 60)}h ${mins % 60}min`;
  readingInfoEl.hidden = false;
}

// ============================================================
// Engine selector
// ============================================================
document.querySelectorAll('input[name="engine"]').forEach(radio => {
  radio.addEventListener('change', () => {
    ttsEngine = radio.value;
    voiceGroup.hidden        = ttsEngine !== 'webspeech';
    kokoroVoiceGroup.hidden  = ttsEngine !== 'kokoro';
    pitchRange.closest('.setting-group').style.opacity = ttsEngine === 'kokoro' ? '0.4' : '';
    pitchRange.disabled = ttsEngine === 'kokoro';
    if (synth.speaking) stop();
  });
});

// ============================================================
// Web Speech — Voices
// ============================================================
function loadVoices() {
  voices = synth.getVoices();
  voiceSelect.innerHTML = '';
  const sorted = [
    ...voices.filter(v => v.lang.startsWith('pt')),
    ...voices.filter(v => !v.lang.startsWith('pt')),
  ];
  if (sorted.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'Voz do sistema (padrão)';
    voiceSelect.appendChild(opt);
    return;
  }
  sorted.forEach(voice => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.textContent = (voice.lang.startsWith('pt') ? '⭐ ' : '') +
      `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(opt);
  });
}
loadVoices();
if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;

// ============================================================
// Kokoro TTS — lazy load
// ============================================================
async function loadKokoro() {
  if (kokoroLoaded) return kokoroTTS;
  kokoroLoadingEl.hidden = false;
  kokoroLoadingFill.style.width = '5%';
  kokoroLoadingText.textContent = 'A carregar biblioteca Kokoro...';

  try {
    const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1/+esm');
    kokoroLoadingFill.style.width = '30%';
    kokoroLoadingText.textContent = 'A descarregar modelo de IA (~80 MB, fica em cache)...';

    kokoroTTS = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0', {
      dtype: 'q8',
      device: 'webgpu',
    }).catch(async () => {
      // WebGPU not available — fall back to WASM
      kokoroLoadingText.textContent = 'WebGPU indisponível, a usar WASM (mais lento)...';
      const { KokoroTTS: K } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1/+esm');
      return K.from_pretrained('onnx-community/Kokoro-82M-v1.0', { dtype: 'q8', device: 'wasm' });
    });

    kokoroLoadingFill.style.width = '100%';
    kokoroLoadingText.textContent = 'Kokoro pronto!';
    kokoroLoaded = true;
    setTimeout(() => { kokoroLoadingEl.hidden = true; }, 1500);
    return kokoroTTS;
  } catch (err) {
    kokoroLoadingEl.hidden = true;
    setStatus('Erro ao carregar Kokoro: ' + err.message);
    // Fall back to web speech
    ttsEngine = 'webspeech';
    engineWebSpeech.checked = true;
    voiceGroup.hidden = false;
    kokoroVoiceGroup.hidden = true;
    throw err;
  }
}

// ============================================================
// Sliders
// ============================================================
rateRange.addEventListener('input', () => {
  rateValue.textContent = parseFloat(rateRange.value).toFixed(2).replace(/\.?0+$/, '') + 'x';
  const text = display.innerText.trim();
  if (text) updateReadingInfo(text);
});
pitchRange.addEventListener('input', () => {
  pitchValue.textContent = parseFloat(pitchRange.value).toFixed(1);
});

// ============================================================
// WakeLock
// ============================================================
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

// Re-acquire WakeLock if tab becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && wakeLockToggle.checked) {
    if (kokoroPlaying || synth.speaking) await requestWakeLock();
  }
});

// ============================================================
// MediaSession
// ============================================================
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Vocaliz',
    artist: display.innerText.trim().slice(0, 60) || 'A ler...',
    album: 'Nodeflow',
  });
  navigator.mediaSession.setActionHandler('play',  () => play());
  navigator.mediaSession.setActionHandler('pause', () => pause());
  navigator.mediaSession.setActionHandler('stop',  () => stop());
}

function setMediaSessionState(state) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = state; // 'playing' | 'paused' | 'none'
}

// ============================================================
// Upload Zone — events
// ============================================================
uploadZone.addEventListener('click', (e) => {
  if (!e.target.closest('.btn-remove-file')) fileInput.click();
});

btnBrowse.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', (e) => {
  if (!uploadZone.contains(e.relatedTarget))
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation();
  clearFile();
});

function clearFile() {
  fileInput.value = '';
  fileInfoEl.hidden = true;
  uploadInner.hidden = false;
  fileNameEl.textContent = '';
  clearTableMode();
  display.innerHTML = '';
  readingInfoEl.hidden = true;
  setStatus('Pronto');
}

function showFileInfo(name) {
  fileNameEl.textContent = name;
  fileInfoEl.hidden = false;
  uploadInner.hidden = true;
}

// ============================================================
// File Handler (dispatcher)
// ============================================================
async function handleFile(file) {
  setStatus('A processar ficheiro...');
  const ext = file.name.split('.').pop().toLowerCase();
  showFileInfo(file.name);

  try {
    if (['txt', 'md'].includes(ext)) {
      setDisplayText(await readAsText(file));

    } else if (['srt', 'vtt'].includes(ext)) {
      setDisplayText(stripSubtitleTimestamps(await readAsText(file)));

    } else if (['html', 'htm'].includes(ext)) {
      setDisplayText(stripHTML(await readAsText(file)));

    } else if (ext === 'csv') {
      await handleCSV(await readAsText(file));
      return;

    } else if (ext === 'pdf') {
      setDisplayText(await extractPDF(file));

    } else if (ext === 'docx') {
      setDisplayText(await extractDOCX(file));

    } else if (['xlsx', 'xls'].includes(ext)) {
      await handleXLSX(file);
      return;

    } else {
      setDisplayText(await readAsText(file));
    }

    const text = display.innerText.trim();
    checkForMarkdownTable(text);
    updateReadingInfo(text);
    setStatus('Ficheiro carregado. Pronto para ouvir.');

  } catch (err) {
    console.error(err);
    setStatus('Erro: ' + (err.message || err));
    clearFile();
  }
}

// ============================================================
// Readers
// ============================================================
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Erro ao ler ficheiro'));
    r.readAsText(file, 'UTF-8');
  });
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Erro ao ler ficheiro'));
    r.readAsArrayBuffer(file);
  });
}

function stripHTML(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.innerText || d.textContent || '').trim();
}

function stripSubtitleTimestamps(text) {
  return text
    .replace(/^\d+\s*$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPDF(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js não carregado');
  const buffer = await readAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n\n').trim();
}

async function extractDOCX(file) {
  if (typeof mammoth === 'undefined') throw new Error('Mammoth.js não carregado');
  const buffer = await readAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

// ============================================================
// CSV / XLSX handlers
// ============================================================
async function handleCSV(raw) {
  const rows = parseDelimited(raw);
  if (rows.length === 0) return;
  const headers = rows[0].map((h, i) => h.trim() || `Coluna ${i + 1}`);
  const data    = rows.slice(1).filter(r => r.some(c => c.trim() !== ''));
  setDisplayText(raw);
  speechScript = tableToSpeechScript(headers, data);
  setTableMode(true);
  setStatus('Tabela CSV detetada. Leitura adaptada.');
}

async function handleXLSX(file) {
  if (typeof XLSX === 'undefined') throw new Error('SheetJS não carregado');
  const buffer   = await readAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length === 0) return;
  const headers = rows[0].map((h, i) => String(h).trim() || `Coluna ${i + 1}`);
  const data    = rows.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => r.map(c => String(c)));
  setDisplayText(rows.map(r => r.join(' | ')).join('\n'));
  speechScript = tableToSpeechScript(headers, data);
  setTableMode(true);
  setStatus('Tabela Excel detetada. Leitura adaptada.');
}

// ============================================================
// CSV parser (handles quoted fields)
// ============================================================
function parseDelimited(text) {
  const lines     = text.trim().split('\n');
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  return lines.map(line => {
    const result = [];
    let current  = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// ============================================================
// Table detection — Markdown & HTML paste
// ============================================================
function checkForMarkdownTable(text) {
  const lines     = text.split('\n');
  const pipeLines = lines.filter(l => l.trim().startsWith('|') && l.includes('|'));
  if (pipeLines.length < 3) return;

  const parsed = pipeLines
    .filter(l => !l.match(/^\|\s*[-:]+[\s|:-]*\|/))
    .map(l => l.split('|').slice(1, -1).map(c => c.trim()));

  if (parsed.length < 2) return;

  speechScript = tableToSpeechScript(parsed[0], parsed.slice(1));
  setTableMode(true);
}

display.addEventListener('paste', (e) => {
  const html = e.clipboardData.getData('text/html');
  if (!html || !html.toLowerCase().includes('<table')) return;

  e.preventDefault();
  const tables = parseHTMLTables(html);
  if (tables.length === 0) return;

  const plain = e.clipboardData.getData('text/plain');
  setDisplayText(
    plain ||
    tables.map(t => [t.headers, ...t.rows].map(r => r.join(' | ')).join('\n')).join('\n\n')
  );
  speechScript = tables.map(t => tableToSpeechScript(t.headers, t.rows)).join('\n\n');
  setTableMode(true);
  setStatus('Tabela detetada. Leitura adaptada.');
});

function parseHTMLTables(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return Array.from(div.querySelectorAll('table')).map(table => {
    const rows   = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return null;
    const first  = rows[0];
    const hasTH  = first.querySelectorAll('th').length > 0;
    const hCells = hasTH ? first.querySelectorAll('th') : first.querySelectorAll('td');
    const headers = Array.from(hCells).map((c, i) => c.innerText.trim() || `Coluna ${i + 1}`);
    const data    = rows.slice(1)
      .map(row => Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim()))
      .filter(r => r.some(c => c !== ''));
    return { headers, rows: data };
  }).filter(Boolean);
}

// ============================================================
// Table → Speech script
// ============================================================
function tableToSpeechScript(headers, rows) {
  const cols = headers.length;
  const n    = rows.length;
  let s = `Tabela com ${cols} ${cols === 1 ? 'coluna' : 'colunas'} e ${n} ${n === 1 ? 'linha' : 'linhas'}. `;
  s += `Cabeçalhos: ${headers.join(', ')}. `;
  rows.forEach((row, i) => {
    s += `Linha ${i + 1}: `;
    headers.forEach((h, j) => {
      const val = row[j] !== undefined ? String(row[j]).trim() : '';
      if (val !== '') s += `${h}, ${val}. `;
    });
  });
  return s.trim();
}

// ============================================================
// Table mode helpers
// ============================================================
function setTableMode(active) {
  tableDetected    = active;
  tableBadge.hidden = !active;
}

function clearTableMode() {
  speechScript = null;
  setTableMode(false);
}

// ============================================================
// Display helpers
// ============================================================
function setDisplayText(text) {
  clearTableMode();
  if (synth.speaking) synth.cancel();
  stopKokoro();
  display.innerText = text;
}

function wrapWords(text) {
  display.innerHTML = '';
  text.split(/(\s+)/).forEach(part => {
    if (/\s+/.test(part)) {
      display.appendChild(document.createTextNode(part));
    } else if (part.length > 0) {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = part;
      display.appendChild(span);
    }
  });
  words = Array.from(display.querySelectorAll('.word'));
}

function clearHighlight() {
  words.forEach(w => w.classList.remove('active'));
}

function highlightWord(charIndex, text) {
  let count = 0, pos = 0;
  while (pos < charIndex) {
    const m = text.slice(pos).search(/\S+/);
    if (m === -1) break;
    pos += m;
    const e = text.slice(pos).search(/\s|$/);
    pos += e === -1 ? text.length - pos : e;
    count++;
  }
  clearHighlight();
  if (words[count]) {
    words[count].classList.add('active');
    words[count].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function setStatus(msg) { statusEl.textContent = msg; }
function setProgress(f)  { progressBar.style.width = Math.min(100, f * 100) + '%'; }

// ============================================================
// Speech — Web Speech API
// ============================================================
function playWebSpeech(ttsText) {
  synth.cancel();
  if (!tableDetected) wrapWords(display.innerText.trim());

  utterance         = new SpeechSynthesisUtterance(ttsText);
  const voice       = voices.find(v => v.name === voiceSelect.value);
  if (voice) utterance.voice = voice;
  utterance.rate    = parseFloat(rateRange.value);
  utterance.pitch   = parseFloat(pitchRange.value);

  utterance.onstart = () => {
    btnPlay.disabled  = true;
    btnPause.disabled = false;
    btnStop.disabled  = false;
    progressWrapper.classList.add('active');
    setStatus('A ler...');
    isPaused = false;
    setupMediaSession();
    setMediaSessionState('playing');
    if (wakeLockToggle.checked) requestWakeLock();
  };

  utterance.onboundary = (e) => {
    if (e.name !== 'word') return;
    setProgress(e.charIndex / ttsText.length);
    if (!tableDetected) highlightWord(e.charIndex, ttsText);
  };

  utterance.onend = () => {
    clearHighlight();
    resetButtons();
    setProgress(1);
    setStatus('Concluído.');
    setMediaSessionState('none');
    releaseWakeLock();
    setTimeout(() => {
      progressWrapper.classList.remove('active');
      setProgress(0);
    }, 1200);
  };

  utterance.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    resetButtons();
    setStatus('Erro: ' + e.error);
    setMediaSessionState('none');
    releaseWakeLock();
  };

  synth.speak(utterance);
}

// ============================================================
// Speech — Kokoro AI
// ============================================================
function splitIntoSentences(text) {
  // Split on sentence-ending punctuation, keeping the punctuation
  const parts = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}

async function playAudioBuffer(ctx, floatArray, sampleRate) {
  return new Promise((resolve, reject) => {
    const buffer = ctx.createBuffer(1, floatArray.length, sampleRate);
    buffer.copyToChannel(floatArray, 0);
    const source = ctx.createBufferSource();
    currentSource = source;
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = resolve;
    source.start();
  });
}

function waitForKokoroResume() {
  return new Promise(resolve => { resumeResolver = resolve; });
}

async function playKokoro(ttsText) {
  try {
    await loadKokoro();
  } catch {
    return; // loadKokoro already set status and fell back
  }

  const voice     = kokoroVoiceSelect.value;
  const sentences = splitIntoSentences(ttsText);
  const total     = sentences.length;

  audioCtx     = new AudioContext();
  kokoroPlaying = true;
  kokoroPaused  = false;

  btnPlay.disabled  = true;
  btnPause.disabled = false;
  btnStop.disabled  = false;
  progressWrapper.classList.add('active');
  setupMediaSession();
  setMediaSessionState('playing');
  if (wakeLockToggle.checked) requestWakeLock();

  if (!tableDetected) wrapWords(display.innerText.trim());

  for (let i = 0; i < sentences.length; i++) {
    if (!kokoroPlaying) break;

    while (kokoroPaused) {
      setStatus('Em pausa.');
      await waitForKokoroResume();
      if (!kokoroPlaying) break;
      setStatus('A ler...');
      setMediaSessionState('playing');
    }
    if (!kokoroPlaying) break;

    setStatus(`A gerar voz… frase ${i + 1}/${total}`);
    let result;
    try {
      result = await kokoroTTS.generate(sentences[i], { voice });
    } catch (err) {
      setStatus('Erro Kokoro: ' + err.message);
      break;
    }

    if (!kokoroPlaying) break;

    setProgress((i + 0.5) / total);
    setStatus('A ler...');

    try {
      await playAudioBuffer(audioCtx, result.audio, result.sampling_rate);
    } catch {
      // source was stopped (user pressed stop)
      break;
    }

    setProgress((i + 1) / total);
  }

  if (kokoroPlaying) {
    // Finished naturally
    setStatus('Concluído.');
    setProgress(1);
  }

  kokoroPlaying = false;
  clearHighlight();
  resetButtons();
  setMediaSessionState('none');
  releaseWakeLock();
  setTimeout(() => {
    progressWrapper.classList.remove('active');
    setProgress(0);
  }, 1200);
}

function pauseKokoro() {
  if (!kokoroPlaying || kokoroPaused) return;
  kokoroPaused = true;
  if (audioCtx) audioCtx.suspend();
  btnPause.textContent = '▶ Retomar';
  setMediaSessionState('paused');
}

function resumeKokoro() {
  if (!kokoroPaused) return;
  kokoroPaused = false;
  if (audioCtx) audioCtx.resume();
  btnPause.textContent = '⏸ Pausa';
  setMediaSessionState('playing');
  if (resumeResolver) { resumeResolver(); resumeResolver = null; }
}

function stopKokoro() {
  kokoroPlaying = false;
  kokoroPaused  = false;
  if (resumeResolver) { resumeResolver(); resumeResolver = null; }
  if (currentSource) { try { currentSource.stop(); } catch {} currentSource = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

// ============================================================
// Unified play / pause / stop
// ============================================================
function play() {
  const raw     = speechScript || display.innerText.trim();
  if (!raw) { setStatus('Sem texto para ler.'); return; }
  const ttsText = applyDict(raw);

  if (ttsEngine === 'kokoro') {
    playKokoro(ttsText);
  } else {
    playWebSpeech(ttsText);
  }
}

function pause() {
  if (ttsEngine === 'kokoro') {
    if (kokoroPaused) resumeKokoro();
    else pauseKokoro();
  } else {
    if (synth.speaking && !synth.paused) {
      synth.pause();
      isPaused = true;
      btnPause.textContent = '▶ Retomar';
      setStatus('Em pausa.');
      setMediaSessionState('paused');
    } else if (synth.paused) {
      synth.resume();
      isPaused = false;
      btnPause.textContent = '⏸ Pausa';
      setStatus('A ler...');
      setMediaSessionState('playing');
    }
  }
}

function stop() {
  synth.cancel();
  stopKokoro();
  clearHighlight();
  resetButtons();
  setProgress(0);
  progressWrapper.classList.remove('active');
  setStatus('Parado.');
  setMediaSessionState('none');
  releaseWakeLock();
}

function resetButtons() {
  btnPlay.disabled  = false;
  btnPause.disabled = true;
  btnStop.disabled  = true;
  btnPause.textContent = '⏸ Pausa';
  isPaused = false;
}

// ============================================================
// Event listeners
// ============================================================
btnPlay.addEventListener('click', play);
btnPause.addEventListener('click', pause);
btnStop.addEventListener('click', stop);

btnClear.addEventListener('click', () => {
  stop();
  clearFile();
});

// Fixed: use else-if to avoid double-triggering Space when both conditions are true
document.addEventListener('keydown', (e) => {
  if (e.target === display) return;
  if (e.code === 'Escape') { stop(); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!btnPause.disabled) pause();
    else if (!btnPlay.disabled) play();
  }
});

display.addEventListener('input', () => {
  if (synth.speaking) stop();
  if (kokoroPlaying) stop();
  clearTableMode();
  const text = display.innerText.trim();
  updateReadingInfo(text);
});

// ============================================================
// Input Tabs
// ============================================================
inputTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    inputTabs.forEach(t => t.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1))
      .classList.add('active');
  });
});

// ============================================================
// URL Fetch
// ============================================================
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

btnFetchUrl.addEventListener('click', fetchUrl);
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchUrl(); });

async function fetchUrl() {
  const raw = urlInput.value.trim();
  if (!raw) return;
  let url = raw;
  if (!url.startsWith('http')) url = 'https://' + url;

  urlLoadingEl.hidden = false;
  urlLoadingFill.style.width = '20%';
  urlLoadingText.textContent = 'A ligar à página...';
  btnFetchUrl.disabled = true;

  try {
    urlLoadingFill.style.width = '50%';
    const res  = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    urlLoadingFill.style.width = '80%';

    const html   = json.contents || '';
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');

    // Remove noise elements
    ['script','style','nav','header','footer','aside','[role="banner"]',
     '[role="navigation"]','[role="complementary"]'].forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Try to find article body, fall back to body
    const article = doc.querySelector('article, [role="main"], main, .content, .post-content, .entry-content');
    const text    = (article || doc.body).innerText.trim();

    if (!text) throw new Error('Não foi possível extrair texto desta página.');

    urlLoadingFill.style.width = '100%';
    setDisplayText(text);
    updateReadingInfo(text);
    setStatus('Página carregada. Pronto para ouvir.');

    // Switch to text view
    inputTabs.forEach(t => t.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="file"]').classList.add('active');
    document.getElementById('tabFile').classList.add('active');

    setTimeout(() => { urlLoadingEl.hidden = true; }, 800);
  } catch (err) {
    urlLoadingEl.hidden = true;
    setStatus('Erro ao carregar URL: ' + err.message);
  } finally {
    btnFetchUrl.disabled = false;
  }
}

// ============================================================
// Camera / OCR (Tesseract.js — lazy loaded)
// ============================================================
let tesseractWorker = null;

btnCamera.addEventListener('click', () => cameraInput.click());
cameraInput.addEventListener('change', (e) => {
  if (e.target.files[0]) runOCR(e.target.files[0]);
});

async function runOCR(imageFile) {
  ocrLoadingEl.hidden = false;
  ocrLoadingFill.style.width = '10%';
  ocrLoadingText.textContent = 'A carregar motor OCR...';

  try {
    if (!tesseractWorker) {
      const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm');
      ocrLoadingFill.style.width = '30%';
      ocrLoadingText.textContent = 'A inicializar reconhecimento de texto...';
      tesseractWorker = await createWorker('por+eng', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        langPath:   'https://tessdata.projectnaptha.com/4.0.0_fast',
        corePath:   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
        logger: (m) => {
          if (m.status === 'recognizing text') {
            ocrLoadingFill.style.width = (30 + m.progress * 60) + '%';
            ocrLoadingText.textContent = `A reconhecer texto… ${Math.round(m.progress * 100)}%`;
          }
        },
      });
    } else {
      ocrLoadingFill.style.width = '30%';
    }

    ocrLoadingText.textContent = 'A analisar imagem...';
    const { data } = await tesseractWorker.recognize(imageFile);
    const text = data.text.trim();

    if (!text) throw new Error('Não foi possível extrair texto da imagem.');

    ocrLoadingFill.style.width = '100%';
    setDisplayText(text);
    updateReadingInfo(text);
    setStatus('Texto extraído da imagem. Pronto para ouvir.');

    // Switch to file tab view
    inputTabs.forEach(t => t.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="file"]').classList.add('active');
    document.getElementById('tabFile').classList.add('active');

    setTimeout(() => { ocrLoadingEl.hidden = true; }, 800);
  } catch (err) {
    ocrLoadingEl.hidden = true;
    setStatus('Erro OCR: ' + err.message);
  }
  cameraInput.value = '';
}

// ============================================================
// Reading List (localStorage)
// ============================================================
const LIBRARY_KEY = 'vocaliz-library';
const LIBRARY_MAX = 30;

function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]'); }
  catch { return []; }
}

function saveLibrary(items) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
}

function renderLibrary() {
  const items = loadLibrary();
  libraryCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} guardado${items.length !== 1 ? 's' : ''}`;
  libraryEmpty.hidden = items.length > 0;
  // Remove existing item elements (keep libraryEmpty)
  Array.from(libraryList.querySelectorAll('.library-item')).forEach(el => el.remove());

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'library-item';
    li.innerHTML = `
      <div class="library-item-body">
        <span class="library-item-title">${escapeHtml(item.title)}</span>
        <span class="library-item-meta">${item.date} · ${item.words} palavras</span>
      </div>
      <div class="library-item-actions">
        <button class="btn-lib-load" data-id="${item.id}" title="Carregar">▶</button>
        <button class="btn-lib-delete" data-id="${item.id}" title="Apagar">✕</button>
      </div>`;
    libraryList.appendChild(li);
  });
}

function addToLibrary() {
  const text = display.innerText.trim();
  if (!text) { setStatus('Sem texto para guardar.'); return; }

  const items = loadLibrary();
  const words = text.split(/\s+/).length;
  const title = text.slice(0, 70).replace(/\n/g, ' ') + (text.length > 70 ? '…' : '');
  const item  = {
    id:    Date.now().toString(),
    title,
    text,
    words,
    date:  new Date().toLocaleDateString('pt-PT'),
  };

  items.unshift(item);
  if (items.length > LIBRARY_MAX) items.splice(LIBRARY_MAX);
  saveLibrary(items);
  renderLibrary();
  setStatus('Guardado na lista de leitura.');
}

libraryList.addEventListener('click', (e) => {
  const loadBtn   = e.target.closest('.btn-lib-load');
  const deleteBtn = e.target.closest('.btn-lib-delete');

  if (loadBtn) {
    const items = loadLibrary();
    const item  = items.find(i => i.id === loadBtn.dataset.id);
    if (item) {
      setDisplayText(item.text);
      updateReadingInfo(item.text);
      setStatus('Texto carregado. Pronto para ouvir.');
      // Switch to file tab
      inputTabs.forEach(t => t.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="file"]').classList.add('active');
      document.getElementById('tabFile').classList.add('active');
    }
  }

  if (deleteBtn) {
    const items   = loadLibrary().filter(i => i.id !== deleteBtn.dataset.id);
    saveLibrary(items);
    renderLibrary();
  }
});

btnSaveToLibrary.addEventListener('click', addToLibrary);
btnSaveInline.addEventListener('click', addToLibrary);

// Init library render
renderLibrary();
