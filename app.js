// --- Simple local storage for backend url ---
const LS_BACKEND = "eatsure_backend_url";

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

// Init
backendUrlEl.value =
  localStorage.getItem(LS_BACKEND) || "https://eatsure-backend-4dkh.onrender.com";

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

// File selection
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

/**
 * ✅ Görseli küçült (iOS’ta hız için kritik)
 * - maxDim: 1280 (genelde yeterli)
 * - jpegQuality: 0.85
 */
async function downscaleImage(file, maxDim = 1280, jpegQuality = 0.85) {
  const imgUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = imgUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (!w || !h) {
      throw new Error("Görsel boyutu okunamadı.");
    }

    // küçültme oranı
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, nw, nh);

    const blob = await new Promise(resolve => {
      canvas.toBlob(
        b => resolve(b),
        "image/jpeg",
        jpegQuality
      );
    });

    if (!blob) throw new Error("Görsel dönüştürülemedi.");

    return blob;
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

/**
 * ✅ OCR (Tesseract.js)
 * Not: index.html içinde tesseract.min.js yüklenmiş olmalı.
 */
async function runOcrOnImage(file) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js yüklenmemiş. index.html'e CDN script'i ekle.");
  }

  // Hız için downscale
  const imgBlob = await downscaleImage(file, 1280, 0.85);

  // TR+EN karışık etiketlerde bazen yardımcı oluyor.
  // İstersen sadece "eng" yapabiliriz (daha hızlı).
  const lang = "eng+tur";

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

  const text = (data && data.text) ? String(data.text) : "";
  return text.trim();
}

// OCR button
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

// ✅ Send to backend (POST /analyze-label)
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
    const payload = {
      labelText
      // İstersen sonra buraya barcode/brand/name ekleriz.
      // barcode: "...",
      // brand: "...",
      // name: "..."
    };

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
