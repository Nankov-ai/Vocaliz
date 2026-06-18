// ============================================================
// DOM
// ============================================================
const display         = document.getElementById('display');
const btnPlay         = document.getElementById('btnPlay');
const btnPause        = document.getElementById('btnPause');
const btnStop         = document.getElementById('btnStop');
const btnClear        = document.getElementById('btnClear');
const voiceSelect     = document.getElementById('voiceSelect');
const rateRange       = document.getElementById('rateRange');
const pitchRange      = document.getElementById('pitchRange');
const rateValue       = document.getElementById('rateValue');
const pitchValue      = document.getElementById('pitchValue');
const progressBar     = document.getElementById('progressBar');
const progressWrapper = document.getElementById('progressWrapper');
const statusEl        = document.getElementById('status');
const uploadZone      = document.getElementById('uploadZone');
const uploadInner     = document.getElementById('uploadInner');
const fileInput       = document.getElementById('fileInput');
const btnBrowse       = document.getElementById('btnBrowse');
const fileInfoEl      = document.getElementById('fileInfo');
const fileNameEl      = document.getElementById('fileName');
const btnRemoveFile   = document.getElementById('btnRemoveFile');
const tableBadge      = document.getElementById('tableBadge');

// ============================================================
// State
// ============================================================
const synth = window.speechSynthesis;
let voices      = [];
let utterance   = null;
let words       = [];
let isPaused    = false;
let speechScript  = null;   // TTS text override (used for tables)
let tableDetected = false;

// PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ============================================================
// Voices
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
// Sliders
// ============================================================
rateRange.addEventListener('input', () => {
  rateValue.textContent = parseFloat(rateRange.value).toFixed(1) + 'x';
});
pitchRange.addEventListener('input', () => {
  pitchValue.textContent = parseFloat(pitchRange.value).toFixed(1);
});

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

    // Check for markdown tables in loaded text
    checkForMarkdownTable(display.innerText);
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
  const headers  = rows[0].map((h, i) => String(h).trim() || `Coluna ${i + 1}`);
  const data     = rows.slice(1)
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
    .filter(l => !l.match(/^\|\s*[-:]+[\s|:-]*\|/))  // remove separator rows
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
  if (synth.speaking) stop();
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
function setProgress(f) { progressBar.style.width = Math.min(100, f * 100) + '%'; }

// ============================================================
// Speech
// ============================================================
function play() {
  const ttsText = speechScript || display.innerText.trim();
  if (!ttsText) { setStatus('Sem texto para ler.'); return; }

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
    setTimeout(() => {
      progressWrapper.classList.remove('active');
      setProgress(0);
    }, 1200);
  };

  utterance.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    resetButtons();
    setStatus('Erro: ' + e.error);
  };

  synth.speak(utterance);
}

function pause() {
  if (synth.speaking && !synth.paused) {
    synth.pause();
    isPaused = true;
    btnPause.textContent = '▶ Retomar';
    setStatus('Em pausa.');
  } else if (synth.paused) {
    synth.resume();
    isPaused = false;
    btnPause.textContent = '⏸ Pausa';
    setStatus('A ler...');
  }
}

function stop() {
  synth.cancel();
  clearHighlight();
  resetButtons();
  setProgress(0);
  progressWrapper.classList.remove('active');
  setStatus('Parado.');
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

document.addEventListener('keydown', (e) => {
  if (e.target === display) return;
  if (e.code === 'Space' && !btnPlay.disabled)  { e.preventDefault(); play(); }
  if (e.code === 'Space' && !btnPause.disabled) { e.preventDefault(); pause(); }
  if (e.code === 'Escape') stop();
});

display.addEventListener('input', () => {
  if (synth.speaking) stop();
  clearTableMode();
});
