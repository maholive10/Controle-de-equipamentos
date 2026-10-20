# Controle de equipamentos

Aplicação web (HTML único, sem build) para registrar entrega e devolução de equipamentos, com checklist, foto na devolução, histórico e exportação em CSV/PDF.

## Estrutura

```
index.html    # aplicação completa (HTML + CSS + JS)
vercel.json   # configuração de deploy no Vercel
.gitignore
README.md
```

## Publicar no GitHub

1. Crie um repositório novo em https://github.com/new (ex.: `controle-equipamentos`).
2. Na página do repositório, clique em **Add file → Upload files**, arraste os 4 arquivos e clique em **Commit changes**.

Ou pelo terminal:

```bash
git init
git add .
git commit -m "Controle de equipamentos"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/controle-equipamentos.git
git push -u origin main
```

## Publicar no Vercel

1. Acesse https://vercel.com/new e importe o repositório do GitHub.
2. Framework Preset: **Other**. Deixe Build Command e Output Directory vazios.
3. Clique em **Deploy**. Cada novo commit na `main` publica automaticamente.

## Como os dados são guardados nesta versão

Fora do Claude, o app funciona em **modo local**:

- Cadastros, entregas e devoluções ficam no `localStorage` do navegador.
- Fotos ficam no IndexedDB do navegador.
- CSV e PDF são baixados direto pelo navegador.

Isso significa que **cada aparelho/navegador tem seus próprios dados** — não há compartilhamento entre usuários nem controle de papéis (mestre/operador). Limpar os dados do navegador apaga os registros. Para uso em equipe, é preciso ligar o app a um banco na nuvem (ex.: Supabase ou Firebase).
