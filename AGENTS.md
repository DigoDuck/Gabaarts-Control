# AGENTS.md — Gabaarts Control

> Fonte única de verdade para TODOS os agentes. Regras específicas de cada agente ficam no arquivo do agente. Se uma linha não muda o comportamento de um agente, ela é deletada.

## Contexto do Projeto

- **Nome:** Gabaarts Control
- **Objetivo em 1 frase:** API interna (Django + DRF) que substitui a planilha de gestão comercial da Gabaarts: vendas, precificação, custos e administrativo. **Não é e-commerce.**
- **Tipo:** DECISIONS.md #001 — Admin como UI de cadastro na fase 1; na fase 2 o React assume cadastro e dashboards, e o Admin vira fallback técnico + gestão de usuários (arquitetura §7, C1/C2).
- **Fonte de verdade do domínio:** [docs/arquitetura.md](docs/arquitetura.md) (modelo, regras, faseamento e log de decisões de domínio). Em conflito de domínio, a arquitetura vence este arquivo.

### Invariantes de domínio (NUNCA violar)

- Dinheiro é `Decimal`, nunca float. `ROUND_HALF_UP`, arredondamento uma vez, no fim do cálculo.
- Margem é **sobre o preço** (não markup): `(preço − COGS − taxa − frete) / preço`. Margem de contribuição, sem rateio de custo fixo por peça.
- Venda **congela snapshot** (`unit_cogs`, `unit_fee`, `unit_freight`) na criação. Mudar parâmetro (custo/hora, taxa) NUNCA reescreve venda passada.
- Lucro é sempre **derivado**, nunca digitado. Todo `SaleItem` tem produto cadastrado (não existe item avulso).
- Taxa de canal só via `services/fees` — `channel_fee()` quando se tem o canal; `fee_from_tiers()`/`tier_for()` para faixas já carregadas em memória (solver). A fórmula da taxa existe num único lugar.
- Regras de negócio vivem em `services/` (funções puras sobre `Decimal`). Models guardam dado; views e serializers só transportam e validam entrada.

## Idioma

- Código, commits, docstrings e nomes de branch: **inglês**.
- Comentários no código: **português** (DECISIONS.md #004).
- `verbose_name`/labels do Admin: **português** (a proprietária, não-técnica, usa o Admin).
- Respostas no chat e descrições de PR: **português**.
- Commits seguem Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). **Nunca** trailer de coautoria.

## Stack Padrão

- **Backend:** Python 3.12+, Django 5.x, Django REST Framework, PostgreSQL (Docker Compose em dev). Um único app: `core`.
- **Auth:** sessão do Admin na fase 1; DRF TokenAuth quando o React chegar. JWT rejeitado nesta fase (DECISIONS.md #008).
- **Frontend (só na fase 2):** React + Vite, Tailwind, shadcn/ui, Zustand, Recharts. Nada de frontend na fase 1.
- **Testes:** pytest + pytest-django. Código CORE exige teste antes do merge; os casos de validação vêm da planilha (docs/arquitetura.md §0.2).

## Estrutura de Pastas

```
Gabaarts-Control/
├── backend/
│   ├── config/            # settings divididos: base.py, dev.py, prod.py
│   ├── apps/core/         # único app: models, services/, admin, tests/
│   ├── manage.py
│   └── requirements.txt
├── frontend/              # criado só na fase 2 (React + Vite)
├── docs/                  # arquitetura e planos (versionado)
├── docker-compose.yml
├── .env.example           # nunca commitar .env
├── AGENTS.md  CLAUDE.md  DESIGN.md  DECISIONS.md  PRODUCT.md  README.md
```

## Fluxo de Trabalho

1. **Domínio** — já modelado e fechado em docs/arquitetura.md; mudança de regra de negócio atualiza a arquitetura ANTES do código.
2. **Plan mode antes de código não-trivial**; um PR por vez.
3. **Loop de feature** — classificar PLUMBING ou CORE; CORE exige teste antes do merge.
4. **Review** — revisão cruzada obrigatória pelo agente REVISOR (papel rotativo, ver "Dois Agentes") antes de merge em main; ferramentas de review específicas de cada agente estão no arquivo daquele agente.
5. **Verificação obrigatória antes de "pronto"** — rodar e mostrar a saída; nunca declarar sucesso sem evidência.
6. **Deploy** — a definir ao fim da fase 1 (registrar no DECISIONS.md).

## Protocolo Anti-Vibe-Coding

- **Velocidade, não mentoria.** O protocolo anti-vibe-coding (predict-before-reveal, whiteboard reconstruction) **não se aplica** neste repo (DECISIONS.md #006).
- O que permanece de proteção: **anti-fallback** (algo falhou → parar e reportar, nunca trocar abordagem em silêncio), **teste obrigatório em CORE** e explicação de conceitos complexos no chat.

## Dois Agentes (Claude Code + Codex)

- **Executor atual:** Claude Code, desde 19/07/2026.
- **Papéis rotativos:** a cada semana/projeto, um agente é EXECUTOR e o outro é REVISOR. Critério: folga de quota do plano.
- **Regra de ouro: quem implementou não revisa.** Todo código CORE recebe review independente do outro agente antes de merge em main.
- **Um escritor por branch.** O revisor lê e comenta; nunca edita a mesma branch na mesma sessão.
- **Duplicação proibida como hábito:** mesmo prompt nos dois agentes só em decisão CORE de arquitetura.
- Ferramenta nova no fluxo: máximo 1 por projeto, e só entra após registro no DECISIONS.md.

### Roteamento de Modelos (deriva da classificação PLUMBING/CORE, nunca de impulso)

| Camada | Claude Code | Codex |
|---|---|---|
| Julgamento (chat, fora do repo) | Opus 4.8 | — |
| Executor — CORE | Opus 4.8 | GPT-5.6 Sol |
| Executor — PLUMBING | Sonnet | GPT-5.6 Terra |
| Revisor (sempre o outro vendor, todo CORE) | Opus 4.8 + subagents | GPT-5.6 Sol |

1. Modelo de topo só onde errar é caro: Sol/Opus em CORE e review, NUNCA em boilerplate.
2. Uma decisão por tarefa: classificar CORE ou PLUMBING; agente vem da rotação, modelo vem da tabela.
3. O fluxo não depende de acesso promocional: se um modelo sair do plano, substituir na tabela e registrar no DECISIONS.md.

## Codex — específico

- Como REVISOR, usar o Checklist de Segurança (abaixo) como roteiro e entregar o review em português na PR.
- Codex não tem acesso aos subagents/skills do Claude Code — não referenciá-los.

## Checklist de Segurança (antes de qualquer deploy)

- `DEBUG=False` em prod; `ALLOWED_HOSTS` explícito; `SECRET_KEY` e credenciais só via env.
- CORS restrito ao domínio do frontend (`django-cors-headers`), nunca `*` em prod.
- Sem SQL cru; sempre ORM. Inputs de usuário validados no serializer, não na view.
- Permissões DRF explícitas em toda view (`IsAuthenticated` como default global, exceções documentadas).
- Tokens de API (fase 2): DRF TokenAuth; revogar token = deletar no Admin.
- `pip audit` / `npm audit` sem críticas abertas.
