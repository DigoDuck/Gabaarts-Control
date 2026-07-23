# DECISIONS.md — Log de Decisões (ADR-lite)

> Regra: toda adoção OU rejeição de ferramenta/padrão entra aqui. Decisão rejeitada não volta à mesa sem fato novo registrado no campo "Gatilho de revisão".

## Formato de entrada

```
## #NNN — Título · AAAA-MM · Status: Ativa | Revertida | Rejeitada
Decisão: ...
Justificativa: ...
Trade-off aceito: ...
Gatilho de revisão: ...
```

---

## #001 — Stack base: Django + DRF + React como default · 2026-07 · Status: Ativa

**Decisão:** Todo projeto novo usa Django + DRF (API) + React/Vite (SPA). Exceção documentada: freelance pequeno de uso interno (1 cliente, CRUD, sem exposição pública) usa Django Templates + Admin.
**Justificativa:** Alinha com as vagas-alvo (Full Stack Jr Python + React); reaproveita o investimento já feito em React/Tailwind/shadcn; o custo de DRF+SPA (CORS, JWT, 2 deploys) é conhecimento cobrado em entrevista.
**Trade-off aceito:** SPA é over-engineering para projetos pequenos — por isso a exceção é regra escrita, não improviso.
**Gatilho de revisão:** Mudança de mercado-alvo ou 2 projetos seguidos caindo na exceção.

## #002 — Ponytail adotado com escopo restrito · 2026-07 · Status: Ativa

**Decisão:** Ponytail liberado APENAS em código PLUMBING (scaffold, boilerplate, CRUD trivial). Proibido em código CORE.
**Justificativa:** Havia sido rejeitado por otimizar economia de código em detrimento de transparência de decisão, conflitando com o protocolo anti-vibe-coding. A restrição de escopo resolve o conflito: em PLUMBING a transparência importa menos; em CORE o predict-before-reveal continua soberano.
**Trade-off aceito:** Ganho de velocidade menor do que uso irrestrito.
**Gatilho de revisão:** Se código gerado em PLUMBING começar a vazar lógica de negócio sem revisão.

## #003 — Graphify adotado com escopo restrito · 2026-07 · Status: Ativa

**Decisão:** Graphify usado para mapear estrutura de codebase em duas situações: retomada de projeto parado há semanas, ou codebase que cresceu além do que se mantém na cabeça.
**Justificativa:** Havia sido rejeitado por mismatch com codebase próprio em estágio inicial — o que continua verdadeiro no início de cada projeto. O valor aparece na manutenção e na alternância entre múltiplos projetos, que agora é o cenário real (2 projetos entregues em manutenção + novos começando).
**Trade-off aceito:** Custo de setup por projeto sem valor imediato nas primeiras semanas.
**Gatilho de revisão:** Se após 2 usos reais não economizar tempo perceptível na retomada.

## #004 — Idioma: código EN, comentários PT · 2026-07 · Status: Ativa (contraponto registrado)

**Decisão:** Código, commits, docstrings e branches em inglês. Comentários e chat em português.
**Justificativa:** Comentários em PT reduzem fricção de aprendizado no nível atual.
**Contraponto registrado (Claude):** Para vagas remote/nearshore com inglês B2, comentários em PT em repo público são sinal negativo ao recrutador internacional; recomendação era 100% EN no código.
**Gatilho de revisão:** Primeira aplicação séria para vaga internacional/nearshore → migrar comentários para EN nos repos de portfólio.

## #005 — Documentação de agente: 3 arquivos fixos · 2026-07 · Status: Ativa

**Decisão:** Todo projeto nasce com CLAUDE.md + DESIGN.md + DECISIONS.md. Outros (PRODUCT.md, AGENTS.md, LGPD.md etc.) só se o projeto justificar.
**Justificativa:** Documentação de agente desatualizada é pior que nenhuma; 3 arquivos com dono e propósito são mantíveis, 6 viram cargo cult.
**Gatilho de revisão:** Se algum dos 3 ficar 2 projetos sem ser atualizado, ele é candidato a corte.

---

# Decisões deste projeto (Gabaarts Control)

> Decisões de domínio (modelo, taxas, precificação) vivem no log da [arquitetura](docs/arquitetura.md) §7. Aqui entram só ferramenta e padrão de trabalho.

