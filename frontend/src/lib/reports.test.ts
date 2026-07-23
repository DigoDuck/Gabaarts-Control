import { expect, test } from "vitest"

import { barPercent, monthToDate } from "@/lib/reports"

test("período padrão vai do 1º dia do mês corrente até hoje", () => {
  // Date(ano, mês, dia) é local, então casa com o formatador de partes locais
  expect(monthToDate(new Date(2026, 6, 22))).toEqual({
    from: "2026-07-01",
    to: "2026-07-22",
  })
})

test("período padrão preenche mês e dia com zero à esquerda", () => {
  expect(monthToDate(new Date(2026, 0, 5))).toEqual({
    from: "2026-01-01",
    to: "2026-01-05",
  })
})

test("largura da barra é proporcional ao maior valor", () => {
  expect(barPercent("50", 100)).toBe(50)
  expect(barPercent("100", 100)).toBe(100)
  expect(barPercent("0", 100)).toBe(0)
})

test("largura não divide por zero nem fica negativa", () => {
  expect(barPercent("10", 0)).toBe(0)
  expect(barPercent("-5", 100)).toBe(0)
})
