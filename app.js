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

// (Opsiyonel) HTML'de bu inputlar varsa otomatik kullanacağız; yoksa null kalır.
const barcodeEl = document.getElementById("barcode");
const brandEl = document.getElementById("brand");
const nameEl = document.getElementById("name");

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
  runOcrBtn.textContent = "OCR çalışıyor...";

  try {
    // Burayı daha sonra gerçek OCR motoruna bağlayacağız.
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

// Send to backend (REAL)
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

  // Opsiyonel alanlar (HTML'de yoksa null kalır)
  const barcode = barcodeEl ? String(barcodeEl.value || "").trim() : "";
  const brand = brandEl ? String(brandEl.value || "").trim() : "";
  const name = nameEl ? String(nameEl.value || "").trim() : "";

  const payload = {
    labelText,
    // boşsa göndermeyelim (backend zaten null yapıyor ama payload sade kalsın)
    ...(barcode ? { barcode } : {}),
    ...(brand ? { brand } : {}),
    ...(name ? { name } : {})
  };

  sendToBackendBtn.disabled = true;
  sendToBackendBtn.textContent = "Analiz ediliyor...";

  try {
    const r = await fetch(`${base}/ocr/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      const msg =
        (data && (data.message || data.error)) ||
        `HTTP ${r.status}`;
      throw new Error(msg);
    }

    // Ekrana temiz JSON bas
    resultEl.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    resultEl.textContent = `Backend hata: ${e.message}`;
  } finally {
    sendToBackendBtn.disabled = false;
    sendToBackendBtn.textContent = "Analiz Et";
  }
});

// --- Placeholder OCR ---
// Burayı, senin kurduğun OCR (örn. Tesseract / Apple Vision / vs) ile değiştireceğiz.
async function runOcrOnImage(file) {
  // Şimdilik sadece “seçim çalışıyor mu” test edelim.
  return "TEST: Foto seçimi OK. OCR entegrasyonu bir sonraki adım.";
}
