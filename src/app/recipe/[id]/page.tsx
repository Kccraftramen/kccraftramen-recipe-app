export const dynamic = 'force-dynamic'
export const revalidate = 0

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
      section_name,
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

  const { data: changeLogs, error: changeLogError } = await supabase
    .from('recipe_change_logs')
    .select('*')
    .eq('recipe_id', id)
    .order('changed_at', { ascending: false })

  if (recipeError) {
    return <main className="p-6">Error: {recipeError.message}</main>
  }

  if (ingredientError) {
    return <main className="p-6">Error: {ingredientError.message}</main>
  }

  if (stepError) {
    return <main className="p-6">Error: {stepError.message}</main>
  }

  if (changeLogError) {
    return <main className="p-6">Error: {changeLogError.message}</main>
  }

  return (
    <RecipeDetailClient
      recipe={recipe}
      ingredientRows={ingredientRows || []}
      stepRows={stepRows || []}
      changeLogs={changeLogs || []}
    />
  )
}