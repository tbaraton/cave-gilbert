import { createClient } from '@supabase/supabase-js'
import ProductPageClient from './ProductPageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function ProductPage(props: any) {
  const params = await props.params
  const slug = params?.slug || 'inconnu'

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .limit(1)

  const product = products?.[0]

  if (!product) {
    return (
      <div style={{ background: '#0d0a08', color: '#e8e0d5', padding: '40px', fontFamily: 'monospace' }}>
        <h1 style={{ color: '#c96e6e' }}>Produit non trouvé</h1>
        <p>Slug reçu : <strong>"{slug}"</strong></p>
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