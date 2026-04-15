'use client'

import { supabase } from '../../lib/supabase'

type Props = {
  recipeIngredientId: string
}

export default function IngredientDeleteButton({
  recipeIngredientId,
}: Props) {
  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this ingredient?')
    if (!confirmed) return

    const { data: currentRow, error: readError } = await supabase
      .from('recipe_ingredients')
      .select(`
        id,
        recipe_id,
        quantity,
        unit,
        section_name,
        ingredients (
          name
        )
      `)
      .eq('id', recipeIngredientId)
      .single()

    if (readError) {
      alert(`Error: ${readError.message}`)
      return
    }

    const ingredient = Array.isArray(currentRow.ingredients)
      ? currentRow.ingredients[0]
      : currentRow.ingredients

    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', recipeIngredientId)

    if (error) {
      alert(`Error: ${error.message}`)
      return
    }

    await supabase.from('recipe_change_logs').insert({
      recipe_id: currentRow.recipe_id,
      entity_type: 'ingredient',
      action_type: 'delete',
      item_name: ingredient?.name || 'Ingredient',
      section_name: currentRow.section_name,
      before_value: `${currentRow.quantity} ${currentRow.unit}`,
      after_value: null,
    })

    window.location.reload()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-sm border rounded px-3 py-1"
    >
      Delete
    </button>
  )
}