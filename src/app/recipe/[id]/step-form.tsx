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
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-3">
      <h2 className="text-lg font-semibold">Add Step</h2>

      <div>
        <label className="block text-sm mb-1">Step Number</label>
        <input
          type="number"
          min="1"
          className="border rounded px-3 py-2 w-full"
          value={stepNumber}
          onChange={(e) => setStepNumber(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Instruction</label>
        <textarea
          className="border rounded px-3 py-2 w-full"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Mix soy sauce and water."
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded"
      >
        {loading ? 'Saving...' : 'Add Step'}
      </button>

      {message && <div className="text-sm">{message}</div>}
    </form>
  )
}