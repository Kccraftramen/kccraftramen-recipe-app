export const dynamic = 'force-dynamic'

import { supabase } from '../../lib/supabase'
import RecipeDetailClient from './recipe-detail-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function RecipeDetailPage({ params }: PageProps) {
  const { id } = await params

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()

  const { data: ingredientRows, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select(`
      id,
      quantity,
      unit,
      ingredients (
        id,
        name,
        default_unit
      )
    `)
    .eq('recipe_id', id)

  const { data: stepRows, error: stepError } = await supabase
    .from('recipe_steps')
    .select('*')
    .eq('recipe_id', id)
    .order('step_number', { ascending: true })

  if (recipeError) {
    return <main className="p-6">Error: {recipeError.message}</main>
  }

  if (ingredientError) {
    return <main className="p-6">Error: {ingredientError.message}</main>
  }

  if (stepError) {
    return <main className="p-6">Error: {stepError.message}</main>
  }

  return (
    <RecipeDetailClient
      recipe={recipe}
      ingredientRows={ingredientRows || []}
      stepRows={stepRows || []}
    />
  )
}
