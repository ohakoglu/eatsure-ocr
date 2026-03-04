// --- Simple local storage for backend url ---
const LS_BACKEND = "eatsure_backend_url";
const LS_MAXDIM = "eatsure_ocr_maxdim";
const LS_LANG = "eatsure_ocr_lang";

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
// OCR Asset Paths (PRIMARY + FALLBACK)
// -----------------------------
const TESSDATA_LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0";

const OCR_ASSET_SETS = [
  {
    name: "jsdelivr",
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js"
  },
  {
    name: "unpkg",
    workerPath: "https://unpkg.com/tesseract.js@5/dist/worker.min.js",
    corePath: "https://unpkg.com/tesseract.js-core@5/tesseract-core.wasm.js"
  }
];

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
          <option value="eng">eng (daha hızlı)</option>
          <option value="tur">tur (TR ağırlıklı)</option>
          <option value="eng+tur" selected>eng+tur (TR+EN)</option>
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
      İpucu: Worker takılırsa bu uygulama otomatik olarak jsdelivr → unpkg fallback dener.
    </p>
  `;

  const cards = main.querySelectorAll("section.card");
  if (cards && cards.length > 1) {
    main.insertBefore(card, cards[1]);
  } else {
    main.appendChild(card);
  }

  const maxDimSel = document.getElementById("maxDimSelect");
  const langSel = document.getElementById("langSelect");

  const savedMaxDim = localStorage.getItem(LS_MAXDIM);
  const savedLang = localStorage.getItem(LS_LANG);

  if (savedMaxDim) maxDimSel.value = savedMaxDim;
  if (savedLang) langSel.value = savedLang;

  maxDimSel.addEventListener("change", () => {
    localStorage.setItem(LS_MAXDIM, String(maxDimSel.value));
  });
  langSel.addEventListener("change", () => {
    localStorage.setItem(LS_LANG, String(langSel.value));
  });
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

  const preprocessing =
    (prepSelect && prepSelect.value) ? (prepSelect.value === "on") : true;

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
    const imgData = ctx.getImageData(0, 0, nw, nh);
    const data = imgData.data;

    const contrast = 1.25;
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
    canvas.toBlob(b => resolve(b), "image/jpeg", jpegQuality);
  });

  if (!blob) throw new Error("Görsel dönüştürülemedi.");
  return blob;
}

// -----------------------------
// Promise timeout helpers
// -----------------------------
function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeoutPromise = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(t));
}

// -----------------------------
// OCR (Tesseract.js) — timeout + fallback
// -----------------------------
async function runOcrOnImage(file) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js yüklenmemiş. index.html'e CDN script'i ekle.");
  }

  const { maxDim, lang, preprocessing } = getOcrSettings();
  const imgBlob = await prepareImageBlob(file, {
    maxDim,
    jpegQuality: 0.85,
    preprocessing
  });

  let lastPct = -1;
  let lastErr = null;

  for (const aset of OCR_ASSET_SETS) {
    try {
      setResult(`OCR motoru hazırlanıyor (worker)... [${aset.name}]`);

      // ✅ workerBlobURL kaldırıldı (iOS/Safari uyumluluğu için)
      const worker = await withTimeout(
        window.Tesseract.createWorker({
          logger: m => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              const pct = Math.floor(m.progress * 100);
              if (pct !== lastPct) {
                lastPct = pct;
                setResult(`OCR çalışıyor... %${pct} [${aset.name}]`);
              }
            }
          },
          workerPath: aset.workerPath,
          corePath: aset.corePath,
          langPath: TESSDATA_LANG_PATH
        }),
        20000,
        `Worker kurulumu zaman aşımı (${aset.name})`
      );

      await withTimeout(worker.loadLanguage(lang), 30000, `Dil yükleme zaman aşımı (${lang})`);
      await withTimeout(worker.initialize(lang), 30000, `Initialize zaman aşımı (${lang})`);

      const { data } = await withTimeout(worker.recognize(imgBlob), 120000, "OCR recognize zaman aşımı");
      await worker.terminate();

      const text = data && data.text ? String(data.text) : "";
      return text.trim();
    } catch (e) {
      lastErr = e;
      // sıradaki CDN'e geç
    }
  }

  const msg = lastErr ? (lastErr.message || String(lastErr)) : "Bilinmeyen hata";
  throw new Error(
    `OCR Worker kurulamadı / takıldı.\nSon hata: ${msg}\n` +
    `Not: Bu genelde CDN/wasm/worker erişiminden olur.`
  );
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
