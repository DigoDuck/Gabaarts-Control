export type ItemForm = { product: string; qty: string }

export function selectProduct(items: ItemForm[], index: number, product: string) {
  if (!product) {
    return items.map((item, position) =>
      position === index ? { ...item, product: "" } : item,
    )
  }
  const duplicate = items.findIndex(
    (item, position) => position !== index && item.product === product,
  )
  if (duplicate === -1) {
    return items.map((item, position) =>
      position === index ? { ...item, product } : item,
    )
  }
  const increment = Math.max(1, Number(items[index]?.qty || 1))
  return items
    .map((item, position) =>
      position === duplicate
        ? { ...item, qty: String(Math.max(1, Number(item.qty || 1)) + increment) }
        : item,
    )
    .filter((_, position) => position !== index)
}
