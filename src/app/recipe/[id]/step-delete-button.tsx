'use client'

import { supabase } from '../../lib/supabase'

type Props = {
  stepId: string
}

export default function StepDeleteButton({ stepId }: Props) {
  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this step?')
    if (!confirmed) return

    const { error } = await supabase
      .from('recipe_steps')
      .delete()
      .eq('id', stepId)

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