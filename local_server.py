from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "local_data"
STATE_FILE = DATA_DIR / "state.json"
USERS_FILE = DATA_DIR / "users.json"
INITIAL_CREDENTIALS_FILE = DATA_DIR / "credenciales_iniciales.txt"
COOKIE_NAME = "ucen_sd_session"
PORT = int(os.environ.get("PORT", "4174"))
PBKDF2_ROUNDS = 120_000

sessions: dict[str, str] = {}


def ensure_data() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    if not USERS_FILE.exists():
        write_json(USERS_FILE, create_default_users())
    else:
        users = [user for user in read_json(USERS_FILE) if user.get("role") != "cafe_digital" and user.get("id") != "cafe-digital"]
        write_json(USERS_FILE, users)
    if not STATE_FILE.exists():
        write_json(STATE_FILE, create_default_state())


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def make_user(user_id: str, name: str, email: str, role: str, password: str, must_change_password: bool = True) -> dict:
    user = {
        "id": user_id,
        "name": name,
        "email": email,
        "role": role,
        "photo": "",
        "salt": "",
        "passwordHash": "",
        "mustChangePassword": must_change_password,
    }
    set_password(user, password, must_change_password)
    return user


def set_password(user: dict, password: str, must_change_password: bool) -> None:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", str(password or "").encode(), salt.encode(), PBKDF2_ROUNDS, dklen=32)
    user["salt"] = salt
    user["passwordHash"] = digest.hex()
    user["mustChangePassword"] = must_change_password


def verify_password(user: dict, password: str) -> bool:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        str(password or "").encode(),
        str(user.get("salt", "")).encode(),
        PBKDF2_ROUNDS,
        dklen=32,
    ).hex()
    return hmac.compare_digest(digest, str(user.get("passwordHash", "")))


def public_user(user: dict | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "photo": user.get("photo", ""),
        "mustChangePassword": bool(user.get("mustChangePassword")),
    }


def create_default_users() -> list[dict]:
    specs = [
        ("admin-cristopher", "Cristopher Calabr\u00e1n", "cristopher.calabran@ucentral.cl", "admin"),
        ("tutor-monserrat", "Monserrat Vargas", "monserrat.vargas@ucentral.cl", "tutor"),
        ("tutor-viviana", "Viviana Brice\u00f1o", "viviana.briceno@ucentral.cl", "tutor"),
        ("tutor-fernando", "Fernando Garc\u00eda", "fernando.garcia@ucentral.cl", "tutor"),
        ("tutor-denisse-bravo", "Denisse Bravo", "denisse.bravo@ucentral.cl", "tutor"),
        ("tutor-denisse-rossel", "Denisse Rossel", "denisse.rossel@ucentral.cl", "tutor"),
    ]
    credentials = []
    users = []
    for user_id, name, email, role in specs:
        password = initial_password_for(user_id, role)
        users.append(make_user(user_id, name, email, role, password))
        credentials.append({"name": name, "email": email, "password": password})
    write_initial_credentials(credentials)
    return users


def initial_password_for(user_id: str, role: str) -> str:
    specific_key = f"INITIAL_PASSWORD_{user_id.upper().replace('-', '_')}"
    role_key = "INITIAL_ADMIN_PASSWORD" if role == "admin" else "INITIAL_TUTOR_PASSWORD"
    return os.environ.get(specific_key) or os.environ.get(role_key) or secrets.token_urlsafe(12)


def write_initial_credentials(credentials: list[dict]) -> None:
    if INITIAL_CREDENTIALS_FILE.exists():
        return
    lines = [
        "Credenciales iniciales generadas automaticamente.",
        "Este archivo esta dentro de local_data y no debe subirse a GitHub.",
        "Cada usuario debe cambiar su contrasena al primer ingreso.",
        "",
    ]
    for credential in credentials:
        lines.extend(
            [
                credential["name"],
                credential["email"],
                credential["password"],
                "",
            ]
        )
    INITIAL_CREDENTIALS_FILE.write_text("\n".join(lines), encoding="utf-8")


def create_default_state() -> dict:
    agents = [
        {"id": secrets.token_hex(16), "name": name, "order": index}
        for index, name in enumerate(
            ["Monserrat Vargas", "Viviana Brice\u00f1o", "Fernando Garc\u00eda", "Denisse Bravo", "Denisse Rossel"]
        )
    ]
    monserrat = next((agent for agent in agents if agent["name"] == "Monserrat Vargas"), None)
    holidays = [
        "2026-01-01",
        "2026-04-03",
        "2026-04-04",
        "2026-05-01",
        "2026-05-21",
        "2026-06-20",
        "2026-06-29",
        "2026-07-16",
        "2026-08-15",
        "2026-09-18",
        "2026-09-19",
        "2026-10-12",
        "2026-10-31",
        "2026-11-01",
        "2026-12-08",
        "2026-12-25",
    ]
    return {
        "month": 4,
        "year": 2026,
        "agents": agents,
        "specialDays": [{"id": secrets.token_hex(16), "date": date, "type": "holiday"} for date in holidays],
        "recurringLocks": [],
        "absences": [
            {
                "id": secrets.token_hex(16),
                "agentId": monserrat["id"],
                "type": "medical",
                "from": "2026-01-01",
                "to": "",
                "indefinite": True,
            }
        ]
        if monserrat
        else [],
        "manualOverrides": {},
        "schedule": {},
    }


def valid_photo(photo: str | None) -> bool:
    if not photo:
        return True
    if not isinstance(photo, str) or not photo.startswith("data:image/") or len(photo) >= 400_000:
        return False
    try:
        header, payload = photo.split(",", 1)
        base64.b64decode(payload, validate=True)
        return bool(header)
    except Exception:
        return False


