# Order Total Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a sale to be recorded by the whole products total, keep shipping separate, calculate total profit live, and freeze the same backend result on save.

**Architecture:** Move commercial facts and fee snapshots to `Sale`, keep product quantity and unit COGS snapshots in `SaleItem`, and centralize preview/persistence arithmetic in `services/sales.py`. The React form sends the same financial draft to `/api/sales/preview/` after a 400 ms debounce and renders the returned result before save.

**Tech Stack:** Python 3.12, Django 5, Django REST Framework, PostgreSQL, pytest-django, React 19, TypeScript 6, Vite 8, Vitest 4, React Testing Library, Tailwind CSS.

## Global Constraints

* Money uses `Decimal`, never float; `ROUND_HALF_UP` at the service boundary.
* Margin is a fraction over `products_total`, never markup.
* `shipping_amount` changes only `amount_paid`; it is neutral to revenue, profit, and margin.
* Fee formulas remain exclusively in `backend/apps/core/services/fees.py`.
* A manual fee is an observed platform fact, not a second formula.
* Administrative edits preserve snapshots; financial edits explicitly create a new result.
* The migration must preserve historical revenue and profit, including legacy nonzero freight.
* UI copy and Django labels are Portuguese; code, docstrings, branches, and commits are English.
* No new runtime dependency.

---

### Task 1: Sale-level financial model and historical migration

**Files:**
* Modify: `backend/apps/core/models.py`
* Create: `backend/apps/core/migrations/0005_order_total_sales.py`
* Modify: `backend/apps/core/tests/test_models.py`
* Create: `backend/apps/core/tests/test_migration_order_total_sales.py`

**Interfaces:**
* Produces: `Sale.products_total`, `shipping_amount`, `channel_fee`, `fee_source`, `legacy_freight_cost`, `total_cogs`, `profit`, `margin_pct`, and `amount_paid`.
* Produces: `SaleItem.product`, `qty`, and `unit_cogs` as the writable/readable current contract; old unit commercial columns remain nullable and non-editable for migration safety.

- [ ] **Step 1: Write failing model tests**

```python
def test_sale_profit_uses_order_total_and_shipping_is_neutral(sale_with_item):
    sale = sale_with_item(products_total="100.00", shipping_amount="15.00",
                          channel_fee="20.00", unit_cogs="30.00", qty=2)
    assert sale.total_cogs == Decimal("60.00")
    assert sale.profit == Decimal("20.00")
    assert sale.margin_pct == Decimal("0.2000")
    assert sale.amount_paid == Decimal("115.00")

def test_sale_rejects_non_positive_total():
    sale = Sale(products_total=Decimal("0"), shipping_amount=Decimal("0"))
    with pytest.raises(ValidationError):
        sale.clean()
```

- [ ] **Step 2: Run the focused model tests and confirm RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/apps/core/tests/test_models.py -q`
Expected: failures because the sale-level fields and properties do not exist.

- [ ] **Step 3: Add model fields and derived properties**

```python
class Sale(models.Model):
    class FeeSource(models.TextChoices):
        SUGGESTED = "suggested", "Sugerida"
        MANUAL = "manual", "Informada"

    products_total = models.DecimalField("total dos produtos (R$)", max_digits=11, decimal_places=2)
    shipping_amount = models.DecimalField("frete cobrado (R$)", max_digits=11, decimal_places=2, default=Decimal("0"))
    channel_fee = models.DecimalField("taxa do canal (R$)", max_digits=11, decimal_places=2, default=Decimal("0"))
    fee_source = models.CharField("origem da taxa", max_length=10, choices=FeeSource.choices, default=FeeSource.SUGGESTED)
    legacy_freight_cost = models.DecimalField("frete histórico (R$)", max_digits=11, decimal_places=2, default=Decimal("0"), editable=False)

    @property
    def profit(self):
        return q2(self.products_total - self.total_cogs - self.channel_fee - self.legacy_freight_cost)
