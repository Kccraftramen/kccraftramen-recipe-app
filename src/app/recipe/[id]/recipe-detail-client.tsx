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
    <main className="p-6 max-w-2xl">
      <a href="/" className="underline">
        ← Back to list
      </a>

      <h1 className="text-2xl font-bold mt-4 mb-2">{recipe.name}</h1>

      <div className="text-sm text-gray-600 mb-1">
        Category: {recipe.category || '-'}
      </div>
      <div className="text-sm text-gray-600 mb-1">
        Usage Type: {recipe.usage_type || '-'}
      </div>
      <div className="text-sm text-gray-600 mb-1">
        Event Name: {recipe.event_name || '-'}
      </div>
      <div className="text-sm text-gray-600 mb-1">
        Base Servings: {recipe.base_servings}
      </div>
      <div className="text-sm text-gray-600 mb-4">
        Notes: {recipe.notes || '-'}
      </div>

      <section className="border rounded-lg p-4 mb-6 space-y-3">
        <h2 className="text-lg font-semibold">Scaling</h2>

        <div>
          <label className="block text-sm mb-1">Target Servings</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="border rounded px-3 py-2 w-full"
            value={targetServings}
            onChange={(e) => setTargetServings(e.target.value)}
          />
        </div>

        <div className="text-sm text-gray-600">
          Multiplier: {formatNumber(multiplier)}x
        </div>
      </section>

      <IngredientForm recipeId={recipe.id} />

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Ingredients</h2>

        {ingredientRows?.length ? (
          <div className="space-y-2">
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
          <div>No ingredients yet.</div>
        )}
      </section>

      <StepForm recipeId={recipe.id} nextStepNumber={nextStepNumber} />

      <section>
        <h2 className="text-xl font-semibold mb-3">Steps</h2>

        {stepRows?.length ? (
          <div className="space-y-2">
            {stepRows.map((step) => (
              <StepEditRow key={step.id} step={step} />
            ))}
          </div>
        ) : (
          <div>No steps yet.</div>
        )}
      </section>
    </main>
  )
}