## #006 — Ponytail irrestrito neste repo (override do #002) · 2026-07 · Status: Ativa

**Decisão:** Neste repositório, ponytail full vale em PLUMBING **e** CORE. O protocolo anti-vibe-coding (predict-before-reveal, whiteboard reconstruction) está dispensado.
**Justificativa:** Pedido explícito do Diogo (18/07/2026). O risco que o #002 mitigava é menor aqui: a arquitetura foi discutida e fechada em docs/arquitetura.md ANTES de qualquer código, e o CORE segue protegido por testes obrigatórios com valores reais da planilha (§0.2).
**Trade-off aceito:** Menos aprendizado ativo durante a implementação; o ensino fica nas explicações de chat, não no protocolo.
**Gatilho de revisão:** Bug em código CORE que o Diogo não consiga explicar ao revisar → volta o protocolo do #002 para CORE.

## #007 — Pipeline de frontend: consultar → criar → revisar · 2026-07 · Status: Ativa (dormente até a fase 2)

**Decisão:** Uso conjunto das três ferramentas de frontend com papéis fixos, definido no DESIGN.md: `ui-ux-pro-max` **consulta** (estilo, paleta, fontes, regras UX, tipos de gráfico), `frontend-design` **cria** (telas e componentes sobre os tokens), `impeccable` **revisa** (auditoria e polimento por PR de UI, iteração ao vivo). Tokens do DESIGN.md têm precedência sobre qualquer sugestão de skill.
**Justificativa:** As três se sobrepõem se invocadas livremente (todas opinam sobre estética); um dono por etapa elimina conflito e retrabalho.
**Trade-off aceito:** Cerimônia leve (3 passos) por tela nova.
**Gatilho de revisão:** Se o pipeline atrasar mais do que ajudar em 2 telas seguidas, reduzir para `impeccable` apenas.

## #008 — Auth mínima: sessão Admin (fase 1), TokenAuth (fase 2); JWT rejeitado · 2026-07 · Status: Ativa

**Decisão:** Fase 1 usa a sessão do próprio Django Admin; fase 2 adiciona DRF TokenAuth para o front React. SimpleJWT (access + refresh + rotação) rejeitado nesta fase.
**Justificativa:** Uso interno com dois usuários conhecidos; JWT com refresh é complexidade sem requisito que a justifique.
**Trade-off aceito:** Token estático é menos sofisticado; revogação é deletar o token no Admin.
**Gatilho de revisão:** Exposição pública da API ou usuários externos.

## #009 — Migração para AGENTS.md canônico + fluxo de dois agentes · 2026-07 · Status: Ativa

**Decisão:** AGENTS.md passa a ser a fonte única de regras lida por Claude Code e Codex; CLAUDE.md vira `@AGENTS.md` + seção "Claude Code — específico". Papéis de executor e revisor alternam entre os dois agentes (critério: folga de quota do plano); quem implementou não revisa.
**Justificativa:** Review cruzado entre vendors ataca cegueira de auto-review (quem implementa tende a não notar os próprios furos); fonte única de regras elimina o risco de CLAUDE.md e AGENTS.md divergirem (drift).
**Trade-off aceito:** Regras no arquivo canônico ficam menos específicas (não podem nomear subagents/skills exclusivos de um agente); overhead de coordenação para alternar papéis e não deixar dois agentes escreverem na mesma branch.
**Gatilho de revisão:** Se em 1 mês (até 2026-08-20) o review cruzado não pegar nenhum problema real que o self-review não pegaria, simplificar para executor único.

## #010 — Deploy: Railway (backend + Postgres) + Vercel (frontend) · 2026-07 · Status: Ativa

