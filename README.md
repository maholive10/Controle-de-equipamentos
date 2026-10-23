# Controle de equipamentos

Registro de entrega e devolução de equipamentos, com foto na devolução, histórico e exportação em CSV/PDF.
Hospedado na **Vercel**, com dados e fotos no **Upstash Redis**. Todos os aparelhos veem os mesmos dados; a tela atualiza sozinha a cada 30 s e ao voltar para a aba.

## Estrutura

```
index.html        # aplicação (HTML + CSS + JS)
api/_lib.js       # conexão com o Upstash, senhas, sessões e permissões (não vira rota)
api/login.js      # POST/GET /api/login
api/usuarios.js   # GET/POST /api/usuarios (somente administradores)
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
| `SENHA_MESTRE` | sim | Senha do usuário **admin** (acesso total, gerencia usuários) |
| `AUTH_SECRET` | não | Texto aleatório para assinar as sessões. Se não definir, usa um derivado da SENHA_MESTRE |

\* Um dos dois pares. Trocar a `SENHA_MESTRE` encerra todas as sessões abertas. Depois de criar ou mudar variáveis, faça **Redeploy**.

## Acesso e permissões

- **Entrega** e **Devolução**: abertas para todos, sem login.
- **Equipamentos**, **Relatório** e **Configurações**: só para quem entra com usuário (botão **Entrar** no topo; **Sair** encerra a sessão).
- Primeiro acesso: usuário `admin` e a senha da variável `SENHA_MESTRE`.
- Em **Configurações → Usuários e permissões** o administrador cria usuários (nome, login, senha) e define para cada área: *Sem acesso*, *Só ver* ou *Ver e editar*. A caixa **Administrador** dá acesso total, inclusive a gerenciar usuários.
- Mudanças de permissão valem em até 30 s, sem o usuário precisar sair. Desativar um usuário ou trocar a senha dele encerra as sessões abertas.
- As regras também valem no servidor: sem permissão, a API recusa a gravação e não entrega o histórico nem as fotos.
- Login: 10 tentativas erradas bloqueiam aquele usuário por 15 minutos.

| Área | Só ver | Ver e editar |
|---|---|---|
| Equipamentos | lista e situação | importar, cadastrar, manutenção, liberar, remover |
| Relatório | histórico completo, fotos, PDF e CSV | editar e excluir registros |
| Configurações | colaboradores, turnos e cargos | importar/incluir/remover colaboradores, salvar turnos e cargos |

## Entrega de vários equipamentos

Na Entrega, marque quantos equipamentos quiser para o mesmo colaborador (com filtro quando a lista passa de 10). Cada equipamento vira um registro próprio, então a devolução pode ser feita item a item. A Devolução agrupa os itens por colaborador, e ao escolher um colaborador na Entrega o app mostra o que ele já tem em uso.

## Planilhas

- **Equipamentos → Importar planilha**: coluna **Equipamento** (ou Nome/Descrição) e, opcional, **Código** (ou Patrimônio/Série). Mesmo código (ou mesmo nome, quando não há código) atualiza o cadastro em vez de duplicar.
- **Configurações → Colaboradores → Importar planilha**: coluna **Nome**; **Cargo** e **Turno** opcionais.
- As duas telas têm **Baixar planilha modelo** e **Incluir manualmente**.

## Dados no Upstash

Todas as chaves usam o prefixo `ce:`: `ce:equipamentos`, `ce:registros`, `ce:colaboradores`, `ce:config`, `ce:usuarios` (senhas guardadas com scrypt, nunca em texto), `ce:foto:<id>` e `ce:ver` (contador usado na sincronização).