class AppHandler(BaseHTTPRequestHandler):
    server_version = "UCENHorariosPython/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self.handle_api("GET", parsed.path)
        return self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self.handle_api("POST", parsed.path)
        return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Ruta no encontrada."})

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self.handle_api("PUT", parsed.path)
        return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Ruta no encontrada."})

    def handle_api(self, method: str, path: str) -> None:
        users = read_json(USERS_FILE)
        state = read_json(STATE_FILE)
        user = self.user_from_request(users)

        if path == "/api/session" and method == "GET":
            return self.send_json(HTTPStatus.OK, {"user": public_user(user)})

        if path == "/api/login" and method == "POST":
            body = self.read_body()
            email = str(body.get("email", "")).lower()
            found = next((item for item in users if item["email"].lower() == email), None)
            if not found or not verify_password(found, body.get("password", "")):
                return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Credenciales incorrectas."})
            token = secrets.token_urlsafe(32)
            sessions[token] = found["id"]
            return self.send_json(
                HTTPStatus.OK,
                {"user": public_user(found)},
                {"Set-Cookie": f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Lax; Path=/"},
            )

        if path == "/api/logout" and method == "POST":
            token = self.read_cookie(COOKIE_NAME)
            if token:
                sessions.pop(token, None)
            return self.send_json(
                HTTPStatus.OK,
                {"ok": True},
                {"Set-Cookie": f"{COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"},
            )

        if not user:
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sesion requerida."})

        if path == "/api/state" and method == "GET":
            return self.send_json(HTTPStatus.OK, {"state": state, "user": public_user(user)})

        if path == "/api/state" and method == "PUT":
            body = self.read_body()
            if not isinstance(body.get("state"), dict):
                return self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Estado invalido."})
            write_json(STATE_FILE, body["state"])
            return self.send_json(HTTPStatus.OK, {"ok": True})

        if path == "/api/reset-state" and method == "POST":
            if user["role"] != "admin":
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Permiso de administrador requerido."})
            fresh = create_default_state()
            write_json(STATE_FILE, fresh)
            return self.send_json(HTTPStatus.OK, {"state": fresh})

        if path == "/api/change-password" and method == "POST":
            body = self.read_body()
            target = next((item for item in users if item["id"] == user["id"]), None)
            if not target or not verify_password(target, body.get("currentPassword", "")):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "La contrasena actual no coincide."})
            set_password(target, body.get("newPassword", ""), False)
            write_json(USERS_FILE, users)
            return self.send_json(HTTPStatus.OK, {"ok": True, "user": public_user(target)})

        if path == "/api/users" and method == "GET":
            if user["role"] != "admin":
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Permiso de administrador requerido."})
            return self.send_json(HTTPStatus.OK, {"users": [public_user(item) for item in users]})

        if path == "/api/users" and method == "POST":
            if user["role"] != "admin":
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Permiso de administrador requerido."})
            body = self.read_body()
            target = next((item for item in users if item["id"] == body.get("userId")), None)
            if not target:
                return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Usuario no encontrado."})
            set_password(target, body.get("newPassword", ""), True)
            write_json(USERS_FILE, users)
            return self.send_json(HTTPStatus.OK, {"ok": True, "user": public_user(target)})

        if path == "/api/users" and method == "PUT":
            body = self.read_body()
            if user["id"] != "admin-cristopher" or body.get("userId") != user["id"]:
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Solo Cristopher puede actualizar su fotografia."})
            if not valid_photo(body.get("photo")):
                return self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Fotografia invalida."})
            target = next((item for item in users if item["id"] == body.get("userId")), None)
            if not target:
                return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Usuario no encontrado."})
            target["photo"] = body.get("photo") or ""
            write_json(USERS_FILE, users)
            return self.send_json(HTTPStatus.OK, {"ok": True, "user": public_user(target)})

        return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Ruta no encontrada."})

    def serve_static(self, raw_path: str) -> None:
        safe_path = unquote(raw_path).lstrip("/")
        target = ROOT / ("index.html" if safe_path == "" else safe_path)
        try:
            target = target.resolve()
            target.relative_to(ROOT)
        except ValueError:
            return self.serve_file(ROOT / "index.html")

        if not target.exists() or target.is_dir():
            return self.serve_file(ROOT / "index.html")
        return self.serve_file(target)

    def serve_file(self, path: Path) -> None:
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if not length:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    def send_json(self, status: int, body: dict, headers: dict | None = None) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(data)

    def user_from_request(self, users: list[dict]) -> dict | None:
        token = self.read_cookie(COOKIE_NAME)
        user_id = sessions.get(token or "")
        return next((user for user in users if user["id"] == user_id), None)

    def read_cookie(self, name: str) -> str | None:
        header = self.headers.get("Cookie", "")
        for part in header.split(";"):
            part = part.strip()
            if part.startswith(f"{name}="):
                return part[len(name) + 1 :]
        return None

    def log_message(self, format: str, *args) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    ensure_data()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), AppHandler)
    print(f"App local Python disponible en http://127.0.0.1:{PORT}")
    print("Por seguridad, las contrasenas no se muestran en consola.")
    if INITIAL_CREDENTIALS_FILE.exists():
        print(f"Credenciales iniciales locales: {INITIAL_CREDENTIALS_FILE.relative_to(ROOT)}")
    else:
        print("Usa las credenciales configuradas o resetea la clave desde el panel de administracion.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")


if __name__ == "__main__":
    main()
