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
      // 1) 既存の材料を探す
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

      // 2) なければ新規作成
      if (!ingredientId) {
        const { data: newIngredient, error: insertIngredientError } = await supabase
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

      // 3) recipe_ingredients に追加
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
    } catch (error) {
      setMessage('Unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-3">
      <h2 className="text-lg font-semibold">Add Ingredient</h2>

      <div>
        <label className="block text-sm mb-1">Ingredient Name</label>
        <input
          className="border rounded px-3 py-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Salt"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Quantity</label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="border rounded px-3 py-2 w-full"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="e.g. 10"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Unit</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="ml">ml</option>
          <option value="L">L</option>
          <option value="lb">lb</option>
          <option value="gal">gal</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded"
      >
        {loading ? 'Saving...' : 'Add Ingredient'}
      </button>

      {message && <div className="text-sm">{message}</div>}
    </form>
  )
}