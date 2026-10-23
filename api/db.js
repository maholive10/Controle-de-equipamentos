import { handler, redis, usuarioAtual, pode, exigir, publico, novoId, idValido, PREFIX, COLS, VER, HttpError } from "./_lib.js";

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
const so = (obj, campos) => Object.keys(obj || {}).every((k) => campos.includes(k));
const DEVOLUCAO = ["devolvidoEm", "devolucaoPor", "fotoId", "devolucaoObs"];
const MANUT = ["manutencao", "manMotivo", "manDesde", "manPor"];
// quem pode gravar em massa cada coleção
const BULK = { equipamentos: ["eq", "editar"], colaboradores: ["cfg", "editar"], registros: ["admin"], config: ["admin"] };

export default handler(async (req, res) => {
  const u = await usuarioAtual(req);

  /* Leitura. Sem permissão de Relatório, só vêm os registros em aberto (o que a Devolução usa). */
  if (req.method === "GET") {
    const v = req.query.v;
    if (v !== undefined) {
      const [cur] = await redis([["GET", VER]]);
      if (String(cur || 0) === String(v)) return res.json({ unchanged: true, ver: Number(cur || 0) });
    }
    const r = await redis([["GET", VER], ...COLS.map((c) => ["HGETALL", key(c)])]);
    const data = {};
    COLS.forEach((c, i) => { data[c] = parse(r[i + 1]); });
    if (!pode(u, "hist", "ver")) data.registros = data.registros.filter((x) => !x.devolvidoEm);
    return res.json({ ver: Number(r[0] || 0), data, user: publico(u) });
  }

  if (req.method !== "POST") throw new HttpError(405, "method", "Método não permitido.");
  const { op, col, id, data, remove } = req.body || {};

  if (op === "bulk") {
    const cmds = [];
    for (const c of COLS) {
      const docs = ((data && data[c]) || []).filter((d) => d && idValido(d.id));
      const ids = ((remove && remove[c]) || []).filter(idValido);
      if (!docs.length && !ids.length) continue;
      const [area, nivel] = BULK[c];
      if (area === "admin") { if (!u || !u.admin) throw new HttpError(403, "forbidden", "Somente administradores podem importar esses dados."); }
      else exigir(u, area, nivel);
      for (const d of docs) cmds.push(["HSET", key(c), d.id, limpo(d)]);
      if (ids.length) cmds.push(["HDEL", key(c), ...ids]);
    }
    cmds.push(["INCR", VER]);
    const r = await redis(cmds);
    return res.json({ ok: true, ver: r[r.length - 1], total: cmds.length - 1 });
  }

  if (!COLS.includes(col)) throw new HttpError(400, "invalid", "Coleção inválida.");
  if (op !== "add" && !idValido(id)) throw new HttpError(400, "invalid", "Identificador inválido.");

  /* Permissões. Entrega e devolução são livres; o resto depende do usuário. */
  let atual = null;
  if (op === "update") {
    const [cur] = await redis([["HGET", key(col), id]]);
    if (!cur) throw new HttpError(404, "not_found", "Registro não encontrado. Atualize a página.");
    atual = JSON.parse(cur);
  }
  if (col === "registros") {
    const livre = (op === "add" && data && !data.devolvidoEm) || (op === "update" && !atual.devolvidoEm && so(data, DEVOLUCAO));
    if (!livre) exigir(u, "hist", "editar");
  } else if (col === "equipamentos") {
    const livre = op === "update" && data && data.manutencao === true && so(data, MANUT);
    if (!livre) exigir(u, "eq", "editar");
  } else if (col === "colaboradores") {
    if (op !== "set") exigir(u, "cfg", "editar"); // na entrega, nomes novos entram na lista
  } else exigir(u, "cfg", "editar"); // config

  let cmd, nid = id;
  if (op === "add") { nid = novoId(); cmd = ["HSET", key(col), nid, limpo(data)]; }
  else if (op === "set") cmd = ["HSET", key(col), id, limpo(data)];
  else if (op === "delete") cmd = ["HDEL", key(col), id];
  else if (op === "update") cmd = ["HSET", key(col), id, limpo(Object.assign(atual, data || {}))];
  else throw new HttpError(400, "invalid", "Operação inválida.");
  const r = await redis([cmd, ["INCR", VER]]);
  res.json({ ok: true, id: nid, ver: r[1] });
});
