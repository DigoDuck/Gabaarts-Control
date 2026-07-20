// dinheiro e percentual chegam da API como string; converter só na hora de exibir
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })

export const money = (value: string) => brl.format(Number(value))
export const percent = (fraction: string) => pct.format(Number(fraction))
