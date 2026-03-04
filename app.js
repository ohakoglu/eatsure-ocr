// app.js — EatSure OCR (Tesseract.js + preprocess + settings UI)

// --- Simple local storage keys ---
const LS_BACKEND = "eatsure_backend_url";
const LS_MAXDIM = "eatsure_ocr_maxdim";
const LS_LANG = "eatsure_ocr_lang";
const LS_PREP = "eatsure_ocr_prep";
const LS_PSM = "eatsure_ocr_psm";

// --- DOM ---
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

// -----------------------------
// Helpers
// -----------------------------
function getBaseUrl() {
  return (localStorage.getItem(LS_BACKEND) || backendUrlEl.value || "")
    .trim()
    .replace(/\/+$/, "");
}

function setResult(objOrText) {
  if (typeof objOrText === "string") {
    resultEl.textContent = objOrText;
  } else {
    resultEl.textContent = JSON.stringify(objOrText, null, 2);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// -----------------------------
// OCR Settings UI (inject)
// -----------------------------
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
        <div class="muted small" style="margin-bottom:6px;">Görsel çözünürlüğü (max)</div>
        <select id="maxDimSelect" class="input" style="height:42px;">
          <option value="1024">1024 (hızlı)</option>
          <option value="1280" selected>1280 (denge)</option>
          <option value="1600">1600 (daha iyi)</option>
          <option value="2048">2048 (yavaş ama güçlü)</option>
        </select>
      </div>

      <div style="min-width:220px;">
        <div class="muted small" style="margin-bottom:6px;">Dil</div>
        <select id="langSelect" class="input" style="height:42px;">
          <option value="eng">eng (hızlı)</option>
          <option value="tur">tur (TR odak)</option>
          <option value="eng+tur" selected>eng+tur (TR+EN)</option>
          <option value="tur+ita+deu">tur+ita+deu (TR+IT+DE)</option>
          <option value="eng+tur+ita+deu">eng+tur+ita+deu (geniş)</option>
        </select>
      </div>

      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">Sayfa modu (PSM)</div>
        <select id="psmSelect" class="input" style="height:42px;">
          <option value="3">3 (auto)</option>
          <option value="4">4 (kolon)</option>
          <option value="6" selected>6 (blok metin) ✅</option>
          <option value="11">11 (dağınık metin)</option>
        </select>
      </div>

      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">Ön işleme</div>
        <select id="prepSelect" class="input" style="height:42px;">
          <option value="on" selected>Açık (önerilir)</option>
          <option value="off">Kapalı</option>
        </select>
      </div>
    </div>

    <p class="muted small" style="margin-top:10px;">
      İpucu: Bu Barilla gibi TR+IT+DE etiketlerde <b>tur+ita+deu</b> + <b>PSM 6</b> genelde iyi sonuç verir.
    </p>
  `;

  // OCR kartını etiket kartının üstüne yerleştir
  const cards = main.querySelectorAll("section.card");
  if (cards && cards.length > 1) {
    main.insertBefore(card, cards[1]);
  } else {
    main.appendChild(card);
  }

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
  const maxDimSel = document.getElementById("maxDimSelect");
  const langSel = document.getElementById("langSelect");
  const prepSel = document.getElementById("prepSelect");
  const psmSel = document.getElementById("psmSelect");

  const maxDim =
    parseInt((maxDimSel && maxDimSel.value) || localStorage.getItem(LS_MAXDIM) || "1280", 10) || 1280;

  const lang =
    (langSel && langSel.value) || localStorage.getItem(LS_LANG) || "eng+tur";

  const preprocessing =
    (prepSel && prepSel.value) ? (prepSel.value === "on") : (localStorage.getItem(LS_PREP) !== "off");

  const psm =
    parseInt((psmSel && psmSel.value) || localStorage.getItem(LS_PSM) || "6", 10) || 6;

  return { maxDim, lang, preprocessing, psm };
}

// -----------------------------
// Init
// -----------------------------
backendUrlEl.value =
  localStorage.getItem(LS_BACKEND) || "https://eatsure-backend-4dkh.onrender.com";

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
// Image prep
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

// grayscale + contrast + light sharpen
function preprocessCanvas(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Grayscale + contrast
  const contrast = 1.35; // biraz artırdık
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let y = 0.2126 * r + 0.7152 * g + 0.0722 * b; // luminance
    y = y * contrast + intercept;
    y = y < 0 ? 0 : y > 255 ? 255 : y;

    data[i] = data[i + 1] = data[i + 2] = y;
  }
  ctx.putImageData(imgData, 0, 0);

  // Light sharpen kernel
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);

  const s = src.data;
  const d = dst.data;

  const idx = (x, y) => (y * w + x) * 4;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = idx(x, y);

      const center = s[c];
      const up = s[idx(x, y - 1)];
      const down = s[idx(x, y + 1)];
      const left = s[idx(x - 1, y)];
      const right = s[idx(x + 1, y)];

      let v = 5 * center - up - down - left - right;
      v = v < 0 ? 0 : v > 255 ? 255 : v;

      d[c] = d[c + 1] = d[c + 2] = v;
      d[c + 3] = 255;
    }
  }

  // Kenarları kopyala
  for (let x = 0; x < w; x++) {
    let t0 = idx(x, 0), t1 = idx(x, h - 1);
    d[t0] = s[t0]; d[t0 + 1] = s[t0 + 1]; d[t0 + 2] = s[t0 + 2]; d[t0 + 3] = 255;
    d[t1] = s[t1]; d[t1 + 1] = s[t1 + 1]; d[t1 + 2] = s[t1 + 2]; d[t1 + 3] = 255;
  }
  for (let y = 0; y < h; y++) {
    let l0 = idx(0, y), l1 = idx(w - 1, y);
    d[l0] = s[l0]; d[l0 + 1] = s[l0 + 1]; d[l0 + 2] = s[l0 + 2]; d[l0 + 3] = 255;
    d[l1] = s[l1]; d[l1 + 1] = s[l1 + 1]; d[l1 + 2] = s[l1 + 2]; d[l1 + 3] = 255;
  }

  ctx.putImageData(dst, 0, 0);
}

async function prepareImageBlob(file, { maxDim = 1280, jpegQuality = 0.85, preprocessing = true } = {}) {
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
    preprocessCanvas(ctx, nw, nh);
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error("Görsel dönüştürülemedi."))),
      "image/jpeg",
      jpegQuality
    );
  });

  return blob;
}

// -----------------------------
// Tesseract worker (reuse)
// -----------------------------
let _worker = null;
let _workerLang = null;

async function getWorkerForLang(lang, logger) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js yüklenmemiş. index.html'e CDN script'i ekle.");
  }

  // Lang değiştiyse worker'ı kapatıp yeniden aç
  if (_worker && _workerLang && _workerLang !== lang) {
    try { await _worker.terminate(); } catch {}
    _worker = null;
    _workerLang = null;
    await sleep(50);
  }

  if (_worker) return _worker;

  // createWorker (v5)
  _worker = await window.Tesseract.createWorker({
    logger
  });

  await _worker.loadLanguage(lang);
  await _worker.initialize(lang);

  _workerLang = lang;
  return _worker;
}

async function runOcrOnImage(file) {
  const { maxDim, lang, preprocessing, psm } = getOcrSettings();

  // 1) Image prep
  const imgBlob = await prepareImageBlob(file, {
    maxDim,
    jpegQuality: 0.85,
    preprocessing
  });

  // 2) OCR
  let lastPct = -1;
  const logger = m => {
    if (m.status === "recognizing text" && typeof m.progress === "number") {
      const pct = Math.floor(m.progress * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        setResult(`OCR çalışıyor... %${pct}`);
      }
    }
  };

  const worker = await getWorkerForLang(lang, logger);

  // PSM ayarı (blok metin için 6 genelde iyi)
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: String(psm),
      preserve_interword_spaces: "1"
    });
  } catch {
    // bazı ortamlarda setParameters desteklenmezse sessiz geç
  }

  const { data } = await worker.recognize(imgBlob);

  const text = data && data.text ? String(data.text) : "";
  return text.trim();
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
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!r.ok) {
      setResult({
        error: "BACKEND_ERROR",
        status: r.status,
        response: data
      });
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
