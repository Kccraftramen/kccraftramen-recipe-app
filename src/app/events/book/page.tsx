import { supabase } from '../../lib/supabase'
import BookClient from './book-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
      ),
      parent_sub_recipes:recipe_sub_recipes!recipe_sub_recipes_parent_recipe_id_fkey (
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
              name
            )
          ),
          recipe_steps (
            id,
            step_number,
            section_name,
            section_order,
            instruction
          ),
          parent_sub_recipes:recipe_sub_recipes!recipe_sub_recipes_parent_recipe_id_fkey (
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
                  name
                )
              ),
              recipe_steps (
                id,
                step_number,
                section_name,
                section_order,
                instruction
              ),
              parent_sub_recipes:recipe_sub_recipes!recipe_sub_recipes_parent_recipe_id_fkey (
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
                )
              )
            )
          )
        )
      )
    `)

  if (error) {
    return <div>Error: {error.message}</div>
  }

  return <BookClient recipes={recipes || []} />
}
