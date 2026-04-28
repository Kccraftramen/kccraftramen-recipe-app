'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type Recipe = {
  id: string
  name: string
}

type SubRecipeRow = {
  id: string
  quantity: number
  unit: string
  section_name: string | null
  sub_recipe: Recipe
}

export default function SubRecipeSection({
  recipeId,
}: {
  recipeId: string
}) {
  const router = useRouter()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [rows, setRows] = useState<SubRecipeRow[]>([])

  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const [sectionName, setSectionName] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    // 全レシピ取得（選択用）
    const { data: allRecipes } = await supabase
      .from('recipes')
      .select('id,name')
      .order('name')

    setRecipes(allRecipes || [])

    // サブレシピ取得
    const { data } = await supabase
      .from('recipe_sub_recipes')
      .select(`
        id,
        quantity,
        unit,
        section_name,
        sub_recipe:recipes!recipe_sub_recipes_sub_recipe_id_fkey (
          id,
          name
        )
      `)
      .eq('parent_recipe_id', recipeId)

    setRows(data || [])
  }

  const handleAdd = async () => {
    if (!selectedRecipeId || !quantity) {
      alert('Select recipe and quantity')
      return
    }

    await supabase.from('recipe_sub_recipes').insert({
      parent_recipe_id: recipeId,
      sub_recipe_id: selectedRecipeId,
      quantity: Number(quantity),
      unit,
      section_name: sectionName || null,
    })

    setSelectedRecipeId('')
    setQuantity('')
    setSectionName('')

    await load()
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    await supabase
      .from('recipe_sub_recipes')
      .delete()
      .eq('id', id)

    await load()
    router.refresh()
  }

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-bold mb-4">Sub Recipes</h2>

      {/* 追加フォーム */}
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <select
          value={selectedRecipeId}
          onChange={(e) => setSelectedRecipeId(e.target.value)}
          className="border rounded p-2 text-sm"
        >
          <option value="">Select Recipe</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border rounded p-2 text-sm"
        />

        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="border rounded p-2 text-sm"
        >
          <option>g</option>
          <option>ml</option>
          <option>pcs</option>
        </select>

        <input
          placeholder="Section"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          className="border rounded p-2 text-sm"
        />
      </div>

      <button
        onClick={handleAdd}
        className="mb-6 bg-black text-white px-4 py-2 rounded"
      >
        Add Sub Recipe
      </button>

      {/* 一覧 */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex justify-between items-center border p-3 rounded"
          >
            <div>
              <div className="font-semibold">
                {row.sub_recipe?.name}
              </div>
              <div className="text-sm text-gray-500">
                {row.quantity} {row.unit} / {row.section_name || 'Other'}
              </div>
            </div>

            <button
              onClick={() => handleDelete(row.id)}
              className="text-red-500 text-sm"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}