'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type IngredientInfo = {
  id: string
  name: string
}

type RecipeIngredient = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  ingredients: IngredientInfo | IngredientInfo[]
}

type RecipeStep = {
  id: string
  step_number: number
  section_name: string | null
  section_order: number | null
  instruction: string
}

type Recipe = {
  id: string
  name: string
  category: string | null
  author: string | null
  event_name: string | null
  usage_type: string | null
  base_servings: number
  notes: string | null
  recipe_ingredients: RecipeIngredient[]
  recipe_steps: RecipeStep[]
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function normalizeSectionName(value: string | null) {
  const trimmed = value?.trim()
  return trimmed || 'Other'
}

function usageTypeLabel(value: string | null) {
  switch (value) {
    case 'regular':
      return 'Regular Menu'
    case 'event':
      return 'Event'
    case 'obento':
      return 'Obento'
    case 'seasonal':
      return 'Seasonal'
    case 'prep':
      return 'Prep Only'
    default:
      return value || '-'
  }
}

function normalizeForAggregation(value: number, unit: string) {
  if (unit === 'g') return { value, unit: 'g' }
  if (unit === 'kg') return { value: value * 1000, unit: 'g' }
  if (unit === 'lb') return { value: value * 453.592, unit: 'g' }

  if (unit === 'ml') return { value, unit: 'ml' }
  if (unit === 'L') return { value: value * 1000, unit: 'ml' }
  if (unit === 'gal') return { value: value * 3785.41, unit: 'ml' }

  if (unit === 'pcs') return { value, unit: 'pcs' }

  return { value, unit }
}

function displayNormalizedUnit(value: number, unit: string) {
  if (unit === 'g' && value >= 1000) {
    return { value: value / 1000, unit: 'kg' }
  }

  if (unit === 'ml' && value >= 1000) {
    return { value: value / 1000, unit: 'L' }
  }

  return { value, unit }
}

export default function BookClient({ recipes }: { recipes: Recipe[] }) {
  const eventNames = useMemo(() => {
    return Array.from(
      new Set(
        recipes
          .map((r) => r.event_name?.trim())
          .filter((v): v is string => Boolean(v))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const [event, setEvent] = useState(eventNames[0] || '')
  const [defaultTarget, setDefaultTarget] = useState('')
  const [targets, setTargets] = useState<Record<string, string>>({})

  const filtered = useMemo(
    () => recipes.filter((r) => r.event_name === event),
    [recipes, event]
  )

  const handleTarget = (id: string, value: string) => {
    setTargets((prev) => ({ ...prev, [id]: value }))
  }

  const applyDefaultTargetToAll = () => {
    if (!defaultTarget) return

    const nextTargets: Record<string, string> = {}
    filtered.forEach((recipe) => {
      nextTargets[recipe.id] = defaultTarget
    })

    setTargets((prev) => ({
      ...prev,
      ...nextTargets,
    }))
  }

  const handleDownloadPdf = () => {
    window.print()
  }

  const aggregatedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        ingredientName: string
        canonicalUnit: string
        quantity: number
      }
    >()

    filtered.forEach((recipe) => {
      const target = Number(targets[recipe.id]) || 0
      const multiplier =
        target && recipe.base_servings ? target / recipe.base_servings : 1

      recipe.recipe_ingredients.forEach((ing) => {
        const ingredient = Array.isArray(ing.ingredients)
          ? ing.ingredients[0]
          : ing.ingredients

        if (!ingredient) return

        const scaledQty = ing.quantity * multiplier
        const normalized = normalizeForAggregation(scaledQty, ing.unit)
        const key = `${ingredient.name}__${normalized.unit}`

        const existing = map.get(key)
        if (existing) {
          existing.quantity += normalized.value
        } else {
          map.set(key, {
            ingredientName: ingredient.name,
            canonicalUnit: normalized.unit,
            quantity: normalized.value,
          })
        }
      })
    })

    return Array.from(map.values())
      .map((row) => {
        const display = displayNormalizedUnit(row.quantity, row.canonicalUnit)
        return {
          ingredientName: row.ingredientName,
          quantity: display.value,
          unit: display.unit,
        }
      })
      .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName))
  }, [filtered, targets])

  return (
    <div className="bg-white text-black print:bg-white">
      <div className="p-6 space-y-4 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3">
              <Link
                href="/"
                className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Back to Recipes
              </Link>
            </div>

            <h1 className="text-2xl font-bold">Event Recipe Book</h1>
            <p className="mt-1 text-sm text-gray-600">
              Set target servings, then click Download PDF.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Download PDF
          </button>
        </div>

        <div className="space-y-4 max-w-xl">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Event Name
            </label>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
            >
              {eventNames.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Default Target Servings
            </label>

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                placeholder="e.g. 60"
                value={defaultTarget}
                onChange={(e) => setDefaultTarget(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
              />

              <button
                type="button"
                onClick={applyDefaultTargetToAll}
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                Apply All
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-10 text-center page-break">
        <h1 className="text-4xl font-bold">{event}</h1>
        <p className="mt-4 text-lg">Recipe Book</p>
      </div>

      {filtered.map((recipe) => {
        const target = Number(targets[recipe.id]) || 0
        const multiplier =
          target && recipe.base_servings ? target / recipe.base_servings : 1

        const groupedIngredients = recipe.recipe_ingredients.reduce(
          (acc: Record<string, RecipeIngredient[]>, ing) => {
            const section = normalizeSectionName(ing.section_name)
            if (!acc[section]) acc[section] = []
            acc[section].push(ing)
            return acc
          },
          {}
        )

        const groupedSteps = (() => {
          const groups = new Map<
            string,
            {
              section: string
              sectionOrder: number
              steps: RecipeStep[]
            }
          >()

          recipe.recipe_steps.forEach((step) => {
            const section = normalizeSectionName(step.section_name)
            const sectionOrder =
              step.section_order === null || step.section_order === undefined
                ? Number.MAX_SAFE_INTEGER
                : step.section_order

            const existing = groups.get(section)

            if (existing) {
              existing.steps.push(step)
              if (sectionOrder < existing.sectionOrder) {
                existing.sectionOrder = sectionOrder
              }
            } else {
              groups.set(section, {
                section,
                sectionOrder,
                steps: [step],
              })
            }
          })

          return Array.from(groups.values())
            .map((group) => ({
              ...group,
              steps: group.steps.sort((a, b) => a.step_number - b.step_number),
            }))
            .sort((a, b) => {
              if (a.sectionOrder !== b.sectionOrder) {
                return a.sectionOrder - b.sectionOrder
              }
              return a.section.localeCompare(b.section)
            })
        })()

        return (
          <div key={recipe.id} className="p-10 page-break">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{recipe.name}</h2>
                <div className="mt-2 text-sm space-y-1">
                  <div>Category: {recipe.category || '-'}</div>
                  <div>Author: {recipe.author || '-'}</div>
                  <div>Usage Type: {usageTypeLabel(recipe.usage_type)}</div>
                  <div>Event Name: {recipe.event_name || '-'}</div>
                  <div>Base Servings: {recipe.base_servings}</div>
                  <div>
                    Target Servings: {target || '-'} / Multiplier: x
                    {formatNumber(multiplier)}
                  </div>
                </div>
              </div>

              <div className="print:hidden w-52">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Target Servings
                </label>
                <input
                  type="number"
                  placeholder="e.g. 40"
                  value={targets[recipe.id] || ''}
                  onChange={(e) => handleTarget(recipe.id, e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-bold">Ingredients</h3>

              <div className="mt-3 space-y-5">
                {Object.entries(groupedIngredients).map(([section, items]) => (
                  <div key={section}>
                    <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
                      {section}
                    </div>

                    <div className="space-y-1">
                      {items.map((ing) => {
                        const qty = ing.quantity * multiplier
                        const ingredient = Array.isArray(ing.ingredients)
                          ? ing.ingredients[0]
                          : ing.ingredients

                        return (
                          <div key={ing.id} className="text-sm">
                            {ingredient?.name} — {formatNumber(qty)} {ing.unit}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-bold">Steps</h3>

              <div className="mt-3 space-y-5">
                {groupedSteps.length ? (
                  groupedSteps.map((group) => (
                    <div key={group.section}>
                      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
                        {group.section}
                      </div>

                      <div className="space-y-2">
                        {group.steps.map((step) => (
                          <div key={step.id} className="text-sm">
                            {step.step_number}. {step.instruction}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">No steps.</div>
                )}
              </div>
            </div>

            {recipe.notes ? (
              <div className="mt-8">
                <h3 className="text-lg font-bold">Notes</h3>
                <div className="mt-2 text-sm whitespace-pre-wrap">
                  {recipe.notes}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}

      <div className="p-10 page-break">
        <h2 className="text-2xl font-bold">Aggregated Ingredient Totals</h2>
        <p className="mt-2 text-sm text-gray-600">
          Combined totals for this event.
        </p>

        <div className="mt-6">
          {aggregatedRows.length ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="py-2 pr-4">Ingredient</th>
                  <th className="py-2 pr-4">Total Quantity</th>
                  <th className="py-2 pr-4">Unit</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedRows.map((row) => (
                  <tr
                    key={`${row.ingredientName}-${row.unit}`}
                    className="border-b border-gray-200"
                  >
                    <td className="py-2 pr-4">{row.ingredientName}</td>
                    <td className="py-2 pr-4">{formatNumber(row.quantity)}</td>
                    <td className="py-2 pr-4">{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-gray-500">
              No aggregated ingredients yet.
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 14mm;
          }

          .page-break {
            page-break-after: always;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}