// dinheiro e percentual chegam da API como string; converter só na hora de exibir
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })

export const money = (value: string) => brl.format(Number(value))
export const percent = (fraction: string) => pct.format(Number(fraction))

// o domínio guarda fração de 4 casas (0.5000); o formulário fala percentual (50).
// A conversão mora só aqui — em nenhum componente.
export const fractionToPercent = (fraction: string) => String(Number(fraction) * 100)
export const percentToFraction = (value: string) => (Number(value || 0) / 100).toFixed(4)
