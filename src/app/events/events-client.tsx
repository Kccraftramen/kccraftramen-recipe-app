'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

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
  category: string | null
  event_name: string | null
  base_servings: number
  usage_type: string | null
  recipe_ingredients: RecipeIngredientRow[]
}

type EventBuilder = {
  id: string
  name: string
  selected_events: string[] | null
  selected_recipe_ids: string[] | null
  target_servings: Record<string, string> | null
  recipe_order: string[] | null
  created_at: string
  updated_at: string
}

type Props = {
  recipes: Recipe[]
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function convertUnit(value: number, unit: string) {
  if (unit === 'g' && value >= 1000) return { value: value / 1000, unit: 'kg' }
  if (unit === 'ml' && value >= 1000) return { value: value / 1000, unit: 'L' }
  return { value, unit }
}

function getUSUnit(value: number, unit: string) {
  if (unit === 'g' || unit === 'kg') {
    const grams = unit === 'kg' ? value * 1000 : value
    return `${formatNumber(grams / 453.592)} lb`
  }

  if (unit === 'ml' || unit === 'L') {
    const ml = unit === 'L' ? value * 1000 : value
    return `${formatNumber(ml / 3785.41)} gal`
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
  if (unit === 'g' && value >= 1000) return { value: value / 1000, unit: 'kg' }
  if (unit === 'ml' && value >= 1000) return { value: value / 1000, unit: 'L' }
  return { value, unit }
}

function buildBookUrl(builderId: string) {
  if (!builderId) return '/events/book'
  return `/events/book?builder=${encodeURIComponent(builderId)}`
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

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        recipes
          .map((recipe) => recipe.category?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([])
  const [recipeOrder, setRecipeOrder] = useState<string[]>([])
  const [menuSearch, setMenuSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [defaultTarget, setDefaultTarget] = useState('')
  const [targetServingsMap, setTargetServingsMap] = useState<Record<string, string>>({})

  const [builders, setBuilders] = useState<EventBuilder[]>([])
  const [builderName, setBuilderName] = useState('')
  const [selectedBuilderId, setSelectedBuilderId] = useState('')
  const [isSavingBuilder, setIsSavingBuilder] = useState(false)
  const [isLoadingBuilders, setIsLoadingBuilders] = useState(false)

  const loadBuilders = async () => {
    setIsLoadingBuilders(true)

    const { data, error } = await supabase
      .from('event_builders')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      alert(`Failed to load Event Builders: ${error.message}`)
      setIsLoadingBuilders(false)
      return
    }

    setBuilders(data || [])
    setIsLoadingBuilders(false)
  }

  useEffect(() => {
    loadBuilders()
  }, [])

  const recipesFromSelectedEvents = useMemo(() => {
    if (!selectedEvents.length) return []

    return recipes.filter((recipe) =>
      selectedEvents.includes(recipe.event_name || '')
    )
  }, [recipes, selectedEvents])

  const searchResults = useMemo(() => {
    const keyword = menuSearch.trim().toLowerCase()
    if (!keyword) return []

    return recipes.filter((recipe) =>
      recipe.name.toLowerCase().includes(keyword)
    )
  }, [recipes, menuSearch])

  const visibleRecipes = useMemo(() => {
    const map = new Map<string, Recipe>()

    recipesFromSelectedEvents.forEach((recipe) => map.set(recipe.id, recipe))
    searchResults.forEach((recipe) => map.set(recipe.id, recipe))

    recipes
      .filter((recipe) => selectedRecipeIds.includes(recipe.id))
      .forEach((recipe) => map.set(recipe.id, recipe))

    let rows = Array.from(map.values())

    if (categoryFilter) {
      rows = rows.filter((recipe) => recipe.category === categoryFilter)
    }

    return rows.sort((a, b) => {
      const eventCompare = (a.event_name || '').localeCompare(b.event_name || '')
      if (eventCompare !== 0) return eventCompare
      return a.name.localeCompare(b.name)
    })
  }, [
    recipesFromSelectedEvents,
    searchResults,
    recipes,
    selectedRecipeIds,
    categoryFilter,
  ])

  const activeRecipes = useMemo(() => {
    const checkedRecipes = recipes.filter((recipe) =>
      selectedRecipeIds.includes(recipe.id)
    )

    const orderMap = new Map(recipeOrder.map((id, index) => [id, index]))

    return checkedRecipes.sort((a, b) => {
      const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER
      const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER

      if (aOrder !== bOrder) return aOrder - bOrder

      const eventCompare = (a.event_name || '').localeCompare(b.event_name || '')
      if (eventCompare !== 0) return eventCompare

      return a.name.localeCompare(b.name)
    })
  }, [recipes, selectedRecipeIds, recipeOrder])

  useEffect(() => {
    setRecipeOrder((prev) => {
      const selectedSet = new Set(selectedRecipeIds)
      const kept = prev.filter((id) => selectedSet.has(id))
      const added = selectedRecipeIds.filter((id) => !kept.includes(id))
      return [...kept, ...added]
    })
  }, [selectedRecipeIds])

  const selectedEventLabel =
    selectedEvents.length === 0
      ? 'Select events'
      : selectedEvents.length === 1
        ? selectedEvents[0]
        : `${selectedEvents.length} events selected`

  const handleEventToggle = (eventName: string, checked: boolean) => {
    if (checked) {
      setSelectedEvents((prev) =>
        prev.includes(eventName) ? prev : [...prev, eventName]
      )
    } else {
      setSelectedEvents((prev) => prev.filter((name) => name !== eventName))
    }
  }

  const addRecipeIds = (ids: string[]) => {
    setSelectedRecipeIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return Array.from(next)
    })
  }

  const removeRecipeIds = (ids: string[]) => {
    const removeSet = new Set(ids)
    setSelectedRecipeIds((prev) => prev.filter((id) => !removeSet.has(id)))
  }

  const selectAllEventRecipes = () => {
    addRecipeIds(recipesFromSelectedEvents.map((recipe) => recipe.id))
  }

  const clearEventRecipes = () => {
    removeRecipeIds(recipesFromSelectedEvents.map((recipe) => recipe.id))
  }

  const selectAllSearchResults = () => {
    addRecipeIds(searchResults.map((recipe) => recipe.id))
  }

  const clearSearchResults = () => {
    removeRecipeIds(searchResults.map((recipe) => recipe.id))
  }

  const clearAllSelectedRecipes = () => {
    setSelectedRecipeIds([])
    setRecipeOrder([])
  }

  const handleRecipeToggle = (recipeId: string, checked: boolean) => {
    if (checked) {
      addRecipeIds([recipeId])
    } else {
      removeRecipeIds([recipeId])
    }
  }

  const moveRecipe = (recipeId: string, direction: 'up' | 'down') => {
    setRecipeOrder((prev) => {
      const currentOrder = activeRecipes.map((recipe) => recipe.id)
      const base = currentOrder.length ? currentOrder : prev
      const index = base.indexOf(recipeId)

      if (index === -1) return prev
      if (direction === 'up' && index === 0) return prev
      if (direction === 'down' && index === base.length - 1) return prev

      const next = [...base]
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      const temp = next[index]
      next[index] = next[swapIndex]
      next[swapIndex] = temp
      return next
    })
  }

  const handleTargetChange = (recipeId: string, value: string) => {
    setTargetServingsMap((prev) => ({
      ...prev,
      [recipeId]: value,
    }))
  }

  const applyDefaultTargetToAll = () => {
    if (!defaultTarget) return

    const nextMap: Record<string, string> = {}

    activeRecipes.forEach((recipe) => {
      nextMap[recipe.id] = defaultTarget
    })

    setTargetServingsMap((prev) => ({
      ...prev,
      ...nextMap,
    }))
  }

  const handleSaveNewBuilder = async () => {
    const trimmedName = builderName.trim()

    if (!trimmedName) {
      alert('Please enter Event Builder name.')
      return
    }

    if (!selectedRecipeIds.length) {
      alert('Please check at least one recipe.')
      return
    }

    setIsSavingBuilder(true)

    const { data, error } = await supabase
      .from('event_builders')
      .insert({
        name: trimmedName,
        selected_events: selectedEvents,
        selected_recipe_ids: selectedRecipeIds,
        target_servings: targetServingsMap,
        recipe_order: activeRecipes.map((recipe) => recipe.id),
      })
      .select('*')
      .single()

    if (error) {
      alert(`Save failed: ${error.message}`)
      setIsSavingBuilder(false)
      return
    }

    setBuilderName('')
    setSelectedBuilderId(data.id)
    await loadBuilders()
    setIsSavingBuilder(false)
    alert('Event Builder saved.')
  }

  const handleUpdateBuilder = async () => {
    if (!selectedBuilderId) {
      alert('Please select a saved Event Builder first.')
      return
    }

    if (!selectedRecipeIds.length) {
      alert('Please check at least one recipe.')
      return
    }

    const confirmed = window.confirm('Overwrite this saved Event Builder?')
    if (!confirmed) return

    setIsSavingBuilder(true)

    const { error } = await supabase
      .from('event_builders')
      .update({
        selected_events: selectedEvents,
        selected_recipe_ids: selectedRecipeIds,
        target_servings: targetServingsMap,
        recipe_order: activeRecipes.map((recipe) => recipe.id),
      })
      .eq('id', selectedBuilderId)

    if (error) {
      alert(`Update failed: ${error.message}`)
      setIsSavingBuilder(false)
      return
    }

    await loadBuilders()
    setIsSavingBuilder(false)
    alert('Event Builder updated.')
  }

  const handleLoadBuilder = () => {
    const builder = builders.find((item) => item.id === selectedBuilderId)

    if (!builder) {
      alert('Please select a saved Event Builder.')
      return
    }

    setSelectedEvents(builder.selected_events || [])
    setSelectedRecipeIds(builder.selected_recipe_ids || [])
    setRecipeOrder(builder.recipe_order || builder.selected_recipe_ids || [])
    setTargetServingsMap(builder.target_servings || {})
    setMenuSearch('')
    setCategoryFilter('')
    setDefaultTarget('')
    setBuilderName(builder.name)
  }

  const handleDeleteBuilder = async () => {
    if (!selectedBuilderId) {
      alert('Please select a saved Event Builder.')
      return
    }

    const builder = builders.find((item) => item.id === selectedBuilderId)
    const confirmed = window.confirm(
      `Delete Event Builder "${builder?.name || ''}"?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('event_builders')
      .delete()
      .eq('id', selectedBuilderId)

    if (error) {
      alert(`Delete failed: ${error.message}`)
      return
    }

    setSelectedBuilderId('')
    await loadBuilders()
    alert('Event Builder deleted.')
  }

  const scaledRows = useMemo(() => {
    const rows: {
      recipeName: string
      eventName: string
      sectionName: string
      ingredientName: string
      quantity: number
      unit: string
      usUnit: string | null
    }[] = []

    activeRecipes.forEach((recipe) => {
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
          eventName: recipe.event_name || '',
          sectionName: row.section_name || 'Other',
          ingredientName: ingredient.name,
          quantity: converted.value,
          unit: converted.unit,
          usUnit,
        })
      })
    })

    return rows
  }, [activeRecipes, targetServingsMap])

  const aggregatedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        ingredientName: string
        canonicalUnit: string
        quantity: number
      }
    >()

    activeRecipes.forEach((recipe) => {
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
  }, [activeRecipes, targetServingsMap])

  const csvFilePrefix = selectedEvents.length
    ? selectedEvents.join('_').replace(/\s+/g, '_')
    : 'custom_event'

  const downloadScaledCsv = () => {
    if (!scaledRows.length) return

    const rows = [
      ['Event', 'Recipe', 'Section', 'Ingredient', 'Quantity', 'Unit', 'US Unit'],
      ...scaledRows.map((row) => [
        row.eventName,
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
    link.download = `${csvFilePrefix}_scaled_ingredients.csv`
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
    link.download = `${csvFilePrefix}_aggregated_ingredients.csv`
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
                Build, save, reorder, reload, and export custom event recipe sets.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={buildBookUrl(selectedBuilderId)}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Open Recipe Book
              </Link>

              <Link
                href="/"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Recipes
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-gray-900">
                Saved Event Builders
              </h2>

              <div className="mt-4 space-y-4">
                <select
                  value={selectedBuilderId}
                  onChange={(e) => setSelectedBuilderId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                >
                  <option value="">
                    {isLoadingBuilders ? 'Loading...' : 'Select saved builder'}
                  </option>

                  {builders.map((builder) => (
                    <option key={builder.id} value={builder.id}>
                      {builder.name}
                    </option>
                  ))}
                </select>

                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleLoadBuilder}
                    disabled={!selectedBuilderId}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Load
                  </button>

                  <button
                    type="button"
                    onClick={handleUpdateBuilder}
                    disabled={!selectedBuilderId || isSavingBuilder}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Update
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteBuilder}
                    disabled={!selectedBuilderId}
                    className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={builderName}
                    onChange={(e) => setBuilderName(e.target.value)}
                    placeholder="e.g. Wagyu Dinner 2026"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                  />

                  <button
                    type="button"
                    onClick={handleSaveNewBuilder}
                    disabled={isSavingBuilder}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Save
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-gray-900">
                Event Settings
              </h2>

              <div className="mt-4 space-y-4">
                <div className="relative">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Event Select
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsEventDropdownOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span>{selectedEventLabel}</span>
                    <span className="text-gray-400">
                      {isEventDropdownOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {isEventDropdownOpen && (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-gray-300 bg-white p-3 shadow-lg">
                      {eventNames.length ? (
                        eventNames.map((eventName) => (
                          <label
                            key={eventName}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEvents.includes(eventName)}
                              onChange={(e) =>
                                handleEventToggle(eventName, e.target.checked)
                              }
                            />
                            <span>{eventName}</span>
                          </label>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">
                          No events found.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search menu name from all recipes..."
                />

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={selectAllEventRecipes}
                    disabled={!recipesFromSelectedEvents.length}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Select All Event Recipes
                  </button>

                  <button
                    type="button"
                    onClick={clearEventRecipes}
                    disabled={!recipesFromSelectedEvents.length}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear Event Recipes
                  </button>

                  <button
                    type="button"
                    onClick={selectAllSearchResults}
                    disabled={!searchResults.length}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Select Search Results
                  </button>

                  <button
                    type="button"
                    onClick={clearSearchResults}
                    disabled={!searchResults.length}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear Search Results
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                    value={defaultTarget}
                    onChange={(e) => setDefaultTarget(e.target.value)}
                    placeholder="Default Target Servings"
                  />

                  <button
                    type="button"
                    onClick={applyDefaultTargetToAll}
                    disabled={!activeRecipes.length}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Apply All
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Candidate Recipes
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Check recipes to include them.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearAllSelectedRecipes}
                  disabled={!selectedRecipeIds.length}
                  className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  Event Recipes: {recipesFromSelectedEvents.length}
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  Search Results: {searchResults.length}
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  Checked: {selectedRecipeIds.length}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {visibleRecipes.length ? (
                  visibleRecipes.map((recipe) => {
                    const isChecked = selectedRecipeIds.includes(recipe.id)
                    const target = Number(targetServingsMap[recipe.id])
                    const multiplier =
                      target && recipe.base_servings
                        ? target / recipe.base_servings
                        : 0

                    return (
                      <div
                        key={recipe.id}
                        className={`rounded-2xl border p-4 ${
                          isChecked
                            ? 'border-gray-300 bg-gray-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="space-y-3">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={isChecked}
                              onChange={(e) =>
                                handleRecipeToggle(recipe.id, e.target.checked)
                              }
                            />

                            <div>
                              <div className="text-lg font-semibold text-gray-900">
                                {recipe.name}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                Event: {recipe.event_name || '-'} / Category:{' '}
                                {recipe.category || '-'}
                              </div>
                            </div>
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                              {usageTypeLabel(recipe.usage_type)}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                              Base {recipe.base_servings}
                            </span>
                          </div>

                          {isChecked && (
                            <>
                              <input
                                type="number"
                                min="1"
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
                                value={targetServingsMap[recipe.id] || ''}
                                onChange={(e) =>
                                  handleTargetChange(recipe.id, e.target.value)
                                }
                                placeholder="Target Servings"
                              />

                              <div className="text-sm text-gray-600">
                                Multiplier:{' '}
                                {multiplier > 0
                                  ? `${formatNumber(multiplier)}x`
                                  : '-'}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    Select events or search menu names to show candidate recipes.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-gray-900">
                Recipe Order
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                This order is used for CSV and Recipe Book.
              </p>

              <div className="mt-4 space-y-3">
                {activeRecipes.length ? (
                  activeRecipes.map((recipe, index) => (
                    <div
                      key={recipe.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {index + 1}. {recipe.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {recipe.event_name || '-'} / {recipe.category || '-'}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => moveRecipe(recipe.id, 'up')}
                          disabled={index === 0}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRecipe(recipe.id, 'down')}
                          disabled={index === activeRecipes.length - 1}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    Checked recipes will appear here.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Scaled Ingredient List
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Included Recipes: {activeRecipes.length}
                  </p>
                </div>

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
                        <th className="px-3 py-2">Event</th>
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
                          key={`${row.eventName}-${row.recipeName}-${row.ingredientName}-${index}`}
                          className="border-b border-gray-100"
                        >
                          <td className="px-3 py-2">{row.eventName}</td>
                          <td className="px-3 py-2">{row.recipeName}</td>
                          <td className="px-3 py-2">{row.sectionName}</td>
                          <td className="px-3 py-2">{row.ingredientName}</td>
                          <td className="px-3 py-2">
                            {formatNumber(row.quantity)}
                          </td>
                          <td className="px-3 py-2">{row.unit}</td>
                          <td className="px-3 py-2">{row.usUnit || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    Check recipes and enter target servings to see scaled ingredients.
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
                          <td className="px-3 py-2">
                            {formatNumber(row.quantity)}
                          </td>
                          <td className="px-3 py-2">{row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    Aggregated totals will appear here after checked recipes have target servings.
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