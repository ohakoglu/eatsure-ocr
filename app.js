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
backendUrlEl.value = localStorage.getItem(LS_BACKEND) || "https://eatsure-backend-4dkh.onrender.com";

saveBackendBtn.addEventListener("click", () => {
  const v = (backendUrlEl.value || "").trim().replace(/\/+$/, "");
  localStorage.setItem(LS_BACKEND, v);
  backendUrlEl.value = v;
  healthResultEl.textContent = "Kaydedildi.";
});

checkHealthBtn.addEventListener("click", async () => {
  healthResultEl.textContent = "Kontrol ediliyor...";
  const base = (localStorage.getItem(LS_BACKEND) || backendUrlEl.value || "").trim().replace(/\/+$/, "");
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
  runOcrBtn.textContent = "OCR çalışıyor...";

  try {
    // Burayı kendi OCR motoruna bağlayacağız.
    // Şimdilik placeholder: “metin yok” demesin diye.
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

// Send to backend
sendToBackendBtn.addEventListener("click", async () => {
  resultEl.textContent = "";
  const text = (ocrTextEl.value || "").trim();
  if (!text) {
    resultEl.textContent = "OCR metni boş. Önce OCR çalıştır veya metni yapıştır.";
    return;
  }

  const base = (localStorage.getItem(LS_BACKEND) || backendUrlEl.value || "").trim().replace(/\/+$/, "");

  sendToBackendBtn.disabled = true;
  sendToBackendBtn.textContent = "Analiz ediliyor...";

  try {
    // Örnek: backend’de OCR metni için bir endpoint yoksa,
    // şimdilik sadece gösteriyoruz.
    // OCR endpointi eklediğimizde burası POST /ocr-analyze gibi olacak.
    const payload = { text };
    resultEl.textContent = JSON.stringify(payload, null, 2) + "\n\n(Not: Backend OCR endpointi eklenince burada analiz sonucu dönecek.)";
  } catch (e) {
    resultEl.textContent = `Backend hata: ${e.message}`;
  } finally {
    sendToBackendBtn.disabled = false;
    sendToBackendBtn.textContent = "Analiz Et";
  }
});

// --- Placeholder OCR ---
// Burayı, senin kurduğun OCR (örn. Tesseract / Apple Vision / vs) ile değiştiriyoruz.
async function runOcrOnImage(file) {
  // Şimdilik sadece “seçim çalışıyor mu” test edelim:
  // gerçek OCR entegrasyonunu bir sonraki adımda bağlayacağız.
  return "TEST: Foto seçimi OK. OCR entegrasyonu bir sonraki adım.";
}
