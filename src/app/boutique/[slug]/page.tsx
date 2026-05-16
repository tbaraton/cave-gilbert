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
    .eq('visible_boutique', true)
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

  // Stock par site pour gérer le retrait 2h sur les lieux de vente
  const ID_MARCY = 'ee3afa96-0c45-407f-87fc-e503fbada6c4'
  const ID_ENTREPOT = 'e12d7e47-23dc-4011-95fc-e9e975fc4307'
  const ID_ARBRESLE = '3097e864-f452-4c2e-9af3-21e26f0330b7'
  const { data: stocks } = await supabase
    .from('stock')
    .select('site_id, quantite')
    .eq('product_id', product.id)
    .in('site_id', [ID_MARCY, ID_ENTREPOT, ID_ARBRESLE])
  const stockByEntity = {
    entrepot: stocks?.find(s => s.site_id === ID_ENTREPOT)?.quantite || 0,
    cave_gilbert: stocks?.find(s => s.site_id === ID_MARCY)?.quantite || 0,
    petite_cave: stocks?.find(s => s.site_id === ID_ARBRESLE)?.quantite || 0,
  }

  const { data: similairesRaw } = await supabase
    .from('products')
    .select('id, nom, millesime, couleur, prix_vente_ttc, image_url, slug, domaine:domaines(nom)')
    .eq('couleur', product.couleur)
    .eq('actif', true)
    .eq('visible_boutique', true)
    .neq('id', product.id)
    .limit(4)

  const similaires = (similairesRaw || []).map((s: any) => ({ ...s, domaine: s.domaine?.nom || null }))

  return <ProductPageClient product={{ ...product, ...tastingNote, _stockByEntity: stockByEntity }} similaires={similaires} />
}