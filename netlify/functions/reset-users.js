const { createDefaultUsers, json, writeUsers } = require("./_shared");

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token || event.headers["x-recovery-token"];
  if (!process.env.RECOVERY_TOKEN) {
    return json(500, { error: "RECOVERY_TOKEN no está configurado en Netlify." });
  }
  if (token !== process.env.RECOVERY_TOKEN) {
    return json(403, { error: "Token de recuperación inválido." });
  }

  const users = createDefaultUsers();
  await writeUsers(users);
  return json(200, {
    ok: true,
    message: "Usuarios reinicializados. Ahora puedes ingresar con ADMIN_EMAIL y ADMIN_PASSWORD configurados en Netlify.",
  });
};
