import { handler, redis, usuarioAtual, hashSenha, publico, limparPerms, novoId, idValido, USERS, VER, HttpError } from "./_lib.js";

// Somente administradores. GET -> lista | POST {op:"set"|"delete", ...}
export default handler(async (req, res) => {
  const eu = await usuarioAtual(req);
  if (!eu) throw new HttpError(401, "login", "Entre com seu usuário para fazer isso.");
  if (!eu.admin) throw new HttpError(403, "forbidden", "Somente administradores gerenciam usuários.");

  const [flat] = await redis([["HGETALL", USERS]]);
  const todos = [];
  for (let i = 0; i < (flat || []).length; i += 2) todos.push(Object.assign(JSON.parse(flat[i + 1]), { id: flat[i] }));

  if (req.method === "GET") return res.json({ usuarios: todos.map(publico) });
  if (req.method !== "POST") throw new HttpError(405, "method", "Método não permitido.");

  const b = req.body || {};
  if (b.op === "delete") {
    if (!idValido(b.id)) throw new HttpError(400, "invalid", "Usuário inválido.");
    if (b.id === eu.id) throw new HttpError(400, "invalid", "Você não pode remover o próprio usuário.");
    await redis([["HDEL", USERS, b.id], ["INCR", VER]]);
    return res.json({ ok: true });
  }
  if (b.op !== "set") throw new HttpError(400, "invalid", "Operação inválida.");

  const atual = b.id ? todos.find((u) => u.id === b.id) : null;
  if (b.id && !atual) throw new HttpError(404, "not_found", "Usuário não encontrado.");
  const u = Object.assign({ sv: 0, ativo: true, admin: false, perms: {} }, atual || {});
  if (b.nome !== undefined) u.nome = String(b.nome).trim().replace(/\s+/g, " ").slice(0, 80);
  if (b.login !== undefined) u.login = String(b.login).trim().toLowerCase().slice(0, 40);
  if (!u.nome) throw new HttpError(400, "invalid", "Informe o nome.");
  if (!/^[a-z0-9._-]{2,40}$/.test(u.login || "")) throw new HttpError(400, "invalid", "Usuário (login) deve ter 2 a 40 letras, números, ponto, hífen ou sublinhado, sem espaços.");
  if (u.login === "admin") throw new HttpError(400, "invalid", "O usuário \"admin\" é reservado.");
  if (todos.some((x) => x.login === u.login && x.id !== b.id)) throw new HttpError(409, "dup", "Já existe um usuário com esse login.");
  if (b.perms !== undefined) u.perms = limparPerms(b.perms);
  if (b.admin !== undefined) u.admin = !!b.admin;
  if (b.ativo !== undefined) { if (u.ativo !== false && b.ativo === false) u.sv++; u.ativo = !!b.ativo; }
  if (b.senha) {
    if (String(b.senha).length < 4) throw new HttpError(400, "invalid", "A senha precisa ter pelo menos 4 caracteres.");
    u.hash = hashSenha(b.senha); if (atual) u.sv++; // troca de senha encerra as sessões abertas
  }
  if (!u.hash) throw new HttpError(400, "invalid", "Defina uma senha para o novo usuário.");
  if (b.id === eu.id && (!u.admin || !u.ativo)) throw new HttpError(400, "invalid", "Você não pode tirar o próprio acesso de administrador.");
  const id = b.id || "u" + novoId();
  const { id: _x, ...doc } = u;
  await redis([["HSET", USERS, id, JSON.stringify(doc)], ["INCR", VER]]);
  res.json({ ok: true, id });
});
