// ============================================================
// CAVE DE GILBERT — Types Bière
// Location tireuse + vente fût consigné
// ============================================================

export type BeerRentalStatus =
  | 'devis'
  | 'confirmée'
  | 'en_cours'
  | 'terminée'
  | 'annulée'
  | 'litige'

export type KegReturnStatus =
  | 'en_attente'
  | 'rendu_plein'
  | 'rendu_vide'
  | 'non_rendu'
  | 'abime'

export type TapUnitStatus =
  | 'disponible'
  | 'louee'
  | 'maintenance'
  | 'hors_service'

export type KegMovementReason =
  | 'reception_fournisseur'
  | 'depart_client'
  | 'retour_client_vide'
  | 'retour_client_plein'
  | 'retour_fournisseur'
  | 'perte'
  | 'ajustement'

// ────────────────────────────────────────────────────────────
// BIÈRES & RÉFÉRENCES FÛTS
// ────────────────────────────────────────────────────────────

export interface Beer {
  id: string
  nom: string
  brasserie: string | null
  style: string | null
  degre_alcool: number | null
  description: string | null
  image_url: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface KegReference {
  id: string
  beer_id: string
  contenance_litres: number     // 5, 10, 20, 30, 50
  prix_vente_ttc: number        // Prix de la bière
  consigne_ttc: number          // Montant de la consigne
  tva_taux: number
  actif: boolean
  created_at: string
  updated_at: string
  // Relation
  beer?: Beer
}

// ────────────────────────────────────────────────────────────
// TIREUSES (unités physiques)
// ────────────────────────────────────────────────────────────

export interface TapUnit {
  id: string
  numero_serie: string          // 'TIR-001'
  modele: string | null
  site_id: string | null
  statut: TapUnitStatus
  date_achat: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TapRentalRate {
  id: string
  nom: string                   // 'Weekend', 'Journée'
  description: string | null
  duree_max_jours: number | null
  prix_ttc: number
  tva_taux: number
  actif: boolean
  created_at: string
}

// Vue disponibilité tireuses
export interface TapAvailability extends TapUnit {
  site: string | null
  rental_id: string | null
  rental_numero: string | null
  date_depart: string | null
  date_retour_prevue: string | null
  client_actuel: string | null
}

// ────────────────────────────────────────────────────────────
// LOCATIONS
// ────────────────────────────────────────────────────────────

export interface BeerRental {
  id: string
  numero: string                // 'LOC-2024-00018'

  // Client
  customer_id: string | null
  client_nom: string | null
  client_prenom: string | null
  client_telephone: string | null
  client_email: string | null

  // Événement
  nom_evenement: string | null
  type_evenement: string | null
  nb_personnes: number | null

  // Dates
  date_depart: string
  date_retour_prevue: string
  date_retour_effective: string | null

  // Tireuse
  tap_unit_id: string | null
  tap_rental_rate_id: string | null
  prix_location_ttc: number | null

  // Statut et paiement
  statut: BeerRentalStatus
  acompte_montant: number
  acompte_recu_le: string | null
  total_ht: number | null
  total_tva: number | null
  total_ttc: number | null
  total_consignes_ttc: number | null
  consignes_remboursees: number
  solde_du: number | null

  stripe_payment_id: string | null
  site_id: string | null
  notes_client: string | null
  notes_admin: string | null
  created_at: string
  updated_at: string

  // Relations
  kegs?: BeerRentalKeg[]
  tap_unit?: TapUnit
  customer?: { prenom: string; nom: string; email: string; telephone: string }
}

export interface BeerRentalKeg {
  id: string
  rental_id: string
  keg_reference_id: string

  // Snapshot
  beer_nom: string
  contenance_litres: number
  prix_vente_ttc: number
  consigne_ttc: number

  // Retour
  statut_retour: KegReturnStatus
  date_retour: string | null
  consigne_remboursee: number
  note_retour: string | null

  // Relation
  keg_reference?: KegReference
}

// Pour créer une location
export interface BeerRentalInsert {
  // Client
  customer_id?: string
  client_nom?: string
  client_prenom?: string
  client_telephone?: string
  client_email?: string

  // Événement
  nom_evenement?: string
  type_evenement?: string
  nb_personnes?: number

  // Dates
  date_depart: string
  date_retour_prevue: string

  // Tireuse
  tap_unit_id?: string
  tap_rental_rate_id?: string
  prix_location_ttc?: number

  site_id?: string
  notes_client?: string
  notes_admin?: string

  // Fûts commandés
  kegs: {
    keg_reference_id: string
    beer_nom: string
    contenance_litres: number
    prix_vente_ttc: number
    consigne_ttc: number
  }[]
}

// Vue tableau de bord locations actives
export interface RentalActive {
  id: string
  numero: string
  statut: BeerRentalStatus
  nom_evenement: string | null
  type_evenement: string | null
  nb_personnes: number | null
  client: string
  telephone: string | null
  email: string | null
  date_depart: string
  date_retour_prevue: string
  date_retour_effective: string | null
  jours_restants: number        // Négatif = en retard
  tireuse: string | null
  prix_location_ttc: number | null
  total_ttc: number | null
  total_consignes_ttc: number | null
  consignes_remboursees: number
  acompte_montant: number
  site: string | null
  nb_futs: number
}

// ────────────────────────────────────────────────────────────
// STOCK FÛTS
// ────────────────────────────────────────────────────────────

export interface KegInventory {
  id: string
  keg_reference_id: string
  site_id: string
  quantite_plein: number
  quantite_vide: number
  quantite_consigne: number     // Actuellement chez des clients
  seuil_alerte: number
  updated_at: string
}

// Vue stock fûts enrichie
export interface KegStock {
  site_id: string
  site: string
  keg_reference_id: string
  biere: string
  style: string | null
  contenance_litres: number
  prix_vente_ttc: number
  consigne_ttc: number
  quantite_plein: number
  quantite_vide: number
  quantite_consigne: number
  seuil_alerte: number
  stock_statut: 'disponible' | 'alerte' | 'rupture'
}

// Vue fûts en retard de retour
export interface KegEnRetard {
  location: string
  date_retour_prevue: string
  jours_retard: number
  client: string
  telephone: string | null
  biere: string
  contenance_litres: number
  consigne_ttc: number
  site_id: string
}

// Payload pour le retour d'une location
export interface KegReturnPayload {
  keg_id: string
  statut: KegReturnStatus
  consigne_remboursee?: number  // Obligatoire si statut = 'abime'
  note?: string
}

// Résumé retourné par process_rental_return()
export interface RentalReturnSummary {
  rental_numero: string
  consignes_engagees: number
  consignes_remboursees: number
  consignes_retenues: number
  date_retour: string
}
