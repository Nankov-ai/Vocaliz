const VOCALIZ_URL = 'https://nankov-ai.github.io/Vocaliz/';
const statusEl   = document.getElementById('status');

function showStatus(msg, type = '') {
  statusEl.textContent  = msg;
  statusEl.className    = 'status ' + type;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectAndGetSelection(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.getSelection().toString().trim(),
  });
  return results[0]?.result || '';
}

async function injectAndGetPageText(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Remove scripts and styles
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
      return (clone.innerText || clone.textContent || '').trim().slice(0, 50000);
    },
  });
  return results[0]?.result || '';
}

document.getElementById('btnSelection').addEventListener('click', async () => {
  try {
    const tab  = await getActiveTab();
    const text = await injectAndGetSelection(tab.id);
    if (!text) { showStatus('Nenhum texto selecionado na página.', 'error'); return; }
    const url = VOCALIZ_URL + '?text=' + encodeURIComponent(text);
    chrome.tabs.create({ url });
    window.close();
  } catch (err) {
    showStatus('Erro: ' + err.message, 'error');
  }
});

document.getElementById('btnPage').addEventListener('click', async () => {
  try {
    showStatus('A extrair texto da página...');
    const tab  = await getActiveTab();
    const text = await injectAndGetPageText(tab.id);
    if (!text) { showStatus('Não foi possível extrair texto.', 'error'); return; }
    const url = VOCALIZ_URL + '?text=' + encodeURIComponent(text);
    chrome.tabs.create({ url });
    window.close();
  } catch (err) {
    showStatus('Erro: ' + err.message, 'error');
  }
});

document.getElementById('btnOpen').addEventListener('click', () => {
  chrome.tabs.create({ url: VOCALIZ_URL });
  window.close();
});