```

`Sale.clean()` rejects `products_total <= 0`, negative shipping, negative fee, and negative legacy freight. `SaleItem.unit_price`, `unit_fee`, and `unit_freight` become nullable, blank, and `editable=False`; new code never writes them.

- [ ] **Step 4: Add the data migration and its preservation test**

The forward migration must execute, before altering the old item fields:

```python
for sale in Sale.objects.all().iterator():
    items = SaleItem.objects.filter(sale_id=sale.pk)
    sale.products_total = sum((item.qty * item.unit_price for item in items), Decimal("0"))
    sale.channel_fee = sum((item.qty * item.unit_fee for item in items), Decimal("0"))
    sale.legacy_freight_cost = sum(
        (item.qty * (item.unit_freight or Decimal("0")) for item in items), Decimal("0")
    )
    sale.shipping_amount = Decimal("0")
    sale.save(update_fields=["products_total", "channel_fee", "legacy_freight_cost", "shipping_amount"])
```

The migration test creates a pre-migration sale with revenue `40.00`, fee `12.00`, COGS `15.16`, and freight `2.00`, migrates forward, and asserts revenue `40.00` and profit `10.84`.

- [ ] **Step 5: Run model and migration tests and confirm GREEN**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/apps/core/tests/test_models.py backend/apps/core/tests/test_migration_order_total_sales.py -q`
Expected: all selected tests pass.

- [ ] **Step 6: Commit the model slice**

```bash
git add backend/apps/core/models.py backend/apps/core/migrations/0005_order_total_sales.py backend/apps/core/tests/test_models.py backend/apps/core/tests/test_migration_order_total_sales.py
git commit -m "feat: move sale totals to order level"
```

### Task 2: Shared sale calculation and snapshots

**Files:**
* Modify: `backend/apps/core/services/sales.py`
* Rewrite: `backend/apps/core/tests/test_sales.py`

**Interfaces:**
* Consumes: sale-level fields and `SaleItem.unit_cogs` from Task 1.
* Produces: `calculate_sale(channel, products_total, items, shipping_amount=Decimal("0"), fee_override=None, tiers=None) -> dict[str, Decimal | str | list[str]]`.
* Produces: `refresh_snapshots(sale, fee_override=None) -> dict` that persists unit COGS and the applied sale fee atomically.

- [ ] **Step 1: Write failing service tests**

```python
def test_calculation_allocates_total_by_base_price_and_applies_fee_per_unit(order):
    result = calculate_sale(order.channel, Decimal("120.00"), order.items)
    assert result["total_cogs"] == Decimal("48.20")
    assert result["suggested_channel_fee"] == expected_fee
    assert result["applied_channel_fee"] == expected_fee

def test_manual_fee_overrides_only_applied_fee(order):
    result = calculate_sale(order.channel, Decimal("120.00"), order.items,
                            fee_override=Decimal("19.90"))
    assert result["fee_source"] == Sale.FeeSource.MANUAL
    assert result["applied_channel_fee"] == Decimal("19.90")
    assert result["suggested_channel_fee"] != Decimal("19.90")

def test_shipping_changes_amount_paid_not_profit(order):
    without = calculate_sale(order.channel, Decimal("100.00"), order.items)
    with_shipping = calculate_sale(order.channel, Decimal("100.00"), order.items,
                                   shipping_amount=Decimal("15.00"))
    assert with_shipping["profit"] == without["profit"]
    assert with_shipping["amount_paid"] == Decimal("115.00")
```

Also test weighted target margin, the 20% low-total warning boundary, inactive product validation, negative inputs, one fee-tier query, and atomic rollback.

