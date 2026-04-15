'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type SuggestionField = 'category' | 'event_name' | 'author'

export default function RecipeForm() {
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('')
  const [baseServings, setBaseServings] = useState('1')
  const [notes, setNotes] = useState('')
  const [usageType, setUsageType] = useState('regular')
  const [eventName, setEventName] = useState('')
  const [message, setMessage] = useState('')

  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])
  const [eventSuggestions, setEventSuggestions] = useState<string[]>([])
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([])

  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const [showEventSuggestions, setShowEventSuggestions] = useState(false)
  const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false)

  const categoryRef = useRef<HTMLDivElement | null>(null)
  const eventRef = useRef<HTMLDivElement | null>(null)
  const authorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryRef.current &&
        !categoryRef.current.contains(event.target as Node)
      ) {
        setShowCategorySuggestions(false)
      }

      if (
        eventRef.current &&
        !eventRef.current.contains(event.target as Node)
      ) {
        setShowEventSuggestions(false)
      }

      if (
        authorRef.current &&
        !authorRef.current.contains(event.target as Node)
      ) {
        setShowAuthorSuggestions(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('Saving...')

    const { error } = await supabase.from('recipes').insert({
      name,
      author: author.trim() || null,
      category: category.trim() || null,
      base_servings: Number(baseServings),
      notes,
      usage_type: usageType,
      event_name: eventName.trim() || null,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }

    setMessage('Saved successfully.')
    setName('')
    setAuthor('')
    setCategory('')
    setBaseServings('1')
    setNotes('')
    setUsageType('regular')
    setEventName('')

    setCategorySuggestions([])
    setEventSuggestions([])
    setAuthorSuggestions([])

    setShowCategorySuggestions(false)
    setShowEventSuggestions(false)
    setShowAuthorSuggestions(false)

    window.location.reload()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">Add Recipe</h2>
        <p className="text-sm text-gray-500">
          Create a new recipe for regular menu items, events, or prep-only use.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Recipe Name
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wagyu Kaeshi"
            required
          />
        </div>

        <div ref={authorRef} className="relative">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Author
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={author}
            onChange={(e) => handleAuthorChange(e.target.value)}
            onFocus={() => {
              if (authorSuggestions.length > 0) {
                setShowAuthorSuggestions(true)
              }
            }}
            placeholder="e.g. Rika"
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
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            onFocus={() => {
              if (categorySuggestions.length > 0) {
                setShowCategorySuggestions(true)
              }
            }}
            placeholder="e.g. Soup Base"
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

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Base Servings
          </label>
          <input
            type="number"
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={baseServings}
            onChange={(e) => setBaseServings(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Usage Type
          </label>
          <select
            className="w-full h-[42px] rounded-xl border border-gray-300 px-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
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
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={eventName}
            onChange={(e) => handleEventChange(e.target.value)}
            onFocus={() => {
              if (eventSuggestions.length > 0) {
                setShowEventSuggestions(true)
              }
            }}
            placeholder="e.g. Wagyu"
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
            Notes
          </label>
          <textarea
            rows={4}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this recipe"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Save Recipe
        </button>

        {message && <p className="text-sm text-gray-500">{message}</p>}
      </div>
    </form>
  )
}