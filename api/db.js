import { handler, redis, exigir, novoId, idValido, PREFIX, COLS, HttpError } from "./_lib.js";

const VER = PREFIX + "ver";
const key = (c) => PREFIX + c;
const parse = (flat) => {
  const out = [];
  for (let i = 0; i < (flat || []).length; i += 2) {
    try { out.push(Object.assign(JSON.parse(flat[i + 1]), { id: flat[i] })); } catch {}
  }
  return out;
};
const limpo = (d) => {
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new HttpError(400, "invalid", "Dados inválidos.");
  const { id, ...rest } = d;
  const s = JSON.stringify(rest);
  if (s.length > 100000) throw new HttpError(413, "too_large", "Registro grande demais.");
  return s;
};

export default handler(async (req, res) => {
  /* Leitura: tudo de uma vez. Com ?v=N responde só {unchanged} se nada mudou. */
  if (req.method === "GET") {
    exigir(req);
    const v = req.query.v;
    if (v !== undefined) {
      const [cur] = await redis([["GET", VER]]);
      if (String(cur || 0) === String(v)) return res.json({ unchanged: true, ver: Number(cur || 0) });
    }
    const r = await redis([["GET", VER], ...COLS.map((c) => ["HGETALL", key(c)])]);
    const data = {};
    COLS.forEach((c, i) => { data[c] = parse(r[i + 1]); });
    return res.json({ ver: Number(r[0] || 0), data });
  }

  if (req.method !== "POST") throw new HttpError(405, "method", "Método não permitido.");
  const u = exigir(req, "mestre", "operador");
  const { op, col, id, data } = req.body || {};

  if (op === "bulk") { // importação de dados antigos (somente mestre)
    if (u.papel !== "mestre") throw new HttpError(403, "forbidden", "Somente o mestre pode importar dados.");
    const cmds = [];
    for (const c of COLS) {
      const docs = (data && data[c]) || [];
      for (const d of docs) if (d && idValido(d.id)) cmds.push(["HSET", key(c), d.id, limpo(d)]);
    }
    cmds.push(["INCR", VER]);
    const r = await redis(cmds);
    return res.json({ ok: true, ver: r[r.length - 1], total: cmds.length - 1 });
  }

  if (!COLS.includes(col)) throw new HttpError(400, "invalid", "Coleção inválida.");
  if ((op === "delete" || col === "config") && u.papel !== "mestre")
    throw new HttpError(403, "forbidden", "Somente o mestre pode fazer isso.");

  let cmd, nid = id;
  if (op === "add") { nid = novoId(); cmd = ["HSET", key(col), nid, limpo(data)]; }
  else {
    if (!idValido(id)) throw new HttpError(400, "invalid", "Identificador inválido.");
    if (op === "set") cmd = ["HSET", key(col), id, limpo(data)];
    else if (op === "delete") cmd = ["HDEL", key(col), id];
    else if (op === "update") {
      const [cur] = await redis([["HGET", key(col), id]]);
      if (!cur) throw new HttpError(404, "not_found", "Registro não encontrado. Atualize a página.");
      cmd = ["HSET", key(col), id, limpo(Object.assign(JSON.parse(cur), data || {}))];
    } else throw new HttpError(400, "invalid", "Operação inválida.");
  }
  const r = await redis([cmd, ["INCR", VER]]);
  res.json({ ok: true, id: nid, ver: r[1] });
});
