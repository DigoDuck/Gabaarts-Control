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

## Identidade deste projeto (definida em 20/07/2026, a partir do brand book da loja)

- **Nome / tagline:** Gabaarts Control · "Ideias acendem. Design transforma." (tagline é da loja, **não** entra na UI interna)
- **Tom visual em 3 palavras:** quente, nítido, direto ao dado
- **Acento principal:** `#7A3DFF` (violeta do meio do gradiente)
- **Dark:** bg `#0B0B12` · surface `#14141F` · surface-2 `#1D1D2B` · text `#F5F5FA` · muted `#A0A0B8` · border `#262636`
- **Light:** bg `#FFFFFF` · surface `#F7F7FA` · surface-2 `#EDEDF3` · text `#14141F` · muted `#5A5A70` · border `#E4E4ED`
- **Estados:** sucesso `#16A34A` · erro `#DC2626` · aviso `#B45309` · info `#0077FF`
- **Fonte UI:** Inter (dados, tabelas, formulários) · **Fonte display:** Montserrat Bold (títulos, logo, KPI)
- **Logo / marca:** chama-lettering "GabaArts" com gradiente. 4 versões oficiais: principal, monocromática, negativa, ícone reduzido. Usar o **ícone reduzido** na sidebar e no favicon; a versão completa só na tela de login.

### Paleta de marca (só chrome, nunca dado)

| Token | Hex | Onde |
|---|---|---|
| `brand-orange` | `#FF6A00` | gradiente, ícone |
| `brand-pink` | `#FF2D85` | gradiente |
| `brand-violet` | `#7A3DFF` | **acento principal**: botão primário, link, foco, item ativo |
| `brand-blue` | `#0077FF` | gradiente, `info` |
| `brand-cyan` | `#00E0FF` | gradiente, fim da rampa |

Gradiente oficial: `linear-gradient(135deg, #FF6A00, #FF2D85, #7A3DFF, #0077FF, #00E0FF)`.

### Regras duras desta identidade

1. **Gradiente é decoração de moldura, não de conteúdo.** Permitido em: logo, faixa de topo do login, borda de card de destaque. **Proibido** em texto, número, valor monetário, fundo de tabela, eixo ou série de gráfico.
2. **Dado é neutro.** Toda célula de valor usa `text` ou `muted`. A cor só entra num número quando ela **significa** algo (margem abaixo da meta → `erro`), e aí vem dos tokens de estado, nunca da marca (princípio 4). Como **texto**, o valor colorido usa a rampa `*-ink` (ver "Rampa de texto colorido" abaixo), que garante AA.
3. **Dinheiro usa `Inter` com `font-variant-numeric: tabular-nums`.** Montserrat é larga e não alinha coluna de valor. Montserrat fica em título, label de KPI e logo.
4. **Laranja e rosa da marca reprovam em AA como texto** (`#FF6A00` dá ~2.6:1 no branco). Nunca usar como cor de texto em fundo claro; só como preenchimento de forma ou dentro do gradiente.
5. **Um acento, não cinco.** O que é clicável é `brand-violet`. Se duas cores de marca disputarem a mesma tela, uma está errada.
6. Padrão gráfico de chamas: no máximo **uma** superfície vazia por tela (empty state, tela de login), com opacidade baixa. Nunca atrás de conteúdo legível.

### Rampa de texto colorido (AA) — registrada em 21/07/2026 (fase 2b)

Registro da etapa 1 do pipeline (#007): a construção da fundação do front (`frontend-design` + `impeccable`) revelou que as cores de **estado** e a **violeta de acento** passam em AA como *preenchimento*, mas **reprovam como texto** sobre superfície (erro `#DC2626` dá 3.78:1 no `surface` escuro; `brand-violet` dá 3.43:1 no `surface-2` escuro). Como o princípio 6 (contraste AA) é inegociável, o **texto** colorido usa uma rampa derivada por tema; o **preenchimento** continua com o hex da identidade.

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--danger-ink` | `#F87171` | `#B91C1C` | texto de erro (validação, valor abaixo da meta) |
| `--accent-ink` | `#A78BFA` | `#7A3DFF` | texto/ícone do acento (link, item ativo) sobre superfície |

Regra: **preenchimento** (badge, barra, ponto de status, botão) usa `erro`/`brand-violet`; **texto e ícone** coloridos usam `*-ink`. Os outros estados (sucesso, aviso, info) só aparecem como preenchimento até agora; se algum virar texto, ganha a mesma rampa aqui antes de ir para o componente.

### Tela de referência (etapa 3 do fluxo)

Listagem de produtos, com dark e light funcionando, validada pelo Diogo. A Rouseli não é checkpoint de aprovação: o sistema é de uso interno dos dois e o dono da decisão visual é o Diogo.
