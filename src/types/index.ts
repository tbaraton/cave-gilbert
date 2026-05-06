// ============================================================
// CAVE DE GILBERT — Types TypeScript v2.0
// Multi-sites + Transferts inter-sites
// ============================================================

export type WineColor = 'rouge' | 'blanc' | 'rosé' | 'champagne' | 'effervescent' | 'spiritueux' | 'autre'
export type WineSize = 'demi' | 'bouteille' | 'magnum' | 'jeroboam' | 'mathusalem'
export type StockStatus = 'disponible' | 'alerte' | 'rupture'
export type OrderStatus = 'panier' | 'en_attente' | 'payée' | 'préparée' | 'expédiée' | 'livrée' | 'annulée' | 'remboursée'
export type SiteType = 'cave' | 'boutique' | 'entrepot' | 'popup'
export type TransferStatus = 'brouillon' | 'demandé' | 'confirmé' | 'en_transit' | 'reçu' | 'annulé'
export type StockMovementReason =
  | 'achat'
  | 'vente'
  | 'ajustement'
  | 'casse'
  | 'dégustation'
  | 'retour'
  | 'transfert_out'
  | 'transfert_in'

// ────────────────────────────────────────────────────────────
// SITES
// ────────────────────────────────────────────────────────────

export interface Site {
  id: string
  code: string              // 'LYON', 'PARIS'
  nom: string               // 'Boutique Lyon Presqu'île'
  type: SiteType
  adresse: string | null
  ville: string | null
  code_postal: string | null
  telephone: string | null
  responsable: string | null
  actif: boolean
  vente_en_ligne: boolean
  visible_clients: boolean
  created_at: string
  updated_at: string
}

export interface SiteInsert {
  code: string
  nom: string
  type?: SiteType
  adresse?: string
  ville?: string
  code_postal?: string
  telephone?: string
  responsable?: string
  vente_en_ligne?: boolean
  visible_clients?: boolean
}

// ────────────────────────────────────────────────────────────
// PRODUITS
// ────────────────────────────────────────────────────────────

export interface Product {
  id: string
  nom: string
  domaine_id: string | null
  appellation_id: string | null
  millesime: number | null
  couleur: WineColor
  contenance: WineSize
  contenance_cl: number
  cepages: string[]
  alcool: number | null
  bio: boolean
  biodynamie: boolean
  prix_achat_ht: number | null
  prix_vente_ttc: number
  tva_taux: number
  actif: boolean
  mis_en_avant: boolean
  description_courte: string | null
  description_longue: string | null
  ia_generated: boolean
  ia_generated_at: string | null
  slug: string | null
  image_url: string | null
  images_urls: string[]
  created_at: string
  updated_at: string
}

export interface ProductInsert {
  nom: string
  couleur: WineColor
  prix_vente_ttc: number
  domaine_id?: string
  appellation_id?: string
  millesime?: number
  contenance?: WineSize
  contenance_cl?: number
  cepages?: string[]
  alcool?: number
  bio?: boolean
  biodynamie?: boolean
  prix_achat_ht?: number
  actif?: boolean
  description_courte?: string
  description_longue?: string
  image_url?: string
}

// Vue catalogue enrichie (v_catalogue) — stock global tous sites
export interface CatalogueProduct extends Product {
  domaine: string | null
  appellation: string | null
  region: string | null
  stock_total: number        // somme de tous les sites
  stock_statut: StockStatus  // basé sur le stock global
  aromes: string[]
  accords: string[]
  temp_service_min: number | null
  temp_service_max: number | null
}

// ────────────────────────────────────────────────────────────
// STOCK
// ────────────────────────────────────────────────────────────

export interface Stock {
  id: string
  product_id: string
  site_id: string
  quantite: number
  seuil_alerte: number
  emplacement: string | null
  updated_at: string
}

// Vue stock détaillée par site (v_stock_par_site)
export interface StockParSite {
  product_id: string
  produit: string
  millesime: number | null
  couleur: WineColor
  image_url: string | null
  site_id: string
  site: string
  site_code: string
  site_type: SiteType
  quantite: number
  seuil_alerte: number
  emplacement: string | null
  stock_statut: StockStatus
  updated_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  site_id: string
  raison: StockMovementReason
  quantite: number
  stock_avant: number
  stock_apres: number
  note: string | null
  order_id: string | null
  transfer_id: string | null
  created_by: string | null
  created_at: string
}

// ────────────────────────────────────────────────────────────
// TRANSFERTS
// ────────────────────────────────────────────────────────────

export interface Transfer {
  id: string
  numero: string
  site_source_id: string
  site_destination_id: string
  statut: TransferStatus
  demande_le: string | null
  confirme_le: string | null
  recu_le: string | null
  transporteur: string | null
  numero_suivi: string | null
  demande_par: string | null
  confirme_par: string | null
  recu_par: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Relations optionnelles
  items?: TransferItem[]
  site_source?: Site
  site_destination?: Site
}

