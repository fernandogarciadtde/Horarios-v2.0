const { clearCookie, json } = require("./_shared");

exports.handler = async () => {
  return json(200, { ok: true }, { "Set-Cookie": clearCookie() });
};
