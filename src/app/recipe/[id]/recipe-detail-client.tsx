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
  instruction: string
}

type Props = {
  recipe: {
    id: string
    name: string
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

  return (
    <main className="min-h-screen bg-[#E60012] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
          <a href="/" className="inline-flex text-sm font-medium text-gray-700 underline">
            ← Back to list
          </a>

          <div className="mt-4 space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              {recipe.name}
            </h1>

            <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
              <div>Category: {recipe.category || '-'}</div>
              <div>Usage Type: {usageTypeLabel(recipe.usage_type)}</div>
              <div>Event Name: {recipe.event_name || '-'}</div>
              <div>Base Servings: {recipe.base_servings}</div>
            </div>

            <div className="text-sm text-gray-600">
              Notes: {recipe.notes || '-'}
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Scaling</h2>

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

            <div className="rounded-2xl border border-gray-200 bg-white p-0">
              <div className="p-0">
                <IngredientForm recipeId={recipe.id} />
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-gray-900">Ingredients</h2>

              {ingredientRows?.length ? (
                <div className="space-y-3">
                  {ingredientRows.map((row) => (
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
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                  No ingredients yet.
                </div>
              )}
            </section>

            <div className="rounded-2xl border border-gray-200 bg-white p-0">
              <div className="p-0">
                <StepForm recipeId={recipe.id} nextStepNumber={nextStepNumber} />
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-gray-900">Steps</h2>

              {stepRows?.length ? (
                <div className="space-y-3">
                  {stepRows.map((step) => (
                    <StepEditRow key={step.id} step={step} />
                  ))}
                </div>
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