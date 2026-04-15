'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

type Props = {
  recipeId: string
  nextStepNumber: number
}

export default function StepForm({ recipeId, nextStepNumber }: Props) {
  const [stepNumber, setStepNumber] = useState(String(nextStepNumber))
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const parsedStepNumber = Number(stepNumber)
    const trimmedInstruction = instruction.trim()

    if (!parsedStepNumber || parsedStepNumber <= 0) {
      setMessage('Step number must be greater than 0.')
      return
    }

    if (!trimmedInstruction) {
      setMessage('Instruction is required.')
      return
    }

    setLoading(true)
    setMessage('Saving...')

    const { error } = await supabase
      .from('recipe_steps')
      .insert({
        recipe_id: recipeId,
        step_number: parsedStepNumber,
        instruction: trimmedInstruction,
      })

    if (error) {
      setMessage(`Error: ${error.message}`)
      setLoading(false)
      return
    }

    setMessage('Step added successfully.')
    setStepNumber(String(parsedStepNumber + 1))
    setInstruction('')
    setLoading(false)
    window.location.reload()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">Add Step</h2>
        <p className="text-sm text-gray-500">
          Add the next instruction for this recipe.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Step Number
        </label>
        <input
          type="number"
          min="1"
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={stepNumber}
          onChange={(e) => setStepNumber(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Instruction
        </label>
        <textarea
          rows={5}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Mix soy sauce and water."
          required
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          {loading ? 'Saving...' : 'Add Step'}
        </button>

        {message && <div className="text-sm text-gray-500">{message}</div>}
      </div>
    </form>
  )
}