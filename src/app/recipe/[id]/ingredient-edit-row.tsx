'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import IngredientDeleteButton from './ingredient-delete-button'

type IngredientRow = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  recipe_id?: string
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

type Props = {
  row: IngredientRow
  multiplier: number
  formatNumber: (value: number) => string
  convertUnit: (value: number, unit: string) => { value: number; unit: string }
  getUSUnit: (value: number, unit: string) => string | null
}

export default function IngredientEditRow({
  row,
  multiplier,
  formatNumber,
  convertUnit,
  getUSUnit,
}: Props) {
  const ingredient = Array.isArray(row.ingredients)
    ? row.ingredients[0]
    : row.ingredients

  const [isEditing, setIsEditing] = useState(false)
  const [quantity, setQuantity] = useState(String(row.quantity))
  const [unit, setUnit] = useState(row.unit)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const scaledQuantity = row.quantity * multiplier
  const converted = convertUnit(scaledQuantity, row.unit)
  const usUnit = getUSUnit(converted.value, converted.unit)

  const handleSave = async () => {
    const parsedQuantity = Number(quantity)

    if (!parsedQuantity || parsedQuantity <= 0) {
      setMessage('Quantity must be greater than 0.')
      return
    }

    setLoading(true)
    setMessage('Saving...')

    const beforeValue = `${row.quantity} ${row.unit}`
    const afterValue = `${parsedQuantity} ${unit}`

    const { data: recipeIngredientRow, error: readError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, section_name')
      .eq('id', row.id)
      .single()

    if (readError) {
      setMessage(`Error: ${readError.message}`)
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('recipe_ingredients')
      .update({
        quantity: parsedQuantity,
        unit,
      })
      .eq('id', row.id)

    if (error) {
      setMessage(`Error: ${error.message}`)
      setLoading(false)
      return
    }

    await supabase.from('recipe_change_logs').insert({
      recipe_id: recipeIngredientRow.recipe_id,
      entity_type: 'ingredient',
      action_type: 'update',
      item_name: ingredient?.name || 'Ingredient',
      section_name: recipeIngredientRow.section_name,
      before_value: beforeValue,
      after_value: afterValue,
    })

    setMessage('')
    setLoading(false)
    setIsEditing(false)
    window.location.reload()
  }

  const handleCancel = () => {
    setQuantity(String(row.quantity))
    setUnit(row.unit)
    setMessage('')
    setIsEditing(false)
  }

  return (
    <div className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-white">
      <div className="flex-1">
        <div className="font-medium">{ingredient?.name}</div>

        {!isEditing ? (
          <>
            <div className="text-sm text-gray-600">
              Base: {formatNumber(row.quantity)} {row.unit}
            </div>

            <div className="text-sm font-medium">
              Scaled: {formatNumber(converted.value)} {converted.unit}
              {usUnit && (
                <span className="text-gray-500 ml-2">({usUnit})</span>
              )}
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm mb-1">Quantity</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border rounded px-3 py-2 w-full"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
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
                <option value="pcs">pcs</option>
              </select>
            </div>

            {message && <div className="text-sm">{message}</div>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="text-sm border rounded px-3 py-1"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="text-sm border rounded px-3 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!isEditing ? (
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-sm border rounded px-3 py-1"
          >
            Edit
          </button>

          <IngredientDeleteButton recipeIngredientId={row.id} />
        </div>
      ) : null}
    </div>
  )
}