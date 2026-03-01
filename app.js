const $ = (id) => document.getElementById(id);

const backendUrlEl = $("backendUrl");
const saveBackendBtn = $("saveBackend");
const pingBtn = $("ping");
const healthOut = $("healthOut");

const imageInput = $("imageInput");
const runOcrBtn = $("runOcr");
const clearBtn = $("clearAll");
const previewImg = $("previewImg");

const progBar = $("progBar");
const statusEl = $("status");

const labelTextEl = $("labelText");
const barcodeEl = $("barcode");
const brandEl = $("brand");
const nameEl = $("name");

const analyzeBtn = $("analyze");
const resultEl = $("result");

function getBackend() {
  return (localStorage.getItem("EATSURE_BACKEND_URL") || "").trim();
}
function setBackend(url) {
  localStorage.setItem("EATSURE_BACKEND_URL", url.trim());
}
function normalizeBackend(url) {
  if (!url) return "";
  // sondaki slash'ı temizle
  return url.replace(/\/+$/, "");
}

function setStatus(msg) {
  statusEl.textContent = msg || "";
}
function setProgress(p) {
  const pct = Math.max(0, Math.min(100, Math.round(p)));
  progBar.style.width = pct + "%";
}

function setResult(obj) {
  resultEl.textContent = JSON.stringify(obj, null, 2);
}

// init backend input
backendUrlEl.value = getBackend();

saveBackendBtn.addEventListener("click", () => {
  const url = normalizeBackend(backendUrlEl.value);
  setBackend(url);
  backendUrlEl.value = url;
  healthOut.textContent = url ? "Kaydedildi." : "Boş URL kaydedilemez.";
});

pingBtn.addEventListener("click", async () => {
  const base = normalizeBackend(backendUrlEl.value || getBackend());
  if (!base) return (healthOut.textContent = "Backend URL gir.");
  try {
    const r = await fetch(base + "/health");
    const t = await r.text();
    healthOut.textContent = `Health: ${r.status} — ${t}`;
  } catch (e) {
    healthOut.textContent = "Health başarısız: " + e.message;
  }
});

let selectedFile = null;
imageInput.addEventListener("change", () => {
  const f = imageInput.files && imageInput.files[0];
  selectedFile = f || null;
  runOcrBtn.disabled = !selectedFile;
  setProgress(0);
  setStatus("");
  if (!selectedFile) {
    previewImg.style.display = "none";
    previewImg.src = "";
    return;
  }
  const url = URL.createObjectURL(selectedFile);
  previewImg.src = url;
  previewImg.style.display = "block";
});

clearBtn.addEventListener("click", () => {
  selectedFile = null;
  imageInput.value = "";
  labelTextEl.value = "";
  barcodeEl.value = "";
  brandEl.value = "";
  nameEl.value = "";
  previewImg.src = "";
  previewImg.style.display = "none";
  setProgress(0);
  setStatus("");
  setResult({});
});

runOcrBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  setResult({});
  setProgress(0);
  setStatus("OCR hazırlanıyor...");

  try {
    // Dil: önce "tur+eng" deniyoruz (Türkçe etiketlerde daha iyi).
    // Eğer çok ağır gelirse sadece "eng" yapabiliriz.
    const worker = await Tesseract.createWorker("tur+eng");

    setStatus("OCR çalışıyor...");
    const { data } = await worker.recognize(selectedFile, {}, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setProgress((m.progress || 0) * 100);
        }
        // diğer status'ları da minimal göster
        if (m.status && m.status !== "recognizing text") {
          setStatus(m.status);
        }
      }
    });

    await worker.terminate();

    const text = (data && data.text) ? data.text.trim() : "";
    labelTextEl.value = text;
    setProgress(100);
    setStatus(text ? "OCR bitti. Metni kontrol edip düzenleyebilirsin." : "OCR bitti ama metin boş geldi.");

  } catch (e) {
    setStatus("OCR hata: " + e.message);
    setProgress(0);
  }
});

analyzeBtn.addEventListener("click", async () => {
  const base = normalizeBackend(backendUrlEl.value || getBackend());
  if (!base) return alert("Backend URL gir ve kaydet.");

  const labelText = (labelTextEl.value || "").trim();
  if (labelText.length < 3) return alert("OCR metni çok kısa. Önce OCR çalıştır veya metin yapıştır.");

  const payload = {
    labelText,
    barcode: (barcodeEl.value || "").trim() || undefined,
    brand: (brandEl.value || "").trim() || undefined,
    name: (nameEl.value || "").trim() || undefined
  };

  setStatus("Analiz ediliyor...");
  setResult({ loading: true });

  try {
    const r = await fetch(base + "/analyze-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => null);
    if (!r.ok) {
      setStatus("Analiz hata.");
      return setResult({ http: r.status, error: data || "unknown_error" });
    }

    setStatus("Tamam.");
    setResult(data);

  } catch (e) {
    setStatus("Analiz hata: " + e.message);
    setResult({ error: e.message });
  }
});
