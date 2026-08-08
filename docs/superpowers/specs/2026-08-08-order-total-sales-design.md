# Venda por total do pedido

Status: desenho aprovado no chat em 08/08/2026; aguardando revisão desta especificação antes do plano de implementação.

## Objetivo

Substituir o preço unitário digitado em cada item pelo valor total dos produtos do pedido. O formulário deve mostrar, antes de salvar, o custo congelável, a taxa do canal, o lucro total, a margem e o total pago, com frete separado e neutro para o lucro.

## Regras de domínio

1. `products_total` é um fato da venda e representa somente os produtos. Deve ser maior que zero.
2. `shipping_amount` é cobrado à parte do cliente. Entra em `amount_paid = products_total + shipping_amount`, mas não entra em receita de produtos, lucro ou margem.
3. O lucro total é derivado: `products_total - total_cogs - applied_channel_fee - legacy_freight_cost`.
4. A margem é sobre o valor dos produtos: `profit / products_total`.
5. Cada item guarda produto, quantidade e o snapshot de `unit_cogs`. Não há preço, taxa ou frete digitável por item no novo fluxo.
6. A taxa sugerida continua usando exclusivamente `services/fees.py`. Um valor real informado pela plataforma pode substituir a sugestão; isso é um fato observado, não uma segunda fórmula.
7. O frete histórico que já tenha sido tratado como custo será migrado para `legacy_freight_cost`, somente leitura, para preservar exatamente o lucro antigo.
8. Todos os cálculos usam `Decimal`. Valores monetários persistidos usam duas casas e `ROUND_HALF_UP` na borda definida pelo service.

## Sugestão de taxa para um total sem preços por item

As faixas atuais recebem preço unitário, mas o novo formulário conhece apenas o total do pedido. Para gerar uma sugestão útil:

1. Calcular o peso comercial de cada linha por `product.base_price * qty`.
2. Distribuir `products_total` proporcionalmente entre as linhas.
3. Obter o preço estimado de cada unidade da linha.
4. Chamar `fee_from_tiers()` para esse preço unitário e multiplicar pela quantidade.
5. Somar as taxas das linhas e arredondar o total em duas casas.

Essa distribuição é uma estimativa. O formulário deve identificá-la como `Taxa sugerida` e permitir `Informar taxa real`. Se o usuário informar a taxa real, o snapshot guarda esse valor e `fee_source = manual`. A ação `Usar sugestão` remove a substituição.

Contraponto: sem preços por item não existe forma matematicamente exata de reconstruir a taxa unitária de um pedido heterogêneo. Usar os preços-base como pesos mantém o cadastro simples, mas a conferência do extrato da plataforma continua sendo a fonte final quando houver diferença.

A meta de margem do pedido usa a média ponderada de `target_margin_pct` pelos mesmos subtotais estimados. O aviso de total baixo aparece quando `products_total` fica mais de 20% abaixo da soma de `base_price * qty`; ele é apenas um lembrete contra erro de digitação.

## Modelo de dados

`Sale` recebe:

* `products_total`
* `shipping_amount`, padrão zero
* `channel_fee`, snapshot aplicado ao lucro
* `fee_source`, `suggested` ou `manual`
* `legacy_freight_cost`, padrão zero e somente leitura

`SaleItem` mantém `product`, `qty` e `unit_cogs`. Os campos `unit_price`, `unit_fee` e `unit_freight` deixam o novo contrato após a migração dos dados.

A migração preenche:

* `products_total = sum(qty * unit_price)`
* `channel_fee = sum(qty * unit_fee)`
* `legacy_freight_cost = sum(qty * unit_freight)`
* `shipping_amount = 0`

Assim, receita e lucro históricos permanecem numericamente iguais.

## API e cálculo único

Adicionar `POST /api/sales/preview/` com o mesmo payload financeiro usado em criar ou editar:

```json
{
  "channel": 3,
  "products_total": "120.00",
  "shipping_amount": "15.00",
  "fee_override": null,
  "items": [
    {"product": 8, "qty": 2},
    {"product": 11, "qty": 1}
  ]
}
```

Resposta:

```json
{
  "total_cogs": "48.20",
  "suggested_channel_fee": "28.00",
  "applied_channel_fee": "28.00",
  "fee_source": "suggested",
  "profit": "43.80",
  "margin_pct": "36.50",
  "amount_paid": "135.00",
  "warnings": []
}
```

Um único service de apuração recebe os dados normalizados e alimenta preview, criação e atualização. O serializer apenas valida e transporta.

## Atualização e congelamento

Mudanças em canal, total dos produtos, itens ou taxa manual invalidam o preview e produzem novo snapshot ao salvar. Mudança apenas em cliente, data ou situação preserva os snapshots. Frete altera somente o total pago, sem recalcular COGS ou taxa.

Antes de salvar, a UI usa `Custo estimado`. Depois da persistência, a venda exibe `Resultado congelado`. O botão vira `Salvar novo resultado` quando uma edição financeira altera o snapshot e pede confirmação explícita.

## Formulário React

O layout aprovado é a opção A: o resultado permanece dentro do fluxo do formulário e fica completamente visível antes do botão de salvar.

Ordem mobile:

1. Dados da venda: data, canal, cliente e situação.
2. Itens: busca de produto e quantidade; selecionar o mesmo produto incrementa a quantidade em vez de duplicar a linha.
3. Valor total dos produtos, como campo financeiro principal.
4. Frete cobrado à parte.
5. Taxa sugerida, com ação para informar a taxa real.
6. Resultado: custo, taxa, lucro total, margem e total pago.
7. Ação de salvar.

O preview usa debounce de 400 ms. Enquanto uma resposta nova está pendente, o resultado anterior fica visualmente atenuado com `Atualizando...`. Respostas antigas não podem sobrescrever a entrada atual. O salvamento espera o preview correspondente ao estado atual.

## Validação e alertas

Bloqueiam o salvamento:

* nenhum item
* quantidade menor que um
* total dos produtos menor ou igual a zero
* produto inativo
* frete ou taxa manual negativos
* falha no cálculo do backend

Alertam sem bloquear:

* lucro negativo
* margem abaixo da meta dos produtos
* taxa manual maior que a sugestão
* total do pedido mais de 20% abaixo da soma dos preços-base

Vendas canceladas continuam excluídas dos relatórios.

## Testes de aceitação

Backend:

* preview e persistência devolvem os mesmos valores
* frete altera o total pago, mas não o lucro
* taxa manual substitui a sugestão sem criar outra fórmula
* edição administrativa preserva snapshots
* edição financeira cria novo resultado congelado
* migração preserva receita e lucro históricos, inclusive com frete antigo não zero
* cálculos usam `Decimal` e o arredondamento acordado

Frontend:

* preview atualiza após 400 ms
* resposta obsoleta é ignorada
* alternância entre taxa sugerida e real funciona
* salvamento nunca usa preview antigo
* alertas não bloqueiam e erros bloqueiam
* formulário funciona em viewport mobile e por teclado

## Fora de escopo

* detalhar lucro por item
* incluir frete no lucro
* integrar automaticamente com extratos de marketplaces
* criar regras específicas por canal fora de `services/fees.py`
* redesenhar a listagem ou o dashboard além de consumir os novos totais