export interface TransferItem {
  id: string
  transfer_id: string
  product_id: string
  quantite_demandee: number
  quantite_envoyee: number | null
  quantite_recue: number | null
  stock_source_avant: number | null
  note: string | null
  // Relation optionnelle
  product?: Product
}

export interface TransferInsert {
  site_source_id: string
  site_destination_id: string
  notes?: string
  transporteur?: string
  items: {
    product_id: string
    quantite_demandee: number
    note?: string
  }[]
}

// Vue des transferts actifs (v_transfers_actifs)
export interface TransferActif {
  id: string
  numero: string
  statut: TransferStatus
  site_source: string
  source_code: string
  site_destination: string
  destination_code: string
  demande_le: string | null
  confirme_le: string | null
  recu_le: string | null
  transporteur: string | null
  numero_suivi: string | null
  notes: string | null
  nb_references: number
  nb_bouteilles: number
}

// Payload pour confirmer la réception avec ajustements
export interface TransferReceiptAdjustment {
  product_id: string
  quantite_recue: number
}

// ────────────────────────────────────────────────────────────
// NOTES DE DÉGUSTATION
// ────────────────────────────────────────────────────────────

export interface TastingNote {
  id: string
  product_id: string
  acidite: number | null
  tanins: number | null
  corps: number | null
  mineralite: number | null
  sucrosite: number | null
  longueur: number | null
  complexite: number | null
  aromes: string[]
  temp_service_min: number | null
  temp_service_max: number | null
  decantation_min: number | null
  type_verre: string | null
  apogee_debut: number | null
  apogee_fin: number | null
  garde_max: number | null
  accords: string[]
  score_parker: number | null
  score_rvf: number | null
  score_bettane: number | null
  created_at: string
  updated_at: string
}

// ────────────────────────────────────────────────────────────
// COMMANDES
// ────────────────────────────────────────────────────────────

export interface Order {
  id: string
  numero: string
  customer_id: string | null
  site_id: string | null    // Site qui prépare la commande
  statut: OrderStatus
  adresse_livraison: Address | null
  adresse_facturation: Address | null
  sous_total_ht: number | null
  tva_montant: number | null
  frais_livraison: number
  total_ttc: number
  stripe_payment_id: string | null
  stripe_status: string | null
  paye_a: string | null
  transporteur: string | null
  numero_suivi: string | null
  expedie_a: string | null
  livre_a: string | null
  notes_client: string | null
  notes_admin: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
  customer?: Customer
  site?: Site
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_nom: string
  product_millesime: number | null
  product_contenance: string | null
  quantite: number
  prix_unitaire_ttc: number
  tva_taux: number | null
  total_ttc: number
  created_at: string
}

// ────────────────────────────────────────────────────────────
// CLIENTS
// ────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  auth_user_id: string | null
  email: string
  prenom: string | null
  nom: string | null
  telephone: string | null
  date_naissance: string | null
  newsletter: boolean
  notes_admin: string | null
  created_at: string
  updated_at: string
}

export interface Address {
  id?: string
  customer_id?: string
  label?: string
  prenom: string
  nom: string
  ligne1: string
  ligne2?: string
  code_postal: string
  ville: string
  pays: string
  par_defaut?: boolean
}

// ────────────────────────────────────────────────────────────
// IA — Payload retourné par Claude pour remplir une fiche
// ────────────────────────────────────────────────────────────

export interface AIGeneratedProduct {
  description_courte: string
  description_longue: string
  cepages: string[]
  alcool: number
  aromes: string[]
  accords: string[]
  temp_service_min: number
  temp_service_max: number
  decantation_min: number
  type_verre: string
  apogee_debut: number
  apogee_fin: number
  profil: {
    acidite: number
    tanins: number
    corps: number
    mineralite: number
    sucrosite: number
    longueur: number
    complexite: number
  }
}

// ────────────────────────────────────────────────────────────
// FILTRES catalogue
// ────────────────────────────────────────────────────────────

export interface CatalogueFilters {
  couleur?: WineColor[]
  region?: string[]
  appellation?: string[]
  millesime_min?: number
  millesime_max?: number
  prix_min?: number
  prix_max?: number
  bio?: boolean
  stock_disponible?: boolean
  search?: string
  sort?: 'prix_asc' | 'prix_desc' | 'millesime_desc' | 'millesime_asc' | 'nom_asc'
}

// ────────────────────────────────────────────────────────────
// PANIER (état local, côté client)
// ────────────────────────────────────────────────────────────

export interface CartItem {
  product: CatalogueProduct
  quantite: number
}

export interface Cart {
  items: CartItem[]
  total_ttc: number
  nb_articles: number
}
