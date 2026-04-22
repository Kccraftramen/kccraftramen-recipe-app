'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Recipe = {
  id: string
  name: string
  author: string | null
  category: string | null
  base_servings: number
  notes: string | null
  usage_type: string | null
  event_name: string | null
}

type SuggestionField = 'author' | 'category' | 'event_name'

type Props = {
  recipe: Recipe
}

export default function RecipeMetaEditor({ recipe }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(recipe.name)
  const [author, setAuthor] = useState(recipe.author || '')
  const [category, setCategory] = useState(recipe.category || '')
  const [usageType, setUsageType] = useState(recipe.usage_type || 'regular')
  const [eventName, setEventName] = useState(recipe.event_name || '')
  const [baseServings, setBaseServings] = useState(String(recipe.base_servings))
  const [notes, setNotes] = useState(recipe.notes || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([])
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])
  const [eventSuggestions, setEventSuggestions] = useState<string[]>([])

  const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false)
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const [showEventSuggestions, setShowEventSuggestions] = useState(false)

  const authorRef = useRef<HTMLDivElement | null>(null)
  const categoryRef = useRef<HTMLDivElement | null>(null)
  const eventRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (authorRef.current && !authorRef.current.contains(event.target as Node)) {
        setShowAuthorSuggestions(false)
      }

      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategorySuggestions(false)
      }

      if (eventRef.current && !eventRef.current.contains(event.target as Node)) {
        setShowEventSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchSuggestions = async (
    field: SuggestionField,
    keyword: string
  ): Promise<string[]> => {
    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) return []

    const { data, error } = await supabase
      .from('recipes')
      .select(field)
      .ilike(field, `%${trimmedKeyword}%`)
      .limit(20)

    if (error || !data) return []

    const uniqueValues = Array.from(
      new Set(
        (data as Record<string, string | null>[])
          .map((row) => row[field])
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => value.trim())
      )
    )

    return uniqueValues.sort((a, b) => a.localeCompare(b)).slice(0, 5)
  }

  const handleAuthorChange = async (value: string) => {
    setAuthor(value)

    if (!value.trim()) {
      setAuthorSuggestions([])
      setShowAuthorSuggestions(false)
      return
    }

    const suggestions = await fetchSuggestions('author', value)
    setAuthorSuggestions(suggestions)
    setShowAuthorSuggestions(true)
  }

  const handleCategoryChange = async (value: string) => {
    setCategory(value)

    if (!value.trim()) {
      setCategorySuggestions([])
      setShowCategorySuggestions(false)
      return
    }

    const suggestions = await fetchSuggestions('category', value)
    setCategorySuggestions(suggestions)
    setShowCategorySuggestions(true)
  }

  const handleEventChange = async (value: string) => {
    setEventName(value)

    if (!value.trim()) {
      setEventSuggestions([])
      setShowEventSuggestions(false)
      return
    }

    const suggestions = await fetchSuggestions('event_name', value)
    setEventSuggestions(suggestions)
    setShowEventSuggestions(true)
  }

  const handleCancel = () => {
    setName(recipe.name)
    setAuthor(recipe.author || '')
    setCategory(recipe.category || '')
    setUsageType(recipe.usage_type || 'regular')
    setEventName(recipe.event_name || '')
    setBaseServings(String(recipe.base_servings))
    setNotes(recipe.notes || '')
    setAuthorSuggestions([])
    setCategorySuggestions([])
    setEventSuggestions([])
    setShowAuthorSuggestions(false)
    setShowCategorySuggestions(false)
    setShowEventSuggestions(false)
    setMessage('')
    setIsEditing(false)
  }

  const handleSave = async () => {
    const parsedBaseServings = Number(baseServings)

    if (!name.trim()) {
      setMessage('Recipe name is required.')
      return
    }

    if (!parsedBaseServings || parsedBaseServings <= 0) {
      setMessage('Base servings must be greater than 0.')
      return
    }

    setLoading(true)
    setMessage('Saving...')

    const updates = {
      name: name.trim(),
      author: author.trim() || null,
      category: category.trim() || null,
      usage_type: usageType || null,
      event_name: eventName.trim() || null,
      base_servings: parsedBaseServings,
      notes: notes.trim() || null,
    }

    const { error } = await supabase
      .from('recipes')
      .update(updates)
      .eq('id', recipe.id)

    if (error) {
      setMessage(`Error: ${error.message}`)
      setLoading(false)
      return
    }

    const logs = []

    if (recipe.name !== updates.name) {
      logs.push({
        recipe_id: recipe.id,
        entity_type: 'recipe',
        action_type: 'update',
        item_name: 'Recipe Name',
        section_name: null,
        before_value: recipe.name,
        after_value: updates.name,
      })
    }

    if ((recipe.author || '') !== (updates.author || '')) {
      logs.push({
        recipe_id: recipe.id,
        entity_type: 'recipe',
        action_type: 'update',
        item_name: 'Author',
        section_name: null,
        before_value: recipe.author,
        after_value: updates.author,
      })
    }

    if ((recipe.category || '') !== (updates.category || '')) {
      logs.push({
        recipe_id: recipe.id,
        entity_type: 'recipe',
        action_type: 'update',
        item_name: 'Category',
        section_name: null,
        before_value: recipe.category,
        after_value: updates.category,
      })
    }

    if ((recipe.usage_type || '') !== (updates.usage_type || '')) {
      logs.push({
        recipe_id: recipe.id,
        entity_type: 'recipe',
        action_type: 'update',
        item_name: 'Usage Type',
        section_name: null,
        before_value: recipe.usage_type,
        after_value: updates.usage_type,
      })
    }

    if ((recipe.event_name || '') !== (updates.event_name || '')) {
      logs.push({
        recipe_id: recipe.id,
        entity_type: 'recipe',
        action_type: 'update',
        item_name: 'Event Name',
        section_name: null,
        before_value: recipe.event_name,
        after_value: updates.event_name,
      })
    }

    if (recipe.base_servings !== updates.base_servings) {
      logs.push({
        recipe_id: recipe.id,
        entity_type: 'recipe',
        action_type: 'update',
        item_name: 'Base Servings',
        section_name: null,
        before_value: String(recipe.base_servings),
        after_value: String(updates.base_servings),
      })
    }

    if ((recipe.notes || '') !== (updates.notes || '')) {
      logs.push({
        recipe_id: recipe.id,
        entity_type: 'recipe',
        action_type: 'update',
        item_name: 'Notes',
        section_name: null,
        before_value: recipe.notes,
        after_value: updates.notes,
      })
    }

    if (logs.length > 0) {
      await supabase.from('recipe_change_logs').insert(logs)
    }

    setLoading(false)
    setIsEditing(false)
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      {!isEditing ? (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              {recipe.name}
            </h1>

            <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
              <div>Author: {recipe.author || '-'}</div>
              <div>Category: {recipe.category || '-'}</div>
              <div>Usage Type: {recipe.usage_type || '-'}</div>
              <div>Event Name: {recipe.event_name || '-'}</div>
              <div>Base Servings: {recipe.base_servings}</div>
            </div>

            <div className="text-sm text-gray-600">
              Notes: {recipe.notes || '-'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Recipe Info
            </h2>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Recipe Name
            </label>
            <input
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div ref={authorRef} className="relative">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Author
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
                value={author}
                onChange={(e) => handleAuthorChange(e.target.value)}
                onFocus={() => {
                  if (authorSuggestions.length > 0) {
                    setShowAuthorSuggestions(true)
                  }
                }}
              />

              {showAuthorSuggestions && author.trim().length > 0 && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                  {authorSuggestions.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {authorSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setAuthor(suggestion)
                            setShowAuthorSuggestions(false)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No matching authors. You can add a new one.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div ref={categoryRef} className="relative">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Category
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                onFocus={() => {
                  if (categorySuggestions.length > 0) {
                    setShowCategorySuggestions(true)
                  }
                }}
              />

              {showCategorySuggestions && category.trim().length > 0 && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                  {categorySuggestions.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {categorySuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setCategory(suggestion)
                            setShowCategorySuggestions(false)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No matching categories. You can add a new one.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Usage Type
              </label>
              <select
                className="w-full h-[42px] rounded-xl border border-gray-300 bg-white px-3 text-sm"
                value={usageType}
                onChange={(e) => setUsageType(e.target.value)}
              >
                <option value="regular">Regular Menu</option>
                <option value="event">Event</option>
                <option value="obento">Obento</option>
                <option value="seasonal">Seasonal</option>
                <option value="prep">Prep Only</option>
              </select>
            </div>

            <div ref={eventRef} className="relative">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Event Name
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
                value={eventName}
                onChange={(e) => handleEventChange(e.target.value)}
                onFocus={() => {
                  if (eventSuggestions.length > 0) {
                    setShowEventSuggestions(true)
                  }
                }}
              />

              {showEventSuggestions && eventName.trim().length > 0 && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                  {eventSuggestions.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {eventSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setEventName(suggestion)
                            setShowEventSuggestions(false)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No matching event names. You can add a new one.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Base Servings
              </label>
              <input
                type="number"
                min="1"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
                value={baseServings}
                onChange={(e) => setBaseServings(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {message && <div className="text-sm text-gray-500">{message}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}