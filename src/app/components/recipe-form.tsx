'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function RecipeForm() {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [baseServings, setBaseServings] = useState('1')
  const [notes, setNotes] = useState('')
  const [usageType, setUsageType] = useState('regular')
  const [eventName, setEventName] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('Saving...')

    const { error } = await supabase.from('recipes').insert({
      name,
      category,
      base_servings: Number(baseServings),
      notes,
      usage_type: usageType,
      event_name: eventName.trim() || null,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }

    setMessage('Saved successfully.')
    setName('')
    setCategory('')
    setBaseServings('1')
    setNotes('')
    setUsageType('regular')
    setEventName('')
    window.location.reload()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">Add Recipe</h2>
        <p className="text-sm text-gray-500">
          Create a new recipe for regular menu items, events, or prep-only use.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Recipe Name
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wagyu Tare"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Category
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Soup Base"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Base Servings
          </label>
          <input
            type="number"
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={baseServings}
            onChange={(e) => setBaseServings(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Usage Type
          </label>
          <select
            className="w-full h-[42px] rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={usageType}
            onChange={(e) => setUsageType(e.target.value)}
          >
            <option value="regular">Regular Menu</option>
            <option value="event">Event</option>
            <option value="seasonal">Seasonal</option>
            <option value="prep">Prep Only</option>
            <option value="obento">Obento</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Event Name
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g. Wagyu"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            rows={4}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this recipe"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Save Recipe
        </button>

        {message && (
          <p className="text-sm text-gray-500">
            {message}
          </p>
        )}
      </div>
    </form>
  )
}