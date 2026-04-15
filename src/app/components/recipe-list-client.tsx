'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type Recipe = {
  id: string
  name: string
  category: string | null
  base_servings: number
  notes: string | null
  usage_type: string | null
  event_name: string | null
}

type Props = {
  recipes: Recipe[]
}

function usageTypeLabel(value: string | null) {
  switch (value) {
    case 'regular':
      return 'Regular Menu'
    case 'event':
      return 'Event'
    case 'seasonal':
      return 'Seasonal'
    case 'prep':
      return 'Prep Only'
    case 'test':
      return 'Test'
    default:
      return value || '-'
  }
}

export default function RecipeListClient({ recipes }: Props) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [usageTypeFilter, setUsageTypeFilter] = useState('')
  const [eventSearch, setEventSearch] = useState('')

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        recipes
          .map((recipe) => recipe.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    )

    return uniqueCategories.sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const usageTypes = useMemo(() => {
    const uniqueUsageTypes = Array.from(
      new Set(
        recipes
          .map((recipe) => recipe.usage_type?.trim())
          .filter((usageType): usageType is string => Boolean(usageType))
      )
    )

    return uniqueUsageTypes.sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch = recipe.name
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesCategory = categoryFilter
        ? recipe.category === categoryFilter
        : true

      const matchesUsageType = usageTypeFilter
        ? recipe.usage_type === usageTypeFilter
        : true

      const matchesEvent = eventSearch
        ? (recipe.event_name || '')
            .toLowerCase()
            .includes(eventSearch.toLowerCase())
        : true

      return (
        matchesSearch &&
        matchesCategory &&
        matchesUsageType &&
        matchesEvent
      )
    })
  }, [recipes, search, categoryFilter, usageTypeFilter, eventSearch])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">Search Recipes</h2>
        <p className="text-sm text-gray-500">
          Filter by name, category, usage type, or event name.
        </p>
      </div>

      <section className="grid gap-4 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Search by recipe name
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. wagyu"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Filter by category
          </label>
          <select
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Filter by usage type
          </label>
          <select
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={usageTypeFilter}
            onChange={(e) => setUsageTypeFilter(e.target.value)}
          >
            <option value="">All usage types</option>
            {usageTypes.map((usageType) => (
              <option key={usageType} value={usageType}>
                {usageTypeLabel(usageType)}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Search by event name
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="e.g. Wagyu"
          />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Results
        </h3>
        <p className="text-sm text-gray-500">
          {filteredRecipes.length} recipe{filteredRecipes.length === 1 ? '' : 's'}
        </p>
      </div>

      <section className="space-y-3">
        {filteredRecipes.length ? (
          filteredRecipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="block">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-gray-900">
                      {recipe.name}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {recipe.category || 'No category'}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {usageTypeLabel(recipe.usage_type)}
                      </span>
                      {recipe.event_name ? (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {recipe.event_name}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-gray-500">
                      {recipe.notes || 'No notes'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs uppercase tracking-wide text-gray-400">
                      Base Servings
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {recipe.base_servings}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No matching recipes found.
          </div>
        )}
      </section>
    </div>
  )
}