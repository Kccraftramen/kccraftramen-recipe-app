export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../../lib/supabase'
import BookClient from './book-client'

export default async function BookPage() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(`
      id,
      name,
      category,
      author,
      event_name,
      usage_type,
      base_servings,
      notes,
      recipe_ingredients (
        id,
        quantity,
        unit,
        section_name,
        ingredients (
          id,
          name
        )
      ),
      recipe_steps (
        id,
        step_number,
        section_name,
        section_order,
        instruction
      )
    `)

  if (error) {
    return <div>Error: {error.message}</div>
  }

  return <BookClient recipes={recipes || []} />
}