# DESIGN.md — Processo Visual Padrão

> Este arquivo define COMO decidir o visual, não QUAL visual. Cores, logo e tipografia display são identidade de cada projeto e ficam na seção final, preenchida por projeto.

## Princípios (valem para todos os projetos)

1. **Tokens primeiro.** Nenhuma cor, espaçamento ou fonte hardcoded em componente. Tudo nasce como CSS variable / token Tailwind, definido antes do primeiro componente.
2. **shadcn como base, customização por token.** Componentes shadcn não são editados diretamente na primeira passada; a identidade entra via tokens. Só customizar o componente quando o token não resolver.
3. **Dark e light desde o dia 1.** Paleta definida em pares (bg/surface/text para cada modo). Adicionar dark mode depois custa 5x mais.
4. **Semântica separada de identidade.** Cores de estado (sucesso, erro, aviso, info) são tokens próprios, nunca reaproveitam a cor de marca.
5. **Escala fixa.** Espaçamento na escala Tailwind padrão (4px base). Tipografia com no máximo 5 tamanhos em uso. Se precisar de um sexto, remover um.
6. **Acessibilidade mínima inegociável:** contraste AA (4.5:1 em texto), foco visível em tudo que é clicável, área de toque ≥ 44px em ações primárias.

## Fase 1 (Django Admin): fora do escopo visual

O Admin fica **default**: tema padrão, `verbose_name` em PT, agrupamento de campos e readonly bem escolhidos. Nenhuma ferramenta de design é usada no Admin; ele é utilitário. Design começa na fase 2, com o React.

## Pipeline de frontend (fase 2): consultar → criar → revisar

Três ferramentas, três papéis fixos, um dono por etapa. Elas se sobrepõem se invocadas livremente; a ordem abaixo elimina o conflito (DECISIONS.md #007).

| Etapa | Ferramenta | Quando | Entrega |
|---|---|---|---|
| **1. Consultar** | skill `ui-ux-pro-max` | Uma vez no início da fase 2; de novo só ao introduzir um tipo novo de tela (ex.: primeiro gráfico) | Estilo, paleta, pareamento de fontes e regras UX para dashboard interno → preenche a seção "Identidade" e vira tokens. É consulta: não escreve componente. |
| **2. Criar** | skill `frontend-design` | Toda tela ou componente novo | Implementação com direção estética intencional, usando **somente** os tokens já definidos. Não inventa cor/fonte fora do token. |
| **3. Revisar** | plugin `impeccable` | Todo PR que toque UI; ou quando algo "ficou genérico" | Auditoria (hierarquia, espaçamento, estados, contraste AA) e iteração ao vivo no browser. Achado que exige mudar token → volta à etapa 1 e registra aqui. |

Mapa de gatilhos:

- "Que estilo / paleta / fonte / tipo de gráfico usar?" → `ui-ux-pro-max` (consulta)
- "Construir tela/componente novo" → `frontend-design`
- "Polir, auditar, ficou feio/genérico" ou PR de UI pronto → `impeccable`
- Dashboard com gráficos → `ui-ux-pro-max` escolhe o tipo de gráfico, `frontend-design` constrói, `impeccable` audita

Precedência em conflito: **princípios e tokens deste arquivo** > impeccable (auditoria) > frontend-design (direção) > ui-ux-pro-max (referência). Nenhuma skill sobrescreve token sem registro aqui.

## Fluxo de definição visual (resumo por projeto)

1. Definir identidade com a etapa 1 do pipeline → preencher seção abaixo.
2. Gerar tokens (Tailwind config + CSS variables).
3. Montar **1 tela de referência** com as etapas 2 e 3 validando os tokens.
4. Só então escalar para o resto das telas.

## Identidade deste projeto (pendente — definir com a Rouseli antes da fase 2)

- **Nome / tagline:** Gabaarts Control ·
- **Tom visual em 3 palavras:**
- **Acento principal:** `#`
- **Dark:** bg `#` · surface `#` · text `#`
- **Light:** bg `#` · surface `#` · text `#`
- **Estados:** sucesso `#` · erro `#` · aviso `#`
- **Fonte UI:** (default: Inter) **Fonte display (opcional):**
- **Logo / marca:** (a marca Gabaarts já existe; coletar referências com a proprietária)
