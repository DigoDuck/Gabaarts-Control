// dinheiro e percentual chegam da API como string; converter só na hora de exibir
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })

export const money = (value: string) => brl.format(Number(value))
export const percent = (fraction: string) => pct.format(Number(fraction))

// o domínio guarda fração de 4 casas (0.5000); o formulário fala percentual (50).
// A conversão mora só aqui — em nenhum componente.
// Number("0.14") * 100 dá 14.000000000000002: a fração tem no máximo 4 casas,
// então o percentual tem no máximo 2 e arredondar nelas mata o ruído binário.
export const fractionToPercent = (fraction: string) =>
  String(Math.round(Number(fraction) * 10000) / 100)
export const percentToFraction = (value: string) => (Number(value || 0) / 100).toFixed(4)
