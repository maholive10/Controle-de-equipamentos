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
