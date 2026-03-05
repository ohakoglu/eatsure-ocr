// --- Simple local storage for backend url + ocr settings ---
const LS_BACKEND = "eatsure_backend_url";
const LS_MAXDIM = "eatsure_ocr_maxdim";
const LS_LANG = "eatsure_ocr_lang";
const LS_PREP = "eatsure_ocr_prep";

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
// UI helpers (OCR settings card)
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
          <option value="1600">1600 (daha iyi OCR)</option>
          <option value="2048">2048 (yavaş ama güçlü)</option>
        </select>
      </div>

      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">Dil</div>
        <select id="langSelect" class="input" style="height:42px;">
          <option value="eng">eng (hızlı)</option>
          <option value="tur">tur (TR ağırlıklı)</option>
          <option value="eng+tur" selected>eng+tur (TR+EN)</option>
        </select>
      </div>

      <div style="min-width:180px;">
        <div class="muted small" style="margin-bottom:6px;">Ön işleme</div>
        <select id="prepSelect" class="input" style="height:42px;">
          <option value="on" selected>Açık (basit grayscale)</option>
          <option value="off">Kapalı</option>
        </select>
      </div>
    </div>

    <p class="muted small" style="margin-top:10px;">
      Not: Bu sürüm “createWorker / workerPath / corePath” kullanmaz.
      En stabil yol olan <b>Tesseract.recognize()</b> ile çalışır.
      (Worker/CDN sorunu varsa, index.html’de jsdelivr → unpkg fallback devreye girer.)
    </p>
  `;

  // Kartı “Etiket fotoğrafı” kartının ÜSTÜNE koy
  const cards = main.querySelectorAll("section.card");
  if (cards && cards.length > 1) {
    main.insertBefore(card, cards[1]);
  } else {
    main.appendChild(card);
  }

  // Load saved settings
  const maxDimSel = document.getElementById("maxDimSelect");
  const langSel = document.getElementById("langSelect");
  const prepSel = document.getElementById("prepSelect");

  const savedMaxDim = localStorage.getItem(LS_MAXDIM);
  const savedLang = localStorage.getItem(LS_LANG);
  const savedPrep = localStorage.getItem(LS_PREP);

  if (savedMaxDim) maxDimSel.value = savedMaxDim;
  if (savedLang) langSel.value = savedLang;
  if (savedPrep) prepSel.value = savedPrep;

  maxDimSel.addEventListener("change", () => localStorage.setItem(LS_MAXDIM, String(maxDimSel.value)));
  langSel.addEventListener("change", () => localStorage.setItem(LS_LANG, String(langSel.value)));
  prepSel.addEventListener("change", () => localStorage.setItem(LS_PREP, String(prepSel.value)));
}

function getOcrSettings() {
  const maxDimSelect = document.getElementById("maxDimSelect");
  const langSelect = document.getElementById("langSelect");
  const prepSelect = document.getElementById("prepSelect");

  const maxDim =
    parseInt(
      (maxDimSelect && maxDimSelect.value) ||
        localStorage.getItem(LS_MAXDIM) ||
        "1280",
      10
    ) || 1280;

  const lang =
    (langSelect && langSelect.value) ||
    localStorage.getItem(LS_LANG) ||
    "eng+tur";

  const prepValue =
    (prepSelect && prepSelect.value) ||
    localStorage.getItem(LS_PREP) ||
    "on";

  const preprocessing = prepValue === "on";
  return { maxDim, lang, preprocessing };
}

function setResult(objOrText) {
  if (typeof objOrText === "string") {
    resultEl.textContent = objOrText;
  } else {
    resultEl.textContent = JSON.stringify(objOrText, null, 2);
  }
}

function getBaseUrl() {
  return (localStorage.getItem(LS_BACKEND) || backendUrlEl.value || "")
    .trim()
    .replace(/\/+$/, "");
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
// Image helpers
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

/**
 * ✅ Downscale + (opsiyonel) basit grayscale
 * - maxDim: 1024/1280/1600/2048
 * - preprocessing: true -> grayscale + hafif kontrast (sharpen YOK)
 */
async function prepareImageBlob(file, { maxDim = 1280, preprocessing = true } = {}) {
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
    const imgData = ctx.getImageData(0, 0, nw, nh);
    const data = imgData.data;

    // Basit grayscale + hafif kontrast
    const contrast = 1.15;
    const intercept = 128 * (1 - contrast);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      y = y * contrast + intercept;
      y = y < 0 ? 0 : y > 255 ? 255 : y;

      data[i] = data[i + 1] = data[i + 2] = y;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const blob = await new Promise(resolve => {
    canvas.toBlob(b => resolve(b), "image/jpeg", 0.9);
  });

  if (!blob) throw new Error("Görsel dönüştürülemedi.");
  return blob;
}

// -----------------------------
// Timeout helper
// -----------------------------
function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeoutPromise = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(t));
}

// -----------------------------
// OCR (Tesseract.recognize) — STABLE PATH
// -----------------------------
async function runOcrOnImage(file) {
  if (!window.Tesseract) {
    throw new Error(
      "Tesseract.js yüklenmemiş.\n" +
      "index.html’de CDN yüklemesi başarısız olmuş olabilir (jsdelivr/unpkg)."
    );
  }

  const { maxDim, lang, preprocessing } = getOcrSettings();

  // 1) downscale + basit preprocess
  const imgBlob = await prepareImageBlob(file, { maxDim, preprocessing });

  let lastPct = -1;

  // 2) recognize — createWorker yok (en stabil)
  const recognizePromise = window.Tesseract.recognize(imgBlob, lang, {
    logger: m => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const pct = Math.floor(m.progress * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setResult(`OCR çalışıyor... %${pct}`);
        }
      } else if (m.status === "loading tesseract core") {
        setResult("OCR motoru yükleniyor...");
      } else if (m.status === "loading language traineddata") {
        setResult("Dil dosyası yükleniyor...");
      }
    }
  });

  // iPhone’da bazen uzun sürebilir: 180s timeout
  const { data } = await withTimeout(recognizePromise, 180000, "OCR zaman aşımı (180sn)");

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
