import Link from 'next/link'
import { supabase } from './lib/supabase'
import RecipeForm from './components/recipe-form'
import RecipeListClient from './components/recipe-list-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="min-h-screen bg-[#E60012] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-red-600 shadow-sm">
            Error: {error.message}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#E60012] px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-white">
            KC Craft Ramen
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-white">
            Recipe Manager
          </h1>

          <p className="max-w-2xl text-sm text-white">
            Manage recipes, ingredients, steps, scaling, and event-specific menu items in one place.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/events"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-100"
            >
              Open Event Summary
            </Link>

            <Link
              href="/events/book"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-100"
            >
              Open Event Recipe Book
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.4fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <RecipeForm />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <RecipeListClient recipes={data || []} />
          </div>
        </div>
      </div>
    </main>
  )
}