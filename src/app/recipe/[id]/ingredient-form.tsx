'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Props = {
  recipeId: string
}

type IngredientSuggestion = {
  id: string
  name: string
  default_unit: string | null
}

export default function IngredientForm({ recipeId }: Props) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const [sectionName, setSectionName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([])
  const [showSectionSuggestions, setShowSectionSuggestions] = useState(false)

  const ingredientWrapperRef = useRef<HTMLDivElement | null>(null)
  const sectionWrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ingredientWrapperRef.current &&
        !ingredientWrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }

      if (
        sectionWrapperRef.current &&
        !sectionWrapperRef.current.contains(event.target as Node)
      ) {
        setShowSectionSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const searchIngredients = async (keyword: string) => {
    const trimmedKeyword = keyword.trim()

    if (trimmedKeyword.length < 1) {
      setSuggestions([])
      return
    }

    setIsSearching(true)

    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, default_unit')
      .ilike('name', `%${trimmedKeyword}%`)
      .order('name', { ascending: true })
      .limit(5)

    if (error) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    setSuggestions(data || [])
    setIsSearching(false)
  }

  const searchSectionSuggestions = async (keyword: string) => {
    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      setSectionSuggestions([])
      return
    }

    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('section_name')
      .ilike('section_name', `%${trimmedKeyword}%`)
      .limit(20)

    if (error || !data) {
      setSectionSuggestions([])
      return
    }

    const uniqueValues = Array.from(
      new Set(
        (data as { section_name: string | null }[])
          .map((row) => row.section_name)
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => value.trim())
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 5)

    setSectionSuggestions(uniqueValues)
  }

  const handleNameChange = async (value: string) => {
    setName(value)
    setShowSuggestions(true)
    await searchIngredients(value)
  }

  const handleSectionChange = async (value: string) => {
    setSectionName(value)

    if (!value.trim()) {
      setSectionSuggestions([])
      setShowSectionSuggestions(false)
      return
    }

    await searchSectionSuggestions(value)
    setShowSectionSuggestions(true)
  }

  const handleSelectSuggestion = (ingredient: IngredientSuggestion) => {
    setName(ingredient.name)
    if (ingredient.default_unit) {
      setUnit(ingredient.default_unit)
    }
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    const parsedQuantity = Number(quantity)
    const trimmedSectionName = sectionName.trim()

    if (!trimmedName) {
      setMessage('Ingredient name is required.')
      return
    }

    if (!parsedQuantity || parsedQuantity <= 0) {
      setMessage('Quantity must be greater than 0.')
      return
    }

    setLoading(true)
    setMessage('Saving...')

    try {
      const { data: existingIngredient, error: findError } = await supabase
        .from('ingredients')
        .select('id, name')
        .eq('name', trimmedName)
        .maybeSingle()

      if (findError) {
        setMessage(`Error: ${findError.message}`)
        setLoading(false)
        return
      }

      let ingredientId = existingIngredient?.id

      if (!ingredientId) {
        const { data: newIngredient, error: insertIngredientError } =
          await supabase
            .from('ingredients')
            .insert({
              name: trimmedName,
              default_unit: unit,
            })
            .select('id')
            .single()

        if (insertIngredientError) {
          setMessage(`Error: ${insertIngredientError.message}`)
          setLoading(false)
          return
        }

        ingredientId = newIngredient.id
      }

      const { error: recipeIngredientError } = await supabase
        .from('recipe_ingredients')
        .insert({
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          quantity: parsedQuantity,
          unit,
          section_name: trimmedSectionName || null,
        })

      if (recipeIngredientError) {
        setMessage(`Error: ${recipeIngredientError.message}`)
        setLoading(false)
        return
      }

      setMessage('Ingredient added successfully.')
      setName('')
      setQuantity('')
      setUnit('g')
      setSectionName('')
      setSuggestions([])
      setShowSuggestions(false)
      setSectionSuggestions([])
      setShowSectionSuggestions(false)

      window.location.reload()
    } catch {
      setMessage('Unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">Add Ingredient</h2>
        <p className="text-sm text-gray-500">
          Add a new ingredient to this recipe.
        </p>
      </div>

      <div ref={sectionWrapperRef} className="relative">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Section Name
        </label>
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={sectionName}
          onChange={(e) => handleSectionChange(e.target.value)}
          onFocus={() => {
            if (sectionSuggestions.length > 0) {
              setShowSectionSuggestions(true)
            }
          }}
          placeholder="e.g. Egg Mixture / Filling / Topping"
        />

        {showSectionSuggestions && sectionName.trim().length > 0 && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
            {sectionSuggestions.length > 0 ? (
              <div className="max-h-64 overflow-y-auto py-1">
                {sectionSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setSectionName(suggestion)
                      setShowSectionSuggestions(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching sections. You can add a new one.
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={ingredientWrapperRef} className="relative">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Ingredient Name
        </label>
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          placeholder="e.g. Salt"
          required
        />

        {showSuggestions && name.trim().length > 0 && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
            {isSearching ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                Searching...
              </div>
            ) : suggestions.length > 0 ? (
              <div className="max-h-64 overflow-y-auto py-1">
                {suggestions.map((ingredient) => (
                  <button
                    key={ingredient.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(ingredient)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-800">
                      {ingredient.name}
                    </span>
                    <span className="text-gray-500">
                      {ingredient.default_unit || '-'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching ingredients. You can add this as a new one.
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Quantity
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="e.g. 10"
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Unit
        </label>
        <select
          className="w-full h-[42px] rounded-xl border border-gray-300 px-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="ml">ml</option>
          <option value="L">L</option>
          <option value="lb">lb</option>
          <option value="gal">gal</option>
          <option value="pcs">pcs</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          {loading ? 'Saving...' : 'Add Ingredient'}
        </button>

        {message && <div className="text-sm text-gray-500">{message}</div>}
      </div>
    </form>
  )
}