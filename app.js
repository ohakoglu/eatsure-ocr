// app.js — TAMAMINI DEĞİŞTİR

// --- Simple local storage for backend url ---
const LS_BACKEND = "eatsure_backend_url";
const LS_MAXDIM = "eatsure_ocr_maxdim";
const LS_LANG = "eatsure_ocr_lang";
const LS_PREP = "eatsure_ocr_prep";
const LS_PSM = "eatsure_ocr_psm";

const backendUrlEl = document.getElementById("backendUrl");
const saveBackendBtn = document.getElementById("saveBackend");
const checkHealthBtn = document.getElementById("checkHealth");
const healthResultEl = document.getElementById("healthResult");

const fileInput = document.getElementById("fileInput");
const previewImg = document.getElementById("previewImg");

const runOcrBtn = document.getElementById("runOcr");
const sendToBackendBtn = document.getElementById("sendToBackend");

const ocrTextEl = document.getElementById("ocrText");
const resultEl = document.getElementById("result");

let selectedFile = null;
let currentWorker = null;
let lastLogAt = 0;

// -----------------------------
// Helpers
// -----------------------------
function nowMs() {
  return Date.now();
}

function getBaseUrl() {
  return (localStorage.getItem(LS_BACKEND) || backendUrlEl.value || "")
    .trim()
    .replace(/\/+$/, "");
}

function setResult(objOrText) {
  if (typeof objOrText === "string") resultEl.textContent = objOrText;
  else resultEl.textContent = JSON.stringify(objOrText, null, 2);
}

