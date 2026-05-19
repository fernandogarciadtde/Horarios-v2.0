const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
const params = new URLSearchParams(window.location.search);
const nextUrl = params.get("next") || "/";

initLogin();

async function initLogin() {
  const session = await fetch("/api/session").then((res) => res.json()).catch(() => ({ user: null }));
  if (session.user) {
    window.location.replace(nextUrl);
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      loginError.textContent = payload.error || "No fue posible iniciar sesión.";
      return;
    }

    window.location.replace(nextUrl);
  });
}
