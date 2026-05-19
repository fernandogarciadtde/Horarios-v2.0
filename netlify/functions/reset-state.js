const { createDefaultState, json, readUserFromEvent, writeState } = require("./_shared");

exports.handler = async (event) => {
  const user = await readUserFromEvent(event);
  if (!user) return json(401, { error: "Sesión requerida." });
  if (user.role !== "admin") return json(403, { error: "Permiso de administrador requerido." });
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });

  const state = createDefaultState();
  await writeState(state);
  return json(200, { state });
};
