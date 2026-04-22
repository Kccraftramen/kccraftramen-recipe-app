'use client'

import { useMemo, useState } from 'react'
import IngredientForm from './ingredient-form'
import IngredientEditRow from './ingredient-edit-row'
import RecipeMetaEditor from './recipe-meta-editor'
import StepForm from './step-form'
import StepEditRow from './step-edit-row'

type IngredientRow = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  ingredients:
    | {
        id: string
        name: string
        default_unit: string | null
      }
    | {
        id: string
        name: string
        default_unit: string | null
      }[]
}

type StepRow = {
  id: string
  step_number: number
  section_name: string | null
  section_order: number | null
  instruction: string
}

type ChangeLog = {
  id: string
  entity_type: string
  action_type: string
  item_name: string | null
  section_name: string | null
  before_value: string | null
  after_value: string | null
  changed_at: string
}

type Props = {
  recipe: {
    id: string
    name: string
    author: string | null
    category: string | null
    base_servings: number
    notes: string | null
    usage_type: string | null
    event_name: string | null
  }
  ingredientRows: IngredientRow[]
  stepRows: StepRow[]
  changeLogs: ChangeLog[]
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
}

function convertUnit(value: number, unit: string) {
  if (unit === 'g' && value >= 1000) {
    return { value: value / 1000, unit: 'kg' }
  }

  if (unit === 'ml' && value >= 1000) {
    return { value: value / 1000, unit: 'L' }
  }

  return { value, unit }
}

function getUSUnit(value: number, unit: string) {
  if (unit === 'g' || unit === 'kg') {
    const grams = unit === 'kg' ? value * 1000 : value
    const lb = grams / 453.592
    return `${formatNumber(lb)} lb`
  }

  if (unit === 'ml' || unit === 'L') {
    const ml = unit === 'L' ? value * 1000 : value
    const gal = ml / 3785.41
    return `${formatNumber(gal)} gal`
  }

  return null
}

function normalizeSectionName(value: string | null) {
  const trimmed = value?.trim()
  return trimmed || 'Other'
}

function formatChangedAt(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function actionLabel(entityType: string, actionType: string) {
  const entity = entityType.charAt(0).toUpperCase() + entityType.slice(1)
  const action = actionType.charAt(0).toUpperCase() + actionType.slice(1)
  return `${entity} ${action}`
}

export default function RecipeDetailClient({
  recipe,
  ingredientRows,
  stepRows,
  changeLogs,
}: Props) {
  const [targetServings, setTargetServings] = useState(
    String(recipe.base_servings)
  )

  const multiplier = useMemo(() => {
    const target = Number(targetServings)
    if (!target || target <= 0 || !recipe.base_servings) return 1
    return target / recipe.base_servings
  }, [targetServings, recipe.base_servings])

  const nextStepNumber =
    stepRows.length > 0
      ? Math.max(...stepRows.map((step) => step.step_number)) + 1
      : 1

  const groupedIngredients = useMemo(() => {
    const groups = new Map<string, IngredientRow[]>()

    ingredientRows.forEach((row) => {
      const section = normalizeSectionName(row.section_name)
      const existing = groups.get(section) || []
      existing.push(row)
      groups.set(section, existing)
    })

    return Array.from(groups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    )
  }, [ingredientRows])

  const groupedSteps = useMemo(() => {
    const groups = new Map<string, StepRow[]>()

    stepRows.forEach((row) => {
      const section = normalizeSectionName(row.section_name)
      const existing = groups.get(section) || []
      existing.push(row)
      groups.set(section, existing)
    })

    return Array.from(groups.entries())
      .map(([section, rows]) => {
        const sortedRows = rows.sort((a, b) => a.step_number - b.step_number)

        const sectionOrderCandidates = sortedRows
          .map((row) => row.section_order)
          .filter((value): value is number => value !== null && value !== undefined)

        const sectionOrder =
          sectionOrderCandidates.length > 0
            ? Math.min(...sectionOrderCandidates)
            : Number.MAX_SAFE_INTEGER

        return {
          section,
          sectionOrder,
          rows: sortedRows,
        }
      })
      .sort((a, b) => {
        if (a.sectionOrder !== b.sectionOrder) {
          return a.sectionOrder - b.sectionOrder
        }
        return a.section.localeCompare(b.section)
      })
  }, [stepRows])

  return (
    <main className="min-h-screen bg-[#E60012] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg md:p-8">
          <a
            href="/"
            className="inline-flex text-sm font-medium text-gray-700 underline"
          >
            ← Back to list
          </a>

          <div className="mt-5">
            <RecipeMetaEditor recipe={recipe} />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Scaling</h2>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Target Servings
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                  value={targetServings}
                  onChange={(e) => setTargetServings(e.target.value)}
                />
              </div>

              <div className="text-sm text-gray-600">
                Multiplier: {formatNumber(multiplier)}x
              </div>
            </section>

            <div className="xl:col-span-2 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <IngredientForm recipeId={recipe.id} />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <StepForm recipeId={recipe.id} nextStepNumber={nextStepNumber} />
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Ingredients</h2>

              {groupedIngredients.length ? (
                groupedIngredients.map(([section, rows]) => (
                  <div key={section} className="space-y-3">
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                      {section}
                    </div>

                    <div className="space-y-3">
                      {rows.map((row) => (
                        <IngredientEditRow
                          key={row.id}
                          row={row}
                          multiplier={multiplier}
                          formatNumber={formatNumber}
                          convertUnit={convertUnit}
                          getUSUnit={getUSUnit}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                  No ingredients yet.
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Steps</h2>

              {groupedSteps.length ? (
                groupedSteps.map((group) => (
                  <div key={group.section} className="space-y-3">
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                      {group.section}
                      {group.sectionOrder !== Number.MAX_SAFE_INTEGER ? (
                        <span className="ml-2 text-xs text-gray-500">
                          (Order {group.sectionOrder})
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {group.rows.map((step) => (
                        <StepEditRow key={step.id} step={step} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                  No steps yet.
                </div>
              )}
            </section>
          </div>

          <div className="mt-10 space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Change History</h2>

            {changeLogs.length ? (
              <div className="space-y-3">
                {changeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {actionLabel(log.entity_type, log.action_type)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatChangedAt(log.changed_at)}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      <div>Item: {log.item_name || '-'}</div>
                      <div>Section: {log.section_name || '-'}</div>
                      {log.before_value ? (
                        <div>Before: {log.before_value}</div>
                      ) : null}
                      {log.after_value ? (
                        <div>After: {log.after_value}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                No change history yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}