- [ ] **Step 2: Run the service tests and confirm RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/apps/core/tests/test_sales.py -q`
Expected: import or assertion failures for `calculate_sale`.

- [ ] **Step 3: Implement proportional allocation and calculation**

```python
def calculate_sale(channel, products_total, items, shipping_amount=Decimal("0"),
                   fee_override=None, tiers=None):
    item_rows = list(items)
    base_total = sum((item.product.base_price * item.qty for item in item_rows), Decimal("0"))
    suggested_fee = sum(
        fee_from_tiers(tiers, products_total * item.product.base_price / base_total)["total"]
        * item.qty
        for item in item_rows
    )
    total_cogs = sum((q2(unit_cogs(item.product)["total"]) * item.qty for item in item_rows), Decimal("0"))
    applied_fee = q2(fee_override if fee_override is not None else suggested_fee)
    profit = q2(products_total - total_cogs - applied_fee)
    margin_pct = q4(profit / products_total)
    return {
        "total_cogs": q2(total_cogs),
        "suggested_channel_fee": q2(suggested_fee),
        "applied_channel_fee": applied_fee,
        "fee_source": Sale.FeeSource.MANUAL if fee_override is not None else Sale.FeeSource.SUGGESTED,
        "profit": profit,
        "margin_pct": margin_pct,
        "amount_paid": q2(products_total + shipping_amount),
        "warnings": warnings,
    }
```

Use `q2` and a four-decimal helper for margin fractions. Treat missing or zero commercial weight as a validation error instead of dividing by zero.

- [ ] **Step 4: Implement atomic persistence with the same result**

`refresh_snapshots()` loads channel tiers once, computes and saves every `unit_cogs`, then saves `Sale.channel_fee` and `Sale.fee_source`. It returns the calculation used by the API response.

- [ ] **Step 5: Run service tests and confirm GREEN**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/apps/core/tests/test_sales.py -q`
Expected: all service tests pass.

- [ ] **Step 6: Commit the service slice**

```bash
git add backend/apps/core/services/sales.py backend/apps/core/tests/test_sales.py
git commit -m "feat: calculate sale result from order total"
```

### Task 3: Preview and persistence API parity

**Files:**
* Modify: `backend/apps/core/serializers.py`
* Modify: `backend/apps/core/views.py`
* Rewrite: `backend/apps/core/tests/test_api_sales.py`

**Interfaces:**
* Consumes: `calculate_sale()` and `refresh_snapshots()` from Task 2.
* Produces: `POST /api/sales/preview/`.
* Produces request fields `products_total`, `shipping_amount`, `fee_override`, `items[{product, qty}]` and response fields `total_cogs`, `suggested_channel_fee`, `applied_channel_fee`, `fee_source`, `profit`, `margin_pct`, `target_margin_pct`, `amount_paid`, `warnings`.

- [ ] **Step 1: Write failing API tests**

```python
def test_preview_matches_created_sale(api, sale_payload):
    preview = api.post("/api/sales/preview/", sale_payload, format="json")
    created = api.post("/api/sales/", sale_payload, format="json")
    assert preview.status_code == 200
    assert created.status_code == 201
    for field in ("total_cogs", "channel_fee", "profit", "margin_pct", "amount_paid"):
        expected = preview.json()["applied_channel_fee"] if field == "channel_fee" else preview.json()[field]
        assert created.json()[field] == expected

def test_administrative_patch_preserves_snapshot(api, saved_sale, changed_cost):
    response = api.patch(saved_sale.url, {"customer_name": "Romilda"}, format="json")
    assert response.json()["total_cogs"] == saved_sale.total_cogs
```

Also test manual fee, shipping-only PATCH, financial PATCH, empty items, inactive products, negative fee/shipping, zero total, and unchanged items.

- [ ] **Step 2: Run API tests and confirm RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/apps/core/tests/test_api_sales.py -q`
Expected: preview returns 405/404 and new fields are missing.

- [ ] **Step 3: Replace the item and sale serializer contracts**

```python
class SaleItemSerializer(ModelCleanMixin, serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "qty", "unit_cogs"]
        read_only_fields = ["unit_cogs"]

