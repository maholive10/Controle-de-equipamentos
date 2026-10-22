import crypto from "node:crypto";

export const PREFIX = "ce:"; // separa as chaves deste app de outras no mesmo banco
export const COLS = ["equipamentos", "registros", "colaboradores", "config"];

const URL_ = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_ = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export class HttpError extends Error {
  constructor(status, code, msg) { super(msg); this.status = status; this.code = code; }
}

/* Executa vários comandos Redis numa só chamada (pipeline REST do Upstash) */
export async function redis(cmds) {
  const url = URL_(), token = TOKEN_();
  if (!url || !token) throw new HttpError(500, "config", "Banco de dados não configurado na Vercel (variáveis do Upstash ausentes).");
  const r = await fetch(url.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new HttpError(502, "db", "Falha ao acessar o banco de dados (" + r.status + ").");
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new HttpError(502, "db", "Erro do banco de dados: " + x.error);
    return x.result;
  });
}

/* ---------- Autenticação ---------- */
const SENHAS = () => ({
  mestre: process.env.SENHA_MESTRE || "",
  operador: process.env.SENHA_OPERADOR || "",
  consulta: process.env.SENHA_CONSULTA || "",
});
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const SECRET = () => {
  const s = SENHAS();
  return process.env.AUTH_SECRET || sha([s.mestre, s.operador, s.consulta, TOKEN_() || ""].join("|")).toString("hex");
};
const b64u = (b) => Buffer.from(b).toString("base64url");
const sign = (p) => crypto.createHmac("sha256", SECRET()).update(p).digest("base64url");

export function papelDaSenha(senha) {
  const s = SENHAS();
  if (!s.mestre) throw new HttpError(500, "config", "Defina a variável SENHA_MESTRE na Vercel.");
  const h = sha(senha);
  for (const p of ["mestre", "operador", "consulta"]) {
    if (s[p] && crypto.timingSafeEqual(h, sha(s[p]))) return p;
  }
  return null;
}

export function criarToken(nome, papel) {
  const p = b64u(JSON.stringify({ n: nome, p: papel, e: Date.now() + 30 * 864e5 }));
  return p + "." + sign(p);
}

export function lerToken(tok) {
  if (!tok || typeof tok !== "string" || !tok.includes(".")) return null;
  const [p, s] = tok.split(".");
  const ok = sign(p);
  if (s.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok))) return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    if (!d.e || d.e < Date.now()) return null;
    return { nome: d.n, papel: d.p };
  } catch { return null; }
}

export function exigir(req, ...papeis) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : (req.query && req.query.t);
  const u = lerToken(tok);
  if (!u) throw new HttpError(401, "auth", "Sessão expirada. Entre novamente.");
  if (papeis.length && !papeis.includes(u.papel)) throw new HttpError(403, "forbidden", "Seu acesso não permite esta ação.");
  return u;
}

/* ---------- Utilidades ---------- */
export const novoId = () => Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
export const idValido = (id) => typeof id === "string" && /^[\w\-.:@ ]{1,120}$/.test(id);

export function handler(fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { await fn(req, res); }
    catch (e) {
      const st = e instanceof HttpError ? e.status : 500;
      if (st === 500 && !(e instanceof HttpError)) console.error(e);
      res.status(st).json({ code: e.code || "erro", error: e instanceof HttpError ? e.message : "Erro inesperado no servidor." });
    }
  };
}
