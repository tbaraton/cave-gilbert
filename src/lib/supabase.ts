// ============================================================
// CAVE DE GILBERT — Couche d'accès aux données v2.0
// Multi-sites + Transferts inter-sites
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type {
  Site, SiteInsert,
  CatalogueProduct, CatalogueFilters,
  Product, ProductInsert,
  TastingNote,
  StockParSite, StockMovement, StockMovementReason,
  Transfer, TransferInsert, TransferActif, TransferReceiptAdjustment,
  Order, Customer,
  AIGeneratedProduct,
} from '@/types'

// ── Clients Supabase ─────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Clé service — réservée aux API Routes Next.js (jamais exposée côté client)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default supabase

// ============================================================
// SITES
// ============================================================

/** Tous les sites actifs */
export async function getSites(actifSeulement = true): Promise<Site[]> {
  let query = supabase.from('sites').select('*').order('nom')
  if (actifSeulement) query = query.eq('actif', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Créer un nouveau site */
export async function createSite(site: SiteInsert): Promise<Site> {
  const { data, error } = await supabaseAdmin
    .from('sites').insert(site).select().single()
  if (error) throw error
  return data
}

/** Mettre à jour un site */
export async function updateSite(id: string, updates: Partial<SiteInsert>): Promise<Site> {
  const { data, error } = await supabaseAdmin
    .from('sites').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// PRODUITS
// ============================================================

/** Catalogue public (vue enrichie, stock global) */
export async function getCatalogue(filters: CatalogueFilters = {}): Promise<CatalogueProduct[]> {
  let query = supabase.from('v_catalogue').select('*').eq('actif', true)

  if (filters.couleur?.length)     query = query.in('couleur', filters.couleur)
  if (filters.region?.length)      query = query.in('region', filters.region)
  if (filters.appellation?.length) query = query.in('appellation', filters.appellation)
  if (filters.millesime_min)       query = query.gte('millesime', filters.millesime_min)
  if (filters.millesime_max)       query = query.lte('millesime', filters.millesime_max)
  if (filters.prix_min)            query = query.gte('prix_vente_ttc', filters.prix_min)
  if (filters.prix_max)            query = query.lte('prix_vente_ttc', filters.prix_max)
  if (filters.bio)                 query = query.eq('bio', true)
  if (filters.stock_disponible)    query = query.gt('stock_total', 0)
  if (filters.search)              query = query.ilike('nom', `%${filters.search}%`)

  switch (filters.sort) {
    case 'prix_asc':       query = query.order('prix_vente_ttc', { ascending: true }); break
    case 'prix_desc':      query = query.order('prix_vente_ttc', { ascending: false }); break
    case 'millesime_desc': query = query.order('millesime', { ascending: false }); break
    case 'millesime_asc':  query = query.order('millesime', { ascending: true }); break
    default:               query = query.order('mis_en_avant', { ascending: false }).order('nom')
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getProductBySlug(slug: string): Promise<CatalogueProduct | null> {
  const { data } = await supabase.from('v_catalogue').select('*').eq('slug', slug).single()
  return data
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data } = await supabase
    .from('products').select('*, tasting_notes(*)').eq('id', id).single()
  return data
}

export async function createProduct(product: ProductInsert): Promise<Product> {
  const { data, error } = await supabaseAdmin
    .from('products').insert(product).select().single()
  if (error) throw error
  return data
}

export async function updateProduct(id: string, updates: Partial<ProductInsert>): Promise<Product> {
  const { data, error } = await supabaseAdmin
    .from('products').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function saveTastingNotes(
  productId: string,
  notes: Partial<TastingNote>
): Promise<TastingNote> {
  const { data, error } = await supabaseAdmin
    .from('tasting_notes').upsert({ ...notes, product_id: productId }).select().single()
  if (error) throw error
  return data
}

// ============================================================
// STOCK MULTI-SITES
// ============================================================

/** Stock de tous les produits sur tous les sites (admin) */
export async function getStockParSite(
  opts: { siteId?: string; produitId?: string; statut?: 'alerte' | 'rupture' } = {}
): Promise<StockParSite[]> {
  let query = supabase.from('v_stock_par_site').select('*')
  if (opts.siteId)    query = query.eq('site_id', opts.siteId)
  if (opts.produitId) query = query.eq('product_id', opts.produitId)
  if (opts.statut)    query = query.eq('stock_statut', opts.statut)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Stock d'un produit sur un site précis */
export async function getStockProduitSite(
  productId: string, siteId: string
): Promise<number> {
  const { data } = await supabase
    .from('stock')
    .select('quantite')
    .eq('product_id', productId)
    .eq('site_id', siteId)
    .single()
  return data?.quantite ?? 0
}

/**
 * Mouvement de stock (appelle la fonction SQL sécurisée)
 * La quantité est toujours positive — le sens dépend de la raison.
 */
export async function moveStock(
  productId: string,
  siteId: string,
  raison: StockMovementReason,
  quantite: number,
  note?: string,
  orderId?: string,
  transferId?: string
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('move_stock', {
    p_product_id:  productId,
    p_site_id:     siteId,
    p_raison:      raison,
    p_quantite:    quantite,
    p_note:        note       ?? null,
    p_order_id:    orderId    ?? null,
    p_transfer_id: transferId ?? null,
  })
  if (error) throw error
}

/** Mettre à jour le seuil d'alerte ou l'emplacement d'un stock */
export async function updateStockMeta(
  productId: string,
  siteId: string,
  updates: { seuil_alerte?: number; emplacement?: string }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('stock')
    .update(updates)
    .eq('product_id', productId)
    .eq('site_id', siteId)
  if (error) throw error
}

/** Historique des mouvements — filtrable par produit et/ou site */
export async function getStockHistory(
  opts: { productId?: string; siteId?: string; limit?: number }
): Promise<StockMovement[]> {
  let query = supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)

  if (opts.productId) query = query.eq('product_id', opts.productId)
  if (opts.siteId)    query = query.eq('site_id', opts.siteId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ============================================================
// TRANSFERTS INTER-SITES
// ============================================================

/** Créer un transfert avec ses lignes produits */
export async function createTransfer(payload: TransferInsert): Promise<Transfer> {
  // 1. Créer l'entête du transfert
  const { data: transfer, error: errTransfer } = await supabaseAdmin
    .from('transfers')
    .insert({
      site_source_id:      payload.site_source_id,
      site_destination_id: payload.site_destination_id,
      notes:               payload.notes,
      transporteur:        payload.transporteur,
      statut:              'brouillon',
      demande_le:          new Date().toISOString(),
    })
    .select()
    .single()

  if (errTransfer) throw errTransfer

  // 2. Insérer les lignes produits
  const items = payload.items.map(item => ({
    transfer_id:        transfer.id,
    product_id:         item.product_id,
    quantite_demandee:  item.quantite_demandee,
    note:               item.note,
  }))

  const { error: errItems } = await supabaseAdmin
    .from('transfer_items')
    .insert(items)

  if (errItems) throw errItems

  return transfer
}

/** Récupère tous les transferts (admin) */
export async function getTransfers(
  opts: { statut?: string; siteId?: string } = {}
): Promise<Transfer[]> {
  let query = supabaseAdmin
    .from('transfers')
    .select(`
      *,
      site_source:sites!site_source_id(id, nom, code),
      site_destination:sites!site_destination_id(id, nom, code),
      items:transfer_items(*, product:products(id, nom, millesime, couleur, image_url))
    `)
    .order('created_at', { ascending: false })

  if (opts.statut) query = query.eq('statut', opts.statut)
  if (opts.siteId) {
    query = query.or(`site_source_id.eq.${opts.siteId},site_destination_id.eq.${opts.siteId}`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Transferts actifs (vue simplifiée pour le tableau de bord) */
export async function getTransfersActifs(): Promise<TransferActif[]> {
  const { data, error } = await supabase.from('v_transfers_actifs').select('*')
  if (error) throw error
  return data ?? []
}

/** Un seul transfert avec tout le détail */
export async function getTransferById(id: string): Promise<Transfer | null> {
  const { data } = await supabaseAdmin
    .from('transfers')
    .select(`
      *,
      site_source:sites!site_source_id(*),
      site_destination:sites!site_destination_id(*),
      items:transfer_items(*, product:products(id, nom, millesime, couleur, image_url, prix_vente_ttc))
    `)
    .eq('id', id)
    .single()
  return data
}

/**
 * Confirmer l'expédition (côté site source)
 * → Débite le stock source, passe le statut à 'confirmé'
 */
export async function dispatchTransfer(
  transferId: string,
  confirmedBy?: string
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('confirm_transfer_dispatch', {
    p_transfer_id:  transferId,
    p_confirmed_by: confirmedBy ?? null,
  })
  if (error) throw error
}

/**
 * Confirmer la réception (côté site destination)
 * → Crédite le stock destination, clôt le transfert
 * adjustments : permet de signaler des écarts (casse en transit, manquants)
 */
export async function receiveTransfer(
  transferId: string,
  receivedBy?: string,
  adjustments?: TransferReceiptAdjustment[]
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('confirm_transfer_receipt', {
    p_transfer_id:  transferId,
    p_received_by:  receivedBy   ?? null,
    p_adjustments:  adjustments  ? JSON.stringify(adjustments) : null,
  })
  if (error) throw error
}

/** Annuler un transfert (uniquement si pas encore expédié) */
export async function cancelTransfer(transferId: string, note?: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('transfers')
    .update({
      statut:     'annulé',
      notes:      note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId)
    .in('statut', ['brouillon', 'demandé']) // Impossible d'annuler après expédition
  if (error) throw error
}

/** Mettre à jour les infos de transport d'un transfert */
export async function updateTransferTracking(
  transferId: string,
  updates: { transporteur?: string; numero_suivi?: string; statut?: 'en_transit' }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('transfers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', transferId)
  if (error) throw error
}

// ============================================================
// COMMANDES
// ============================================================

export async function getOrders(
  opts: { statut?: string; siteId?: string } = {}
): Promise<Order[]> {
  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*), customers(prenom, nom, email), sites(nom, code)')
    .order('created_at', { ascending: false })
  if (opts.statut) query = query.eq('statut', opts.statut)
  if (opts.siteId) query = query.eq('site_id', opts.siteId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function updateOrderStatus(orderId: string, statut: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('orders').update({ statut }).eq('id', orderId)
  if (error) throw error
}

// ============================================================
// IA — Génération automatique de fiche produit (Google Gemini)
// ============================================================

export async function generateProductWithAI(params: {
  nom: string
  domaine?: string
  appellation?: string
  millesime?: number
  couleur: string
}): Promise<AIGeneratedProduct> {
  const prompt = `Tu es un expert sommelier. Génère une fiche produit complète pour ce vin :
- Nom : ${params.nom}
${params.domaine ? `- Domaine : ${params.domaine}` : ''}
${params.appellation ? `- Appellation : ${params.appellation}` : ''}
${params.millesime ? `- Millésime : ${params.millesime}` : ''}
- Couleur : ${params.couleur}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans balises \`\`\`, avec exactement cette structure :
{
  "description_courte": "1 phrase percutante de 15 mots max",
  "description_longue": "Paragraphe de 80 mots décrivant le terroir, le producteur et le style du vin",
  "cepages": ["Cépage1"],
  "alcool": 13.5,
  "aromes": ["Arôme1", "Arôme2", "Arôme3", "Arôme4", "Arôme5"],
  "accords": ["Accord1", "Accord2", "Accord3"],
  "temp_service_min": 14,
  "temp_service_max": 17,
  "decantation_min": 30,
  "type_verre": "Bordeaux",
  "apogee_debut": 2026,
  "apogee_fin": 2035,
  "profil": {
    "acidite": 65,
    "tanins": 78,
    "corps": 82,
    "mineralite": 55,
    "sucrosite": 15,
    "longueur": 88,
    "complexite": 85
  }
}`

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Clé GEMINI_API_KEY manquante dans .env.local')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Erreur API Gemini : ${err.error?.message ?? response.statusText}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) throw new Error('Réponse Gemini vide ou inattendue')

  // Nettoyer les éventuelles balises markdown que Gemini pourrait ajouter malgré tout
  const clean = text.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(clean) as AIGeneratedProduct
  } catch {
    throw new Error(`Gemini n'a pas retourné du JSON valide : ${clean.slice(0, 200)}`)
  }
}

export async function createProductWithAI(params: {
  nom: string
  domaine_id?: string
  domaine_nom?: string
  appellation_id?: string
  appellation_nom?: string
  millesime?: number
  couleur: string
  prix_vente_ttc: number
  prix_achat_ht?: number
}): Promise<Product> {
  const aiData = await generateProductWithAI({
    nom:         params.nom,
    domaine:     params.domaine_nom,
    appellation: params.appellation_nom,
    millesime:   params.millesime,
    couleur:     params.couleur,
  })

  const product = await createProduct({
    nom:               params.nom,
    domaine_id:        params.domaine_id,
    appellation_id:    params.appellation_id,
    millesime:         params.millesime,
    couleur:           params.couleur as any,
    prix_vente_ttc:    params.prix_vente_ttc,
    prix_achat_ht:     params.prix_achat_ht,
    cepages:           aiData.cepages,
    alcool:            aiData.alcool,
    description_courte: aiData.description_courte,
    description_longue: aiData.description_longue,
    actif:             false, // L'admin valide avant publication
  })

  await saveTastingNotes(product.id, {
    aromes:          aiData.aromes,
    accords:         aiData.accords,
    temp_service_min: aiData.temp_service_min,
    temp_service_max: aiData.temp_service_max,
    decantation_min:  aiData.decantation_min,
    type_verre:       aiData.type_verre,
    apogee_debut:     aiData.apogee_debut,
    apogee_fin:       aiData.apogee_fin,
    acidite:          aiData.profil.acidite,
    tanins:           aiData.profil.tanins,
    corps:            aiData.profil.corps,
    mineralite:       aiData.profil.mineralite,
    sucrosite:        aiData.profil.sucrosite,
    longueur:         aiData.profil.longueur,
    complexite:       aiData.profil.complexite,
  })

  return product
}
