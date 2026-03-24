const display     = document.getElementById('display');
const btnPlay     = document.getElementById('btnPlay');
const btnPause    = document.getElementById('btnPause');
const btnStop     = document.getElementById('btnStop');
const btnClear    = document.getElementById('btnClear');
const voiceSelect = document.getElementById('voiceSelect');
const rateRange   = document.getElementById('rateRange');
const pitchRange  = document.getElementById('pitchRange');
const rateValue   = document.getElementById('rateValue');
const pitchValue  = document.getElementById('pitchValue');
const progressBar = document.getElementById('progressBar');
const progressWrapper = document.getElementById('progressWrapper');
const statusEl    = document.getElementById('status');

const synth = window.speechSynthesis;
let voices = [];
let utterance = null;
let words = [];
let wordIndex = 0;
let isPaused = false;

// Load voices (may fire async in Chrome)
function loadVoices() {
  voices = synth.getVoices();
  voiceSelect.innerHTML = '';

  // Prefer Portuguese voices first
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

  sorted.forEach((voice, i) => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})`;
    if (voice.lang.startsWith('pt')) opt.textContent = '⭐ ' + opt.textContent;
    voiceSelect.appendChild(opt);
  });
}

loadVoices();
if (synth.onvoiceschanged !== undefined) {
  synth.onvoiceschanged = loadVoices;
}

// Sliders
rateRange.addEventListener('input', () => {
  rateValue.textContent = parseFloat(rateRange.value).toFixed(1) + 'x';
});
pitchRange.addEventListener('input', () => {
  pitchValue.textContent = parseFloat(pitchRange.value).toFixed(1);
});

// Wrap plain text words in spans for highlighting
function wrapWords(text) {
  // Split preserving whitespace and punctuation attached to words
  display.innerHTML = '';
  const parts = text.split(/(\s+)/);
  parts.forEach(part => {
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

function highlightWord(index) {
  clearHighlight();
  if (words[index]) {
    words[index].classList.add('active');
    words[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setProgress(fraction) {
  progressBar.style.width = Math.min(100, fraction * 100) + '%';
}

function play() {
  const rawText = display.innerText.trim();
  if (!rawText) {
    setStatus('Sem texto para ler.');
    return;
  }

  synth.cancel();
  wrapWords(rawText);
  wordIndex = 0;

  utterance = new SpeechSynthesisUtterance(rawText);

  // Voice
  const selectedVoiceName = voiceSelect.value;
  const voice = voices.find(v => v.name === selectedVoiceName);
  if (voice) utterance.voice = voice;

  utterance.rate  = parseFloat(rateRange.value);
  utterance.pitch = parseFloat(pitchRange.value);

  utterance.onstart = () => {
    btnPlay.disabled  = true;
    btnPause.disabled = false;
    btnStop.disabled  = false;
    progressWrapper.classList.add('active');
    setStatus('A ler...');
    isPaused = false;
  };

  utterance.onboundary = (e) => {
    if (e.name === 'word') {
      // Count word index based on char position
      let count = 0;
      let pos = 0;
      const text = rawText;
      while (pos < e.charIndex) {
        const match = text.slice(pos).search(/\S+/);
        if (match === -1) break;
        pos += match;
        const end = text.slice(pos).search(/\s|$/);
        pos += end === -1 ? text.length - pos : end;
        count++;
      }
      wordIndex = count;
      highlightWord(wordIndex);
      setProgress(e.charIndex / rawText.length);
    }
  };

  utterance.onend = () => {
    clearHighlight();
    resetButtons();
    setProgress(1);
    setStatus('Leitura concluída.');
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

btnPlay.addEventListener('click', play);
btnPause.addEventListener('click', pause);
btnStop.addEventListener('click', stop);

btnClear.addEventListener('click', () => {
  stop();
  display.innerHTML = '';
  setStatus('Pronto');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target === display) return; // don't intercept while typing
  if (e.code === 'Space' && !btnPlay.disabled) { e.preventDefault(); play(); }
  if (e.code === 'Space' && !btnPause.disabled) { e.preventDefault(); pause(); }
  if (e.code === 'Escape') stop();
});

// Prevent losing text when re-playing (restore plain text from spans)
display.addEventListener('input', () => {
  // User edited — if speech was running, stop it
  if (synth.speaking) stop();
});
