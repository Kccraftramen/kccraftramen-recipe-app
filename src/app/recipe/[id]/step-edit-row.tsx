'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import StepDeleteButton from './step-delete-button'

type StepRow = {
  id: string
  step_number: number
  section_name: string | null
  instruction: string
}

type Props = {
  step: StepRow
}

export default function StepEditRow({ step }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [stepNumber, setStepNumber] = useState(String(step.step_number))
  const [instruction, setInstruction] = useState(step.instruction)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async () => {
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

    const { data: currentRow, error: readError } = await supabase
      .from('recipe_steps')
      .select('recipe_id, section_name, step_number, instruction')
      .eq('id', step.id)
      .single()

    if (readError) {
      setMessage(`Error: ${readError.message}`)
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('recipe_steps')
      .update({
        step_number: parsedStepNumber,
        instruction: trimmedInstruction,
      })
      .eq('id', step.id)

    if (error) {
      setMessage(`Error: ${error.message}`)
      setLoading(false)
      return
    }

    await supabase.from('recipe_change_logs').insert({
      recipe_id: currentRow.recipe_id,
      entity_type: 'step',
      action_type: 'update',
      item_name: `Step ${currentRow.step_number}`,
      section_name: currentRow.section_name,
      before_value: currentRow.instruction,
      after_value: trimmedInstruction,
    })

    setMessage('')
    setLoading(false)
    setIsEditing(false)
    window.location.reload()
  }

  const handleCancel = () => {
    setStepNumber(String(step.step_number))
    setInstruction(step.instruction)
    setMessage('')
    setIsEditing(false)
  }

  return (
    <div className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-white">
      <div className="flex-1">
        {!isEditing ? (
          <>
            <div className="font-medium">Step {step.step_number}</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {step.instruction}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Step Number</label>
              <input
                type="number"
                min="1"
                className="border rounded px-3 py-2 w-full"
                value={stepNumber}
                onChange={(e) => setStepNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Instruction</label>
              <textarea
                className="border rounded px-3 py-2 w-full"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
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

          <StepDeleteButton stepId={step.id} />
        </div>
      ) : null}
    </div>
  )
}