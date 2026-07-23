import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Field } from "@/components/field"
import { Button } from "@/components/ui/button"
import { ApiError, fieldError, summaryErrors, type FieldErrors } from "@/lib/api"
import {
  createEquipment,
  getEquipment,
  updateEquipment,
  type EquipmentPayload,
} from "@/lib/equipment"

// estado do formulário: tudo string, como sai de <input>. A conversão para o
// formato do domínio (vazio -> null, número) acontece uma vez, em toPayload().
type FormState = {
  name: string
  category: string
  purchase_date: string
  value: string
  useful_life_months: string
  maintenance_status: string
}

const EMPTY: FormState = {
  name: "",
  category: "",
  purchase_date: "",
  value: "",
  useful_life_months: "",
  maintenance_status: "Em dia",
}

function toPayload(form: FormState): EquipmentPayload {
  return {
    name: form.name,
    category: form.category,
    // campos opcionais (null=True no model): vazio vira null, não "" nem 0
    purchase_date: form.purchase_date || null,
    value: form.value || null,
    useful_life_months: form.useful_life_months
      ? Number(form.useful_life_months)
      : null,
    maintenance_status: form.maintenance_status,
  }
}

export function EquipmentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = id !== undefined

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // enquanto o GET não volta, o form ainda mostra os vazios de EMPTY; salvar
  // aqui gravaria vazio por cima do dado real, porque o PUT escreve tudo
  const [loading, setLoading] = useState(editing)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!editing) {
      setLoading(false)
      return
    }
    setLoading(true)
    getEquipment(Number(id))
      .then((item) =>
        setForm({
          name: item.name,
          category: item.category,
          purchase_date: item.purchase_date ?? "",
          value: item.value ?? "",
          useful_life_months:
            item.useful_life_months === null ? "" : String(item.useful_life_months),
          maintenance_status: item.maintenance_status,
        }),
      )
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [editing, id])

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (editing && loadError) {
        // salvar sobre um formulário que não carregou apagaria os campos do equipamento
        setErrors({ detail: ["Este equipamento não foi carregado. Recarregue a página."] })
        return
      }
      setSaving(true)
      setErrors({})
      try {
        const payload = toPayload(form)
        if (editing) await updateEquipment(Number(id), payload)
        else await createEquipment(payload)
        navigate("/equipment")
      } catch (error) {
        if (error instanceof ApiError) setErrors(error.fields)
        else setErrors({ non_field_errors: ["Não foi possível salvar."] })
      } finally {
        setSaving(false)
      }
    },
    [editing, form, id, loadError, navigate],
  )

  const resumo = summaryErrors(errors)

  return (
    <form onSubmit={submit} className="grid max-w-lg gap-4 content-start">
      {loadError && (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
          Não foi possível carregar este equipamento. Volte à lista e tente de novo.
        </p>
      )}

      {resumo.length > 0 && (
        <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
          {resumo.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}

      <Field
        label="Equipamento"
        name="name"
        required
        value={form.name}
        error={fieldError(errors, "name")}
        onChange={(event) => set("name", event.target.value)}
      />

      <Field
        label="Categoria"
        name="category"
        hint="Opcional. Ex.: Impressão, Corte, Acabamento."
        value={form.category}
        error={fieldError(errors, "category")}
        onChange={(event) => set("category", event.target.value)}
      />

      <Field
        label="Data de aquisição"
        name="purchase_date"
        type="date"
        value={form.purchase_date}
        error={fieldError(errors, "purchase_date")}
        onChange={(event) => set("purchase_date", event.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Valor pago (R$)"
          name="value"
          type="number"
          step="0.01"
          min="0"
          value={form.value}
          error={fieldError(errors, "value")}
          onChange={(event) => set("value", event.target.value)}
        />
        <Field
          label="Vida útil (meses)"
          name="useful_life_months"
          type="number"
          min="0"
          value={form.useful_life_months}
          error={fieldError(errors, "useful_life_months")}
          onChange={(event) => set("useful_life_months", event.target.value)}
        />
      </div>

      <Field
        label="Status de manutenção"
        name="maintenance_status"
        hint="Texto livre. Ex.: Em dia, Revisar, Em manutenção."
        value={form.maintenance_status}
        error={fieldError(errors, "maintenance_status")}
        onChange={(event) => set("maintenance_status", event.target.value)}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || loading}>
          {saving ? "Salvando…" : loading ? "Carregando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/equipment")}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
