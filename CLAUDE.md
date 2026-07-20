@AGENTS.md

## Claude Code — específico

- **Review:** subagents `django-reviewer` + `code-quality-reviewer` antes de qualquer merge em main; `bug-hunter-scanner` quando houver comportamento inesperado. Quando o Claude for o REVISOR, os subagents rodam sobre o código do Codex.
- **Ponytail:** full irrestrito neste repo, inclusive em código CORE (DECISIONS.md #006 — override do #002).
- **Graphify:** apenas em retomada de projeto ou codebase crescido (DECISIONS.md #003).
- **Frontend** (`frontend-design`, `ui-ux-pro-max`, `impeccable`): sempre subordinados ao DESIGN.md.
