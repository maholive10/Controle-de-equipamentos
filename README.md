# Controle de equipamentos

Registro de entrega e devolução de equipamentos, com checklist, foto na devolução, histórico e exportação em CSV/PDF.
Hospedado na **Vercel**, com dados e fotos no **Upstash Redis**. Todos os aparelhos veem os mesmos dados; a tela atualiza sozinha a cada 30 s (e ao voltar para a aba).

## Estrutura

```
index.html        # aplicação (HTML + CSS + JS)
api/_lib.js       # conexão com o Upstash (não vira rota)
api/db.js         # GET/POST /api/db (equipamentos, registros, colaboradores, config)
api/foto.js       # GET/POST /api/foto (fotos de devolução)
package.json      # sem dependências
vercel.json
```

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Para quê |
|---|---|
| `KV_REST_API_URL` e `KV_REST_API_TOKEN` | Criadas sozinhas ao conectar o Upstash pelo painel da Vercel (Storage) |
| `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` | Alternativa, se você copiou do console do Upstash |

Basta um dos dois pares. Não há login: todos que abrem o link têm o mesmo acesso.

## Publicar

1. Envie os arquivos para o repositório no GitHub (a pasta `api` fica na raiz, ao lado do `index.html`).
2. Na Vercel o deploy é automático a cada commit. Framework Preset: **Other**, sem Build Command.

## Colaboradores

- **Configurações → Importar planilha do Excel**: aceita .xlsx, .xls ou .csv. Lê a primeira aba; precisa de uma coluna **Nome** (também reconhece "Colaborador" ou "Funcionário"). **Cargo** (ou "Função") e **Turno** são opcionais. Nomes já cadastrados são atualizados, sem duplicar. Há a opção de remover da lista quem não está na planilha. O botão **Baixar planilha modelo** gera um exemplo.
- **Configurações → Incluir manualmente**: adiciona um nome por vez.
- **Entrega**: o campo *Colaborador responsável* é uma lista com todos os cadastrados (com filtro quando passa de 15 nomes). A última opção, **Digitar nome que não está na lista**, abre um campo livre; esse nome entra na lista ao registrar a entrega.

## Comportamento

- A aba aberta, o rascunho da entrega e a devolução em andamento ficam guardados no aparelho: trocar de aba no navegador ou recarregar a página não perde o que estava na tela.
- Os dados atualizam sozinhos a cada 30 s e ao voltar para a aba.
## Dados no Upstash

Todas as chaves usam o prefixo `ce:` para não misturar com outros apps no mesmo banco:
`ce:equipamentos`, `ce:registros`, `ce:colaboradores`, `ce:config` (hashes, um JSON por item), `ce:foto:<id>` (foto em base64) e `ce:ver` (contador de versão usado na sincronização).

Fotos são reduzidas para 1280 px (~150–250 KB). No plano gratuito do Upstash (256 MB) cabem milhares de fotos.