**Decisão:** Resolve o C6 da arquitetura. Backend Django e Postgres no Railway; frontend React/Vite na Vercel. O front fala com o backend por HTTPS via CORS restrito ao domínio da Vercel. Sem Docker em produção (o compose continua sendo só o ambiente de dev).
**Justificativa:** Dois usuários internos acessando de máquinas e celulares diferentes exigem algo publicado; Railway entrega Postgres gerenciado e deploy por git push sem escrever infra, e a Vercel é o caminho de menor atrito para Vite. Uma VPS daria mais controle que o projeto não precisa e cobraria manutenção de SO, backup e TLS.
**Trade-off aceito:** Duas plataformas em vez de uma (dois painéis, duas variáveis de ambiente para manter em sincronia); lock-in leve de PaaS; custo mensal pequeno em vez de zero. Backup do Postgres passa a depender do plano do Railway, não de script próprio.
**Gatilho de revisão:** Custo passar de ~US$ 10/mês, ou surgir requisito de dado que não possa sair do Brasil.

**Consequências imediatas (fase 2b):**
- `django-cors-headers` com `CORS_ALLOWED_ORIGINS` explícito, nunca `*`.
- `prod.py` ganha o hardening já marcado no `ponytail:` (SSL redirect, HSTS, cookies secure) e `ALLOWED_HOSTS` do domínio Railway.
- `DATABASE_URL` do Railway precisa ser lida pelo settings (hoje o `base.py` monta a conexão por variáveis separadas).
- Frontend lê a URL da API de env var da Vercel, nunca hardcoded.

## #011 — PRODUCT.md como quarto arquivo de documentação (exceção ao #005) · 2026-07 · Status: Ativa

**Decisão:** Este repositório ganha `PRODUCT.md` além dos três fixos do #005. Ele guarda contexto de produto — quem usa, o que cada tela resolve, não-objetivos — e é proibido de repetir domínio (docs/arquitetura.md) ou processo visual (DESIGN.md).
**Justificativa:** A skill `impeccable`, prevista no DESIGN.md como etapa 3 do pipeline de frontend, exige o arquivo. Independente dela, a fase 2c é a primeira com contexto de produto real que não cabe nos outros arquivos: a usuária principal é não-técnica e isso muda decisão de UI (idioma, texto de erro, mobile), mas não é regra de domínio nem token visual.
**Trade-off aceito:** Mais um arquivo para manter em dia; o #005 alerta que documentação de agente desatualizada é pior que nenhuma.
**Gatilho de revisão:** Se o PRODUCT.md passar a fase 2 inteira sem ser atualizado, ou se virar cópia do README, ele é cortado e o #005 volta a valer sem exceção.

## #012 — Fase 2c-2 inclui os CRUDs de canais, artesãs e equipamentos · 2026-07 · Status: Ativa

**Decisão:** As três telas de cadastro (canais/faixas, artesãs, equipamentos) entram no React na 2c-2. Isso **reverte** o "não entra, fica no Admin (YAGNI)" registrado na spec da fatia (`docs/superpowers/specs/2026-07-22-fase2c2-*-design.md`), que foi atualizada para refletir esta decisão.
**Justificativa:** O `PRODUCT.md` — documento versionado no git — já listava as três telas como fase 2c-2, enquanto a spec (em diretório gitignored) as excluía. Divergência encontrada durante a review da fatia, decidida pelo Diogo em 23/07/2026 com o código já implementado e coberto por build e testes.
**Trade-off aceito:** Nove arquivos a mais para manter, e o Admin deixa de ser o único caminho dessas entidades. O YAGNI da spec era defensável: essas entidades mudam raramente.
**Gatilho de revisão:** Se as três telas atravessarem a fase 3 sem uso real, voltam a ser exclusividade do Admin.

## #013 — Recharts dispensado no dashboard; quebra por canal em barras CSS · 2026-07 · Status: Ativa

**Decisão:** A quebra por canal do dashboard usa barras CSS puras. `recharts` **não** é instalado, contrariando a spec da 2c-2, que o registrava como a única dependência nova da fatia.
**Justificativa:** Cinco canais em barra horizontal não justificam uma lib de gráfico. A própria spec listava "Recharts renderiza cor fora dos tokens (viola DESIGN.md)" como risco a mitigar — risco que deixa de existir sem a lib. Zero KB de bundle e nenhuma cor fora de token.
**Trade-off aceito:** A lib não fica "pronta para visualizações futuras", que era parte da intenção original; a primeira visualização com eixo ou série temporal vai pagar o custo de instalá-la.
**Gatilho de revisão:** Primeira visualização que precise de eixo, tooltip, série temporal ou interação — aí a lib entra com propósito, e a barra CSS não escala.
