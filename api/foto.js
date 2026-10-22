import { handler, redis, novoId, idValido, PREFIX, HttpError } from "./_lib.js";

const key = (id) => PREFIX + "foto:" + id;
const MAX = 3 * 1024 * 1024; // ~3 MB em base64


export default handler(async (req, res) => {
  if (req.method === "GET") { // <img src="/api/foto?id=...&t=token">
    const id = req.query.id;
    if (!idValido(id)) throw new HttpError(400, "invalid", "Foto inválida.");
    const [b64] = await redis([["GET", key(id)]]);
    if (!b64) throw new HttpError(404, "not_found", "Foto não encontrada.");
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    return res.end(Buffer.from(b64, "base64"));
  }
  if (req.method !== "POST") throw new HttpError(405, "method", "Método não permitido.");
  const { op, id, data } = req.body || {};

  if (op === "delete") {
    if (!idValido(id)) throw new HttpError(400, "invalid", "Foto inválida.");
    await redis([["DEL", key(id)]]);
    return res.json({ ok: true });
  }
  const m = /^data:image\/[a-z+]+;base64,(.+)$/.exec(String(data || ""));
  if (!m) throw new HttpError(400, "invalid", "Imagem inválida.");
  if (m[1].length > MAX) throw new HttpError(413, "too_large", "A foto ficou grande demais. Tente outra.");
  // id próprio só na importação de dados antigos; senão é gerado aqui
  const nid = id && idValido(id) ? id : "f" + novoId();
  await redis([["SET", key(nid), m[1]]]);
  res.json({ ok: true, id: nid });
});