class SaleSerializer(NestedWriteMixin, serializers.ModelSerializer):
    fee_override = serializers.DecimalField(max_digits=11, decimal_places=2,
                                            min_value=Decimal("0"), write_only=True,
                                            required=False, allow_null=True)
```

Expose derived sale properties as read-only decimal fields. Pop `fee_override` before model creation/update. Only channel, products total, items, or fee override trigger `refresh_snapshots`; customer, date, status, and shipping-only changes preserve COGS and fee snapshots.

- [ ] **Step 4: Add the preview action**

```python
@action(detail=False, methods=["post"])
def preview(self, request):
    payload = SalePreviewSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    result = calculate_sale(**payload.as_service_kwargs())
    return Response(sale_result_payload(result))
```

- [ ] **Step 5: Run API tests and confirm GREEN**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/apps/core/tests/test_api_sales.py -q`
Expected: all sales API tests pass.

- [ ] **Step 6: Commit the API slice**

```bash
git add backend/apps/core/serializers.py backend/apps/core/views.py backend/apps/core/tests/test_api_sales.py
git commit -m "feat: add live sale result preview"
```

### Task 4: Reports, Admin, seed, and backend regression

**Files:**
* Modify: `backend/apps/core/services/reports.py`
* Modify: `backend/apps/core/admin.py`
* Modify: `backend/apps/core/management/commands/seed_gabaarts.py`
* Modify: `backend/apps/core/tests/test_reports.py`
* Modify: `backend/apps/core/tests/test_api_reports.py`
* Modify: `backend/apps/core/tests/test_admin.py`
* Modify: `backend/apps/core/tests/test_seed.py`

**Interfaces:**
* Consumes: sale-level revenue/profit fields from Task 1.
* Produces: unchanged report response shape and Admin fallback using the new model.

- [ ] **Step 1: Rewrite report fixtures and assert unchanged KPI semantics**

Create completed sales with `products_total=60/40`, `channel_fee=0/12`, `legacy_freight_cost=0/2`, and item COGS `15.16`; keep assertions `revenue=100.00`, `profit=40.52`, `sales_count=2`, and `avg_ticket=50.00`.

