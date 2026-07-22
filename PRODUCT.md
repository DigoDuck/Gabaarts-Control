# PRODUCT.md — Gabaarts Control

> Contexto de **produto**: quem usa, o que cada tela resolve e o que não fazemos. O **domínio** (modelo, fórmulas, regras) vive em [docs/arquitetura.md](docs/arquitetura.md); o **processo visual** vive em [DESIGN.md](DESIGN.md). Este arquivo não repete nenhum dos dois.

## O que é

Sistema interno que substitui a planilha oficial da Gabaarts, uma papelaria de produtos personalizados. Ele responde três perguntas que a planilha respondia mal ou não respondia: **quanto custa fazer**, **por quanto vender em cada canal** e **quanto sobrou de fato**.

Não é e-commerce, não é ERP, não tem cliente final. Duas pessoas usam, por navegador, de máquinas e celulares diferentes.

## Quem usa

| Pessoa | Perfil | O que faz no sistema |
|---|---|---|
| **Rouseli** | Dona do negócio, não-técnica. Vinha da planilha, mexe pelo celular com frequência. | Cadastra produto, registra venda, consulta preço sugerido e margem. |
| **Diogo** | Dev, mantém o sistema. | Tudo acima, mais parâmetros (custo/hora, faixas de taxa), usuários e correções pelo Admin. |

Consequências diretas de ter uma usuária não-técnica como principal:

- Toda a interface é em **português**, inclusive os rótulos do Admin.
- Erro precisa dizer o que fazer, não o que falhou. "Produto com tempo de produção precisa de artesã" e não "ValidationError".
- Nenhuma tela pode exigir entender a modelagem. Ela pensa em "caneca", não em "produto com `batch_size` 1".
- Mobile não é enfeite: o registro de venda acontece com o celular na mão.

## O que a planilha ensinou

A planilha original marcava as células em duas cores: **amarela** você preenche, **branca** a fórmula calcula. Esse é o contrato de UI do sistema inteiro.

1. **Nada derivado é digitável.** COGS, preço sugerido, margem, lucro, taxa de canal e total nunca aparecem como campo editável. Se um número pode ser calculado, ele é calculado — a planilha tinha lucro digitado à mão em algumas linhas e por isso mentia.
2. **O cálculo aparece junto da decisão.** Mexer na margem-alvo e ver o preço mudar era o que tornava a planilha útil. Formulário onde o número só aparece depois de salvar perde isso.
3. **O tempo não é grátis.** Mesmo sem salário, a hora da Rouseli e da filha entra no custo. Nenhuma tela pode sugerir que produto sem custo de material é produto sem custo.
4. **Registrar venda é registrar um fato passado.** O preço já foi cobrado; a tela anota, não simula. Simulação tem tela própria.

## Telas

| Tela | Resolve | Status |
|---|---|---|
| Login | Entrar com usuário e senha, token guardado no navegador | ✅ fase 2b |
| Produtos (lista) | Ver catálogo com custo, preço sugerido e situação | ✅ fase 2b |
| Produto (formulário) | Cadastrar/editar produto e kit, com custo calculado ao vivo | 🔜 fase 2c-1 |
| Vendas (lista) | Ver vendas do período com total e lucro | 🔜 fase 2c-1 |
| Venda (formulário) | Registrar venda com N itens; custo e taxa congelam na criação | 🔜 fase 2c-1 |
| Canais e faixas | Manter comissão e taxa fixa por faixa de preço | 🔜 fase 2c-2 |
| Artesãs | Manter custo/hora de quem produz | 🔜 fase 2c-2 |
| Equipamentos | Patrimônio e valor investido | 🔜 fase 2c-2 |
| Simulador | "Se eu vender a R$ X na Shopee, sobra quanto?" | 🔜 fase 2c-2 |
| Dashboard | Receita, lucro, ticket médio, nº de vendas e quebra por canal no período | 🔜 fase 2c-2 |

O Admin do Django continua existindo como **fallback técnico** e para gestão de usuários e tokens (arquitetura §7 C1/C2, DECISIONS #008). Ele não é caminho de cadastro.

## Não-objetivos

- **Vitrine ou carrinho.** Cliente final nunca acessa o sistema.
- **Estoque.** Produção é sob encomenda; não há saldo a controlar.
- **Importador de planilha.** 19 produtos e 13 vendas entram à mão mais rápido do que se escreve o importador (arquitetura §6).
- **Rateio de custo fixo por peça.** A conta é margem de contribuição. Aluguel, energia e depreciação entram só quando existir o módulo de ponto de equilíbrio.
- **Multiusuário de verdade.** Sem papéis, sem permissão por objeto, sem auditoria. Duas pessoas de confiança.
- **App nativo.** Web responsivo resolve.
