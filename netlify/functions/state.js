const { json, publicUser, readState, readUserFromEvent, writeState } = require("./_shared");

exports.handler = async (event) => {
  const user = await readUserFromEvent(event);
  if (!user) return json(401, { error: "Sesión requerida." });

  if (event.httpMethod === "GET") {
    const state = await readState();
    return json(200, { state, user: publicUser(user) });
  }

  if (event.httpMethod === "PUT") {
    if (user.role !== "admin") return json(403, { error: "Permiso de administrador requerido." });
    const body = JSON.parse(event.body || "{}");
    if (!body.state || typeof body.state !== "object") return json(400, { error: "Estado inválido." });
    await writeState(body.state);
    return json(200, { ok: true });
  }

  return json(405, { error: "Método no permitido." });
};
