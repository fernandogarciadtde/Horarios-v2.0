const root = document.querySelector("#pdfExportRoot");
const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";
const requestedFilename = sanitizePdfFilename(params.get("filename") || "");
const storageKey = `ucen_pdf_export_${token}`;
const payloadText = token ? localStorage.getItem(storageKey) : "";

if (!payloadText) {
  document.title = "Exportacion no disponible";
  root.innerHTML = '<section class="panel"><h1>Exportacion no disponible</h1><p>Vuelve al calendario y genera el PDF nuevamente.</p></section>';
} else {
  const payload = JSON.parse(payloadText);
  localStorage.removeItem(storageKey);
  const filename = sanitizePdfFilename(payload.filename || requestedFilename || payload.title || "semana");
  setPdfDocumentName(filename);
  root.innerHTML = payload.html || "";
  window.addEventListener("afterprint", () => {
    setTimeout(() => window.close(), 250);
  });
  setTimeout(() => {
    window.focus();
    window.print();
  }, 750);
}

function sanitizePdfFilename(value) {
  return String(value || "semana")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "semana";
}

function setPdfDocumentName(filename) {
  document.title = filename;
  document.querySelector("title").textContent = filename;
  try {
    window.history.replaceState(null, filename, filename);
  } catch {
    // El nombre por titulo queda disponible aunque el navegador bloquee el cambio de URL.
  }
}
