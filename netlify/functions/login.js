const { createToken, findUserByEmail, json, publicUser, sessionCookie, verifyPassword } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });
  const body = JSON.parse(event.body || "{}");
  const user = await findUserByEmail(body.email);
  if (!user || !verifyPassword(user, body.password)) {
    return json(401, { error: "Credenciales incorrectas." });
  }
  const token = await createToken(user);
  return json(200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token) });
};
