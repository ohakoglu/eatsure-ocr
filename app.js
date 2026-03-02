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

// OCR button (şimdilik placeholder OCR)
runOcrBtn.addEventListener("click", async () => {
  resultEl.textContent = "";
  if (!selectedFile) {
    resultEl.textContent = "Önce fotoğraf seç.";
    return;
  }

  runOcrBtn.disabled = true;
  runOcrBtn.textContent = "OCR çalışıyor...";

  try {
    const text = await runOcrOnImage(selectedFile);
    ocrTextEl.value = text || "";
    resultEl.textContent = "OCR tamamlandı.";
  } catch (e) {
    resultEl.textContent = `OCR hata: ${e.message}`;
  } finally {
    runOcrBtn.disabled = false;
    runOcrBtn.textContent = "OCR Başlat";
  }
});

// ✅ Send to backend: POST /analyze-label
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
  sendToBackendBtn.textContent = "Analiz ediliyor...";

  try {
    const r = await fetch(`${base}/analyze-label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labelText,              // ✅ backend’in beklediği alan
        // barcode: "...",       // istersen sonra ekleriz
        // brand: "...",
        // name: "..."
      })
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      resultEl.textContent =
        `Backend hata: ${r.status}\n` + (data ? JSON.stringify(data, null, 2) : "");
      return;
    }

    resultEl.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    resultEl.textContent = `Backend hata: ${e.message}`;
  } finally {
    sendToBackendBtn.disabled = false;
    sendToBackendBtn.textContent = "Analiz Et";
  }
});

// --- Placeholder OCR ---
async function runOcrOnImage(file) {
  return "TEST: Foto seçimi OK. OCR entegrasyonu bir sonraki adım.";
}
