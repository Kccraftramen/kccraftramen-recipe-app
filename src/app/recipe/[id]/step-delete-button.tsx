'use client'

import { supabase } from '../../lib/supabase'

type Props = {
  stepId: string
}

export default function StepDeleteButton({ stepId }: Props) {
  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this step?')
    if (!confirmed) return

    const { data: currentRow, error: readError } = await supabase
      .from('recipe_steps')
      .select('recipe_id, step_number, section_name, instruction')
      .eq('id', stepId)
      .single()

    if (readError) {
      alert(`Error: ${readError.message}`)
      return
    }

    const { error } = await supabase
      .from('recipe_steps')
      .delete()
      .eq('id', stepId)

    if (error) {
      alert(`Error: ${error.message}`)
      return
    }

    await supabase.from('recipe_change_logs').insert({
      recipe_id: currentRow.recipe_id,
      entity_type: 'step',
      action_type: 'delete',
      item_name: `Step ${currentRow.step_number}`,
      section_name: currentRow.section_name,
      before_value: currentRow.instruction,
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