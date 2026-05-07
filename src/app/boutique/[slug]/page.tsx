import { createClient } from '@supabase/supabase-js'
import ProductPageClient from './ProductPageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!product) {
    return (
      <div style={{ background: '#0d0a08', color: '#e8e0d5', padding: '40px', fontFamily: 'monospace' }}>
        <h1 style={{ color: '#c96e6e' }}>Produit non trouvé</h1>
        <p>Slug recherché : <strong>{slug}</strong></p>
        <p>Erreur : <strong>{error?.message}</strong></p>
      </div>
    )
  }

  const { data: tastingNote } = await supabase
    .from('tasting_notes')
    .select('*')
    .eq('product_id', product.id)
    .single()

  const { data: similaires } = await supabase
    .from('products')
    .select('id, nom, millesime, couleur, prix_vente_ttc, image_url, slug')
    .eq('couleur', product.couleur)
    .eq('actif', true)
    .neq('id', product.id)
    .limit(4)

  return <ProductPageClient product={{ ...product, ...tastingNote }} similaires={similaires || []} />
}