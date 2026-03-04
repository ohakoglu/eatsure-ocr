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
// Small UI helpers (inserted dynamically)
// -----------------------------
function ensureOcrSettingsUi() {
  // Zaten varsa tekrar ekleme
  if (document.getElementById("ocrSettingsCard")) return;

  const main = document.querySelector("main.wrap") || document.body;

  // 1) OCR Settings Card
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
          <option value="eng+tur" selected>eng+tur (TR etiket)</option>
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
      Not: 1600/2048 kaliteyi artırabilir ama iPhone’da daha yavaş çalışır.
    </p>
  `;

  // Card'ı “Etiket fotoğrafı” kartının ÜSTÜNE koy
  const cards = main.querySelectorAll("section.card");
  if (cards && cards.length > 1) {
    main.insertBefore(card, cards[1]); // ikinci kart etiket kartıydı
  } else {
    main.appendChild(card);
  }

  // Load saved settings
  const maxDimSel = document.getElementById("maxDimSelect");
  const langSel = document.getElementById("langSelect");
  const prepSel = document.getElementById("prepSelect");

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
  // prepSel'i local'e kaydetmeye gerek yok (istersen ekleriz)
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

// OCR settings UI (inject once)
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
 * ✅ Downscale + (opsiyonel) preprocess
 * - maxDim: 1024/1280/1600/2048
 * - jpegQuality: 0.85
 * - preprocessing: true -> grayscale + contrast + mild sharpen
 */
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
    // Grayscale + contrast stretch + mild sharpen
    const imgData = ctx.getImageData(0, 0, nw, nh);
    const data = imgData.data;

    // 1) grayscale + contrast
    // Basit kontrast (1.25) + parlaklık (0) yaklaşımı
    const contrast = 1.25;
    const intercept = 128 * (1 - contrast);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // luminance
      let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // contrast
      y = y * contrast + intercept;

      // clamp
      y = y < 0 ? 0 : y > 255 ? 255 : y;

      data[i] = data[i + 1] = data[i + 2] = y;
      // alpha aynı
    }
    ctx.putImageData(imgData, 0, 0);

    // 2) mild sharpen (çok agresif yapmıyoruz)
    // Unsharp mask benzeri basit 3x3 kernel
    // [ 0 -1  0
    //  -1  5 -1
    //   0 -1  0 ]
    const src = ctx.getImageData(0, 0, nw, nh);
    const dst = ctx.createImageData(nw, nh);

    const s = src.data;
    const d = dst.data;

    function idx(x, y) {
      return (y * nw + x) * 4;
    }

    for (let y = 1; y < nh - 1; y++) {
      for (let x = 1; x < nw - 1; x++) {
        const c = idx(x, y);

        // sadece gri kanal yeter (r=g=b)
        const center = s[c];
        const up = s[idx(x, y - 1)];
        const down = s[idx(x, y + 1)];
        const left = s[idx(x - 1, y)];
        const right = s[idx(x + 1, y)];

        let v = 5 * center - up - down - left - right;
        v = v < 0 ? 0 : v > 255 ? 255 : v;

        d[c] = d[c + 1] = d[c + 2] = v;
        d[c + 3] = s[c + 3];
      }
    }

    // kenarları aynen kopyala
    for (let x = 0; x < nw; x++) {
      d[idx(x, 0) + 3] = 255;
      d[idx(x, nh - 1) + 3] = 255;
      const t0 = idx(x, 0), t1 = idx(x, nh - 1);
      d[t0] = s[t0]; d[t0 + 1] = s[t0 + 1]; d[t0 + 2] = s[t0 + 2];
      d[t1] = s[t1]; d[t1 + 1] = s[t1 + 1]; d[t1 + 2] = s[t1 + 2];
    }
    for (let y = 0; y < nh; y++) {
      const l0 = idx(0, y), l1 = idx(nw - 1, y);
      d[l0] = s[l0]; d[l0 + 1] = s[l0 + 1]; d[l0 + 2] = s[l0 + 2]; d[l0 + 3] = 255;
      d[l1] = s[l1]; d[l1 + 1] = s[l1 + 1]; d[l1 + 2] = s[l1 + 2]; d[l1 + 3] = 255;
    }

    ctx.putImageData(dst, 0, 0);
  }

  const blob = await new Promise(resolve => {
    canvas.toBlob(b => resolve(b), "image/jpeg", jpegQuality);
  });

  if (!blob) throw new Error("Görsel dönüştürülemedi.");
  return blob;
}

// -----------------------------
// OCR (Tesseract.js)
// -----------------------------
async function runOcrOnImage(file) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js yüklenmemiş. index.html'e CDN script'i ekle.");
  }

  const { maxDim, lang, preprocessing } = getOcrSettings();

  // 1) downscale + preprocess
  const imgBlob = await prepareImageBlob(file, {
    maxDim,
    jpegQuality: 0.85,
    preprocessing
  });

  let lastPct = -1;

  const { data } = await window.Tesseract.recognize(imgBlob, lang, {
    logger: m => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const pct = Math.floor(m.progress * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setResult(`OCR çalışıyor... %${pct}`);
        }
      }
    }
  });

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
