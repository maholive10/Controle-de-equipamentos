import { handler, papelDaSenha, criarToken, exigir, HttpError } from "./_lib.js";

// POST {nome, senha} -> {token, nome, papel}   |   GET (com token) -> {nome, papel}
export default handler(async (req, res) => {
  if (req.method === "GET") return res.json(exigir(req));
  if (req.method !== "POST") throw new HttpError(405, "method", "Método não permitido.");
  const { nome, senha } = req.body || {};
  const n = String(nome || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!n || !senha) throw new HttpError(400, "invalid", "Informe seu nome e a senha.");
  const papel = papelDaSenha(String(senha));
  if (!papel) throw new HttpError(403, "senha", "Senha incorreta.");
  res.json({ token: criarToken(n, papel), nome: n, papel });
});