- [ ] **Step 2: Run report/admin/seed tests and confirm RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/apps/core/tests/test_reports.py backend/apps/core/tests/test_api_reports.py backend/apps/core/tests/test_admin.py backend/apps/core/tests/test_seed.py -q`
Expected: failures from removed current-contract unit fields and old totals.

- [ ] **Step 3: Aggregate from `Sale` without multiplying header totals by item joins**

Use a correlated `Subquery` to annotate each sale's item COGS, then aggregate `products_total` and `products_total - item_cogs - channel_fee - legacy_freight_cost`. Keep completed-only, period, channel filter, and response keys unchanged.

- [ ] **Step 4: Update Admin and seed compatibility**

Admin item inline shows product, quantity, and frozen unit COGS. Sale fields show total products and shipping as inputs; fee, total COGS, profit, margin, and total paid are read-only. Seed rows derive `products_total`, `channel_fee`, and `legacy_freight_cost` from source unit values before creating current sale items.

- [ ] **Step 5: Run the complete backend suite**

Run: `backend\.venv\Scripts\python.exe -m pytest backend -q`
Expected: all backend tests pass.

- [ ] **Step 6: Commit the compatibility slice**

```bash
git add backend/apps/core/services/reports.py backend/apps/core/admin.py backend/apps/core/management/commands/seed_gabaarts.py backend/apps/core/tests
git commit -m "refactor: align reports and admin with order totals"
```

### Task 5: Frontend sales contract and request tests

**Files:**
* Modify: `frontend/src/lib/sales.ts`
* Create: `frontend/src/lib/sales.test.ts`

**Interfaces:**
* Consumes: API contract from Task 3.
* Produces: `SaleDraft`, `SalePayload`, `SaleResult`, `previewSale()`, `createSale()`, and `updateSale()` TypeScript interfaces.

- [ ] **Step 1: Write failing client tests**

```typescript
test("previewSale posts the financial draft", async () => {
  await previewSale({ channel: 2, products_total: "100", shipping_amount: "15",
                      fee_override: null, items: [{ product: 1, qty: 2 }] })
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    channel: 2, products_total: "100", shipping_amount: "15",
    fee_override: null, items: [{ product: 1, qty: 2 }],
  })
})
```

- [ ] **Step 2: Run the client test and confirm RED**

Run: `npm.cmd test -- src/lib/sales.test.ts`
Expected: `previewSale` is missing.

- [ ] **Step 3: Implement the typed API contract**

`SaleItem` contains only id, product, product_name, qty, and optional unit_cogs. `SalePayload` contains header fields plus `products_total`, `shipping_amount`, optional nullable `fee_override`, and items. `Sale` includes `channel_fee`, `fee_source`, `total_cogs`, `profit`, `margin_pct`, and `amount_paid`.

- [ ] **Step 4: Run the client test and confirm GREEN**

Run: `npm.cmd test -- src/lib/sales.test.ts`
Expected: all sales client tests pass.

- [ ] **Step 5: Commit the client slice**

```bash
git add frontend/src/lib/sales.ts frontend/src/lib/sales.test.ts
git commit -m "feat: add sale preview client contract"
```

### Task 6: Mobile-first live sale form

**Files:**
* Modify: `frontend/src/routes/sale-form.tsx`
* Create: `frontend/src/components/sale-result.tsx`
* Create: `frontend/src/routes/sale-form.test.tsx`
* Modify: `frontend/src/routes/sales.tsx`

**Interfaces:**
* Consumes: `previewSale()` and sale result types from Task 5.
* Produces: approved layout A, 400 ms live result, stale-response protection, manual fee flow, and snapshot confirmation.

- [ ] **Step 1: Write failing interaction tests**

```typescript
test("updates preview after 400 ms and ignores an obsolete response", async () => {
  vi.useFakeTimers()
  renderSaleForm()
  fillRequiredDraft()
  await vi.advanceTimersByTimeAsync(400)
  expect(previewSale).toHaveBeenCalledTimes(1)
  changeProductsTotal("120")
  await vi.advanceTimersByTimeAsync(400)
  resolveSecondPreview({ profit: "40.00" })
  resolveFirstPreview({ profit: "10.00" })
  expect(screen.getByText("R$ 40,00")).toBeInTheDocument()
})

test("shipping changes total paid without changing displayed profit", async () => {
  renderSaleForm()
  fillRequiredDraft()
  changeShipping("15")
  await vi.advanceTimersByTimeAsync(400)
  expect(screen.getByText("R$ 115,00")).toBeInTheDocument()
  expect(screen.getByText("R$ 40,00")).toBeInTheDocument()
})

test("manual fee can return to suggestion", () => {
  renderSaleForm()
  fireEvent.click(screen.getByRole("button", { name: "Informar taxa real" }))
  expect(screen.getByLabelText("Taxa real da plataforma")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }))
  expect(screen.queryByLabelText("Taxa real da plataforma")).not.toBeInTheDocument()
})

test("selecting the same product increments quantity", () => {
  renderSaleForm()
  selectProduct("1")
  fireEvent.click(screen.getByRole("button", { name: "Adicionar produto" }))
  selectProduct("1")
  expect(screen.getByLabelText("Quantidade de Caneca")).toHaveValue(2)
})

test("save waits for the preview that matches the current draft", () => {
  renderSaleForm()
  fillRequiredDraft()
  changeProductsTotal("120")
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
})

test("administrative edit does not request snapshot confirmation", async () => {
  renderExistingSale()
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Romilda" } })
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
  expect(window.confirm).not.toHaveBeenCalled()
})

