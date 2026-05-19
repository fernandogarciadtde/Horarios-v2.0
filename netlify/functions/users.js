const { json, publicUser, readUserFromEvent, readUsers, setUserPassword, writeUsers } = require("./_shared");

exports.handler = async (event) => {
  const user = await readUserFromEvent(event);
  if (!user) return json(401, { error: "Sesión requerida." });
  if (user.role !== "admin") return json(403, { error: "Permiso de administrador requerido." });

  if (event.httpMethod === "GET") {
    const users = await readUsers();
    return json(200, { users: users.map(publicUser) });
  }

  if (event.httpMethod === "POST") {
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

  return json(405, { error: "Método no permitido." });
};
