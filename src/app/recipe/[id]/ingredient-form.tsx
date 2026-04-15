'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

type Props = {
  recipeId: string
}

export default function IngredientForm({ recipeId }: Props) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    const parsedQuantity = Number(quantity)

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

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Ingredient Name
        </label>
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Salt"
          required
        />
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