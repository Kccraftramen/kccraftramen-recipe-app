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

    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', recipeIngredientId)

    if (error) {
      alert(`Error: ${error.message}`)
      return
    }

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
