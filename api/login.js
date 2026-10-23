import { handler, redis, usuarioAtual, criarToken, confereSenha, iguais, publico, ADMIN, USERS, PREFIX, HttpError } from "./_lib.js";

// POST {login, senha} -> {token, user}   |   GET (com token) -> {user}
export default handler(async (req, res) => {
  if (req.method === "GET") return res.json({ user: publico(await usuarioAtual(req)) });
  if (req.method !== "POST") throw new HttpError(405, "method", "Método não permitido.");

  const login = String((req.body || {}).login || "").trim().toLowerCase();
  const senha = String((req.body || {}).senha || "");
  if (!login || !senha) throw new HttpError(400, "invalid", "Informe usuário e senha.");

  // trava simples contra tentativas repetidas: 10 erros em 15 min por usuário
  const rl = PREFIX + "rl:" + login.slice(0, 60);
  const [tent] = await redis([["GET", rl]]);
  if (Number(tent || 0) >= 10) throw new HttpError(429, "rate_limited", "Muitas tentativas. Aguarde 15 minutos e tente de novo.");
  const falha = async () => { await redis([["INCR", rl], ["EXPIRE", rl, 900]]); throw new HttpError(403, "senha", "Usuário ou senha incorretos."); };

  if (login === "admin") {
    if (!process.env.SENHA_MESTRE) throw new HttpError(500, "config", "Defina a variável SENHA_MESTRE na Vercel.");
    if (!iguais(senha, process.env.SENHA_MESTRE)) return falha();
    await redis([["DEL", rl]]);
    return res.json({ token: criarToken("admin", 0), user: publico(ADMIN) });
  }
  const [flat] = await redis([["HGETALL", USERS]]);
  let u = null;
  for (let i = 0; i < (flat || []).length; i += 2) {
    const d = JSON.parse(flat[i + 1]);
    if (String(d.login).toLowerCase() === login) { u = Object.assign(d, { id: flat[i] }); break; }
  }
  if (!u || !confereSenha(senha, u.hash)) return falha();
  if (u.ativo === false) throw new HttpError(403, "inativo", "Este usuário está desativado. Fale com o administrador.");
  await redis([["DEL", rl]]);
  res.json({ token: criarToken(u.id, u.sv || 0), user: publico(u) });
});
