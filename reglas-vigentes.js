const sessionName = document.querySelector("#manualSessionName");
const sessionRole = document.querySelector("#manualSessionRole");
const logoutBtn = document.querySelector("#manualLogoutBtn");
const manualBackTopBtn = document.querySelector("#manualBackTopBtn");

const roleLabels = {
  admin: "Administrador",
  tutor: "Tutor",
};

function loginRedirect() {
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.replace(`/login.html?next=${next}`);
}

async function loadManualSession() {
  const response = await fetch("/api/session").catch(() => null);
  if (!response?.ok) {
    loginRedirect();
    return;
  }
  const payload = await response.json().catch(() => ({ user: null }));
  if (!payload.user) {
    loginRedirect();
    return;
  }
  sessionName.textContent = payload.user.name || "Usuario";
  sessionRole.textContent = roleLabels[payload.user.role] || "Consulta";
}

logoutBtn?.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => null);
  window.location.replace("/login.html");
});

function updateManualBackTopButton() {
  if (!manualBackTopBtn) return;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  const parallaxOffset = Math.round((1 - progress) * 18);
  manualBackTopBtn.style.setProperty("--back-top-offset", `${parallaxOffset}px`);
  manualBackTopBtn.classList.toggle("is-visible", progress >= 0.9);
}

manualBackTopBtn?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", updateManualBackTopButton, { passive: true });
window.addEventListener("resize", updateManualBackTopButton);
updateManualBackTopButton();

loadManualSession();
