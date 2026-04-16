'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import StepDeleteButton from './step-delete-button'

type StepRow = {
  id: string
  step_number: number
  section_name: string | null
  section_order: number | null
  instruction: string
}

type Props = {
  step: StepRow
}

type ExistingSection = {
  section_name: string | null
  section_order: number | null
}

export default function StepEditRow({ step }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [stepNumber, setStepNumber] = useState(String(step.step_number))
  const [sectionName, setSectionName] = useState(step.section_name || '')
  const [sectionOrder, setSectionOrder] = useState(
    step.section_order ? String(step.section_order) : ''
  )
  const [instruction, setInstruction] = useState(step.instruction)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([])
  const [showSectionSuggestions, setShowSectionSuggestions] = useState(false)
  const [existingSections, setExistingSections] = useState<ExistingSection[]>([])

  const sectionWrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sectionWrapperRef.current &&
        !sectionWrapperRef.current.contains(event.target as Node)
      ) {
        setShowSectionSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const loadExistingSections = async () => {
      const { data: currentRow, error: currentRowError } = await supabase
        .from('recipe_steps')
        .select('recipe_id')
        .eq('id', step.id)
        .single()

      if (currentRowError || !currentRow) {
        setExistingSections([])
        return
      }

      const { data, error } = await supabase
        .from('recipe_steps')
        .select('section_name, section_order')
        .eq('recipe_id', currentRow.recipe_id)

      if (error || !data) {
        setExistingSections([])
        return
      }

      setExistingSections(data)
    }

    loadExistingSections()
  }, [step.id])

  const fetchSectionSuggestions = async (keyword: string) => {
    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      setSectionSuggestions([])
      return
    }

    const uniqueValues = Array.from(
      new Set(
        existingSections
          .map((row) => row.section_name)
          .filter((value): value is string => Boolean(value?.trim()))
          .filter((value) =>
            value.toLowerCase().includes(trimmedKeyword.toLowerCase())
          )
          .map((value) => value.trim())
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 5)

    setSectionSuggestions(uniqueValues)
  }

  const findExistingSectionOrder = (name: string) => {
    const match = existingSections.find(
      (row) =>
        row.section_name?.trim().toLowerCase() === name.trim().toLowerCase() &&
        row.section_order !== null
    )

    if (match?.section_order !== null && match?.section_order !== undefined) {
      return String(match.section_order)
    }

    return ''
  }

  const handleSectionChange = async (value: string) => {
    setSectionName(value)

    if (!value.trim()) {
      setSectionSuggestions([])
      setShowSectionSuggestions(false)
      return
    }

    const matchedOrder = findExistingSectionOrder(value)
    if (matchedOrder) {
      setSectionOrder(matchedOrder)
    }

    await fetchSectionSuggestions(value)
    setShowSectionSuggestions(true)
  }

  const handleSave = async () => {
    const parsedStepNumber = Number(stepNumber)
    const parsedSectionOrder = sectionOrder ? Number(sectionOrder) : null
    const trimmedInstruction = instruction.trim()
    const trimmedSectionName = sectionName.trim()

    if (!parsedStepNumber || parsedStepNumber <= 0) {
      setMessage('Step number must be greater than 0.')
      return
    }

    if (sectionOrder && (!parsedSectionOrder || parsedSectionOrder <= 0)) {
      setMessage('Section order must be greater than 0.')
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
      .select('recipe_id, section_name, step_number, instruction, section_order')
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
        section_name: trimmedSectionName || null,
        section_order: parsedSectionOrder,
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
      before_value: `Section: ${currentRow.section_name || '-'} / Order: ${currentRow.section_order ?? '-'} / ${currentRow.instruction}`,
      after_value: `Section: ${trimmedSectionName || '-'} / Order: ${parsedSectionOrder ?? '-'} / ${trimmedInstruction}`,
    })

    setMessage('')
    setLoading(false)
    setIsEditing(false)
    window.location.reload()
  }

  const handleCancel = () => {
    setStepNumber(String(step.step_number))
    setSectionName(step.section_name || '')
    setSectionOrder(step.section_order ? String(step.section_order) : '')
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
            <div className="text-xs text-gray-500 mb-1">
              Section Order: {step.section_order ?? '-'}
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {step.instruction}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div ref={sectionWrapperRef} className="relative">
              <label className="block text-sm mb-1">Section Name</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={sectionName}
                onChange={(e) => handleSectionChange(e.target.value)}
                onFocus={() => {
                  if (sectionSuggestions.length > 0) {
                    setShowSectionSuggestions(true)
                  }
                }}
              />

              {showSectionSuggestions && sectionName.trim().length > 0 && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                  {sectionSuggestions.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {sectionSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setSectionName(suggestion)
                            setShowSectionSuggestions(false)

                            const matchedOrder =
                              findExistingSectionOrder(suggestion)
                            if (matchedOrder) {
                              setSectionOrder(matchedOrder)
                            }
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No matching sections. You can add a new one.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm mb-1">Section Order</label>
              <input
                type="number"
                min="1"
                className="border rounded px-3 py-2 w-full"
                value={sectionOrder}
                onChange={(e) => setSectionOrder(e.target.value)}
              />
            </div>

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