import crypto from "node:crypto";

export const PREFIX = "ce:"; // separa as chaves deste app de outras no mesmo banco
export const COLS = ["equipamentos", "registros", "colaboradores", "config"];
export const USERS = PREFIX + "usuarios";
export const VER = PREFIX + "ver";
export const AREAS = ["eq", "hist", "cfg"]; // Equipamentos, Relatório, Configurações
const NIV = { nenhum: 0, ver: 1, editar: 2 };

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

/* ---------- Senhas e sessões ---------- */
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const SECRET = () => process.env.AUTH_SECRET || sha("ce|" + (process.env.SENHA_MESTRE || "") + "|" + (TOKEN_() || "")).toString("hex");
const sign = (p) => crypto.createHmac("sha256", SECRET()).update(p).digest("base64url");
export const iguais = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

export function hashSenha(s) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(String(s), salt, 32).toString("hex");
}
export function confereSenha(s, h) {
  const [salt, hx] = String(h || "").split(":");
  if (!salt || !hx) return false;
  return crypto.timingSafeEqual(Buffer.from(hx, "hex"), crypto.scryptSync(String(s), salt, 32));
}

export function criarToken(uid, sv) {
  const p = Buffer.from(JSON.stringify({ u: uid, s: sv || 0, e: Date.now() + 30 * 864e5 })).toString("base64url");
  return p + "." + sign(p);
}
function lerToken(tok) {
  if (!tok || typeof tok !== "string" || !tok.includes(".")) return null;
  const [p, s] = tok.split("."), ok = sign(p);
  if (!s || s.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok))) return null;
  try { const d = JSON.parse(Buffer.from(p, "base64url").toString()); return d.e > Date.now() ? d : null; } catch { return null; }
}

export const ADMIN = { id: "admin", nome: "Administrador", login: "admin", admin: true, perms: {} };
export const publico = (u) => u && { id: u.id, nome: u.nome, login: u.login, admin: !!u.admin, perms: u.perms || {}, ativo: u.ativo !== false };

/* Usuário da requisição (ou null se não logado). Sessão inválida -> 401. */
export async function usuarioAtual(req) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : req.query && req.query.t;
  if (!tok) return null;
  const d = lerToken(tok);
  const fora = new HttpError(401, "auth", "Sua sessão terminou. Entre novamente.");
  if (!d) throw fora;
  if (d.u === "admin") { if (!process.env.SENHA_MESTRE) throw fora; return ADMIN; }
  const [raw] = await redis([["HGET", USERS, d.u]]);
  if (!raw) throw fora;
  const u = Object.assign(JSON.parse(raw), { id: d.u });
  if (u.ativo === false || (u.sv || 0) !== d.s) throw fora;
  return u;
}

export const pode = (u, area, nivel = "ver") => !!u && (u.admin || (NIV[(u.perms || {})[area]] || 0) >= NIV[nivel]);
export function exigir(u, area, nivel) {
  if (!u) throw new HttpError(401, "login", "Entre com seu usuário para fazer isso.");
  if (!pode(u, area, nivel)) throw new HttpError(403, "forbidden", "Seu usuário não tem permissão para fazer isso.");
}
export const limparPerms = (p) => Object.fromEntries(AREAS.map((a) => [a, NIV[(p || {})[a]] !== undefined ? p[a] : "nenhum"]));

/* ---------- Utilidades ---------- */
export const novoId = () => Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
export const idValido = (id) => typeof id === "string" && /^[\w\-.:@ ]{1,120}$/.test(id);

export function handler(fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { await fn(req, res); }
    catch (e) {
      const st = e instanceof HttpError ? e.status : 500;
      if (!(e instanceof HttpError)) console.error(e);
      res.status(st).json({ code: e.code || "erro", error: e instanceof HttpError ? e.message : "Erro inesperado no servidor." });
    }
  };
}
