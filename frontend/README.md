# Frontend — Gabaarts Control

SPA React + Vite que consome a API DRF da fase 2a. Identidade visual e regras de
uso da paleta estão no [DESIGN.md](../DESIGN.md) da raiz — nenhuma cor nasce aqui.

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
```

O backend precisa estar de pé (`docker compose up` na raiz) e o CORS liberado
para `http://localhost:5173`.

| Script | O quê |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | type-check + build de produção em `dist/` |
| `npm run test` | vitest (cliente de API) |
| `npm run lint` | oxlint |

## Variáveis de ambiente

| Var | Default (dev) | O quê |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8000` | URL base da API, **sem barra final** |

Em produção ela é definida no painel da Vercel apontando para o domínio do
Railway. Nada de URL hardcoded (DECISIONS.md #010).

## Autenticação

`POST /api/auth/token/` troca usuário e senha por um token estático
(DECISIONS.md #008). O token fica no `localStorage` e vai em toda chamada como
`Authorization: Token <t>`; um `401` limpa o token e devolve o usuário ao login.
Revogar acesso = apagar o token no Admin.

## Estrutura

```text
src/
├── components/       # shell da aplicação, marca e componentes shadcn (ui/)
├── lib/              # cliente de API, formatação de dinheiro, tipos por recurso
├── routes/           # uma tela por arquivo
├── store/            # zustand: auth e tema
└── index.css         # tokens do DESIGN.md — fonte única da paleta
```

`/tokens` é uma rota de conferência: mostra a paleta computada nos dois temas.
Não entra na navegação.

## Deploy (Vercel)

Root directory `frontend/`, build padrão do Vite. O `vercel.json` faz o rewrite
de qualquer rota para `index.html` (SPA). O primeiro deploy é manual, feito pelo
Diogo — ver a seção "Deploy" do README da raiz para a ordem entre Railway e
Vercel.

## Pendências conhecidas

- A chama da sidebar, do login e do favicon é **placeholder**; trocar pelo SVG
  oficial quando ele for exportado do vetor.
- Telas de CRUD e dashboard entram na fase 2c.
