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
  const base = (localStorage.getItem(LS_BACKEND) || backendUrlEl.value || "")
    .trim()
    .replace(/\/+$/, "");
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

// OCR button
runOcrBtn.addEventListener("click", async () => {
  resultEl.textContent = "";
  if (!selectedFile) {
    resultEl.textContent = "Önce fotoğraf seç.";
    return;
  }

  runOcrBtn.disabled = true;
  sendToBackendBtn.disabled = true;
  runOcrBtn.textContent = "OCR çalışıyor...";

  try {
    const text = await runOcrOnImage(selectedFile, (msg) => {
      // ilerleme mesajı
      resultEl.textContent = msg;
    });

    ocrTextEl.value = (text || "").trim();
    resultEl.textContent = "OCR tamamlandı. (Metin kutusunu kontrol et)";
  } catch (e) {
    resultEl.textContent = `OCR hata: ${e.message}`;
  } finally {
    runOcrBtn.disabled = false;
    sendToBackendBtn.disabled = false;
    runOcrBtn.textContent = "OCR Başlat";
  }
});

// Send to backend
sendToBackendBtn.addEventListener("click", async () => {
  resultEl.textContent = "";
  const labelText = (ocrTextEl.value || "").trim();
  if (!labelText) {
    resultEl.textContent = "OCR metni boş. Önce OCR çalıştır veya metni yapıştır.";
    return;
  }

  const base = (localStorage.getItem(LS_BACKEND) || backendUrlEl.value || "")
    .trim()
    .replace(/\/+$/, "");

  sendToBackendBtn.disabled = true;
  runOcrBtn.disabled = true;
  sendToBackendBtn.textContent = "Analiz ediliyor...";

  try {
    const r = await fetch(`${base}/analyze-label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labelText,
        // İleride: barcode/brand/name de gönderebiliriz
      }),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      resultEl.textContent =
        `Backend hata: ${r.status}\n` + JSON.stringify(data, null, 2);
      return;
    }

    // Sonucu sade ve okunur bas
    resultEl.textContent = JSON.stringify(
      {
        decision: data?.decision || null,
        analysis: data?.analysis || null,
        meta: data?.meta || null,
      },
      null,
      2
    );
  } catch (e) {
    resultEl.textContent = `Backend hata: ${e.message}`;
  } finally {
    sendToBackendBtn.disabled = false;
    runOcrBtn.disabled = false;
    sendToBackendBtn.textContent = "Analiz Et";
  }
});

// --- Real OCR with Tesseract.js ---
// Notlar:
// - iOS Safari’de büyük fotoğraflar RAM’i şişirebilir.
// - O yüzden resmi OCR öncesi küçültüyoruz (max 1600px).
async function runOcrOnImage(file, onProgress) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract yüklenmedi. index.html içine CDN scripti ekli mi?");
  }

  // Görseli küçült (performans için)
  const resizedBlob = await downscaleImage(file, 1600, 0.85);

  const lang = "eng"; // şimdilik. İstersen sonra tur+eng gibi deneriz (model boyutu artar)
  const worker = await Tesseract.createWorker(lang, 1, {
    logger: (m) => {
      if (!onProgress) return;
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const pct = Math.round(m.progress * 100);
        onProgress(`OCR: ${pct}%`);
      } else if (m.status) {
        onProgress(`OCR: ${m.status}`);
      }
    },
  });

  try {
    // OCR ayarları (çok agresif değil)
    await worker.setParameters({
      // PSM 6: tek blok metin gibi. Etiketlerde genelde iyi çalışır.
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    });

    const { data } = await worker.recognize(resizedBlob);
    return data && data.text ? data.text : "";
  } finally {
    await worker.terminate();
  }
}

// --- Image downscale helper ---
function downscaleImage(file, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const w = img.width;
      const h = img.height;

      const scale = Math.min(1, maxSide / Math.max(w, h));
      const nw = Math.round(w * scale);
      const nh = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context alınamadı."));
        return;
      }

      ctx.drawImage(img, 0, 0, nw, nh);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Görsel küçültme başarısız (blob null)."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel yüklenemedi."));
    };

    img.src = url;
  });
}
