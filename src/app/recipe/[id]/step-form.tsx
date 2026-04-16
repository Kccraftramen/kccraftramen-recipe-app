'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Props = {
  recipeId: string
  nextStepNumber: number
}

export default function StepForm({ recipeId, nextStepNumber }: Props) {
  const [stepNumber, setStepNumber] = useState(String(nextStepNumber))
  const [sectionName, setSectionName] = useState('')
  const [sectionOrder, setSectionOrder] = useState('')
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([])
  const [showSectionSuggestions, setShowSectionSuggestions] = useState(false)

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

  const fetchSectionSuggestions = async (keyword: string) => {
    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      setSectionSuggestions([])
      return
    }

    const { data, error } = await supabase
      .from('recipe_steps')
      .select('section_name')
      .ilike('section_name', `%${trimmedKeyword}%`)
      .limit(20)

    if (error || !data) {
      setSectionSuggestions([])
      return
    }

    const uniqueValues = Array.from(
      new Set(
        (data as { section_name: string | null }[])
          .map((row) => row.section_name)
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => value.trim())
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 5)

    setSectionSuggestions(uniqueValues)
  }

  const handleSectionChange = async (value: string) => {
    setSectionName(value)

    if (!value.trim()) {
      setSectionSuggestions([])
      setShowSectionSuggestions(false)
      return
    }

    await fetchSectionSuggestions(value)
    setShowSectionSuggestions(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

    const { error } = await supabase
      .from('recipe_steps')
      .insert({
        recipe_id: recipeId,
        step_number: parsedStepNumber,
        section_name: trimmedSectionName || null,
        section_order: parsedSectionOrder,
        instruction: trimmedInstruction,
      })

    if (error) {
      setMessage(`Error: ${error.message}`)
      setLoading(false)
      return
    }

    setMessage('Step added successfully.')
    setStepNumber(String(parsedStepNumber + 1))
    setSectionName('')
    setSectionOrder('')
    setInstruction('')
    setSectionSuggestions([])
    setShowSectionSuggestions(false)
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

      <div ref={sectionWrapperRef} className="relative">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Section Name
        </label>
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={sectionName}
          onChange={(e) => handleSectionChange(e.target.value)}
          onFocus={() => {
            if (sectionSuggestions.length > 0) {
              setShowSectionSuggestions(true)
            }
          }}
          placeholder="e.g. Egg Mixture / Cutting / Steaming"
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
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Section Order
        </label>
        <input
          type="number"
          min="1"
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={sectionOrder}
          onChange={(e) => setSectionOrder(e.target.value)}
          placeholder="e.g. 1"
        />
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