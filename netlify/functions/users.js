const { json, publicUser, readUserFromEvent, readUsers, setUserPassword, writeUsers } = require("./_shared");

exports.handler = async (event) => {
  const user = await readUserFromEvent(event);
  if (!user) return json(401, { error: "Sesion requerida." });

  if (event.httpMethod === "GET") {
    if (user.role !== "admin") return json(403, { error: "Permiso de administrador requerido." });
    const users = await readUsers();
    return json(200, { users: users.map(publicUser) });
  }

  if (event.httpMethod === "POST") {
    if (user.role !== "admin") return json(403, { error: "Permiso de administrador requerido." });
    const body = JSON.parse(event.body || "{}");
    if (!body.userId || !body.newPassword) return json(400, { error: "Falta usuario o contraseña." });
    if (String(body.newPassword).length < 8) return json(400, { error: "La nueva contraseña debe tener al menos 8 caracteres." });
    const users = await readUsers();
    const target = users.find((candidate) => candidate.id === body.userId);
    if (!target) return json(404, { error: "Usuario no encontrado." });
    setUserPassword(target, body.newPassword, true);
    await writeUsers(users);
    return json(200, { ok: true, user: publicUser(target) });
  }

  if (event.httpMethod === "PUT") {
    const body = JSON.parse(event.body || "{}");
    if (!body.userId) return json(400, { error: "Falta usuario." });
    if (!isValidPhoto(body.photo)) return json(400, { error: "Fotografia invalida." });
    if (user.id !== "admin-cristopher" || body.userId !== user.id) return json(403, { error: "Solo Cristopher puede actualizar su fotografia." });
    const users = await readUsers();
    const target = users.find((candidate) => candidate.id === body.userId);
    if (!target) return json(404, { error: "Usuario no encontrado." });
    target.photo = body.photo || "";
    await writeUsers(users);
    return json(200, { ok: true, user: publicUser(target) });
  }

  return json(405, { error: "Metodo no permitido." });
};

function isValidPhoto(photo) {
  if (!photo) return true;
  return typeof photo === "string" && photo.startsWith("data:image/") && photo.length < 400000;
}
