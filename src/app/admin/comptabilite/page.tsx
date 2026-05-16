// src/app/admin/comptabilite/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
type Onglet = 'dashboard' | 'achats' | 'ventes' | 'banque' | 'export'

type Entreprise = {
  id: string
  code: string
  raison_sociale: string
}

type Fournisseur = {
  id: string
  code: string | null
  nom: string
  categorie: string
  compte_charge_id: string | null
  compte_fournisseur_id: string | null
}

type CompteComptable = {
  id: string
  numero: string
  libelle: string
  classe: number
  type: string
}

type LigneFacture = {
  id?: string
  ordre: number
  libelle: string
  quantite: number
  prix_unitaire_ht: number | null
  montant_ht: number
  tva_taux: number
  montant_tva: number
  montant_ttc: number
  compte_charge_id: string | null
}

type FactureAchat = {
  id: string
  numero_interne: string
  numero_fournisseur: string | null
  entreprise_id: string
  fournisseur_id: string | null
  date_facture: string
  date_reception: string | null
  date_echeance: string | null
  total_ht: number
  total_tva: number
  total_ttc: number
  statut: 'brouillon' | 'a_valider' | 'validee' | 'payee' | 'litige' | 'annulee'
  mode_paiement: string | null
  date_paiement: string | null
  fichier_base64: string | null
  fichier_nom: string | null
  analyse_ia_statut: string
  analyse_ia_data: any
  notes: string | null
  created_at: string
  fournisseur?: Fournisseur
  entreprise?: Entreprise
  lignes?: LigneFacture[]
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
const fmt = (n: number | string | null | undefined) => {
  const v = parseFloat(String(n ?? 0))
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ajouterJours = (date: string, jours: number) => {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + jours)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
const moisActuel = () => {
  const d = new Date()
  return { debut: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, fin: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31` }
}

const STATUT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',   color: 'rgba(232,224,213,0.6)', bg: 'rgba(255,255,255,0.06)' },
  a_valider:  { label: 'À valider',   color: '#c9a96e',                bg: 'rgba(201,169,110,0.12)' },
  validee:    { label: 'Validée',     color: '#6e9ec9',                bg: 'rgba(110,158,201,0.12)' },
  payee:      { label: 'Payée',       color: '#6ec96e',                bg: 'rgba(110,201,110,0.12)' },
  litige:     { label: 'Litige',      color: '#c96e6e',                bg: 'rgba(201,110,110,0.12)' },
  annulee:    { label: 'Annulée',     color: 'rgba(232,224,213,0.3)',  bg: 'rgba(255,255,255,0.03)' },
}

// ═══════════════════════════════════════════════════════════════
// Styles partagés
// ═══════════════════════════════════════════════════════════════
const card: any = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '20px 24px',
  marginBottom: 16,
}
const inp: any = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  borderRadius: 4,
  color: '#e8e0d5',
  fontSize: 13,
  padding: '8px 12px',
  fontFamily: 'inherit',
}
const sel: any = { ...inp, cursor: 'pointer' }
const lbl: any = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }
const btnGold: any = {
  background: '#c9a96e', color: '#0d0a08', border: 'none',
  borderRadius: 6, padding: '10px 20px', fontSize: 11,
  letterSpacing: 2, cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase',
}
const btnGhost: any = {
  background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)',
  color: 'rgba(232,224,213,0.6)', borderRadius: 6, padding: '10px 16px',
  fontSize: 12, cursor: 'pointer',
}

// ═══════════════════════════════════════════════════════════════
// Page principale
// ═══════════════════════════════════════════════════════════════
export default function ComptabilitePage() {
  const [onglet, setOnglet] = useState<Onglet>('dashboard')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  // Vérification auth + permission
  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setAuthReady(true); return }

        const { data: profile } = await supabase.from('users')
          .select('*').eq('auth_user_id', authUser.id).maybeSingle()
        if (!profile) { setAuthReady(true); return }
        setCurrentUser(profile)

        if (profile.role === 'admin') { setHasAccess(true); setAuthReady(true); return }

        const { data: perms } = await supabase.from('user_permissions')
          .select('acces_comptabilite').eq('user_id', profile.id).maybeSingle()
        setHasAccess(perms?.acces_comptabilite === true)
      } finally {
        setAuthReady(true)
      }
    })()
  }, [])

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.4)' }}>
        ⟳ Chargement…
      </div>
    )
  }
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.6)', flexDirection: 'column' as const, gap: 16 }}>
        <div>Non connecté</div>
        <a href="/login" style={{ color: '#c9a96e' }}>Se connecter</a>
      </div>
    )
  }
  if (!hasAccess) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.6)', flexDirection: 'column' as const, gap: 16 }}>
        <div>Accès refusé — permission "Comptabilité" requise</div>
        <a href="/admin" style={{ color: '#c9a96e' }}>← Retour</a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <SidebarCompta currentUser={currentUser} />

      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', maxWidth: 'calc(100vw - 220px)' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 6 }}>Comptabilité</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {[
            { id: 'dashboard' as Onglet, label: 'Tableau de bord' },
            { id: 'achats' as Onglet, label: 'Achats' },
            { id: 'ventes' as Onglet, label: 'Ventes & TVA' },
            { id: 'banque' as Onglet, label: 'Banque' },
            { id: 'export' as Onglet, label: 'Export comptable' },
          ].map(t => (
            <button key={t.id} onClick={() => setOnglet(t.id)} style={{
              background: 'transparent', border: 'none',
              borderBottom: onglet === t.id ? '2px solid #c9a96e' : '2px solid transparent',
              color: onglet === t.id ? '#c9a96e' : 'rgba(232,224,213,0.4)',
              padding: '10px 20px', fontSize: 12, letterSpacing: 1.5, cursor: 'pointer',
              textTransform: 'uppercase' as const, fontWeight: 500,
            }}>{t.label}</button>
          ))}
        </div>

        {onglet === 'dashboard' && <DashboardCompta />}
        {onglet === 'achats' && <OngletAchats currentUser={currentUser} />}
        {onglet === 'ventes' && <OngletVentes />}
        {onglet === 'banque' && <OngletBanque currentUser={currentUser} />}
        {onglet === 'export' && <OngletExport />}
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Sidebar simple (pattern allégé)
// ═══════════════════════════════════════════════════════════════
function SidebarCompta({ currentUser }: { currentUser: any }) {
  return (
    <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' as const, padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 100 }}>
      <div style={{ padding: '0 20px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <a href="/admin" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </a>
      </div>
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' as const }}>
        <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.5)', textDecoration: 'none', borderLeft: '2px solid transparent' }}>
          <span>←</span>Retour au backoffice
        </a>
        <div style={{ height: 12 }} />
        <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(232,224,213,0.25)', padding: '4px 20px 8px', textTransform: 'uppercase' as const }}>Comptabilité</div>
        <a href="/admin/comptabilite" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: '#c9a96e', textDecoration: 'none', borderLeft: '2px solid #c9a96e', background: 'rgba(201,169,110,0.08)' }}>
          <span>€</span>Comptabilité
        </a>
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, color: '#e8e0d5', fontWeight: 600 }}>{currentUser?.prenom}</div>
        <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', textTransform: 'capitalize' as const }}>{currentUser?.role}</div>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════
// ONGLET 1 — DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardCompta() {
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<any>({})
  const [factures, setFactures] = useState<FactureAchat[]>([])

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { debut, fin } = moisActuel()

      // KPIs : CA, achats, TVA, factures en attente, factures en retard
      const [
        { data: entreprises },
        { data: ventes },
        { data: facturesAchat },
      ] = await Promise.all([
        supabase.from('entreprises').select('id, code, raison_sociale').order('code'),
        supabase.from('ventes')
          .select('total_ht, total_ttc, site_id')
          .eq('statut', 'validee')
          .neq('statut_paiement', 'non_regle')
          .gte('created_at', `${debut}T00:00:00`)
          .lte('created_at', `${fin}T23:59:59`),
        supabase.from('factures_achat')
          .select('*, fournisseur:fournisseurs(nom, categorie), entreprise:entreprises(code, raison_sociale)')
          .order('date_facture', { ascending: false })
          .limit(100),
      ])

      // CA total + ventilation par entreprise (CDG = Marcy + Entrepôt, LPC = Arbresle)
      const ID_MARCY = 'ee3afa96-0c45-407f-87fc-e503fbada6c4'
      const ID_ENTREPOT = 'e12d7e47-23dc-4011-95fc-e9e975fc4307'
      const ID_ARBRESLE = '3097e864-f452-4c2e-9af3-21e26f0330b7'

      const caCDG = (ventes || [])
        .filter((v: any) => v.site_id === ID_MARCY || v.site_id === ID_ENTREPOT)
        .reduce((sum: number, v: any) => sum + parseFloat(v.total_ttc || 0), 0)
      const caLPC = (ventes || [])
        .filter((v: any) => v.site_id === ID_ARBRESLE)
        .reduce((sum: number, v: any) => sum + parseFloat(v.total_ttc || 0), 0)
      const caCDG_HT = (ventes || [])
        .filter((v: any) => v.site_id === ID_MARCY || v.site_id === ID_ENTREPOT)
        .reduce((sum: number, v: any) => sum + parseFloat(v.total_ht || 0), 0)
      const caLPC_HT = (ventes || [])
        .filter((v: any) => v.site_id === ID_ARBRESLE)
        .reduce((sum: number, v: any) => sum + parseFloat(v.total_ht || 0), 0)

      // Achats du mois (factures dont la date_facture est dans le mois)
      const facMois = (facturesAchat || []).filter((f: any) =>
        f.date_facture >= debut && f.date_facture <= fin && f.statut !== 'annulee'
      )
      const achatsCDG = facMois
        .filter((f: any) => f.entreprise?.code === 'CDG')
        .reduce((sum: number, f: any) => sum + parseFloat(f.total_ht || 0), 0)
      const achatsLPC = facMois
        .filter((f: any) => f.entreprise?.code === 'LPC')
        .reduce((sum: number, f: any) => sum + parseFloat(f.total_ht || 0), 0)
      const tvaDedCDG = facMois
        .filter((f: any) => f.entreprise?.code === 'CDG')
        .reduce((sum: number, f: any) => sum + parseFloat(f.total_tva || 0), 0)
      const tvaDedLPC = facMois
        .filter((f: any) => f.entreprise?.code === 'LPC')
        .reduce((sum: number, f: any) => sum + parseFloat(f.total_tva || 0), 0)

      // TVA collectée estimée (CA TTC - CA HT)
      const tvaColCDG = caCDG - caCDG_HT
      const tvaColLPC = caLPC - caLPC_HT

      // Factures à valider / à payer
      const aValider = (facturesAchat || []).filter((f: any) => f.statut === 'a_valider' || f.statut === 'brouillon')
      const aPayer = (facturesAchat || []).filter((f: any) => f.statut === 'validee')
      const enRetard = aPayer.filter((f: any) => f.date_echeance && f.date_echeance < today())

      setKpis({
        caCDG, caLPC, caCDG_HT, caLPC_HT,
        achatsCDG, achatsLPC,
        tvaDedCDG, tvaDedLPC, tvaColCDG, tvaColLPC,
        soldeTvaCDG: tvaColCDG - tvaDedCDG,
        soldeTvaLPC: tvaColLPC - tvaDedLPC,
        margeCDG: caCDG_HT - achatsCDG,
        margeLPC: caLPC_HT - achatsLPC,
        nbAValider: aValider.length,
        nbAPayer: aPayer.length,
        nbEnRetard: enRetard.length,
        entreprises: entreprises || [],
      })
      setFactures([...aValider.slice(0, 5), ...enRetard.slice(0, 5)])
      setLoading(false)
    })()
  }, [])

  if (loading) return <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement…</div>

  return (
    <div>
      {/* Bloc 1 — Vue d'ensemble du mois */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', marginBottom: 12, textTransform: 'uppercase' as const }}>
          Mois en cours — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Cave de Gilbert (CDG) */}
        <div style={{ ...card, borderLeft: '3px solid #c9a96e' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', marginBottom: 14, textTransform: 'uppercase' as const }}>Cave de Gilbert</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <KpiInline label="CA TTC" value={`${fmt(kpis.caCDG)} €`} color="#6ec96e" />
            <KpiInline label="Achats HT" value={`${fmt(kpis.achatsCDG)} €`} color="#c96e6e" />
            <KpiInline label="TVA collectée (est.)" value={`${fmt(kpis.tvaColCDG)} €`} />
            <KpiInline label="TVA déductible" value={`${fmt(kpis.tvaDedCDG)} €`} />
            <KpiInline label="Solde TVA dû" value={`${fmt(kpis.soldeTvaCDG)} €`} color={kpis.soldeTvaCDG > 0 ? '#c96e6e' : '#6ec96e'} />
            <KpiInline label="Marge brute (est.)" value={`${fmt(kpis.margeCDG)} €`} color={kpis.margeCDG > 0 ? '#6ec96e' : '#c96e6e'} />
          </div>
        </div>

        {/* La Petite Cave (LPC) */}
        <div style={{ ...card, borderLeft: '3px solid #6e9ec9' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#6e9ec9', marginBottom: 14, textTransform: 'uppercase' as const }}>La Petite Cave</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <KpiInline label="CA TTC" value={`${fmt(kpis.caLPC)} €`} color="#6ec96e" />
            <KpiInline label="Achats HT" value={`${fmt(kpis.achatsLPC)} €`} color="#c96e6e" />
            <KpiInline label="TVA collectée (est.)" value={`${fmt(kpis.tvaColLPC)} €`} />
            <KpiInline label="TVA déductible" value={`${fmt(kpis.tvaDedLPC)} €`} />
            <KpiInline label="Solde TVA dû" value={`${fmt(kpis.soldeTvaLPC)} €`} color={kpis.soldeTvaLPC > 0 ? '#c96e6e' : '#6ec96e'} />
            <KpiInline label="Marge brute (est.)" value={`${fmt(kpis.margeLPC)} €`} color={kpis.margeLPC > 0 ? '#6ec96e' : '#c96e6e'} />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', marginBottom: 24, fontStyle: 'italic' as const }}>
        ⓘ TVA collectée estimée sur la base des ventes encaissées ce mois. Le calcul officiel via écritures comptables sera dispo en Phase 2.
      </div>

      {/* Bloc 2 — Alertes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiCard label="À valider / brouillons" value={kpis.nbAValider} color="#c9a96e" />
        <KpiCard label="À payer" value={kpis.nbAPayer} color="#6e9ec9" />
        <KpiCard label="En retard de paiement" value={kpis.nbEnRetard} color="#c96e6e" />
      </div>

      {/* Bloc 3 — Liste rapide des factures à traiter */}
      {factures.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', marginBottom: 14, textTransform: 'uppercase' as const }}>Factures à traiter en priorité</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['N°', 'Fournisseur', 'Entreprise', 'Date', 'Échéance', 'Total TTC', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factures.map((f, i) => {
                const enRetard = f.statut === 'validee' && f.date_echeance && f.date_echeance < today()
                const st = STATUT_LABELS[f.statut]
                return (
                  <tr key={f.id} style={{ borderBottom: i < factures.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#e8e0d5', fontFamily: 'monospace' }}>{f.numero_interne}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#e8e0d5' }}>{f.fournisseur?.nom || <em style={{ color: 'rgba(232,224,213,0.3)' }}>—</em>}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>{f.entreprise?.code}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>{fmtDate(f.date_facture)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: enRetard ? '#c96e6e' : 'rgba(232,224,213,0.5)' }}>{fmtDate(f.date_echeance)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#e8e0d5', fontFamily: 'Georgia, serif', textAlign: 'right' as const }}>{fmt(f.total_ttc)} €</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 3, letterSpacing: 0.5 }}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KpiInline({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', fontWeight: 300, color: color || '#f0e8d8' }}>{value}</div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...card, borderLeft: `3px solid ${color}`, marginBottom: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontFamily: 'Georgia, serif', fontWeight: 300, color }}>{value}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ONGLET 2 — ACHATS
// ═══════════════════════════════════════════════════════════════
function OngletAchats({ currentUser }: { currentUser: any }) {
  const [factures, setFactures] = useState<FactureAchat[]>([])
  const [loading, setLoading] = useState(true)
  const [showNouvelle, setShowNouvelle] = useState(false)
  const [detailFacture, setDetailFacture] = useState<FactureAchat | null>(null)

  // Filtres
  const [filtreEntreprise, setFiltreEntreprise] = useState<string>('')
  const [filtreStatut, setFiltreStatut] = useState<string>('')
  const [filtreFournisseur, setFiltreFournisseur] = useState<string>('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: facs }, { data: ents }, { data: facsInter }] = await Promise.all([
      supabase.from('factures_achat')
        .select('*, fournisseur:fournisseurs(id, nom, categorie), entreprise:entreprises(id, code, raison_sociale)')
        .order('date_facture', { ascending: false })
        .limit(500),
      supabase.from('entreprises').select('id, code, raison_sociale').order('code'),
      supabase.from('factures_intersocietes')
        .select('*, transfer:stock_transfers(numero)')
        .neq('statut', 'brouillon')
        .order('date_emission', { ascending: false })
        .limit(500),
    ])

    // Mapping site → entreprise (CDG = Marcy + Entrepôt, LPC = Arbresle)
    const ID_MARCY = 'ee3afa96-0c45-407f-87fc-e503fbada6c4'
    const ID_ENTREPOT = 'e12d7e47-23dc-4011-95fc-e9e975fc4307'
    const ID_ARBRESLE = '3097e864-f452-4c2e-9af3-21e26f0330b7'
    const entCDG = (ents || []).find((e: any) => e.code === 'CDG')
    const entLPC = (ents || []).find((e: any) => e.code === 'LPC')
    const siteToEnt = (siteId: string) => {
      if (siteId === ID_ARBRESLE) return entLPC
      if (siteId === ID_MARCY || siteId === ID_ENTREPOT) return entCDG
      return null
    }

    // Factures inter-sociétés vues comme Achat par l'entité destinataire (ou émettrice pour les avoirs).
    // type='facture' : émetteur vend → destinataire achète. L'entité destinataire voit l'achat.
    // type='avoir'   : émetteur/destinataire flippés à la création. L'entité émettrice (= acheteur d'origine)
    //                  reçoit un avoir réduisant son achat.
    const facsInterMapped = (facsInter || []).map((f: any) => {
      const isAvoir = f.type === 'avoir'
      const buyerEnt = isAvoir ? siteToEnt(f.site_emetteur_id) : siteToEnt(f.site_destinataire_id)
      const sellerEnt = isAvoir ? siteToEnt(f.site_destinataire_id) : siteToEnt(f.site_emetteur_id)
      const ht = parseFloat(f.total_ht || 0)
      const ttc = parseFloat(f.total_ttc || 0)
      const sign = isAvoir ? -1 : 1
      return {
        id: `inter-${f.id}`,
        numero_interne: f.numero,
        numero_fournisseur: f.transfer?.numero || null,
        entreprise_id: buyerEnt?.id || null,
        entreprise: buyerEnt,
        fournisseur: {
          id: null,
          nom: `${sellerEnt?.raison_sociale || '—'} (inter-société)`,
          categorie: 'inter_societe',
        },
        date_facture: f.date_emission,
        date_reception: f.date_emission,
        date_echeance: null,
        total_ht: sign * ht,
        total_tva: sign * (ttc - ht),
        total_ttc: sign * ttc,
        statut: f.statut === 'reglee' ? 'reglee' : 'a_valider',
        _isInterCo: true,
        _docType: f.type,
      } as any
    })

    const merged = [...(facs || []), ...facsInterMapped]
      .sort((a, b) => (b.date_facture || '').localeCompare(a.date_facture || ''))
    setFactures(merged)
    setEntreprises(ents || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtrees = useMemo(() => {
    return factures.filter(f => {
      if (filtreEntreprise && f.entreprise_id !== filtreEntreprise) return false
      if (filtreStatut && f.statut !== filtreStatut) return false
      if (filtreFournisseur && !(f.fournisseur?.nom || '').toLowerCase().includes(filtreFournisseur.toLowerCase())) return false
      if (filtreDateDebut && f.date_facture < filtreDateDebut) return false
      if (filtreDateFin && f.date_facture > filtreDateFin) return false
      return true
    })
  }, [factures, filtreEntreprise, filtreStatut, filtreFournisseur, filtreDateDebut, filtreDateFin])

  const totauxFiltres = useMemo(() => ({
    nb: filtrees.length,
    ht: filtrees.reduce((s, f) => s + parseFloat(String(f.total_ht || 0)), 0),
    tva: filtrees.reduce((s, f) => s + parseFloat(String(f.total_tva || 0)), 0),
    ttc: filtrees.reduce((s, f) => s + parseFloat(String(f.total_ttc || 0)), 0),
  }), [filtrees])

  return (
    <div>
      {/* Barre d'actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
          {totauxFiltres.nb} facture{totauxFiltres.nb > 1 ? 's' : ''} — <span style={{ color: '#e8e0d5' }}>{fmt(totauxFiltres.ttc)} € TTC</span>
          {' '}<span style={{ color: 'rgba(232,224,213,0.3)' }}>({fmt(totauxFiltres.ht)} HT + {fmt(totauxFiltres.tva)} TVA)</span>
        </div>
        <button onClick={() => setShowNouvelle(true)} style={btnGold}>+ Nouvelle facture</button>
      </div>

      {/* Filtres */}
      <div style={{ ...card, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Entreprise</label>
            <select value={filtreEntreprise} onChange={e => setFiltreEntreprise(e.target.value)} style={{ ...sel, width: '100%' }}>
              <option value="">Toutes</option>
              {entreprises.map(e => <option key={e.id} value={e.id}>{e.code} — {e.raison_sociale}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Statut</label>
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={{ ...sel, width: '100%' }}>
              <option value="">Tous</option>
              {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Fournisseur</label>
            <input value={filtreFournisseur} onChange={e => setFiltreFournisseur(e.target.value)} placeholder="Rechercher…" style={{ ...inp, width: '100%' }} />
          </div>
          <div>
            <label style={lbl}>Du</label>
            <input type="date" value={filtreDateDebut} onChange={e => setFiltreDateDebut(e.target.value)} style={{ ...inp, width: '100%' }} />
          </div>
          <div>
            <label style={lbl}>Au</label>
            <input type="date" value={filtreDateFin} onChange={e => setFiltreDateFin(e.target.value)} style={{ ...inp, width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement…</div>
      ) : filtrees.length === 0 ? (
        <div style={{ ...card, textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>
          Aucune facture {factures.length > 0 ? 'ne correspond aux filtres' : 'enregistrée'}
        </div>
      ) : (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['N° interne', 'N° fournisseur', 'Entreprise', 'Fournisseur', 'Date', 'Échéance', 'HT', 'TVA', 'TTC', 'Statut', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrees.map((f, i) => {
                const st = STATUT_LABELS[f.statut]
                const enRetard = f.statut === 'validee' && f.date_echeance && f.date_echeance < today()
                const isInterCo = (f as any)._isInterCo
                return (
                  <tr key={f.id} onClick={isInterCo ? undefined : () => setDetailFacture(f)} style={{ borderBottom: i < filtrees.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', cursor: isInterCo ? 'default' : 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: '#e8e0d5', fontFamily: 'monospace' }}>
                      {f.numero_interne}
                      {isInterCo && <span style={{ marginLeft: 6, fontSize: 9, background: 'rgba(110,158,201,0.12)', color: '#6e9ec9', padding: '1px 6px', borderRadius: 3, letterSpacing: 0.5, textTransform: 'uppercase' as const, fontFamily: 'inherit' }}>{(f as any)._docType === 'avoir' ? '↩ avoir' : '↔ inter-soc'}</span>}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: 'rgba(232,224,213,0.6)' }}>{f.numero_fournisseur || '—'}</td>
                    <td style={{ padding: '10px 10px', fontSize: 11 }}>
                      <span style={{ fontSize: 10, background: f.entreprise?.code === 'CDG' ? 'rgba(201,169,110,0.12)' : 'rgba(110,158,201,0.12)', color: f.entreprise?.code === 'CDG' ? '#c9a96e' : '#6e9ec9', padding: '2px 8px', borderRadius: 3 }}>{f.entreprise?.code}</span>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#e8e0d5' }}>{f.fournisseur?.nom || <em style={{ color: 'rgba(232,224,213,0.3)' }}>—</em>}</td>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>{fmtDate(f.date_facture)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: enRetard ? '#c96e6e' : 'rgba(232,224,213,0.5)' }}>{fmtDate(f.date_echeance)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: 'rgba(232,224,213,0.6)', textAlign: 'right' as const, fontFamily: 'Georgia, serif' }}>{fmt(f.total_ht)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 11, color: 'rgba(232,224,213,0.6)', textAlign: 'right' as const, fontFamily: 'Georgia, serif' }}>{fmt(f.total_tva)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#f0e8d8', textAlign: 'right' as const, fontFamily: 'Georgia, serif' }}>{fmt(f.total_ttc)}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: 10, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 3, letterSpacing: 0.5, whiteSpace: 'nowrap' as const }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 14, color: 'rgba(232,224,213,0.3)' }}>›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNouvelle && (
        <ModalNouvelleFacture
          currentUser={currentUser}
          entreprises={entreprises}
          onClose={() => setShowNouvelle(false)}
          onSaved={() => { setShowNouvelle(false); load() }}
        />
      )}

      {detailFacture && (
        <ModalDetailFacture
          facture={detailFacture}
          onClose={() => setDetailFacture(null)}
          onUpdated={() => { setDetailFacture(null); load() }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MODAL — Nouvelle facture (upload + analyse IA + édition)
// ═══════════════════════════════════════════════════════════════
function ModalNouvelleFacture({ currentUser, entreprises, onClose, onSaved }: {
  currentUser: any
  entreprises: Entreprise[]
  onClose: () => void
  onSaved: () => void
}) {
  const [etape, setEtape] = useState<'upload' | 'analyse' | 'edition'>('upload')
  const [fichier, setFichier] = useState<File | null>(null)
  const [fichierBase64, setFichierBase64] = useState<string>('')
  const [analyse, setAnalyse] = useState<any>(null)
  const [analysing, setAnalysing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state
  const [entrepriseId, setEntrepriseId] = useState('')
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [fournisseurId, setFournisseurId] = useState('')
  const [nouveauFournisseurNom, setNouveauFournisseurNom] = useState('')
  const [creerFournisseur, setCreerFournisseur] = useState(false)
  const [comptes, setComptes] = useState<CompteComptable[]>([])
  const [numeroFournisseur, setNumeroFournisseur] = useState('')
  const [dateFacture, setDateFacture] = useState(today())
  const [dateEcheance, setDateEcheance] = useState('')
  const [lignes, setLignes] = useState<LigneFacture[]>([
    { ordre: 1, libelle: '', quantite: 1, prix_unitaire_ht: null, montant_ht: 0, tva_taux: 20, montant_tva: 0, montant_ttc: 0, compte_charge_id: null }
  ])
  const [modePaiement, setModePaiement] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Charger fournisseurs + comptes
  useEffect(() => {
    (async () => {
      const [{ data: fs }, { data: cs }] = await Promise.all([
        supabase.from('fournisseurs').select('id, code, nom, categorie, compte_charge_id, compte_fournisseur_id').eq('actif', true).order('nom'),
        supabase.from('plan_comptable').select('id, numero, libelle, classe, type').eq('actif', true).in('classe', [6, 2]).order('numero'),
      ])
      setFournisseurs(fs || [])
      setComptes(cs || [])
    })()
  }, [])

  // Totaux calculés
  const totaux = useMemo(() => {
    const ht = lignes.reduce((s, l) => s + (l.montant_ht || 0), 0)
    const tva = lignes.reduce((s, l) => s + (l.montant_tva || 0), 0)
    const ttc = lignes.reduce((s, l) => s + (l.montant_ttc || 0), 0)
    return { ht: Math.round(ht * 100) / 100, tva: Math.round(tva * 100) / 100, ttc: Math.round(ttc * 100) / 100 }
  }, [lignes])

  // Upload du fichier → encodage base64
  const handleFichier = async (file: File) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setErreur('Format non supporté : merci de fournir un PDF')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErreur('Fichier trop volumineux (max 10 Mo)')
      return
    }
    setErreur('')
    setFichier(file)
    const b64 = await new Promise<string>(res => {
      const reader = new FileReader()
      reader.onload = () => res((reader.result as string).split(',')[1])
      reader.readAsDataURL(file)
    })
    setFichierBase64(b64)
  }

  // Lancer l'analyse IA
  const lancerAnalyse = async () => {
    if (!fichierBase64) return
    setAnalysing(true)
    setEtape('analyse')
    setErreur('')
    try {
      const r = await fetch('/api/analyser-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichierBase64, nom: fichier?.name }),
      })
      if (!r.ok) throw new Error(`Erreur serveur ${r.status}`)
      const a = await r.json()
      if (a.error) throw new Error(a.error)
      setAnalyse(a)

      // Pré-remplir le formulaire avec les données extraites
      if (a.facture?.numero) setNumeroFournisseur(a.facture.numero)
      if (a.facture?.date_facture) setDateFacture(a.facture.date_facture)
      if (a.facture?.date_echeance) setDateEcheance(a.facture.date_echeance)
      if (a.mode_paiement_suggere) setModePaiement(a.mode_paiement_suggere)

      // Recherche d'un fournisseur existant par nom (similarité simple)
      if (a.fournisseur?.nom && (fournisseurs || []).length > 0) {
        const recherche = a.fournisseur.nom.toLowerCase()
        const match = fournisseurs.find(f => f.nom.toLowerCase().includes(recherche) || recherche.includes(f.nom.toLowerCase()))
        if (match) {
          setFournisseurId(match.id)
        } else {
          setCreerFournisseur(true)
          setNouveauFournisseurNom(a.fournisseur.nom)
        }
      } else if (a.fournisseur?.nom) {
        setCreerFournisseur(true)
        setNouveauFournisseurNom(a.fournisseur.nom)
      }

      // Pré-remplir les lignes
      if (Array.isArray(a.lignes) && a.lignes.length > 0) {
        setLignes(a.lignes.map((l: any, i: number) => ({
          ordre: i + 1,
          libelle: l.libelle || '',
          quantite: l.quantite ?? 1,
          prix_unitaire_ht: l.prix_unitaire_ht ?? null,
          montant_ht: l.montant_ht || 0,
          tva_taux: l.tva_taux ?? 20,
          montant_tva: l.montant_tva || 0,
          montant_ttc: l.montant_ttc || 0,
          compte_charge_id: null,
        })))
      }

      setEtape('edition')
    } catch (e: any) {
      setErreur(e.message || 'Erreur IA')
      setEtape('upload')
    } finally {
      setAnalysing(false)
    }
  }

  // Sauter l'analyse IA (saisie manuelle directe)
  const saisieManuelle = () => {
    setEtape('edition')
  }

  // Modifier une ligne (recalcule automatiquement TVA et TTC)
  const majLigne = (idx: number, patch: Partial<LigneFacture>) => {
    setLignes(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, ...patch }
      // Recalcul auto si HT ou taux change
      if ('montant_ht' in patch || 'tva_taux' in patch) {
        updated.montant_tva = Math.round(updated.montant_ht * updated.tva_taux) / 100
        updated.montant_ttc = Math.round((updated.montant_ht + updated.montant_tva) * 100) / 100
      }
      return updated
    }))
  }

  const ajouterLigne = () => {
    setLignes(prev => [...prev, {
      ordre: prev.length + 1, libelle: '', quantite: 1, prix_unitaire_ht: null,
      montant_ht: 0, tva_taux: 20, montant_tva: 0, montant_ttc: 0, compte_charge_id: null,
    }])
  }
  const supprimerLigne = (idx: number) => {
    setLignes(prev => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, ordre: i + 1 })))
  }

  // Sauvegarder (brouillon ou validée)
  const sauvegarder = async (statutFinal: 'brouillon' | 'validee') => {
    setErreur('')
    if (!entrepriseId) { setErreur('Sélectionne une entreprise'); return }
    if (!dateFacture) { setErreur('La date de facture est requise'); return }
    if (lignes.length === 0 || lignes.every(l => !l.libelle)) { setErreur('Ajoute au moins une ligne'); return }

    setSaving(true)
    try {
      // 1) Créer le fournisseur si demandé
      let foId = fournisseurId
      if (creerFournisseur && nouveauFournisseurNom.trim()) {
        const { data: novo, error: errFo } = await supabase
          .from('fournisseurs')
          .insert({
            nom: nouveauFournisseurNom.trim(),
            categorie: analyse?.categorie_suggeree || 'autre',
            siret: analyse?.fournisseur?.siret || null,
            tva_intracommunautaire: analyse?.fournisseur?.tva_intracom || null,
            adresse_ligne1: analyse?.fournisseur?.adresse_ligne1 || null,
            code_postal: analyse?.fournisseur?.code_postal || null,
            ville: analyse?.fournisseur?.ville || null,
          })
          .select('id')
          .single()
        if (errFo) throw new Error(`Création fournisseur : ${errFo.message}`)
        foId = novo.id
      }

      // 2) Générer le numéro interne (FA-YYYYMM-NNNN)
      const dt = new Date(dateFacture)
      const prefix = `FA-${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}-`
      const { data: lastFac } = await supabase
        .from('factures_achat')
        .select('numero_interne')
        .like('numero_interne', `${prefix}%`)
        .order('numero_interne', { ascending: false })
        .limit(1)
      let nextNum = 1
      if (lastFac && lastFac.length > 0) {
        const m = lastFac[0].numero_interne.match(/-(\d+)$/)
        if (m) nextNum = parseInt(m[1]) + 1
      }
      const numeroInterne = `${prefix}${String(nextNum).padStart(4, '0')}`

      // 3) Insérer la facture
      const { data: fac, error: errFac } = await supabase
        .from('factures_achat')
        .insert({
          numero_interne: numeroInterne,
          numero_fournisseur: numeroFournisseur || null,
          entreprise_id: entrepriseId,
          fournisseur_id: foId || null,
          date_facture: dateFacture,
          date_reception: today(),
          date_echeance: dateEcheance || null,
          total_ht: totaux.ht,
          total_tva: totaux.tva,
          total_ttc: totaux.ttc,
          statut: statutFinal,
          mode_paiement: modePaiement || null,
          fichier_base64: fichierBase64 || null,
          fichier_nom: fichier?.name || null,
          fichier_taille_ko: fichier ? Math.round(fichier.size / 1024) : null,
          analyse_ia_statut: analyse ? 'ok' : 'non_analyse',
          analyse_ia_data: analyse || null,
          notes: notes || null,
          created_by: currentUser?.id || null,
          validated_by: statutFinal === 'validee' ? currentUser?.id : null,
          validated_at: statutFinal === 'validee' ? new Date().toISOString() : null,
        })
        .select('id')
        .single()
      if (errFac) throw new Error(`Facture : ${errFac.message}`)

      // 4) Insérer les lignes
      if (lignes.length > 0) {
        const lignesPayload = lignes
          .filter(l => l.libelle.trim() && (l.montant_ht > 0 || l.montant_ttc > 0))
          .map(l => ({
            facture_id: fac.id,
            ordre: l.ordre,
            libelle: l.libelle.trim(),
            quantite: l.quantite || 1,
            prix_unitaire_ht: l.prix_unitaire_ht,
            montant_ht: l.montant_ht || 0,
            tva_taux: l.tva_taux ?? 20,
            montant_tva: l.montant_tva || 0,
            montant_ttc: l.montant_ttc || 0,
            compte_charge_id: l.compte_charge_id || null,
          }))
        if (lignesPayload.length > 0) {
          const { error: errLg } = await supabase.from('factures_achat_lignes').insert(lignesPayload)
          if (errLg) throw new Error(`Lignes : ${errLg.message}`)
        }
      }

      onSaved()
    } catch (e: any) {
      setErreur(e.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 980 }} onClick={e => e.stopPropagation()}>
        <div style={modalHeader}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 4 }}>Comptabilité</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouvelle facture d'achat</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>

        {erreur && (
          <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#c96e6e' }}>{erreur}</div>
        )}

        {/* Étape 1 : upload */}
        {etape === 'upload' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ ...card, textAlign: 'center' as const, padding: 48, borderStyle: 'dashed' as const, border: '1px dashed rgba(201,169,110,0.3)' }}>
              <div style={{ fontSize: 48, marginBottom: 16, color: '#c9a96e' }}>📄</div>
              <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 8 }}>Importe une facture PDF</div>
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 20 }}>L'IA extraira automatiquement les données. Tu pourras vérifier et corriger avant de valider.</div>
              <input ref={fileRef} type="file" accept="application/pdf" onChange={e => handleFichier(e.target.files?.[0]!)} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={btnGold}>Choisir un PDF</button>
              {fichier && (
                <div style={{ marginTop: 16, fontSize: 12, color: '#6ec96e' }}>✓ {fichier.name} ({Math.round(fichier.size / 1024)} Ko)</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <button onClick={saisieManuelle} style={btnGhost}>Saisie manuelle (sans IA)</button>
              <button onClick={lancerAnalyse} disabled={!fichierBase64 || analysing} style={{ ...btnGold, opacity: !fichierBase64 ? 0.4 : 1, cursor: !fichierBase64 ? 'not-allowed' : 'pointer' }}>
                ✦ Analyser avec l'IA
              </button>
            </div>
          </div>
        )}

        {/* Étape 2 : analyse en cours */}
        {etape === 'analyse' && (
          <div style={{ textAlign: 'center' as const, padding: 64 }}>
            <div style={{ fontSize: 32, marginBottom: 16, color: '#c9a96e' }}>⟳</div>
            <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 6 }}>Analyse de la facture en cours…</div>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Extraction des données par Claude IA (≈ 10-20 secondes)</div>
          </div>
        )}

        {/* Étape 3 : édition */}
        {etape === 'edition' && (
          <>
            {analyse && (
              <div style={{ background: 'rgba(110,201,110,0.06)', border: '0.5px solid rgba(110,201,110,0.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#6ec96e', marginBottom: 4 }}>✦ ANALYSE IA — STATUT : {analyse.statut?.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.7)' }}>{analyse.resume}</div>
                {analyse.anomalies?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {analyse.anomalies.map((a: any, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: a.gravite === 'critique' ? '#c96e6e' : a.gravite === 'importante' ? '#c9a96e' : 'rgba(232,224,213,0.5)', marginTop: 3 }}>
                        ⚠ {a.gravite}: {a.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Entête facture */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Entreprise *</label>
                <select value={entrepriseId} onChange={e => setEntrepriseId(e.target.value)} style={{ ...sel, width: '100%' }}>
                  <option value="">— Choisir —</option>
                  {entreprises.map(e => <option key={e.id} value={e.id}>{e.code} — {e.raison_sociale}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>N° facture fournisseur</label>
                <input value={numeroFournisseur} onChange={e => setNumeroFournisseur(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
              <div>
                <label style={lbl}>Mode paiement</label>
                <select value={modePaiement} onChange={e => setModePaiement(e.target.value)} style={{ ...sel, width: '100%' }}>
                  <option value="">—</option>
                  <option value="virement">Virement</option>
                  <option value="cb">CB</option>
                  <option value="cheque">Chèque</option>
                  <option value="prelevement">Prélèvement</option>
                  <option value="especes">Espèces</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Date facture *</label>
                <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
              <div>
                <label style={lbl}>Date d'échéance</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} style={{ ...inp, flex: 1 }} />
                  <button type="button" onClick={() => setDateEcheance(ajouterJours(dateFacture, 30))} style={{ ...btnGhost, padding: '0 10px', fontSize: 10 }} title="+30j">+30j</button>
                </div>
              </div>
              <div>
                <label style={lbl}>Fournisseur *</label>
                {!creerFournisseur ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={fournisseurId} onChange={e => setFournisseurId(e.target.value)} style={{ ...sel, flex: 1 }}>
                      <option value="">— Choisir —</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                    </select>
                    <button type="button" onClick={() => setCreerFournisseur(true)} style={{ ...btnGhost, padding: '0 10px', fontSize: 14 }} title="Créer">+</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input value={nouveauFournisseurNom} onChange={e => setNouveauFournisseurNom(e.target.value)} placeholder="Nom du nouveau fournisseur" style={{ ...inp, flex: 1 }} />
                    <button type="button" onClick={() => { setCreerFournisseur(false); setNouveauFournisseurNom('') }} style={{ ...btnGhost, padding: '0 10px', fontSize: 12 }} title="Annuler">×</button>
                  </div>
                )}
              </div>
            </div>

            {/* Tableau des lignes */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', marginBottom: 10, textTransform: 'uppercase' as const }}>Lignes de facture</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {['Libellé', 'Qté', 'PU HT', 'HT', 'TVA %', 'TVA €', 'TTC', 'Compte', ''].map(h => (
                      <th key={h} style={{ padding: '8px 6px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '4px 4px' }}>
                        <input value={l.libelle} onChange={e => majLigne(i, { libelle: e.target.value })} style={{ ...inp, width: '100%', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input type="number" step="0.01" value={l.quantite} onChange={e => majLigne(i, { quantite: parseFloat(e.target.value) || 0 })} style={{ ...inp, width: 60, fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input type="number" step="0.01" value={l.prix_unitaire_ht ?? ''} onChange={e => majLigne(i, { prix_unitaire_ht: e.target.value ? parseFloat(e.target.value) : null })} style={{ ...inp, width: 80, fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input type="number" step="0.01" value={l.montant_ht} onChange={e => majLigne(i, { montant_ht: parseFloat(e.target.value) || 0 })} style={{ ...inp, width: 90, fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <select value={l.tva_taux} onChange={e => majLigne(i, { tva_taux: parseFloat(e.target.value) })} style={{ ...sel, width: 70, fontSize: 12 }}>
                          <option value="20">20</option>
                          <option value="10">10</option>
                          <option value="5.5">5.5</option>
                          <option value="2.1">2.1</option>
                          <option value="0">0</option>
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px', fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>{fmt(l.montant_tva)}</td>
                      <td style={{ padding: '4px 4px', fontSize: 12, color: '#f0e8d8', fontFamily: 'Georgia, serif' }}>{fmt(l.montant_ttc)}</td>
                      <td style={{ padding: '4px 4px' }}>
                        <select value={l.compte_charge_id || ''} onChange={e => majLigne(i, { compte_charge_id: e.target.value || null })} style={{ ...sel, width: 200, fontSize: 11 }}>
                          <option value="">— Compte —</option>
                          {comptes.map(c => <option key={c.id} value={c.id}>{c.numero} — {c.libelle}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <button type="button" onClick={() => supprimerLigne(i)} style={{ background: 'transparent', border: 'none', color: 'rgba(201,110,110,0.6)', fontSize: 16, cursor: 'pointer', padding: '2px 6px' }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={ajouterLigne} style={{ ...btnGhost, marginTop: 10, fontSize: 11 }}>+ Ajouter une ligne</button>
            </div>

            {/* Totaux */}
            <div style={{ ...card, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const }}>Total HT</div>
                <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#e8e0d5' }}>{fmt(totaux.ht)} €</div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const }}>TVA</div>
                <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#e8e0d5' }}>{fmt(totaux.tva)} €</div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c9a96e', textTransform: 'uppercase' as const }}>Total TTC</div>
                <div style={{ fontSize: 22, fontFamily: 'Georgia, serif', color: '#c9a96e' }}>{fmt(totaux.ttc)} €</div>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Notes internes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, width: '100%', resize: 'vertical' as const, fontFamily: 'inherit' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <button onClick={() => setEtape('upload')} style={btnGhost}>← Retour</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => sauvegarder('brouillon')} disabled={saving} style={btnGhost}>
                  {saving ? '⟳' : 'Enregistrer en brouillon'}
                </button>
                <button onClick={() => sauvegarder('validee')} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⟳ Enregistrement…' : '✓ Valider la facture'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MODAL — Détail facture
// ═══════════════════════════════════════════════════════════════
function ModalDetailFacture({ facture, onClose, onUpdated }: {
  facture: FactureAchat
  onClose: () => void
  onUpdated: () => void
}) {
  const [lignes, setLignes] = useState<LigneFacture[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('factures_achat_lignes')
        .select('*').eq('facture_id', facture.id).order('ordre')
      setLignes(data || [])
      setLoading(false)
    })()
  }, [facture.id])

  const changerStatut = async (nouveauStatut: string, extra: any = {}) => {
    if (!confirm(`Confirmer le changement vers "${STATUT_LABELS[nouveauStatut]?.label}" ?`)) return
    setUpdating(true)
    try {
      const { error } = await supabase.from('factures_achat')
        .update({ statut: nouveauStatut, ...extra })
        .eq('id', facture.id)
      if (error) throw error
      onUpdated()
    } catch (e: any) {
      alert('Erreur : ' + (e.message || 'inconnue'))
    } finally {
      setUpdating(false)
    }
  }

  const st = STATUT_LABELS[facture.statut]

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 980 }} onClick={e => e.stopPropagation()}>
        <div style={modalHeader}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 4 }}>{facture.numero_interne}</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
              {facture.fournisseur?.nom || 'Sans fournisseur'}
            </h2>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 3, letterSpacing: 0.5 }}>{st.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
          <InfoBloc label="Entreprise" value={facture.entreprise?.code + ' — ' + (facture.entreprise?.raison_sociale || '')} />
          <InfoBloc label="N° fournisseur" value={facture.numero_fournisseur || '—'} />
          <InfoBloc label="Mode paiement" value={facture.mode_paiement || '—'} />
          <InfoBloc label="Date facture" value={fmtDate(facture.date_facture)} />
          <InfoBloc label="Date réception" value={fmtDate(facture.date_reception)} />
          <InfoBloc label="Échéance" value={fmtDate(facture.date_echeance)} />
        </div>

        {/* Lignes */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', marginBottom: 12, textTransform: 'uppercase' as const }}>Lignes</div>
          {loading ? <div style={{ color: 'rgba(232,224,213,0.4)', fontSize: 12 }}>⟳ Chargement…</div> : lignes.length === 0 ? <div style={{ color: 'rgba(232,224,213,0.4)', fontSize: 12 }}>Aucune ligne</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {['Libellé', 'Qté', 'HT', 'TVA %', 'TTC'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 8px', color: '#e8e0d5' }}>{l.libelle}</td>
                    <td style={{ padding: '6px 8px', color: 'rgba(232,224,213,0.6)' }}>{l.quantite}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' as const, color: 'rgba(232,224,213,0.7)', fontFamily: 'Georgia, serif' }}>{fmt(l.montant_ht)}</td>
                    <td style={{ padding: '6px 8px', color: 'rgba(232,224,213,0.5)' }}>{l.tva_taux}%</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' as const, color: '#f0e8d8', fontFamily: 'Georgia, serif' }}>{fmt(l.montant_ttc)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <td colSpan={2} style={{ padding: '8px 8px', fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>Totaux</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' as const, color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>{fmt(facture.total_ht)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' as const, color: 'rgba(232,224,213,0.5)', fontFamily: 'Georgia, serif' }}>{fmt(facture.total_tva)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' as const, color: '#c9a96e', fontFamily: 'Georgia, serif', fontSize: 14 }}>{fmt(facture.total_ttc)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* PDF */}
        {facture.fichier_base64 && (
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => {
              const a = document.createElement('a')
              a.href = `data:application/pdf;base64,${facture.fichier_base64}`
              a.download = facture.fichier_nom || `${facture.numero_interne}.pdf`
              a.click()
            }} style={btnGhost}>↓ Télécharger le PDF original</button>
          </div>
        )}

        {/* Actions selon statut */}
        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} style={btnGhost}>Fermer</button>
          <div style={{ display: 'flex', gap: 10 }}>
            {facture.statut === 'brouillon' && (
              <button onClick={() => changerStatut('validee', { validated_at: new Date().toISOString() })} disabled={updating} style={btnGold}>✓ Valider</button>
            )}
            {facture.statut === 'validee' && (
              <>
                <button onClick={() => changerStatut('litige')} disabled={updating} style={{ ...btnGhost, color: '#c96e6e', borderColor: 'rgba(201,110,110,0.3)' }}>Marquer en litige</button>
                <button onClick={() => changerStatut('payee', { date_paiement: today() })} disabled={updating} style={btnGold}>✓ Marquer comme payée</button>
              </>
            )}
            {facture.statut === 'litige' && (
              <button onClick={() => changerStatut('validee')} disabled={updating} style={btnGhost}>Lever le litige</button>
            )}
            {!['payee', 'annulee'].includes(facture.statut) && (
              <button onClick={() => changerStatut('annulee')} disabled={updating} style={{ ...btnGhost, color: 'rgba(201,110,110,0.6)' }}>Annuler</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoBloc({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#e8e0d5' }}>{value}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Styles modaux
// ═══════════════════════════════════════════════════════════════
const overlayStyle: any = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 20px', zIndex: 1000, overflowY: 'auto',
}
const modalStyle: any = {
  background: '#100d0a', border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '24px 28px', width: '100%',
  maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
}
const modalHeader: any = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  borderBottom: '0.5px solid rgba(255,255,255,0.07)', paddingBottom: 16, marginBottom: 20,
}

// ═══════════════════════════════════════════════════════════════
// OngletVentes — Écritures comptables des ventes + TVA CA3
// ═══════════════════════════════════════════════════════════════
function OngletVentes() {
  const today = new Date()
  const [entreprises, setEntreprises] = useState<any[]>([])
  const [entrepriseId, setEntrepriseId] = useState<string>('')
  const [annee, setAnnee] = useState<number>(today.getFullYear())
  const [mois, setMois] = useState<number>(today.getMonth() + 1)
  const [ecritures, setEcritures] = useState<any[]>([])
  const [tva, setTva] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('entreprises').select('id, code, raison_sociale').order('code').then(({ data }) => {
      setEntreprises(data || [])
      if (data && data.length > 0 && !entrepriseId) setEntrepriseId(data[0].id)
    })
  }, [])

  const loadData = async () => {
    if (!entrepriseId) return
    setLoading(true); setMsg('')
    const dateDebut = new Date(annee, mois - 1, 1).toISOString().split('T')[0]
    const dateFin = new Date(annee, mois, 0).toISOString().split('T')[0]
    const [{ data: ecr }, { data: tvaData }] = await Promise.all([
      supabase.from('ecritures_comptables')
        .select('*, compte:plan_comptable(numero, libelle), vente:ventes(numero, type_doc, customer:customers(prenom, nom, raison_sociale, est_societe))')
        .eq('entreprise_id', entrepriseId)
        .eq('journal', 'VE')
        .gte('date_ecriture', dateDebut)
        .lte('date_ecriture', dateFin)
        .order('date_ecriture', { ascending: true })
        .order('numero_piece', { ascending: true })
        .order('ordre', { ascending: true }),
      supabase.rpc('calculer_tva_ca3', { p_entreprise_id: entrepriseId, p_annee: annee, p_mois: mois }),
    ])
    setEcritures(ecr || [])
    setTva(tvaData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [entrepriseId, annee, mois])

  const handleRegenerer = async () => {
    if (!confirm('Régénérer toutes les écritures de ventes manquantes ?\n(Aucune écriture existante ne sera modifiée)')) return
    setRegenerating(true); setMsg('')
    const { data, error } = await supabase.rpc('backfill_ecritures_ventes')
    setRegenerating(false)
    if (error) { setMsg('Erreur : ' + error.message); return }
    setMsg('✓ ' + data + ' vente(s) traitée(s)')
    loadData()
  }

  const totalDebit = ecritures.reduce((s, e) => s + parseFloat(e.debit || 0), 0)
  const totalCredit = ecritures.reduce((s, e) => s + parseFloat(e.credit || 0), 0)
  const totalBaseHT = tva.reduce((s, t) => s + parseFloat(t.base_ht || 0), 0)
  const totalTVA = tva.reduce((s, t) => s + parseFloat(t.tva_collectee || 0), 0)
  const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'end', flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Entreprise</div>
          <select value={entrepriseId} onChange={e => setEntrepriseId(e.target.value)} style={sel}>
            {entreprises.map(e => <option key={e.id} value={e.id} style={{ background: '#1a1408' }}>{e.code} — {e.raison_sociale}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Mois</div>
          <select value={mois} onChange={e => setMois(parseInt(e.target.value))} style={sel}>
            {moisNoms.map((m, i) => <option key={i} value={i + 1} style={{ background: '#1a1408' }}>{m}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Année</div>
          <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={sel}>
            {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a} style={{ background: '#1a1408' }}>{a}</option>)}
          </select>
        </div>
        <button onClick={handleRegenerer} disabled={regenerating} style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 4, padding: '9px 16px', fontSize: 11, cursor: regenerating ? 'wait' : 'pointer', letterSpacing: 1, marginLeft: 'auto' }}>
          {regenerating ? '⟳ ...' : '↻ Régénérer écritures manquantes'}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(110,201,110,0.08)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 4, fontSize: 12, color: '#6ec96e' }}>{msg}</div>}

      {/* TVA CA3 */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 16 }}>
          Brouillon CA3 — {moisNoms[mois - 1]} {annee}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              <th style={{ textAlign: 'left' as const, padding: '8px 12px', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const }}>Taux</th>
              <th style={{ textAlign: 'right' as const, padding: '8px 12px', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const }}>Base HT</th>
              <th style={{ textAlign: 'right' as const, padding: '8px 12px', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const }}>TVA collectée</th>
            </tr>
          </thead>
          <tbody>
            {tva.map((t, i) => (
              <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 12px', color: '#e8e0d5' }}>{parseFloat(t.taux).toFixed(1)} %</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' as const, color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>{parseFloat(t.base_ht).toFixed(2)} €</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' as const, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{parseFloat(t.tva_collectee).toFixed(2)} €</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid rgba(201,169,110,0.3)' }}>
              <td style={{ padding: '12px', fontSize: 11, letterSpacing: 1.5, color: '#c9a96e', textTransform: 'uppercase' as const, fontWeight: 600 }}>Total</td>
              <td style={{ padding: '12px', textAlign: 'right' as const, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 600 }}>{totalBaseHT.toFixed(2)} €</td>
              <td style={{ padding: '12px', textAlign: 'right' as const, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 600 }}>{totalTVA.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Journal des ventes */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const }}>
            Journal des ventes — {ecritures.length} écriture{ecritures.length > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
            Débit : <span style={{ color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>{totalDebit.toFixed(2)} €</span>
            <span style={{ margin: '0 12px', color: 'rgba(232,224,213,0.2)' }}>·</span>
            Crédit : <span style={{ color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>{totalCredit.toFixed(2)} €</span>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)' }}>⟳ Chargement…</div>
        ) : ecritures.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', fontSize: 13 }}>
            Aucune écriture pour cette période
          </div>
        ) : (
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Date', 'Pièce', 'Compte', 'Libellé', 'Débit', 'Crédit'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Débit' || h === 'Crédit' ? 'right' as const : 'left' as const, padding: '10px 14px', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ecritures.map((e, i) => {
                  const isNewPiece = i === 0 || ecritures[i - 1].numero_piece !== e.numero_piece
                  return (
                    <tr key={e.id} style={{ borderTop: isNewPiece && i > 0 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <td style={{ padding: '8px 14px', color: 'rgba(232,224,213,0.6)', verticalAlign: 'top' as const }}>{isNewPiece ? new Date(e.date_ecriture).toLocaleDateString('fr-FR') : ''}</td>
                      <td style={{ padding: '8px 14px', verticalAlign: 'top' as const }}>
                        {isNewPiece && <div style={{ color: '#c9a96e', fontFamily: 'monospace', fontSize: 11 }}>{e.numero_piece}</div>}
                        {isNewPiece && e.vente?.customer && (
                          <div style={{ color: 'rgba(232,224,213,0.6)', fontSize: 11, marginTop: 2 }}>
                            {e.vente.customer.est_societe ? e.vente.customer.raison_sociale : `${e.vente.customer.prenom || ''} ${e.vente.customer.nom || ''}`.trim()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 14px', color: '#e8e0d5' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c9a96e' }}>{e.compte?.numero}</span>
                        <span style={{ marginLeft: 8, color: 'rgba(232,224,213,0.5)' }}>{e.compte?.libelle}</span>
                      </td>
                      <td style={{ padding: '8px 14px', color: 'rgba(232,224,213,0.6)' }}>{e.libelle}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' as const, color: parseFloat(e.debit) > 0 ? '#e8e0d5' : 'rgba(232,224,213,0.2)', fontFamily: 'Georgia, serif' }}>
                        {parseFloat(e.debit) > 0 ? parseFloat(e.debit).toFixed(2) + ' €' : '—'}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' as const, color: parseFloat(e.credit) > 0 ? '#c9a96e' : 'rgba(232,224,213,0.2)', fontFamily: 'Georgia, serif' }}>
                        {parseFloat(e.credit) > 0 ? parseFloat(e.credit).toFixed(2) + ' €' : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// OngletBanque — Import CSV Crédit Mutuel + Rapprochement
// ═══════════════════════════════════════════════════════════════
function OngletBanque({ currentUser }: { currentUser: any }) {
  const [entreprises, setEntreprises] = useState<any[]>([])
  const [entrepriseId, setEntrepriseId] = useState('')
  const [comptes, setComptes] = useState<any[]>([])
  const [compteId, setCompteId] = useState('')
  const [releves, setReleves] = useState<any[]>([])
  const [releveActif, setReleveActif] = useState<any>(null)
  const [mouvements, setMouvements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'non_rapproche' | 'rapproche'>('tous')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('entreprises').select('id, code, raison_sociale').order('code')
      .then(({ data }) => {
        setEntreprises(data || [])
        if (data && data.length > 0) setEntrepriseId(data[0].id)
      })
    // Comptes bancaires du plan comptable
    supabase.from('plan_comptable').select('id, numero, libelle')
      .like('numero', '512%').order('numero')
      .then(({ data }) => {
        setComptes(data || [])
        if (data && data.length > 0) setCompteId(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (!entrepriseId) return
    loadReleves()
  }, [entrepriseId])

  const loadReleves = async () => {
    const { data } = await supabase.from('releves_bancaires')
      .select('*').eq('entreprise_id', entrepriseId)
      .order('periode_fin', { ascending: false }).limit(12)
    setReleves(data || [])
  }

  const loadMouvements = async (releveId: string) => {
    setLoading(true)
    const { data } = await supabase.from('mouvements_bancaires')
      .select('*').eq('releve_id', releveId)
      .order('date_operation', { ascending: false })
    setMouvements(data || [])
    setLoading(false)
  }

  // Parser CSV Crédit Mutuel
  // Format: Date;Date de valeur;Débit;Crédit;Libellé;Solde
  const parseCreditMutuelCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('Fichier vide')

    const rows: any[] = []
    let soldeDebut: number | null = null
    let soldeFin: number | null = null
    let periodeDebut: string | null = null
    let periodeFin: string | null = null

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';')
      if (cols.length < 5) continue

      const parseDate = (d: string) => {
        const [day, month, year] = d.trim().split('/')
        return `${year}-${month}-${day}`
      }
      const parseMontant = (s: string) => {
        if (!s || !s.trim()) return null
        return parseFloat(s.trim().replace(',', '.').replace(/\s/g, ''))
      }

      const dateOp = parseDate(cols[0])
      const dateVal = cols[1]?.trim() ? parseDate(cols[1]) : null
      const debit = parseMontant(cols[2])
      const credit = parseMontant(cols[3])
      const libelle = cols[4]?.trim() || ''
      const solde = parseMontant(cols[5])

      const montant = credit !== null ? credit : (debit !== null ? debit : 0)

      if (!periodeDebut || dateOp < periodeDebut) periodeDebut = dateOp
      if (!periodeFin || dateOp > periodeFin) periodeFin = dateOp
      if (solde !== null) {
        if (soldeDebut === null) soldeDebut = solde
        soldeFin = solde
      }

      rows.push({ date_operation: dateOp, date_valeur: dateVal, libelle, montant, solde_apres: solde })
    }

    // Remettre solde dans l'ordre (le 1er du fichier = le plus récent)
    const premierSolde = rows[0]?.solde_apres ?? null
    const dernierSolde = rows[rows.length - 1]?.solde_apres ?? null

    return { rows, periodeDebut, periodeFin, soldeDebut: dernierSolde, soldeFin: premierSolde, nbLignes: rows.length }
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !entrepriseId || !compteId) return
    setImporting(true); setMsg(null)

    try {
      const text = await file.text()
      const { rows, periodeDebut, periodeFin, soldeDebut, soldeFin, nbLignes } = parseCreditMutuelCSV(text)
      if (!periodeDebut || !periodeFin) throw new Error('Impossible de lire les dates')

      // Créer le relevé
      const { data: releve, error: errR } = await supabase.from('releves_bancaires').insert({
        entreprise_id: entrepriseId,
        compte_comptable_id: compteId,
        banque: 'Crédit Mutuel',
        periode_debut: periodeDebut,
        periode_fin: periodeFin,
        solde_debut: soldeDebut,
        solde_fin: soldeFin,
        nb_mouvements: nbLignes,
        importe_par: currentUser?.id,
      }).select().single()
      if (errR) throw new Error(errR.message)

      // Insérer les mouvements par batch de 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100).map(r => ({
          ...r, releve_id: releve.id, entreprise_id: entrepriseId,
        }))
        const { error: errM } = await supabase.from('mouvements_bancaires').insert(batch)
        if (errM) throw new Error(errM.message)
      }

      setMsg({ type: 'ok', text: `✓ ${nbLignes} mouvements importés (${periodeDebut} → ${periodeFin})` })
      await loadReleves()
      setReleveActif(releve)
      await loadMouvements(releve.id)
    } catch (err: any) {
      setMsg({ type: 'err', text: 'Erreur : ' + err.message })
    }

    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleRapprocher = async (mouvementId: string, type: string, sourceId: string) => {
    const args: any = { p_mouvement_id: mouvementId, p_user_id: currentUser?.id }
    if (type === 'vente') args.p_vente_id = sourceId
    else if (type === 'facture_achat') args.p_facture_id = sourceId
    const { error } = await supabase.rpc('rapprocher_mouvement', args)
    if (error) { setMsg({ type: 'err', text: error.message }); return }
    if (releveActif) loadMouvements(releveActif.id)
  }

  const handleIgnorer = async (mouvementId: string) => {
    await supabase.from('mouvements_bancaires').update({ statut: 'ignore' }).eq('id', mouvementId)
    if (releveActif) loadMouvements(releveActif.id)
  }

  const mouvementsFiltres = mouvements.filter(m =>
    filtreStatut === 'tous' ? true : m.statut === filtreStatut
  )
  const nbNonRapproches = mouvements.filter(m => m.statut === 'non_rapproche').length
  const nbRapproches = mouvements.filter(m => m.statut === 'rapproche').length

  const statutColor: Record<string, string> = {
    non_rapproche: '#c9b06e',
    rapproche: '#6ec96e',
    ignore: '#555',
  }
  const statutLabel: Record<string, string> = {
    non_rapproche: 'À rapprocher',
    rapproche: '✓ Rapproché',
    ignore: 'Ignoré',
  }

  return (
    <div>
      {/* En-tête + import */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'end', flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Entreprise</div>
          <select value={entrepriseId} onChange={e => setEntrepriseId(e.target.value)} style={sel}>
            {entreprises.map(e => <option key={e.id} value={e.id} style={{ background: '#1a1408' }}>{e.code} — {e.raison_sociale}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Compte bancaire</div>
          <select value={compteId} onChange={e => setCompteId(e.target.value)} style={sel}>
            {comptes.map(c => <option key={c.id} value={c.id} style={{ background: '#1a1408' }}>{c.numero} — {c.libelle}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Import CSV Crédit Mutuel</div>
          <label style={{ display: 'inline-block', background: '#c9a96e', color: '#0d0a08', borderRadius: 4, padding: '9px 18px', fontSize: 11, letterSpacing: 1.5, fontWeight: 600, cursor: importing ? 'wait' : 'pointer', opacity: importing ? 0.7 : 1 }}>
            {importing ? '⟳ Import...' : '↑ Importer un relevé CSV'}
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleImportCSV} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: msg.type === 'ok' ? 'rgba(110,201,110,0.08)' : 'rgba(201,110,110,0.08)', border: '0.5px solid ' + (msg.type === 'ok' ? 'rgba(110,201,110,0.3)' : 'rgba(201,110,110,0.3)'), borderRadius: 4, fontSize: 12, color: msg.type === 'ok' ? '#6ec96e' : '#c96e6e' }}>{msg.text}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Liste des relevés */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Relevés importés</div>
          {releves.length === 0 ? (
            <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: 24, textAlign: 'center' as const, fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
              Aucun relevé<br />
              <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.25)' }}>Importez un CSV pour commencer</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {releves.map(r => (
                <div key={r.id} onClick={() => { setReleveActif(r); loadMouvements(r.id) }}
                  style={{ background: releveActif?.id === r.id ? 'rgba(201,169,110,0.1)' : '#18130e', border: '0.5px solid ' + (releveActif?.id === r.id ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.07)'), borderRadius: 6, padding: '12px 14px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, color: '#c9a96e', marginBottom: 3 }}>{r.banque}</div>
                  <div style={{ fontSize: 11, color: '#e8e0d5', marginBottom: 3 }}>
                    {new Date(r.periode_debut).toLocaleDateString('fr-FR')} → {new Date(r.periode_fin).toLocaleDateString('fr-FR')}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>{r.nb_mouvements} mouvements</div>
                  {r.solde_fin != null && (
                    <div style={{ fontSize: 12, color: r.solde_fin >= 0 ? '#6ec96e' : '#c96e6e', fontFamily: 'Georgia, serif', marginTop: 4 }}>
                      Solde : {parseFloat(r.solde_fin).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mouvements du relevé sélectionné */}
        <div>
          {!releveActif ? (
            <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: 48, textAlign: 'center' as const, fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>
              Sélectionnez un relevé pour voir les mouvements
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)', marginRight: 8 }}>
                  <span style={{ color: '#6ec96e' }}>{nbRapproches}</span> rapprochés ·{' '}
                  <span style={{ color: '#c9b06e' }}>{nbNonRapproches}</span> à traiter
                </div>
                {(['tous', 'non_rapproche', 'rapproche'] as const).map(s => (
                  <button key={s} onClick={() => setFiltreStatut(s)} style={{ background: filtreStatut === s ? 'rgba(201,169,110,0.15)' : 'transparent', border: '0.5px solid ' + (filtreStatut === s ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'), color: filtreStatut === s ? '#c9a96e' : 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
                    {s === 'tous' ? 'Tous' : s === 'non_rapproche' ? 'À rapprocher' : 'Rapprochés'}
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: 40, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)' }}>⟳ Chargement…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                  {mouvementsFiltres.map(m => (
                    <MouvementRow key={m.id} mouvement={m} onRapprocher={handleRapprocher} onIgnorer={handleIgnorer} />
                  ))}
                  {mouvementsFiltres.length === 0 && (
                    <div style={{ padding: 32, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', fontSize: 13 }}>Aucun mouvement</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MouvementRow({ mouvement: m, onRapprocher, onIgnorer }: {
  mouvement: any
  onRapprocher: (id: string, type: string, sourceId: string) => void
  onIgnorer: (id: string) => void
}) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loadingSugg, setLoadingSugg] = useState(false)
  const [showSugg, setShowSugg] = useState(false)

  const loadSuggestions = async () => {
    if (showSugg) { setShowSugg(false); return }
    setLoadingSugg(true)
    const { data } = await supabase.rpc('suggestions_rapprochement', { p_mouvement_id: m.id })
    setSuggestions(data || [])
    setLoadingSugg(false)
    setShowSugg(true)
  }

  const isDebit = m.montant < 0
  const statutColor: Record<string, string> = { non_rapproche: '#c9b06e', rapproche: '#6ec96e', ignore: '#555' }

  return (
    <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 130px auto', gap: 12, alignItems: 'center', padding: '12px 16px' }}>
        <div>
          <div style={{ fontSize: 12, color: '#e8e0d5' }}>{new Date(m.date_operation).toLocaleDateString('fr-FR')}</div>
          <span style={{ fontSize: 10, color: statutColor[m.statut] || '#888', letterSpacing: 1 }}>
            {m.statut === 'rapproche' ? '✓' : m.statut === 'ignore' ? '—' : '○'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.7)', lineHeight: 1.4 }}>{m.libelle}</div>
        <div style={{ textAlign: 'right' as const }}>
          <div style={{ fontSize: 15, fontFamily: 'Georgia, serif', color: isDebit ? '#c96e6e' : '#6ec96e', fontWeight: 600 }}>
            {isDebit ? '' : '+'}{parseFloat(m.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </div>
          {m.solde_apres != null && (
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>
              Solde : {parseFloat(m.solde_apres).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {m.statut === 'non_rapproche' && (
            <>
              <button onClick={loadSuggestions} disabled={loadingSugg} style={{ background: showSugg ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 4, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                {loadingSugg ? '⟳' : showSugg ? '▲ Suggestions' : '▼ Suggestions'}
              </button>
              <button onClick={() => onIgnorer(m.id)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                Ignorer
              </button>
            </>
          )}
          {m.statut === 'rapproche' && (
            <span style={{ fontSize: 11, color: '#6ec96e', padding: '5px 0' }}>✓ Rapproché</span>
          )}
        </div>
      </div>

      {showSugg && (
        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px 16px' }}>
          {suggestions.length === 0 ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Aucune suggestion trouvée</span>
              <button onClick={() => onRapprocher(m.id, 'manuel', '')} style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 4, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
                ✓ Rapprocher sans lien
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 8 }}>Suggestions de rapprochement</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '8px 12px' }}>
                    <div>
                      <span style={{ fontSize: 10, background: s.type_source === 'vente' ? 'rgba(110,201,110,0.15)' : 'rgba(110,158,201,0.15)', color: s.type_source === 'vente' ? '#6ec96e' : '#6e9ec9', padding: '2px 6px', borderRadius: 3, marginRight: 8 }}>
                        {s.type_source === 'vente' ? 'VENTE' : 'FACTURE'}
                      </span>
                      <span style={{ fontSize: 12, color: '#e8e0d5' }}>{s.source_ref}</span>
                      {s.source_label && <span style={{ fontSize: 12, color: '#c9a96e', marginLeft: 8 }}>{s.source_label}</span>}
                      <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginLeft: 8 }}>{new Date(s.source_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontFamily: 'Georgia, serif', color: '#c9a96e' }}>{parseFloat(s.source_montant).toFixed(2)} €</span>
                      {parseFloat(s.ecart) > 0 && <span style={{ fontSize: 10, color: '#c9b06e' }}>écart {parseFloat(s.ecart).toFixed(2)} €</span>}
                      <button onClick={() => onRapprocher(m.id, s.type_source, s.source_id)} style={{ background: '#6ec96e', color: '#0a1a0a', border: 'none', borderRadius: 4, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        ✓
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => onRapprocher(m.id, 'manuel', '')} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '5px 12px', fontSize: 11, cursor: 'pointer', alignSelf: 'flex-start' as const }}>
                  Rapprocher sans lien
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// OngletExport — FEC + Envoi expert-comptable
// ═══════════════════════════════════════════════════════════════
function OngletExport() {
  const today = new Date()
  const [entreprises, setEntreprises] = useState<any[]>([])
  const [entrepriseId, setEntrepriseId] = useState('')
  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth() + 1)
  const [messagePerso, setMessagePerso] = useState('')
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

  useEffect(() => {
    supabase.from('entreprises').select('id, code, raison_sociale, expert_comptable_email, expert_comptable_nom').order('code')
      .then(({ data }) => {
        setEntreprises(data || [])
        if (data && data.length > 0) setEntrepriseId(data[0].id)
      })
  }, [])

  useEffect(() => { if (entrepriseId) loadStats() }, [entrepriseId, annee, mois])

  const loadStats = async () => {
    setLoadingStats(true)
    const m = mois.toString().padStart(2, '0')
    const lastDay = new Date(annee, mois, 0).getDate()
    const dateDebut = `${annee}-${m}-01`
    const dateFin = `${annee}-${m}-${lastDay}`

    const [{ count: nbEcritures }, { count: nbFactures }, tvaRes] = await Promise.all([
      supabase.from('ecritures_comptables').select('*', { count: 'exact', head: true })
        .eq('entreprise_id', entrepriseId).gte('date_ecriture', dateDebut).lte('date_ecriture', dateFin),
      supabase.from('factures_achat').select('*', { count: 'exact', head: true })
        .eq('entreprise_id', entrepriseId).gte('date_facture', dateDebut).lte('date_facture', dateFin),
      supabase.rpc('calculer_tva_ca3', { p_entreprise_id: entrepriseId, p_annee: annee, p_mois: mois }),
    ])

    const totalHT = (tvaRes.data || []).reduce((s: number, t: any) => s + parseFloat(t.base_ht || 0), 0)
    const totalTVA = (tvaRes.data || []).reduce((s: number, t: any) => s + parseFloat(t.tva_collectee || 0), 0)
    setStats({ nbEcritures, nbFactures, totalHT, totalTVA })
    setLoadingStats(false)
  }

  const handleDownloadFEC = async () => {
    setDownloading(true); setMsg(null)
    try {
      const params = new URLSearchParams({ entreprise_id: entrepriseId, annee: annee.toString(), mois: mois.toString() })
      const res = await fetch(`/api/export-fec?${params}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'fec.txt'
      a.click()
      URL.revokeObjectURL(url)
      setMsg({ type: 'ok', text: '✓ FEC téléchargé' })
    } catch (e: any) { setMsg({ type: 'err', text: 'Erreur : ' + e.message }) }
    setDownloading(false)
  }

  const handleEnvoyerComptable = async () => {
    const entreprise = entreprises.find(e => e.id === entrepriseId)
    if (!entreprise?.expert_comptable_email) {
      setMsg({ type: 'err', text: 'Email expert-comptable non configuré pour cette entreprise' })
      return
    }
    if (!confirm(`Envoyer les pièces de ${moisNoms[mois - 1]} ${annee} à ${entreprise.expert_comptable_email} ?`)) return

    setSending(true); setMsg(null)
    try {
      const res = await fetch('/api/envoyer-comptable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entreprise_id: entrepriseId, annee, mois, message_perso: messagePerso || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ type: 'ok', text: `✓ Email envoyé à ${data.destinataire} — ${data.nb_ecritures} écritures, ${data.nb_pdfs_joints} PDF(s) joint(s)` })
      setMessagePerso('')
    } catch (e: any) { setMsg({ type: 'err', text: 'Erreur : ' + e.message }) }
    setSending(false)
  }

  const entreprise = entreprises.find(e => e.id === entrepriseId)

  return (
    <div style={{ maxWidth: 740 }}>
      {/* Sélecteurs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'end', flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Entreprise</div>
          <select value={entrepriseId} onChange={e => setEntrepriseId(e.target.value)} style={sel}>
            {entreprises.map(e => <option key={e.id} value={e.id} style={{ background: '#1a1408' }}>{e.code} — {e.raison_sociale}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Mois</div>
          <select value={mois} onChange={e => setMois(parseInt(e.target.value))} style={sel}>
            {moisNoms.map((m, i) => <option key={i} value={i + 1} style={{ background: '#1a1408' }}>{m}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Année</div>
          <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={sel}>
            {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a} style={{ background: '#1a1408' }}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Stats période */}
      {loadingStats ? (
        <div style={{ color: 'rgba(232,224,213,0.4)', marginBottom: 20 }}>⟳ Chargement…</div>
      ) : stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Écritures', value: stats.nbEcritures, unit: '' },
            { label: 'Factures achat', value: stats.nbFactures, unit: '' },
            { label: 'CA HT', value: stats.totalHT.toFixed(2), unit: '€' },
            { label: 'TVA collectée', value: stats.totalTVA.toFixed(2), unit: '€' },
          ].map(({ label, value, unit }) => (
            <div key={label} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 22, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{value}<span style={{ fontSize: 13, marginLeft: 4 }}>{unit}</span></div>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: msg.type === 'ok' ? 'rgba(110,201,110,0.08)' : 'rgba(201,110,110,0.08)', border: '0.5px solid ' + (msg.type === 'ok' ? 'rgba(110,201,110,0.3)' : 'rgba(201,110,110,0.3)'), borderRadius: 4, fontSize: 13, color: msg.type === 'ok' ? '#6ec96e' : '#c96e6e' }}>{msg.text}</div>
      )}

      {/* Téléchargement FEC */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 8 }}>FEC — Fichier des Écritures Comptables</div>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 16, lineHeight: 1.6 }}>
          Format légal DGFiP (Art. A 47 A-1 LPF). Requis en cas de contrôle fiscal.
          Séparateur pipe <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3 }}>|</code>, encodage UTF-8.
        </p>
        <button onClick={handleDownloadFEC} disabled={downloading || !entrepriseId} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 11, letterSpacing: 1.5, fontWeight: 600, cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.7 : 1 }}>
          {downloading ? '⟳ Génération...' : '↓ Télécharger le FEC'}
        </button>
      </div>

      {/* Envoi expert-comptable */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, padding: '20px 24px' }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 8 }}>Envoi à l'expert-comptable</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>Destinataire :</div>
          <div style={{ fontSize: 13, color: entreprise?.expert_comptable_email ? '#e8e0d5' : '#c96e6e' }}>
            {entreprise?.expert_comptable_email || '⚠ Email non configuré'}
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 14, lineHeight: 1.6 }}>
          Envoie un email avec le FEC en pièce jointe + les PDFs des factures fournisseurs du mois (max 5).
        </p>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Message personnalisé (optionnel)</div>
          <textarea
            value={messagePerso}
            onChange={e => setMessagePerso(e.target.value)}
            rows={3}
            placeholder="Ex: TVA à déclarer avant le 24. Merci de traiter en priorité."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '10px 12px', boxSizing: 'border-box' as const, resize: 'vertical' as const }}
          />
        </div>
        <button onClick={handleEnvoyerComptable} disabled={sending || !entrepriseId || !entreprise?.expert_comptable_email} style={{ background: sending ? 'rgba(201,169,110,0.3)' : '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, letterSpacing: 1.5, fontWeight: 600, cursor: (sending || !entreprise?.expert_comptable_email) ? 'not-allowed' : 'pointer', opacity: (sending || !entreprise?.expert_comptable_email) ? 0.6 : 1 }}>
          {sending ? '⟳ Envoi en cours...' : `✉ Envoyer à ${entreprise?.expert_comptable_email || 'l\'expert-comptable'}`}
        </button>
      </div>
    </div>
  )
}