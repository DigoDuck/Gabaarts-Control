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
