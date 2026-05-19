const { json, publicUser, readUserFromEvent } = require("./_shared");

exports.handler = async (event) => {
  const user = await readUserFromEvent(event);
  return json(200, { user: publicUser(user) });
};
