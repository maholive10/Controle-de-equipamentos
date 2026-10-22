# Controle de equipamentos

Registro de entrega e devolução de equipamentos, com checklist, foto na devolução, histórico e exportação em CSV/PDF.
Hospedado na **Vercel**, com dados e fotos no **Upstash Redis**. Todos os aparelhos veem os mesmos dados; a tela atualiza sozinha a cada 30 s (e ao voltar para a aba).

## Estrutura

```
index.html        # aplicação (HTML + CSS + JS)
api/_lib.js       # conexão com o Upstash + login (não vira rota)
api/login.js      # POST /api/login  (nome + senha -> sessão)
api/db.js         # GET/POST /api/db (equipamentos, registros, colaboradores, config)
api/foto.js       # GET/POST /api/foto (fotos de devolução)
package.json      # sem dependências
vercel.json
```

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `KV_REST_API_URL` e `KV_REST_API_TOKEN` | sim* | Criadas sozinhas ao conectar o Upstash pelo painel da Vercel (Storage) |
| `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` | sim* | Alternativa, se você copiou do console do Upstash |
| `SENHA_MESTRE` | sim | Acesso total (Configurações, editar/excluir, remover equipamentos) |
| `SENHA_OPERADOR` | não | Registra entregas, devoluções e cadastra equipamentos |
| `SENHA_CONSULTA` | não | Só visualiza e exporta relatórios |
| `AUTH_SECRET` | não | Texto aleatório para assinar as sessões. Se não definir, usa um derivado das senhas |

\* Um dos dois pares. Trocar qualquer senha desconecta todo mundo (exceto se `AUTH_SECRET` estiver definido).

Depois de criar ou alterar variáveis, faça **Redeploy**.

## Publicar

1. Envie todos os arquivos (incluindo a pasta `api`) para o repositório no GitHub, substituindo os antigos.
2. Na Vercel o deploy acontece automaticamente a cada commit. Framework Preset: **Other**, sem Build Command.
3. Confirme que o banco Upstash está conectado ao projeto (Storage) e que as senhas estão definidas.

## Uso

- Ao abrir, cada pessoa informa **seu nome** e a **senha** do seu papel. O nome fica gravado nas entregas, devoluções e no PDF. A sessão dura 30 dias no aparelho; o botão **Sair** fica no topo.
- Se um aparelho tiver dados da versão anterior (salvos só no navegador), o mestre verá um aviso **Enviar para o banco** — aparece só enquanto o banco estiver vazio.

## Dados no Upstash

Todas as chaves usam o prefixo `ce:` para não misturar com outros apps no mesmo banco:
`ce:equipamentos`, `ce:registros`, `ce:colaboradores`, `ce:config` (hashes, um JSON por item), `ce:foto:<id>` (foto em base64) e `ce:ver` (contador de versão usado na sincronização).

Fotos são reduzidas para 1280 px (~150–250 KB). No plano gratuito do Upstash (256 MB) cabem milhares de fotos.
