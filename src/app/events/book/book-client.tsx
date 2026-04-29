'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

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

type LinkedRecipeInfo = {
  id: string
  name: string
  base_servings: number
  recipe_ingredients: RecipeIngredient[]
  recipe_steps: RecipeStep[]
  parent_sub_recipes?: RecipeSubRecipe[]
}

type RecipeSubRecipe = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  sub_recipe: LinkedRecipeInfo | LinkedRecipeInfo[] | null
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
  parent_sub_recipes?: RecipeSubRecipe[]
}

type EventBuilder = {
  id: string
  name: string
  selected_events: string[] | null
  selected_recipe_ids: string[] | null
  target_servings: Record<string, string> | null
  recipe_order: string[] | null
}

type LinkedRecipeBookPage = {
  linkedRecipe: LinkedRecipeInfo
  canonicalUnit: string
  totalRequiredCanonical: number
  displayRequired: {
    value: number
    unit: string
  }
  multiplier: number
  usedBy: {
    parentRecipeName: string
    requiredQuantity: number
    unit: string
    sectionName: string
  }[]
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function roundUpToHalf(value: number) {
  return Math.ceil(value * 2) / 2
}

function normalizeSectionName(value: string | null) {
  return value?.trim() || 'Other'
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
  if (unit === 'g' && value >= 1000) return { value: value / 1000, unit: 'kg' }
  if (unit === 'ml' && value >= 1000) return { value: value / 1000, unit: 'L' }
  return { value, unit }
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Recipe'
}

function getIngredient(row: RecipeIngredient) {
  return Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients
}

function getLinkedRecipe(row: RecipeSubRecipe) {
  return Array.isArray(row.sub_recipe) ? row.sub_recipe[0] : row.sub_recipe
}

function groupSteps(steps: RecipeStep[]) {
  const groups = new Map<
    string,
    {
      section: string
      sectionOrder: number
      steps: RecipeStep[]
    }
  >()

  steps.forEach((step) => {
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
}

export default function BookClient({ recipes }: { recipes: Recipe[] }) {
  const searchParams = useSearchParams()
  const builderIdFromUrl = searchParams.get('builder') || ''

  const eventNames = useMemo(() => {
    return Array.from(
      new Set(
        recipes
          .map((r) => r.event_name?.trim())
          .filter((v): v is string => Boolean(v))
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
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [builderName, setBuilderName] = useState('')
  const [isLoadingBuilder, setIsLoadingBuilder] = useState(false)

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

  const selectedRecipes = useMemo(() => {
    const checkedRecipes = recipes.filter((recipe) =>
      selectedRecipeIds.includes(recipe.id)
    )

    const orderMap = new Map(recipeOrder.map((id, index) => [id, index]))

    return checkedRecipes.sort((a, b) => {
      const aOrder = orderMap.has(a.id)
        ? orderMap.get(a.id)!
        : Number.MAX_SAFE_INTEGER
      const bOrder = orderMap.has(b.id)
        ? orderMap.get(b.id)!
        : Number.MAX_SAFE_INTEGER

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

  useEffect(() => {
    const loadBuilderFromUrl = async () => {
      if (!builderIdFromUrl) return

      setIsLoadingBuilder(true)

      const { data, error } = await supabase
        .from('event_builders')
        .select('*')
        .eq('id', builderIdFromUrl)
        .single()

      if (error) {
        alert(`Failed to load Event Builder: ${error.message}`)
        setIsLoadingBuilder(false)
        return
      }

      const builder = data as EventBuilder

      setBuilderName(builder.name)
      setSelectedEvents(builder.selected_events || [])
      setSelectedRecipeIds(builder.selected_recipe_ids || [])
      setRecipeOrder(builder.recipe_order || builder.selected_recipe_ids || [])
      setTargets(builder.target_servings || {})
      setMenuSearch('')
      setCategoryFilter('')
      setDefaultTarget('')
      setIsLoadingBuilder(false)
    }

    loadBuilderFromUrl()
  }, [builderIdFromUrl])

  const selectedEventLabel =
    selectedEvents.length === 0
      ? 'Select events'
      : selectedEvents.length === 1
        ? selectedEvents[0]
        : `${selectedEvents.length} events selected`

  const bookTitle =
    builderName ||
    (selectedEvents.length > 0
      ? selectedEvents.join(' + ')
      : selectedRecipes.length > 0
        ? 'Custom Event'
        : 'Event Recipe Book')

  const linkedRecipePages = useMemo(() => {
  const map = new Map<
    string,
    {
      linkedRecipe: LinkedRecipeInfo
      canonicalUnit: string
      totalRequiredCanonical: number
      usedBy: LinkedRecipeBookPage['usedBy']
    }
  >()

  const addLinkedRecipe = (
    linkedRecipe: LinkedRecipeInfo,
    requiredQuantity: number,
    unit: string,
    parentRecipeName: string,
    sectionName: string
  ) => {
    const normalized = normalizeForAggregation(requiredQuantity, unit)

    // 🔥 同じレシピは1つに統一
    const key = linkedRecipe.id
    const existing = map.get(key)

    if (existing) {
      existing.totalRequiredCanonical += normalized.value

      existing.usedBy.push({
        parentRecipeName,
        requiredQuantity,
        unit,
        sectionName,
      })
    } else {
      map.set(key, {
        linkedRecipe,
        canonicalUnit: normalized.unit,
        totalRequiredCanonical: normalized.value,
        usedBy: [
          {
            parentRecipeName,
            requiredQuantity,
            unit,
            sectionName,
          },
        ],
      })
    }
  }

  const expandLinks = (
    recipe: Recipe | LinkedRecipeInfo,
    parentMultiplier: number,
    parentRecipeName: string,
    depth: number,
    visitedRecipeIds: Set<string>
  ) => {
    if (depth > 3) return

    recipe.parent_sub_recipes?.forEach((link) => {
      const linkedRecipe = getLinkedRecipe(link)
      if (!linkedRecipe) return
      if (visitedRecipeIds.has(linkedRecipe.id)) return

      const requiredQuantity = link.quantity * parentMultiplier

      addLinkedRecipe(
        linkedRecipe,
        requiredQuantity,
        link.unit,
        parentRecipeName,
        normalizeSectionName(link.section_name)
      )

      const normalized = normalizeForAggregation(requiredQuantity, link.unit)

      const linkedMultiplier =
        linkedRecipe.base_servings > 0
          ? roundUpToHalf(normalized.value / linkedRecipe.base_servings)
          : 1

      const nextVisited = new Set(visitedRecipeIds)
      nextVisited.add(linkedRecipe.id)

      expandLinks(
        linkedRecipe,
        linkedMultiplier,
        linkedRecipe.name,
        depth + 1,
        nextVisited
      )
    })
  }

  selectedRecipes.forEach((recipe) => {
    const target = Number(targets[recipe.id]) || 0

    const parentMultiplier =
      target && recipe.base_servings
        ? roundUpToHalf(target / recipe.base_servings)
        : 1

    expandLinks(recipe, parentMultiplier, recipe.name, 1, new Set([recipe.id]))
  })

  return Array.from(map.values())
    .map((item) => {
      const displayRequired = displayNormalizedUnit(
        item.totalRequiredCanonical,
        item.canonicalUnit
      )

      const multiplier =
        item.linkedRecipe.base_servings > 0
          ? roundUpToHalf(
              item.totalRequiredCanonical / item.linkedRecipe.base_servings
            )
          : 1

      // 🔥 子のLinkedもここで計算（これが今足りてない）
      const linkedRecipesUsed =
        item.linkedRecipe.parent_sub_recipes?.map((link) => {
          const nested = getLinkedRecipe(link)

          return {
            name: nested?.name || '',
            requiredQuantity: link.quantity * multiplier,
            unit: link.unit,
            sectionName: normalizeSectionName(link.section_name),
          }
        }) || []

      return {
        linkedRecipe: item.linkedRecipe,
        canonicalUnit: item.canonicalUnit,
        totalRequiredCanonical: item.totalRequiredCanonical,
        displayRequired,
        multiplier,
        usedBy: item.usedBy,
        linkedRecipesUsed,
      }
    })
    .sort((a, b) => a.linkedRecipe.name.localeCompare(b.linkedRecipe.name))
}, [selectedRecipes, targets])

  const aggregatedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        ingredientName: string
        canonicalUnit: string
        quantity: number
      }
    >()

    const addToMap = (ingredientName: string, quantity: number, unit: string) => {
      const normalized = normalizeForAggregation(quantity, unit)
      const key = `${ingredientName}__${normalized.unit}`
      const existing = map.get(key)

      if (existing) {
        existing.quantity += normalized.value
      } else {
        map.set(key, {
          ingredientName,
          canonicalUnit: normalized.unit,
          quantity: normalized.value,
        })
      }
    }

    selectedRecipes.forEach((recipe) => {
      const target = Number(targets[recipe.id]) || 0
      const multiplier =
        target && recipe.base_servings
          ? roundUpToHalf(target / recipe.base_servings)
          : 1

      recipe.recipe_ingredients.forEach((ing) => {
        const ingredient = getIngredient(ing)
        if (!ingredient) return

        addToMap(ingredient.name, ing.quantity * multiplier, ing.unit)
      })
    })

    linkedRecipePages.forEach((page) => {
      page.linkedRecipe.recipe_ingredients.forEach((ing) => {
        const ingredient = getIngredient(ing)
        if (!ingredient) return

        addToMap(ingredient.name, ing.quantity * page.multiplier, ing.unit)
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
  }, [selectedRecipes, targets, linkedRecipePages])

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
    if (checked) addRecipeIds([recipeId])
    else removeRecipeIds([recipeId])
  }

  const moveRecipe = (recipeId: string, direction: 'up' | 'down') => {
    setRecipeOrder((prev) => {
      const currentOrder = selectedRecipes.map((recipe) => recipe.id)
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

  const handleTarget = (id: string, value: string) => {
    setTargets((prev) => ({ ...prev, [id]: value }))
  }

  const applyDefaultTargetToAll = () => {
    if (!defaultTarget) return

    const nextTargets: Record<string, string> = {}

    selectedRecipes.forEach((recipe) => {
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

  const handleDownloadExcel = () => {
    if (!selectedRecipes.length) {
      alert('Please select at least one recipe.')
      return
    }

    const workbook = XLSX.utils.book_new()

    const coverRows: (string | number)[][] = [
      ['KC Craft Ramen'],
      ['Event Recipe Book'],
      [],
      ['Book Title', bookTitle],
      ['Parent Recipes', selectedRecipes.length],
      ['Linked Recipes', linkedRecipePages.length],
      ['Generated At', new Date().toLocaleString()],
      [],
      ['Parent Recipe Order'],
      ['#', 'Recipe', 'Event', 'Category', 'Target Servings'],
      ...selectedRecipes.map((recipe, index) => [
        index + 1,
        recipe.name,
        recipe.event_name || '-',
        recipe.category || '-',
        targets[recipe.id] || '-',
      ]),
      [],
      ['Linked Recipes'],
      ['#', 'Linked Recipe', 'Total Required', 'Unit', 'Multiplier'],
      ...linkedRecipePages.map((page, index) => [
        index + 1,
        page.linkedRecipe.name,
        formatNumber(page.displayRequired.value),
        page.displayRequired.unit,
        formatNumber(page.multiplier),
      ]),
    ]

    const coverSheet = XLSX.utils.aoa_to_sheet(coverRows)
    coverSheet['!cols'] = [
      { wch: 8 },
      { wch: 34 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(workbook, coverSheet, 'Cover')

    selectedRecipes.forEach((recipe, recipeIndex) => {
      const target = Number(targets[recipe.id]) || 0
      const multiplier =
        target && recipe.base_servings
          ? roundUpToHalf(target / recipe.base_servings)
          : 1

      const rows: (string | number)[][] = []

      rows.push(['Recipe Name', recipe.name])
      rows.push(['Category', recipe.category || '-'])
      rows.push(['Author', recipe.author || '-'])
      rows.push(['Usage Type', usageTypeLabel(recipe.usage_type)])
      rows.push(['Event Name', recipe.event_name || '-'])
      rows.push(['Base Servings', recipe.base_servings])
      rows.push(['Target Servings', target || '-'])
      rows.push(['Multiplier', formatNumber(multiplier)])
      rows.push([])
      rows.push(['Ingredients'])
      rows.push(['Section', 'Ingredient', 'Quantity', 'Unit'])

      recipe.recipe_ingredients.forEach((ing) => {
        const ingredient = getIngredient(ing)

        rows.push([
          normalizeSectionName(ing.section_name),
          ingredient?.name || '',
          formatNumber(ing.quantity * multiplier),
          ing.unit,
        ])
      })

      if (recipe.parent_sub_recipes && recipe.parent_sub_recipes.length > 0) {
        rows.push([])
        rows.push(['Linked Recipes Used'])
        rows.push(['Linked Recipe', 'Required Quantity', 'Unit', 'Section'])

        recipe.parent_sub_recipes.forEach((link) => {
          const linkedRecipe = getLinkedRecipe(link)
          if (!linkedRecipe) return

          rows.push([
            linkedRecipe.name,
            formatNumber(link.quantity * multiplier),
            link.unit,
            normalizeSectionName(link.section_name),
          ])
        })
      }

      rows.push([])
      rows.push(['Steps'])
      rows.push(['Section', 'Step Number', 'Instruction'])

      recipe.recipe_steps
        .slice()
        .sort((a, b) => {
          const sectionA = a.section_order ?? Number.MAX_SAFE_INTEGER
          const sectionB = b.section_order ?? Number.MAX_SAFE_INTEGER

          if (sectionA !== sectionB) return sectionA - sectionB
          return a.step_number - b.step_number
        })
        .forEach((step) => {
          rows.push([
            normalizeSectionName(step.section_name),
            step.step_number,
            step.instruction,
          ])
        })

      if (recipe.notes) {
        rows.push([])
        rows.push(['Notes'])
        rows.push([recipe.notes])
      }

      const worksheet = XLSX.utils.aoa_to_sheet(rows)
      worksheet['!cols'] = [
        { wch: 22 },
        { wch: 34 },
        { wch: 14 },
        { wch: 14 },
        { wch: 80 },
      ]

      const sheetName = safeSheetName(`${recipeIndex + 1}. ${recipe.name}`)
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    })

    linkedRecipePages.forEach((page, index) => {
      const rows: (string | number)[][] = []

      rows.push(['Linked Recipe Name', page.linkedRecipe.name])
      rows.push([
        'Total Required',
        formatNumber(page.displayRequired.value),
        page.displayRequired.unit,
      ])
      rows.push(['Base Servings', page.linkedRecipe.base_servings])
      rows.push(['Multiplier', formatNumber(page.multiplier)])
      rows.push([])
      rows.push(['Used By'])
      rows.push(['Parent Recipe', 'Required Quantity', 'Unit', 'Section'])

      page.usedBy.forEach((usage) => {
        rows.push([
          usage.parentRecipeName,
          formatNumber(usage.requiredQuantity),
          usage.unit,
          usage.sectionName,
        ])
      })

      rows.push([])
      rows.push(['Ingredients'])
      rows.push(['Section', 'Ingredient', 'Quantity', 'Unit'])

      page.linkedRecipe.recipe_ingredients.forEach((ing) => {
        const ingredient = getIngredient(ing)

        rows.push([
          normalizeSectionName(ing.section_name),
          ingredient?.name || '',
          formatNumber(ing.quantity * page.multiplier),
          ing.unit,
        ])
      })

      rows.push([])
      rows.push(['Steps'])
      rows.push(['Section', 'Step Number', 'Instruction'])

      page.linkedRecipe.recipe_steps
        .slice()
        .sort((a, b) => {
          const sectionA = a.section_order ?? Number.MAX_SAFE_INTEGER
          const sectionB = b.section_order ?? Number.MAX_SAFE_INTEGER

          if (sectionA !== sectionB) return sectionA - sectionB
          return a.step_number - b.step_number
        })
        .forEach((step) => {
          rows.push([
            normalizeSectionName(step.section_name),
            step.step_number,
            step.instruction,
          ])
        })

      const worksheet = XLSX.utils.aoa_to_sheet(rows)
      worksheet['!cols'] = [
        { wch: 24 },
        { wch: 36 },
        { wch: 16 },
        { wch: 16 },
        { wch: 80 },
      ]

      const sheetName = safeSheetName(
        `${selectedRecipes.length + index + 1}. ${page.linkedRecipe.name}`
      )
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    })

    const totalsRows: (string | number)[][] = [
      ['Ingredient', 'Total Quantity', 'Unit'],
      ...aggregatedRows.map((row) => [
        row.ingredientName,
        formatNumber(row.quantity),
        row.unit,
      ]),
    ]

    const totalsSheet = XLSX.utils.aoa_to_sheet(totalsRows)
    totalsSheet['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(workbook, totalsSheet, 'Aggregated Totals')

    XLSX.writeFile(workbook, `${safeSheetName(bookTitle)}.xlsx`)
  }

  return (
    <div className="bg-white text-black print:bg-white">
      <div className="space-y-6 p-6 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Back to Recipes
              </Link>

              <Link
                href="/events"
                className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Back to Event Summary
              </Link>
            </div>

            <h1 className="text-2xl font-bold">Event Recipe Book</h1>
            <p className="mt-1 text-sm text-gray-600">
              Linked recipes are shown as separate recipe pages with combined required quantities.
            </p>
            {isLoadingBuilder ? (
              <p className="mt-2 text-sm text-gray-500">Loading builder...</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={!selectedRecipes.length}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download Excel
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!selectedRecipes.length}
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900">
              Book Settings
            </h2>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="font-semibold">Current Book</div>
                <div className="mt-1">{bookTitle}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Parent Recipes: {selectedRecipes.length} / Linked Recipes:{' '}
                  {linkedRecipePages.length}
                </div>
              </div>

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
                    disabled={!selectedRecipes.length}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Apply All
                  </button>
                </div>
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
                  Checked recipes will be included in the recipe book, PDF, and Excel.
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

            <div className="mt-4 max-h-[520px] space-y-4 overflow-auto pr-2">
              {visibleRecipes.length ? (
                visibleRecipes.map((recipe) => {
                  const isChecked = selectedRecipeIds.includes(recipe.id)
                  const target = Number(targets[recipe.id])
                  const multiplier =
                    target && recipe.base_servings
                      ? roundUpToHalf(target / recipe.base_servings)
                      : 1

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

                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                            Multiplier x{formatNumber(multiplier)}
                          </span>
                        </div>

                        {isChecked && (
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              Target Servings
                            </label>

                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 40"
                              value={targets[recipe.id] || ''}
                              onChange={(e) =>
                                handleTarget(recipe.id, e.target.value)
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
                            />
                          </div>
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

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900">
            Recipe Order
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            This order is used for parent recipes. Linked recipes are automatically added after parent recipes.
          </p>

          <div className="mt-4 space-y-3">
            {selectedRecipes.length ? (
              selectedRecipes.map((recipe, index) => (
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
                      disabled={index === selectedRecipes.length - 1}
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
      </div>

      <div className="p-10 text-center page-break">
        <h1 className="text-4xl font-bold">{bookTitle}</h1>
        <p className="mt-4 text-lg">Recipe Book</p>
        <p className="mt-3 text-sm text-gray-600">
          Parent Recipes: {selectedRecipes.length} / Linked Recipes:{' '}
          {linkedRecipePages.length}
        </p>
      </div>

      {selectedRecipes.map((recipe) => {
        const target = Number(targets[recipe.id]) || 0
        const multiplier =
          target && recipe.base_servings
            ? roundUpToHalf(target / recipe.base_servings)
            : 1

        const groupedIngredients = recipe.recipe_ingredients.reduce(
          (acc: Record<string, RecipeIngredient[]>, ing) => {
            const section = normalizeSectionName(ing.section_name)
            if (!acc[section]) acc[section] = []
            acc[section].push(ing)
            return acc
          },
          {}
        )

        const groupedSteps = groupSteps(recipe.recipe_steps)

        return (
          <div key={recipe.id} className="p-10 page-break">
            <div>
              <h2 className="text-2xl font-bold">{recipe.name}</h2>
              <div className="mt-2 space-y-1 text-sm">
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
                        const ingredient = getIngredient(ing)

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

              {recipe.parent_sub_recipes && recipe.parent_sub_recipes.length > 0 ? (
  <div className="mt-5">
    <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
      Linked Recipes
    </div>

    <div className="space-y-1">
      {recipe.parent_sub_recipes.map((link) => {
        const linkedRecipe = getLinkedRecipe(link)
        if (!linkedRecipe) return null

        return (
          <div key={link.id} className="text-sm">
            {linkedRecipe.name} — {formatNumber(link.quantity * multiplier)}{' '}
            {link.unit}
            {' / Section: '}
            {normalizeSectionName(link.section_name)}
          </div>
        )
      })}
    </div>
  </div>
) : null}
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
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {recipe.notes}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}

      {linkedRecipePages.map((page) => {
        const groupedIngredients = page.linkedRecipe.recipe_ingredients.reduce(
          (acc: Record<string, RecipeIngredient[]>, ing) => {
            const section = normalizeSectionName(ing.section_name)
            if (!acc[section]) acc[section] = []
            acc[section].push(ing)
            return acc
          },
          {}
        )
        const groupedLinkedRecipesUsed = page.linkedRecipesUsed.reduce(
  (acc: Record<string, typeof page.linkedRecipesUsed>, link) => {
    const section = normalizeSectionName(link.sectionName)
    if (!acc[section]) acc[section] = []
    acc[section].push(link)
    return acc
  },
  {}
)
        const groupedSteps = groupSteps(page.linkedRecipe.recipe_steps)

        return (
          <div key={`${page.linkedRecipe.id}-${page.canonicalUnit}`} className="p-10 page-break">
            <div>
              <h2 className="text-2xl font-bold">{page.linkedRecipe.name}</h2>
              <div className="mt-2 space-y-1 text-sm">
                <div>Type: Linked Recipe</div>
                <div>
                  Total Required: {formatNumber(page.displayRequired.value)}{' '}
                  {page.displayRequired.unit}
                </div>
                <div>Base Servings: {page.linkedRecipe.base_servings}</div>
                <div>Multiplier: x{formatNumber(page.multiplier)}</div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-bold">Used By</h3>

              <div className="mt-3 space-y-1 text-sm">
                {page.usedBy.map((usage, index) => (
                  <div key={`${usage.parentRecipeName}-${index}`}>
                    {usage.parentRecipeName} —{' '}
                    {formatNumber(usage.requiredQuantity)} {usage.unit}
                    {' / Section: '}
                    {usage.sectionName}
                  </div>
                ))}
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
                        const qty = ing.quantity * page.multiplier
                        const ingredient = getIngredient(ing)

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
             {page.linkedRecipesUsed.length > 0 ? (
  <div className="mt-5 space-y-5">
    {Object.entries(groupedLinkedRecipesUsed).map(([section, links]) => (
      <div key={section}>
        <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          {section}
        </div>

        <div className="space-y-1">
          {links.map((link, index) => (
            <div key={`${link.name}-${index}`} className="text-sm">
              {link.name} — {formatNumber(link.requiredQuantity)} {link.unit}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
) : null}
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
          </div>
        )
      })}

      <div className="p-10 page-break">
        <h2 className="text-2xl font-bold">Aggregated Ingredient Totals</h2>
        <p className="mt-2 text-sm text-gray-600">
          Combined totals for checked parent recipes and linked recipes.
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