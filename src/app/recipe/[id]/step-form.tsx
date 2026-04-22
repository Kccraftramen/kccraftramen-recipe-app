'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Props = {
  recipeId: string
  nextStepNumber: number
}

type ExistingStep = {
  section_name: string | null
  section_order: number | null
  step_number: number
}

export default function StepForm({ recipeId }: Props) {
  const [stepNumber, setStepNumber] = useState('1')
  const [sectionName, setSectionName] = useState('')
  const [sectionOrder, setSectionOrder] = useState('')
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([])
  const [showSectionSuggestions, setShowSectionSuggestions] = useState(false)

  const [orderNameSuggestions, setOrderNameSuggestions] = useState<string[]>([])
  const [showOrderNameSuggestions, setShowOrderNameSuggestions] = useState(false)

  const [existingSteps, setExistingSteps] = useState<ExistingStep[]>([])

  const sectionWrapperRef = useRef<HTMLDivElement | null>(null)
  const orderWrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sectionWrapperRef.current &&
        !sectionWrapperRef.current.contains(event.target as Node)
      ) {
        setShowSectionSuggestions(false)
      }

      if (
        orderWrapperRef.current &&
        !orderWrapperRef.current.contains(event.target as Node)
      ) {
        setShowOrderNameSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const loadExistingSteps = async () => {
      const { data, error } = await supabase
        .from('recipe_steps')
        .select('section_name, section_order, step_number')
        .eq('recipe_id', recipeId)

      if (error || !data) {
        setExistingSteps([])
        return
      }

      setExistingSteps(data)
    }

    loadExistingSteps()
  }, [recipeId])

  const fetchSectionSuggestions = async (keyword: string) => {
    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      setSectionSuggestions([])
      return
    }

    const uniqueValues = Array.from(
      new Set(
        existingSteps
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
    const matches = existingSteps.filter(
      (row) =>
        row.section_name?.trim().toLowerCase() === name.trim().toLowerCase() &&
        row.section_order !== null
    )

    const uniqueOrders = Array.from(
      new Set(matches.map((row) => row.section_order))
    ).filter((value): value is number => value !== null && value !== undefined)

    if (uniqueOrders.length === 1) {
      return String(uniqueOrders[0])
    }

    return ''
  }

  const findNextStepNumberBySection = (name: string) => {
    const matches = existingSteps.filter(
      (row) =>
        row.section_name?.trim().toLowerCase() === name.trim().toLowerCase()
    )

    if (matches.length === 0) {
      return '1'
    }

    const maxStepNumber = Math.max(...matches.map((row) => row.step_number))
    return String(maxStepNumber + 1)
  }

  const findSectionNamesByOrder = (orderValue: string) => {
    const parsedOrder = Number(orderValue)

    if (!parsedOrder || parsedOrder <= 0) return []

    const names = Array.from(
      new Set(
        existingSteps
          .filter((row) => row.section_order === parsedOrder)
          .map((row) => row.section_name)
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => value.trim())
      )
    ).sort((a, b) => a.localeCompare(b))

    return names
  }

  const handleSectionChange = async (value: string) => {
    setSectionName(value)

    if (!value.trim()) {
      setSectionSuggestions([])
      setShowSectionSuggestions(false)
      setStepNumber('1')
      return
    }

    const matchedOrder = findExistingSectionOrder(value)
    if (matchedOrder) {
      setSectionOrder(matchedOrder)
      setOrderNameSuggestions([])
      setShowOrderNameSuggestions(false)
    }

    setStepNumber(findNextStepNumberBySection(value))

    await fetchSectionSuggestions(value)
    setShowSectionSuggestions(true)
  }

  const handleSelectSectionSuggestion = (suggestion: string) => {
    setSectionName(suggestion)
    setShowSectionSuggestions(false)

    const matchedOrder = findExistingSectionOrder(suggestion)
    if (matchedOrder) {
      setSectionOrder(matchedOrder)
      setOrderNameSuggestions([])
      setShowOrderNameSuggestions(false)
    }

    setStepNumber(findNextStepNumberBySection(suggestion))
  }

  const handleSectionOrderChange = (value: string) => {
    setSectionOrder(value)

    if (!value.trim()) {
      setOrderNameSuggestions([])
      setShowOrderNameSuggestions(false)
      return
    }

    const matchedNames = findSectionNamesByOrder(value)

    if (matchedNames.length === 1) {
      setSectionName(matchedNames[0])
      setStepNumber(findNextStepNumberBySection(matchedNames[0]))
      setOrderNameSuggestions([])
      setShowOrderNameSuggestions(false)
      return
    }

    if (matchedNames.length > 1) {
      setOrderNameSuggestions(matchedNames)
      setShowOrderNameSuggestions(true)
      return
    }

    setOrderNameSuggestions([])
    setShowOrderNameSuggestions(false)
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
    setSectionName('')
    setSectionOrder('')
    setStepNumber('1')
    setInstruction('')
    setSectionSuggestions([])
    setShowSectionSuggestions(false)
    setOrderNameSuggestions([])
    setShowOrderNameSuggestions(false)
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
                    onClick={() => handleSelectSectionSuggestion(suggestion)}
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

      <div ref={orderWrapperRef} className="relative">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Section Order
        </label>
        <input
          type="number"
          min="1"
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={sectionOrder}
          onChange={(e) => handleSectionOrderChange(e.target.value)}
          onFocus={() => {
            if (orderNameSuggestions.length > 0) {
              setShowOrderNameSuggestions(true)
            }
          }}
          placeholder="e.g. 1"
        />

        {showOrderNameSuggestions && sectionOrder.trim().length > 0 && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
            {orderNameSuggestions.length > 0 ? (
              <div className="max-h-64 overflow-y-auto py-1">
                {orderNameSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setSectionName(suggestion)
                      setStepNumber(findNextStepNumberBySection(suggestion))
                      setShowOrderNameSuggestions(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching sections for this order.
              </div>
            )}
          </div>
        )}
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