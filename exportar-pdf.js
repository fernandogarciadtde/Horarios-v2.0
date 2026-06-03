const root = document.querySelector("#pdfExportRoot");
const token = new URLSearchParams(window.location.search).get("token") || "";
const storageKey = `ucen_pdf_export_${token}`;
const payloadText = token ? localStorage.getItem(storageKey) : "";

if (!payloadText) {
  document.title = "Exportacion no disponible";
  root.innerHTML = '<section class="panel"><h1>Exportacion no disponible</h1><p>Vuelve al calendario y genera el PDF nuevamente.</p></section>';
} else {
  const payload = JSON.parse(payloadText);
  localStorage.removeItem(storageKey);
  document.title = payload.title || "Exportacion semana";
  root.innerHTML = payload.html || "";
  setTimeout(() => {
    window.print();
  }, 350);
}
