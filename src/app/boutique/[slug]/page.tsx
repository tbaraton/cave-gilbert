import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ProductPageClient from './ProductPageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { data } = await supabase
    .from('v_catalogue')
    .select('nom, millesime, domaine, description_courte')
    .eq('slug', params.slug)
    .single()
  if (!data) return { title: 'Produit introuvable' }
  return {
    title: `${data.nom}${data.millesime ? ` ${data.millesime}` : ''} — Cave de Gilbert`,
    description: data.description_courte || `${data.domaine || ''} · Cave de Gilbert`,
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const { data: product } = await supabase
    .from('v_catalogue')
    .select('*')
    .eq('slug', params.slug)
    .eq('actif', true)
    .single()

  if (!product) notFound()

  const { data: tastingNote } = await supabase
    .from('tasting_notes')
    .select('*')
    .eq('product_id', product.id)
    .single()

  const { data: similaires } = await supabase
    .from('v_catalogue')
    .select('id, nom, millesime, couleur, prix_vente_ttc, image_url, slug, domaine, stock_statut')
    .eq('couleur', product.couleur)
    .eq('actif', true)
    .neq('id', product.id)
    .limit(4)

  const productComplet = { ...product, ...tastingNote }
  return <ProductPageClient product={productComplet} similaires={similaires || []} />
}