function setStatusLine(text) {
  // sonuç alanına tek satır yazma (spam azaltır)
  resultEl.textContent = text;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function ensureOcrSettingsUi() {
  if (document.getElementById("ocrSettingsCard")) return;

  const main = document.querySelector("main.wrap") || document.body;

  const card = document.createElement("section");
  card.className = "card";
  card.id = "ocrSettingsCard";

  card.innerHTML = `
    <label class="label">OCR Ayarları</label>

    <div class="row" style="gap:10px; flex-wrap:wrap;">
      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">Görsel max boyut</div>
        <select id="maxDimSelect" class="input" style="height:42px;">
          <option value="1024">1024 (stabil)</option>
          <option value="1280" selected>1280 (denge)</option>
          <option value="1600">1600 (daha iyi)</option>
          <option value="2048">2048 (yavaş)</option>
        </select>
      </div>

      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">Dil</div>
        <select id="langSelect" class="input" style="height:42px;">
          <option value="eng" selected>eng (en stabil)</option>
          <option value="tur">tur</option>
          <option value="eng+tur">eng+tur (daha ağır)</option>
        </select>
      </div>

      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">PSM (düzen)</div>
        <select id="psmSelect" class="input" style="height:42px;">
          <option value="6" selected>6 (blok metin)</option>
          <option value="3">3 (otomatik)</option>
          <option value="11">11 (dağınık)</option>
        </select>
      </div>

      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">Ön işleme</div>
        <select id="prepSelect" class="input" style="height:42px;">
          <option value="off" selected>Kapalı (stabil)</option>
          <option value="on">Açık (bazen daha iyi)</option>
        </select>
      </div>
    </div>

    <p class="muted small" style="margin-top:10px;">
      iPhone’da ilk hedef: <b>stabil çalışsın</b>. Sonra kalite artırırız.
    </p>
  `;

  const cards = main.querySelectorAll("section.card");
  if (cards && cards.length > 1) main.insertBefore(card, cards[1]);
  else main.appendChild(card);

  const maxDimSel = document.getElementById("maxDimSelect");
  const langSel = document.getElementById("langSelect");
  const prepSel = document.getElementById("prepSelect");
  const psmSel = document.getElementById("psmSelect");

  const savedMaxDim = localStorage.getItem(LS_MAXDIM);
  const savedLang = localStorage.getItem(LS_LANG);
  const savedPrep = localStorage.getItem(LS_PREP);
  const savedPsm = localStorage.getItem(LS_PSM);

  if (savedMaxDim) maxDimSel.value = savedMaxDim;
  if (savedLang) langSel.value = savedLang;
  if (savedPrep) prepSel.value = savedPrep;
  if (savedPsm) psmSel.value = savedPsm;

  maxDimSel.addEventListener("change", () => localStorage.setItem(LS_MAXDIM, String(maxDimSel.value)));
  langSel.addEventListener("change", () => localStorage.setItem(LS_LANG, String(langSel.value)));
  prepSel.addEventListener("change", () => localStorage.setItem(LS_PREP, String(prepSel.value)));
  psmSel.addEventListener("change", () => localStorage.setItem(LS_PSM, String(psmSel.value)));
}

function getOcrSettings() {
  const maxDim = parseInt(localStorage.getItem(LS_MAXDIM) || "1280", 10) || 1280;
  const lang = localStorage.getItem(LS_LANG) || "eng";
  const preprocessing = (localStorage.getItem(LS_PREP) || "off") === "on";
  const psm = parseInt(localStorage.getItem(LS_PSM) || "6", 10) || 6;
  return { maxDim, lang, preprocessing, psm };
}

// -----------------------------
// Init
// -----------------------------
backendUrlEl.value = localStorage.getItem(LS_BACKEND) || "https://eatsure-backend-4dkh.onrender.com";
ensureOcrSettingsUi();

saveBackendBtn.addEventListener("click", () => {
  const v = (backendUrlEl.value || "").trim().replace(/\/+$/, "");
  localStorage.setItem(LS_BACKEND, v);
  backendUrlEl.value = v;
  healthResultEl.textContent = "Kaydedildi.";
});

checkHealthBtn.addEventListener("click", async () => {
  healthResultEl.textContent = "Kontrol ediliyor...";
  const base = getBaseUrl();
  try {
    const r = await fetch(`${base}/health`);
    const t = await r.text();
    healthResultEl.textContent = `${r.status} ${t}`;
  } catch (e) {
    healthResultEl.textContent = `Hata: ${e.message}`;
  }
});

// -----------------------------
// File selection
// -----------------------------
fileInput.addEventListener("change", () => {
  const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  selectedFile = f;

  if (!f) {
    previewImg.src = "";
    previewImg.style.display = "none";
    return;
  }

  const url = URL.createObjectURL(f);
  previewImg.src = url;
  previewImg.style.display = "block";
});

// -----------------------------
// Image prep (downscale only, preprocess opsiyonel)
// -----------------------------
async function loadImageFromFile(file) {
  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = imgUrl;
    });
    return img;
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

