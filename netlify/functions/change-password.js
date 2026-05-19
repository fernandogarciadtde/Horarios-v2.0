const { json, publicUser, readUserFromEvent, readUsers, setUserPassword, verifyPassword, writeUsers } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });
  const user = await readUserFromEvent(event);
  if (!user) return json(401, { error: "Sesión requerida." });

  const body = JSON.parse(event.body || "{}");
  if (!body.currentPassword || !body.newPassword) return json(400, { error: "Completa la contraseña actual y la nueva." });
  if (String(body.newPassword).length < 8) return json(400, { error: "La nueva contraseña debe tener al menos 8 caracteres." });
  if (!verifyPassword(user, body.currentPassword)) return json(403, { error: "La contraseña actual no coincide." });

  const users = await readUsers();
  const target = users.find((candidate) => candidate.id === user.id);
  setUserPassword(target, body.newPassword, false);
  await writeUsers(users);
  return json(200, { ok: true, user: publicUser(target) });
};
