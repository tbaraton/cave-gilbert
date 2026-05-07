import { createClient } from '@supabase/supabase-js'
import ProductPageClient from './ProductPageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function ProductPage(props: any) {
  const slug = props.params?.slug || 'inconnu'

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
        <p>Props : <strong>{JSON.stringify(Object.keys(props))}</strong></p>
      </div>
    )
  }

  return <ProductPageClient product={product} similaires={[]} />
}