test("financial edit requires confirmation and says Salvar novo resultado", () => {
  renderExistingSale()
  changeProductsTotal("120")
  expect(screen.getByRole("button", { name: "Salvar novo resultado" })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the form tests and confirm RED**

Run: `npm.cmd test -- src/routes/sale-form.test.tsx`
Expected: missing labels, preview calls, and result panel assertions fail.

- [ ] **Step 3: Rebuild state and payload around the order total**

Remove item price/freight fields. Add `productsTotal`, `shippingAmount`, `feeOverride`, `preview`, `previewKey`, `stale`, and `previewError`. Build a stable financial key from channel, total, shipping, fee override, and normalized items.

- [ ] **Step 4: Implement debounce and stale response protection**

```typescript
useEffect(() => {
  const draft = buildPreviewDraft({ channel, productsTotal, shippingAmount,
                                    feeOverride, items })
  if (!draft) { setPreview(null); return }
  const key = financialKey(draft)
  let dropped = false
  setStale(true)
  const timer = setTimeout(() => {
    previewSale(draft).then((result) => {
      if (dropped) return
      setPreview(result)
      setPreviewKey(key)
      setStale(false)
    }).catch(() => { if (!dropped) setPreviewError(true) })
  }, 400)
  return () => { dropped = true; clearTimeout(timer) }
}, [financialDraft])
```

Submit is disabled until `previewKey === financialKey(currentDraft)` and there is no preview error.

- [ ] **Step 5: Implement layout A and accessible copy**

Render sections in mobile order: sale data, items, products total, separate shipping, suggested/manual fee, `SaleResult`, actions. `SaleResult` shows cost, applied fee, total profit, margin, and total paid; stale state adds opacity and `Atualizando...`; negative profit and warnings use danger tokens.

- [ ] **Step 6: Implement edit safety**

`changedFields()` sends only changed administrative fields for administrative edits. Financial changes send the complete financial contract, change the action to `Salvar novo resultado`, and call `window.confirm` before PATCH. A saved manual fee initializes `feeOverride` from `sale.channel_fee`.

- [ ] **Step 7: Run form tests, full frontend tests, lint, and build**

Run: `npm.cmd test`
Run: `npm.cmd run lint`
Run: `npm.cmd run build`
Expected: 100% commands exit zero.

- [ ] **Step 8: Commit the UI slice**

```bash
git add frontend/src/lib/sales.ts frontend/src/lib/sales.test.ts frontend/src/routes/sale-form.tsx frontend/src/routes/sale-form.test.tsx frontend/src/components/sale-result.tsx frontend/src/routes/sales.tsx
git commit -m "feat: add live order-total sale form"
```

### Task 7: Final migration, contract, and regression verification

**Files:**
* Modify if needed: `README.md`
* Verify: all files changed by Tasks 1 through 6

**Interfaces:**
* Consumes: complete backend and frontend implementation.
* Produces: review-ready branch with reproducible evidence.

- [ ] **Step 1: Check migrations and source hygiene**

Run: `backend\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run`
Run: `git diff --check origin/main...HEAD`
Run: `rg -n "unit_price|unit_fee|unit_freight" backend frontend/src`
Expected: no pending migration, no whitespace errors, and legacy names only in migration/compatibility code.

- [ ] **Step 2: Run complete backend verification**

Run: `backend\.venv\Scripts\python.exe -m pytest backend -q`
Expected: all tests pass.

- [ ] **Step 3: Run complete frontend verification**

Run: `npm.cmd test`
Run: `npm.cmd run lint`
Run: `npm.cmd run build`
Expected: all commands exit zero.

- [ ] **Step 4: Review the final diff against every acceptance criterion**

Confirm preview/save parity, shipping neutrality, fee override provenance, migration preservation, administrative snapshot preservation, financial confirmation, stale-response protection, warnings, mobile order, and report compatibility.

- [ ] **Step 5: Commit any final corrections**

```bash
git add -u
git commit -m "fix: harden order-total sale workflow"
```
