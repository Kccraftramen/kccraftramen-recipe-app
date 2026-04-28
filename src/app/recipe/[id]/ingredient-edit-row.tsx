'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type IngredientInfo = {
  id: string
  name: string
  default_unit: string | null
}

type IngredientRow = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  ingredients: IngredientInfo | IngredientInfo[]
}

type Props = {
  row: IngredientRow
  multiplier: number
  formatNumber: (value: number) => string
  convertUnit: (value: number, unit: string) => {
    value: number
    unit: string
  }
  getUSUnit: (value: number, unit: string) => string | null
}

function getIngredient(row: IngredientRow) {
  return Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || ''
}

function normalizeSection(value: string | null | undefined) {
  return value?.trim() || null
}

export default function IngredientEditRow({
  row,
  multiplier,
  formatNumber,
  convertUnit,
  getUSUnit,
}: Props) {
  const router = useRouter()

  const ingredient = getIngredient(row)

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [ingredientName, setIngredientName] = useState(ingredient?.name || '')
  const [quantity, setQuantity] = useState(String(row.quantity))
  const [unit, setUnit] = useState(row.unit || 'g')
  const [sectionName, setSectionName] = useState(row.section_name || '')

  const scaled = useMemo(() => {
    const scaledQuantity = row.quantity * multiplier
    const converted = convertUnit(scaledQuantity, row.unit)
    const usUnit = getUSUnit(converted.value, converted.unit)

    return {
      quantity: converted.value,
      unit: converted.unit,
      usUnit,
    }
  }, [row.quantity, row.unit, multiplier, convertUnit, getUSUnit])

  const resetForm = () => {
    setIngredientName(ingredient?.name || '')
    setQuantity(String(row.quantity))
    setUnit(row.unit || 'g')
    setSectionName(row.section_name || '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!ingredient?.id) {
      alert('Ingredient data is missing.')
      return
    }

    const nextIngredientName = normalizeText(ingredientName)
    const nextQuantity = Number(quantity)
    const nextUnit = unit
    const nextSectionName = normalizeSection(sectionName)

    if (!nextIngredientName) {
      alert('Ingredient name is required.')
      return
    }

    if (!nextQuantity || nextQuantity <= 0) {
      alert('Quantity must be greater than 0.')
      return
    }

    setIsSaving(true)

    try {
      const changes: string[] = []

      const previousIngredientName = ingredient.name
      const previousQuantity = row.quantity
      const previousUnit = row.unit
      const previousSectionName = row.section_name || ''

      if (nextIngredientName !== previousIngredientName) {
        const { error } = await supabase
          .from('ingredients')
          .update({
            name: nextIngredientName,
          })
          .eq('id', ingredient.id)

        if (error) throw error

        changes.push(
          `Ingredient Name: ${previousIngredientName} → ${nextIngredientName}`
        )
      }

      const ingredientRowChanged =
        nextQuantity !== previousQuantity ||
        nextUnit !== previousUnit ||
        (nextSectionName || '') !== previousSectionName

      if (ingredientRowChanged) {
        const { error } = await supabase
          .from('recipe_ingredients')
          .update({
            quantity: nextQuantity,
            unit: nextUnit,
            section_name: nextSectionName,
          })
          .eq('id', row.id)

        if (error) throw error

        if (nextQuantity !== previousQuantity) {
          changes.push(
            `Quantity: ${previousQuantity} → ${nextQuantity}`
          )
        }

        if (nextUnit !== previousUnit) {
          changes.push(`Unit: ${previousUnit} → ${nextUnit}`)
        }

        if ((nextSectionName || '') !== previousSectionName) {
          changes.push(
            `Section Name: ${previousSectionName || '-'} → ${
              nextSectionName || '-'
            }`
          )
        }
      }

      if (changes.length > 0) {
        const { data: recipeIngredient, error: recipeLookupError } =
          await supabase
            .from('recipe_ingredients')
            .select('recipe_id')
            .eq('id', row.id)
            .single()

        if (!recipeLookupError && recipeIngredient?.recipe_id) {
          await supabase.from('recipe_change_logs').insert({
            recipe_id: recipeIngredient.recipe_id,
            entity_type: 'ingredient',
            action_type: 'update',
            item_name: nextIngredientName,
            section_name: nextSectionName,
            before_value: changes.join('\n'),
            after_value: 'Updated',
          })
        }
      }

      setIsEditing(false)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred.'
      alert(`Save failed: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-gray-300 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Ingredient Name
            </label>
            <input
              type="text"
              value={ingredientName}
              onChange={(e) => setIngredientName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Section Name
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="e.g. Egg Liquid / Toppings / Sauce"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Quantity
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Unit
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <button
            type="button"
            onClick={resetForm}
            disabled={isSaving}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="font-semibold text-gray-900">
            {ingredient?.name || 'Unknown Ingredient'}
          </div>

          <div className="text-sm text-gray-600">
            Base: {formatNumber(row.quantity)} {row.unit}
          </div>

          <div className="text-sm text-gray-600">
            Scaled: {formatNumber(scaled.quantity)} {scaled.unit}
            {scaled.usUnit ? (
              <span className="ml-2 text-gray-400">({scaled.usUnit})</span>
            ) : null}
          </div>

          <div className="text-xs text-gray-500">
            Section: {row.section_name || 'Other'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </button>
      </div>
    </div>
  )
}