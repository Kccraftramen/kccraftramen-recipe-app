'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Recipe = {
  id: string
  name: string
  category: string | null
}

type SubRecipeRow = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  sub_recipe: Recipe | Recipe[] | null
}

const allowedCategories = ['Sauce', 'Ramen Soup', 'Ramen Paste', 'Ramen Topping', 'Ramen Kaeshi']

function getSubRecipe(row: SubRecipeRow) {
  return Array.isArray(row.sub_recipe) ? row.sub_recipe[0] : row.sub_recipe
}

export default function SubRecipeSection({ recipeId }: { recipeId: string }) {
  const router = useRouter()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [rows, setRows] = useState<SubRecipeRow[]>([])

  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const [sectionName, setSectionName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async () => {
    setIsLoading(true)

    const { data: allRecipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id,name,category')
      .in('category', allowedCategories)
      .neq('id', recipeId)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (recipesError) {
      alert(`Failed to load linked recipe options: ${recipesError.message}`)
      setIsLoading(false)
      return
    }

    setRecipes((allRecipes || []) as Recipe[])

    const { data: subRows, error: subRowsError } = await supabase
      .from('recipe_sub_recipes')
      .select(`
        id,
        quantity,
        unit,
        section_name,
        sub_recipe:recipes!recipe_sub_recipes_sub_recipe_id_fkey (
          id,
          name,
          category
        )
      `)
      .eq('parent_recipe_id', recipeId)
      .order('created_at', { ascending: true })

    if (subRowsError) {
      alert(`Failed to load linked recipes: ${subRowsError.message}`)
      setIsLoading(false)
      return
    }

    setRows((subRows || []) as unknown as SubRecipeRow[])
    setIsLoading(false)
  }

  const handleAdd = async () => {
    if (isSaving) return

    if (!selectedRecipeId) {
      alert('Please select a linked recipe.')
      return
    }

    const qty = Number(quantity)

    if (!qty || qty <= 0) {
      alert('Quantity must be greater than 0.')
      return
    }

    setIsSaving(true)

    const { error } = await supabase.from('recipe_sub_recipes').insert({
      parent_recipe_id: recipeId,
      sub_recipe_id: selectedRecipeId,
      quantity: qty,
      unit,
      section_name: sectionName.trim() || null,
    })

    if (error) {
      alert(`Failed to add linked recipe: ${error.message}`)
      setIsSaving(false)
      return
    }

    setSelectedRecipeId('')
    setQuantity('')
    setUnit('g')
    setSectionName('')

    await load()
    router.refresh()
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this linked recipe?')
    if (!confirmed) return

    const { error } = await supabase
      .from('recipe_sub_recipes')
      .delete()
      .eq('id', id)

    if (error) {
      alert(`Failed to delete linked recipe: ${error.message}`)
      return
    }

    await load()
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          Linked Recipes
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Import another recipe as an ingredient, such as sauce, ramen soup, or ramen paste.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
          Available categories: {allowedCategories.join(', ')}
        </div>

        <div className="grid gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Linked Recipe
            </label>

            <select
              value={selectedRecipeId}
              onChange={(e) => setSelectedRecipeId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                {isLoading ? 'Loading...' : 'Select Linked Recipe'}
              </option>

              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name} ({recipe.category || '-'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Quantity
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 80"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Unit
              </label>

              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="L">L</option>
                <option value="lb">lb</option>
                <option value="gal">gal</option>
                <option value="pcs">pcs</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Section Name
              </label>

              <input
                type="text"
                placeholder="e.g. Sauce"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={isSaving}
            className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSaving ? 'Adding...' : 'Add Linked Recipe'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length ? (
          rows.map((row) => {
            const subRecipe = getSubRecipe(row)

            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div>
                  <div className="font-semibold text-gray-900">
                    {subRecipe?.name || 'Unknown Recipe'}
                  </div>

                  <div className="mt-1 text-sm text-gray-600">
                    {row.quantity} {row.unit} / Section:{' '}
                    {row.section_name || 'Other'}
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    Category: {subRecipe?.category || '-'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
            No linked recipes yet.
          </div>
        )}
      </div>
    </section>
  )
}