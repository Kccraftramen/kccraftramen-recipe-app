export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../lib/supabase'
import EventsClient from './events-client'

export default async function EventsPage() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(`
      id,
      name,
      category,
      event_name,
      base_servings,
      usage_type,
      recipe_ingredients (
        id,
        quantity,
        unit,
        section_name,
        ingredients (
          id,
          name,
          default_unit
        )
      ),
      recipe_sub_recipes (
        id,
        quantity,
        unit,
        section_name,
        sub_recipe:recipes!recipe_sub_recipes_sub_recipe_id_fkey (
          id,
          name,
          base_servings,
          recipe_ingredients (
            id,
            quantity,
            unit,
            section_name,
            ingredients (
              id,
              name,
              default_unit
            )
          )
        )
      )
    `)
    .not('event_name', 'is', null)
    .order('event_name', { ascending: true })

  if (error) {
    return (
      <main className="min-h-screen bg-[#E60012] px-6 py-10">
        <div className="mx-auto max-w-6xl rounded-2xl border border-red-200 bg-white p-6 text-red-600 shadow-sm">
          Error: {error.message}
        </div>
      </main>
    )
  }

  return <EventsClient recipes={recipes || []} />
}