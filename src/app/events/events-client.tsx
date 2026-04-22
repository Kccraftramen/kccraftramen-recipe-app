'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type IngredientInfo = {
  id: string
  name: string
  default_unit: string | null
}

type RecipeIngredientRow = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  ingredients: IngredientInfo | IngredientInfo[]
}

type Recipe = {
  id: string
  name: string
  event_name: string | null
  base_servings: number
  usage_type: string | null
  recipe_ingredients: RecipeIngredientRow[]
}

type Props = {
  recipes: Recipe[]
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

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function normalizeForAggregation(value: number, unit: string) {
  // Weight → grams
  if (unit === 'g') return { value, unit: 'g' }
  if (unit === 'kg') return { value: value * 1000, unit: 'g' }
  if (unit === 'lb') return { value: value * 453.592, unit: 'g' }

  // Volume → ml
  if (unit === 'ml') return { value, unit: 'ml' }
  if (unit === 'L') return { value: value * 1000, unit: 'ml' }
  if (unit === 'gal') return { value: value * 3785.41, unit: 'ml' }

  // Count
  if (unit === 'pcs') return { value, unit: 'pcs' }

  // Fallback
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

export default function EventsClient({ recipes }: Props) {
  const eventNames = useMemo(() => {
    return Array.from(
      new Set(
        recipes
          .map((recipe) => recipe.event_name?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const [selectedEvent, setSelectedEvent] = useState(eventNames[0] || '')
  const [defaultTarget, setDefaultTarget] = useState('')
  const [targetServingsMap, setTargetServingsMap] = useState<Record<string, string>>({})

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => recipe.event_name === selectedEvent)
  }, [recipes, selectedEvent])

  const handleTargetChange = (recipeId: string, value: string) => {
    setTargetServingsMap((prev) => ({
      ...prev,
      [recipeId]: value,
    }))
  }

  const applyDefaultTargetToAll = () => {
    if (!defaultTarget) return

    const nextMap: Record<string, string> = {}
    filteredRecipes.forEach((recipe) => {
      nextMap[recipe.id] = defaultTarget
    })

    setTargetServingsMap((prev) => ({
      ...prev,
      ...nextMap,
    }))
  }

  const scaledRows = useMemo(() => {
    const rows: {
      recipeName: string
      sectionName: string
      ingredientName: string
      quantity: number
      unit: string
      usUnit: string | null
    }[] = []

    filteredRecipes.forEach((recipe) => {
      const target = Number(targetServingsMap[recipe.id])

      if (!target || target <= 0 || !recipe.base_servings) return

      const multiplier = target / recipe.base_servings

      recipe.recipe_ingredients.forEach((row) => {
        const ingredient = Array.isArray(row.ingredients)
          ? row.ingredients[0]
          : row.ingredients

        if (!ingredient) return

        const scaledQuantity = row.quantity * multiplier
        const converted = convertUnit(scaledQuantity, row.unit)
        const usUnit = getUSUnit(converted.value, converted.unit)

        rows.push({
          recipeName: recipe.name,
          sectionName: row.section_name || 'Other',
          ingredientName: ingredient.name,
          quantity: converted.value,
          unit: converted.unit,
          usUnit,
        })
      })
    })

    return rows
  }, [filteredRecipes, targetServingsMap])

  const aggregatedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        ingredientName: string
        canonicalUnit: string
        quantity: number
      }
    >()

    filteredRecipes.forEach((recipe) => {
      const target = Number(targetServingsMap[recipe.id])

      if (!target || target <= 0 || !recipe.base_servings) return

      const multiplier = target / recipe.base_servings

      recipe.recipe_ingredients.forEach((row) => {
        const ingredient = Array.isArray(row.ingredients)
          ? row.ingredients[0]
          : row.ingredients

        if (!ingredient) return

        const scaledQuantity = row.quantity * multiplier
        const normalized = normalizeForAggregation(scaledQuantity, row.unit)

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
        const displayValue = displayNormalizedUnit(row.quantity, row.canonicalUnit)
        return {
          ingredientName: row.ingredientName,
          quantity: displayValue.value,
          unit: displayValue.unit,
        }
      })
      .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName))
  }, [filteredRecipes, targetServingsMap])

  const downloadScaledCsv = () => {
    if (!scaledRows.length) return

    const rows = [
      ['Recipe', 'Section', 'Ingredient', 'Quantity', 'Unit', 'US Unit'],
      ...scaledRows.map((row) => [
        row.recipeName,
        row.sectionName,
        row.ingredientName,
        formatNumber(row.quantity),
        row.unit,
        row.usUnit || '',
      ]),
    ]

    const csvContent =
      '\uFEFF' +
      rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n')

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    })

    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.href = url
    link.download = `${selectedEvent || 'event'}_scaled_ingredients.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  const downloadAggregatedCsv = () => {
    if (!aggregatedRows.length) return

    const rows = [
      ['Ingredient', 'Total Quantity', 'Unit'],
      ...aggregatedRows.map((row) => [
        row.ingredientName,
        formatNumber(row.quantity),
        row.unit,
      ]),
    ]

    const csvContent =
      '\uFEFF' +
      rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n')

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    })

    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.href = url
    link.download = `${selectedEvent || 'event'}_aggregated_ingredients.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#E60012] px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                KC Craft Ramen
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Event Summary
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Select an event, enter target servings for each recipe, and review scaled ingredients.
              </p>
            </div>

            <Link
              href="/"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to Recipes
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-gray-900">Event Settings</h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Event Name
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                  >
                    {eventNames.length ? (
                      eventNames.map((eventName) => (
                        <option key={eventName} value={eventName}>
                          {eventName}
                        </option>
                      ))
                    ) : (
                      <option value="">No events found</option>
                    )}
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
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                      value={defaultTarget}
                      onChange={(e) => setDefaultTarget(e.target.value)}
                      placeholder="e.g. 60"
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
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-gray-900">Recipes in Event</h2>

              <div className="mt-4 space-y-4">
                {filteredRecipes.length ? (
                  filteredRecipes.map((recipe) => {
                    const target = Number(targetServingsMap[recipe.id])
                    const multiplier =
                      target && recipe.base_servings
                        ? target / recipe.base_servings
                        : 0

                    return (
                      <div
                        key={recipe.id}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="space-y-2">
                          <div className="text-lg font-semibold text-gray-900">
                            {recipe.name}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                              {usageTypeLabel(recipe.usage_type)}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                              Base {recipe.base_servings}
                            </span>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              Target Servings
                            </label>
                            <input
                              type="number"
                              min="1"
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
                              value={targetServingsMap[recipe.id] || ''}
                              onChange={(e) =>
                                handleTargetChange(recipe.id, e.target.value)
                              }
                              placeholder="e.g. 40"
                            />
                          </div>

                          <div className="text-sm text-gray-600">
                            Multiplier:{' '}
                            {multiplier > 0 ? `${formatNumber(multiplier)}x` : '-'}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    No recipes found for this event.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  Scaled Ingredient List
                </h2>

                <button
                  type="button"
                  onClick={downloadScaledCsv}
                  disabled={!scaledRows.length}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Download CSV
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                {scaledRows.length ? (
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="px-3 py-2">Recipe</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Ingredient</th>
                        <th className="px-3 py-2">Quantity</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">US Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scaledRows.map((row, index) => (
                        <tr
                          key={`${row.recipeName}-${row.ingredientName}-${index}`}
                          className="border-b border-gray-100"
                        >
                          <td className="px-3 py-2">{row.recipeName}</td>
                          <td className="px-3 py-2">{row.sectionName}</td>
                          <td className="px-3 py-2">{row.ingredientName}</td>
                          <td className="px-3 py-2">{formatNumber(row.quantity)}</td>
                          <td className="px-3 py-2">{row.unit}</td>
                          <td className="px-3 py-2">{row.usUnit || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    Enter target servings to see scaled ingredients.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  Aggregated Ingredient Totals
                </h2>

                <button
                  type="button"
                  onClick={downloadAggregatedCsv}
                  disabled={!aggregatedRows.length}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Download CSV
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                {aggregatedRows.length ? (
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="px-3 py-2">Ingredient</th>
                        <th className="px-3 py-2">Total Quantity</th>
                        <th className="px-3 py-2">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregatedRows.map((row) => (
                        <tr
                          key={`${row.ingredientName}-${row.unit}`}
                          className="border-b border-gray-100"
                        >
                          <td className="px-3 py-2">{row.ingredientName}</td>
                          <td className="px-3 py-2">{formatNumber(row.quantity)}</td>
                          <td className="px-3 py-2">{row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    Aggregated totals will appear here after target servings are entered.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}