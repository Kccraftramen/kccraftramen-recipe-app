'use client'

import { useMemo, useState } from 'react'
import IngredientForm from './ingredient-form'
import IngredientEditRow from './ingredient-edit-row'
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
  instruction: string
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

function normalizeSectionName(value: string | null) {
  const trimmed = value?.trim()
  return trimmed || 'Other'
}

export default function RecipeDetailClient({
  recipe,
  ingredientRows,
  stepRows,
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
      .map(([section, rows]) => [
        section,
        rows.sort((a, b) => a.step_number - b.step_number),
      ] as const)
      .sort((a, b) => a[0].localeCompare(b[0]))
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

          <div className="mt-5 space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              {recipe.name}
            </h1>

            <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
              <div>Author: {recipe.author || '-'}</div>
              <div>Category: {recipe.category || '-'}</div>
              <div>Usage Type: {usageTypeLabel(recipe.usage_type)}</div>
              <div>Event Name: {recipe.event_name || '-'}</div>
              <div>Base Servings: {recipe.base_servings}</div>
            </div>

            <div className="text-sm text-gray-600">
              Notes: {recipe.notes || '-'}
            </div>
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
                groupedSteps.map(([section, rows]) => (
                  <div key={section} className="space-y-3">
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                      {section}
                    </div>

                    <div className="space-y-3">
                      {rows.map((step) => (
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
        </div>
      </div>
    </main>
  )
}