async function prepareImageBlob(file, { maxDim = 1280, jpegQuality = 0.85, preprocessing = false } = {}) {
  const img = await loadImageFromFile(file);

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Görsel boyutu okunamadı.");

  const scale = Math.min(1, maxDim / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, nw, nh);

  if (preprocessing) {
    // Çok hafif gri + kontrast (agresif sharpen yok)
    const imgData = ctx.getImageData(0, 0, nw, nh);
    const d = imgData.data;
    const contrast = 1.2;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      let v = y * contrast + intercept;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const blob = await new Promise(resolve => {
    canvas.toBlob(b => resolve(b), "image/jpeg", jpegQuality);
  });

  if (!blob) throw new Error("Görsel dönüştürülemedi.");
  return blob;
}

// -----------------------------
// Tesseract worker (CDN paths pinned)
// -----------------------------
const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5";
const TESSERACT_WORKER_PATH = `${TESSERACT_CDN}/dist/worker.min.js`;
const TESSERACT_CORE_PATH = `${TESSERACT_CDN}/dist/tesseract-core.wasm.js`;
const TESSERACT_LANG_PATH = `https://tessdata.projectnaptha.com/4.0.0`;

function tlog(msg) {
  lastLogAt = nowMs();
  setStatusLine(String(msg));
}

async function terminateWorker() {
  try {
    if (currentWorker) {
      await currentWorker.terminate();
    }
  } catch {}
  currentWorker = null;
}

async function runOcrOnImage(file) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js yüklenmemiş. index.html'e CDN script'i ekle.");
  }

  await terminateWorker();

  const { maxDim, lang, preprocessing, psm } = getOcrSettings();

  tlog("Görsel hazırlanıyor...");
  const imgBlob = await prepareImageBlob(file, { maxDim, jpegQuality: 0.85, preprocessing });

  // Watchdog: 90sn log yoksa kilitlendi say
  let watchdogAlive = true;
  const watchdog = (async () => {
    const start = nowMs();
    while (watchdogAlive) {
      await sleep(1000);
      const idle = nowMs() - lastLogAt;
      const total = nowMs() - start;
      if (idle > 90000 || total > 120000) {
        // 90 sn hiç log yoksa veya 120 sn geçtiyse
        throw new Error("OCR kilitlendi (iOS/worker). Dil/çözünürlük düşürüp tekrar dene.");
      }
    }
  })();

  try {
    lastLogAt = nowMs();

    tlog("OCR motoru hazırlanıyor (worker)...");
    currentWorker = await window.Tesseract.createWorker({
      logger: m => {
        // TÜM durumları yazdır (asıl fark burada)
        if (m && m.status) {
          const pct = (typeof m.progress === "number") ? ` %${Math.floor(m.progress * 100)}` : "";
          tlog(`${m.status}${pct}`);
        }
      },
      workerPath: TESSERACT_WORKER_PATH,
      corePath: TESSERACT_CORE_PATH,
      langPath: TESSERACT_LANG_PATH
    });

    tlog(`Dil indiriliyor/yükleniyor: ${lang}...`);
    await currentWorker.loadLanguage(lang);

    tlog("Dil initialize ediliyor...");
    await currentWorker.initialize(lang);

    // PSM ayarı
    await currentWorker.setParameters({
      tessedit_pageseg_mode: String(psm)
    });

    tlog("Metin okunuyor...");
    const { data } = await currentWorker.recognize(imgBlob);

    const text = data && data.text ? String(data.text) : "";
    return text.trim();
  } finally {
    watchdogAlive = false;
    // watchdog promise hata fırlatmış olabilir -> yakala
    watchdog.catch(async (e) => {
      await terminateWorker();
      setResult(`OCR hata: ${e.message}`);
    });
  }
}

// -----------------------------
// OCR button
// -----------------------------
runOcrBtn.addEventListener("click", async () => {
  setResult("");
  if (!selectedFile) {
    setResult("Önce fotoğraf seç.");
    return;
  }

  runOcrBtn.disabled = true;
  sendToBackendBtn.disabled = true;
  runOcrBtn.textContent = "OCR çalışıyor...";

  try {
    const text = await runOcrOnImage(selectedFile);
    ocrTextEl.value = text || "";
    setResult(text ? "OCR tamamlandı." : "OCR tamamlandı ama metin boş görünüyor.");
  } catch (e) {
    await terminateWorker();
    setResult(`OCR hata: ${e.message}`);
  } finally {
    runOcrBtn.disabled = false;
    sendToBackendBtn.disabled = false;
    runOcrBtn.textContent = "OCR Başlat";
  }
});

// -----------------------------
// Send to backend (POST /analyze-label)
// -----------------------------
sendToBackendBtn.addEventListener("click", async () => {
  setResult("");
  const labelText = (ocrTextEl.value || "").trim();
  if (!labelText) {
    setResult("OCR metni boş. Önce OCR çalıştır veya metni yapıştır.");
    return;
  }

  const base = getBaseUrl();

  sendToBackendBtn.disabled = true;
  sendToBackendBtn.textContent = "Analiz ediliyor...";

  try {
    const payload = { labelText };

    const r = await fetch(`${base}/analyze-label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }

    if (!r.ok) {
      setResult({ error: "BACKEND_ERROR", status: r.status, response: data });
      return;
    }

    setResult(data);
  } catch (e) {
    setResult(`Backend hata: ${e.message}`);
  } finally {
    sendToBackendBtn.disabled = false;
    sendToBackendBtn.textContent = "Analiz Et";
  }
});
