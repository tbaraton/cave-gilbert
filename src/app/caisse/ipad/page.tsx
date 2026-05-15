'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ModuleLocation } from '../caisse-location'
import { ModuleRetourLocation } from '../retour-location'
import { ModuleLivraisonLocation } from '../livraison-location'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ────────────────────────────────────────────────────
type User = { id: string; nom: string; prenom: string; email: string; pin: string; role: string }
type Session = { id: string; user_id: string; site_id: string; statut: string; especes_ouverture: number; site_nom?: string }
type Client = { id: string; prenom: string; nom: string; raison_sociale: string; est_societe: boolean; tarif_pro: boolean; remise_pct: number; email: string; telephone: string }
type Ligne = { id: string; product_id: string; nom: string; nom_modifie?: string; millesime: number; qte: number; prix_unit: number; remise_pct: number; total: number; is_divers?: boolean; tva_pct?: number }
type Paiement = { mode: string; montant: number; label: string }

const GOLD = '#c9a96e'
const BG = '#0d0a08'
const BG2 = '#100d0a'
const BG3 = '#18130e'
const BORDER = 'rgba(255,255,255,0.07)'
const COULEURS: Record<string, string> = { rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0', champagne: '#d4c88a', effervescent: '#a0b0e0', spiritueux: '#8ec98e', biere: '#d4a056', autre: '#888' }
const fmt = (n: number) => n.toFixed(2) + '€'
const getLogo = (n = '') => n.toLowerCase().includes('petite cave') ? '/logo-petite-cave.png' : '/logo.png'

// ── Login ────────────────────────────────────────────────────
function EcranLogin({ onLogin }: { onLogin: (u: User) => void }) {
  const [prenom, setPrenom] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const doLogin = useCallback(async (p = pin) => {
    if (!prenom.trim() || p.length < 4) return
    setLoading(true); setError('')
    const { data } = await supabase.from('users').select('*').ilike('prenom', prenom.trim()).eq('actif', true).maybeSingle()
    if (!data) { setError('Utilisateur introuvable'); setPin(''); setLoading(false); return }
    if (data.pin !== p) { setError('PIN incorrect'); setPin(''); setLoading(false); return }
    onLogin(data)
  }, [prenom, pin])

  const handleKey = (k: string) => {
    if (k === '←') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 4) return
    const np = pin + k
    setPin(np)
    if (np.length === 4) setTimeout(() => doLogin(np), 50)
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/logo.png" alt="" style={{ maxHeight: 72, maxWidth: '80%', objectFit: 'contain', marginBottom: 12 }} onError={e => (e.currentTarget.style.display = 'none')} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: GOLD, letterSpacing: 3, textTransform: 'uppercase' }}>Cave de Gilbert</div>
          <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>Caisse iPad</div>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 15, color: '#c96e6e', textAlign: 'center' }}>{error}</div>}

        <input type="text" placeholder="Votre prénom" value={prenom} onChange={e => setPrenom(e.target.value)} autoCapitalize="words"
          style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#f0e8d8', fontSize: 20, padding: 18, boxSizing: 'border-box', marginBottom: 28, textAlign: 'center', outline: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 32 }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: i < pin.length ? GOLD : 'rgba(255,255,255,0.12)', transition: 'background 0.15s' }} />)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'].map(k => (
            <button key={k} onClick={() => k === '✓' ? doLogin() : handleKey(k)} style={{
              background: k === '✓' ? GOLD : 'rgba(255,255,255,0.07)',
              border: `1px solid ${k === '✓' ? GOLD : 'rgba(255,255,255,0.1)'}`,
              color: k === '✓' ? BG : '#e8e0d5',
              borderRadius: 14, padding: '22px 0', fontSize: 24, cursor: 'pointer', fontWeight: k === '✓' ? 700 : 400, touchAction: 'manipulation',
            }}>{k}</button>
          ))}
        </div>
        {loading && <div style={{ textAlign: 'center', marginTop: 24, color: 'rgba(232,224,213,0.4)', fontSize: 16 }}>⟳ Connexion...</div>}
      </div>
    </div>
  )
}

// ── Ouverture ────────────────────────────────────────────────
function EcranOuverture({ user, onOuvrir }: { user: User; onOuvrir: (s: Session) => void }) {
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')
  const [especes, setEspeces] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: sitesData } = await supabase.from('sites').select('*').eq('actif', true).order('nom')
      setSites(sitesData || [])
      if (sitesData?.length) setSiteId(sitesData[0].id)
      setReady(true)
      const { data: session } = await supabase.from('caisse_sessions').select('*').eq('user_id', user.id).eq('statut', 'ouverte').maybeSingle()
      if (session) {
        const siteName = sitesData?.find((s: any) => s.id === session.site_id)?.nom || ''
        onOuvrir({ ...session, site_nom: siteName })
      }
    }
    load()
  }, [])

  const handleOuvrir = async () => {
    if (!siteId) return
    setLoading(true)
    const { data } = await supabase.from('caisse_sessions').insert({ user_id: user.id, site_id: siteId, especes_ouverture: parseFloat(especes) || 0, fond_caisse_ouverture: parseFloat(especes) || 0, statut: 'ouverte' }).select('*').single()
    if (data) onOuvrir({ ...data, site_nom: sites.find(s => s.id === siteId)?.nom || '' })
    setLoading(false)
  }

  if (!ready) return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 32, color: GOLD }}>⟳</div></div>

  const isEntrepot = sites.find(s => s.id === siteId)?.nom?.toLowerCase().includes('entrepôt') || sites.find(s => s.id === siteId)?.nom?.toLowerCase().includes('entrepot')

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: 460, background: BG3, border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 20, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={getLogo(sites.find(s => s.id === siteId)?.nom || '')} alt="" style={{ maxHeight: 64, maxWidth: '70%', objectFit: 'contain' }} onError={e => (e.currentTarget.style.display = 'none')} />
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#f0e8d8', marginBottom: 6 }}>Ouverture de caisse</div>
        <div style={{ fontSize: 16, color: 'rgba(232,224,213,0.4)', marginBottom: 32 }}>Bonjour {user.prenom} !</div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 10 }}>SITE</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ width: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, color: '#e8e0d5', fontSize: 18, padding: 16, cursor: 'pointer' }}>
            {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>

        {!isEntrepot && (
          <div style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 10 }}>ESPÈCES EN CAISSE</label>
            <input type="number" step="0.01" placeholder="0.00" value={especes} onChange={e => setEspeces(e.target.value)} inputMode="decimal"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 10, color: '#f0e8d8', fontSize: 26, padding: 16, boxSizing: 'border-box', textAlign: 'center' }} />
          </div>
        )}

        <button onClick={handleOuvrir} disabled={loading} style={{ width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 14, padding: 22, fontSize: 18, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, touchAction: 'manipulation' }}>
          {loading ? '⟳' : '✓ Ouvrir la caisse'}
        </button>
      </div>
    </div>
  )
}

// ── Numpad ───────────────────────────────────────────────────
function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tap = (k: string) => {
    if (k === '⌫') { onChange(value.slice(0, -1)); return }
    if (k === '.' && value.includes('.')) return
    if (k === '.' && value === '') { onChange('0.'); return }
    if (value.split('.')[1]?.length >= 2) return
    onChange(value + k)
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'].map(k => (
        <button key={k} onClick={() => tap(k)} style={{
          background: k === '⌫' ? 'rgba(201,110,110,0.12)' : 'rgba(255,255,255,0.07)',
          border: `0.5px solid ${k === '⌫' ? 'rgba(201,110,110,0.25)' : 'rgba(255,255,255,0.1)'}`,
          color: k === '⌫' ? '#c96e6e' : '#e8e0d5',
          borderRadius: 10, padding: '18px 0', fontSize: 22, cursor: 'pointer', fontWeight: 500, touchAction: 'manipulation', userSelect: 'none' as const, WebkitUserSelect: 'none' as const,
        }}>{k}</button>
      ))}
    </div>
  )
}

// ── Caisse iPad ──────────────────────────────────────────────
function CaisseIpad({ user, session, onFermer }: { user: User; session: Session; onFermer: () => void }) {
  // État vente
  const [client, setClient] = useState<Client | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [typeDoc, setTypeDoc] = useState('ticket')
  const [remise, setRemise] = useState('')
  const [remiseType, setRemiseType] = useState<'pct' | 'eur'>('pct')
  const [vendeur, setVendeur] = useState(user)
  const [vendeurs, setVendeurs] = useState<User[]>([])
  const [noteGlobale, setNoteGlobale] = useState('')
  const [noteGlobaleActive, setNoteGlobaleActive] = useState(false)

  // Recherche
  const [searchProduit, setSearchProduit] = useState('')
  const [produits, setProduits] = useState<any[]>([])
  const [searchClient, setSearchClient] = useState('')
  const [clientsFound, setClientsFound] = useState<Client[]>([])

  // Paiement
  const [showPaiement, setShowPaiement] = useState(false)
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [modePai, setModePai] = useState('cb')
  const [montantSaisi, setMontantSaisi] = useState('')

  // UI overlays
  const [showClientSheet, setShowClientSheet] = useState(false)
  const [showFermeture, setShowFermeture] = useState(false)
  const [showHistorique, setShowHistorique] = useState(false)
  const [showLocation, setShowLocation] = useState(false)
  const [showLivraison, setShowLivraison] = useState(false)
  const [showDivers, setShowDivers] = useState(false)
  const [diversNom, setDiversNom] = useState('')
  const [diversPrix, setDiversPrix] = useState('')
  const [diversTva, setDiversTva] = useState<5.5 | 20>(20)
  const [espacesFermeture, setEspacesFermeture] = useState('')
  const [venteOk, setVenteOk] = useState(false)
  const [derniereVente, setDerniereVente] = useState<any>(null)
  const [alertesClient, setAlertesClient] = useState<any>(null)
  const [clientEnAttente, setClientEnAttente] = useState<Client | null>(null)
  const [attentes, setAttentes] = useState<any[]>([])

  const searchTimer = useRef<any>(null)
  const prodTimer = useRef<any>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('users').select('*').eq('actif', true).then(({ data }) => setVendeurs(data || []))
  }, [])

  // Calculs
  const totalBrut = lignes.reduce((a, l) => a + l.total, 0)
  const remiseVal = remise ? (remiseType === 'pct' ? totalBrut * parseFloat(remise) / 100 : parseFloat(remise)) : 0
  const totalNet = Math.max(0, totalBrut - remiseVal)
  const totalPaye = paiements.reduce((a, p) => a + p.montant, 0)
  const resteAPayer = Math.max(0, totalNet - totalPaye)
  const monnaie = totalPaye > totalNet ? totalPaye - totalNet : 0
  const canValider = totalPaye >= totalNet || paiements.some(p => p.mode === 'non_regle')

  // Produits
  const searchProduits = async (q: string) => {
    if (!q.trim()) { setProduits([]); return }
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_products', { search_term: q.trim(), p_site_id: session.site_id })
    if (!rpcError && rpcData?.length >= 0) {
      const domaineIds = [...new Set((rpcData || []).map((p: any) => p.domaine_id).filter(Boolean))]
      const domaineMap: Record<string, string> = {}
      if (domaineIds.length) {
        const { data: d } = await supabase.from('domaines').select('id, nom').in('id', domaineIds)
        ;(d || []).forEach((x: any) => { domaineMap[x.id] = x.nom })
      }
      setProduits((rpcData || []).map((p: any) => ({ ...p, domaine_nom: domaineMap[p.domaine_id] || '' })))
      return
    }
    const { data: byNom } = await supabase.from('products').select('id, nom, nom_cuvee, millesime, couleur, prix_vente_ttc, prix_vente_pro, domaine_id, bio').or(`nom.ilike.%${q}%,millesime::text.ilike.%${q}%`).eq('actif', true).limit(20)
    if (byNom?.length) {
      const ids = byNom.map(p => p.id)
      const { data: st } = await supabase.from('stock').select('product_id, quantite').eq('site_id', session.site_id).in('product_id', ids)
      const sm = Object.fromEntries((st || []).map(s => [s.product_id, s.quantite || 0]))
      setProduits(byNom.map(p => ({ ...p, stock: sm[p.id] || 0 })))
    } else setProduits([])
  }

  const addProduit = (p: any) => {
    const prix = (client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc
    const rp = client?.remise_pct || 0
    const ex = lignes.find(l => l.product_id === p.id)
    if (ex) {
      setLignes(prev => prev.map(l => l.product_id === p.id ? { ...l, qte: l.qte + 1, total: (l.qte + 1) * l.prix_unit * (1 - l.remise_pct / 100) } : l))
    } else {
      setLignes(prev => [...prev, { id: Math.random().toString(36).slice(2), product_id: p.id, nom: p.nom, millesime: p.millesime, qte: 1, prix_unit: prix, remise_pct: rp, total: prix * (1 - rp / 100), domaine_nom: p.domaine_nom || '' }])
    }
    setSearchProduit(''); setProduits([]); searchRef.current?.focus()
  }

  const updateQte = (id: string, delta: number) => {
    setLignes(prev => prev.map(l => {
      if (l.id !== id) return l
      const q = Math.max(1, l.qte + delta)
      return { ...l, qte: q, total: q * l.prix_unit * (1 - l.remise_pct / 100) }
    }))
  }

  // Clients
  const searchClients = async (q: string) => {
    if (!q.trim()) { setClientsFound([]); return }
    const [{ data: byNom }, { data: byPrenom }, { data: bySociete }] = await Promise.all([
      supabase.from('customers').select('id, prenom, nom, raison_sociale, est_societe, tarif_pro, remise_pct, email, telephone').ilike('nom', `%${q}%`).limit(6),
      supabase.from('customers').select('id, prenom, nom, raison_sociale, est_societe, tarif_pro, remise_pct, email, telephone').ilike('prenom', `%${q}%`).limit(6),
      supabase.from('customers').select('id, prenom, nom, raison_sociale, est_societe, tarif_pro, remise_pct, email, telephone').ilike('raison_sociale', `%${q}%`).limit(6),
    ])
    const seen = new Set(); const merged = [...(byNom||[]),...(byPrenom||[]),...(bySociete||[])].filter(c => { if(seen.has(c.id)) return false; seen.add(c.id); return true })
    setClientsFound(merged.slice(0, 8))
  }

  const selectClient = async (c: Client | null) => {
    if (!c) { setClient(null); setShowClientSheet(false); return }
    const [{ data: bons }, { data: demandes }, { data: factures }] = await Promise.all([
      supabase.from('loyalty_vouchers').select('*').eq('customer_id', c.id).eq('utilise', false),
      supabase.from('customer_requests').select('*').eq('customer_id', c.id).eq('statut', 'en_attente'),
      supabase.from('ventes').select('id, numero, total_ttc').eq('customer_id', c.id).eq('statut_paiement', 'non_regle').eq('statut', 'validee'),
    ])
    const a = { bons: bons || [], demandes: demandes || [], factures: factures || [] }
    if (a.bons.length || a.demandes.length || a.factures.length) { setClientEnAttente(c); setAlertesClient(a); setShowClientSheet(false) }
    else { setClient(c); setShowClientSheet(false) }
  }

  // Paiement
  const addPaiement = () => {
    const montant = modePai === 'non_regle' ? resteAPayer : (parseFloat(montantSaisi) || resteAPayer)
    if (montant <= 0) return
    const labels: Record<string, string> = { cb: 'CB', especes: 'Espèces', virement: 'Virement', bon_achat: "Bon d'achat", non_regle: 'Non réglé' }
    setPaiements(prev => [...prev, { mode: modePai, montant, label: labels[modePai] }])
    setMontantSaisi('')
  }

  const addDivers = () => {
    if (!diversNom.trim() || !diversPrix) return
    const prix = parseFloat(diversPrix); const qte = 1
    setLignes(prev => [...prev, { id: Math.random().toString(36).slice(2), product_id: `divers-${Date.now()}`, nom: diversNom.trim(), millesime: 0, qte, prix_unit: prix, remise_pct: 0, total: prix * qte, tva_pct: diversTva, is_divers: true }])
    setDiversNom(''); setDiversPrix(''); setShowDivers(false)
  }

  const mettreEnAttente = () => {
    if (attentes.length >= 4 || !lignes.length) return
    const label = client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : `Vente ${attentes.length + 1}`
    setAttentes(prev => [...prev, { id: Math.random().toString(36).slice(2), client, lignes, typeDoc, remise, remiseType, label }])
    resetVente()
  }

  const reprendreAttente = (a: any) => {
    setClient(a.client); setLignes(a.lignes); setTypeDoc(a.typeDoc); setRemise(a.remise); setRemiseType(a.remiseType)
    setAttentes(prev => prev.filter(x => x.id !== a.id))
  }

  const resetVente = () => {
    setClient(null); setLignes([]); setTypeDoc('ticket'); setRemise(''); setRemiseType('pct')
    setNoteGlobale(''); setNoteGlobaleActive(false); setPaiements([]); setMontantSaisi('')
    setSearchClient(''); setClientsFound([]); setShowPaiement(false)
  }

  const imprimerTicket = (vente: any) => {
    const html = `<html><head><style>body{font-family:monospace;font-size:12px;width:80mm;margin:0 auto}.h{text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px}.l{display:flex;justify-content:space-between;margin:3px 0}.t{border-top:1px dashed #000;padding-top:6px;margin-top:6px;font-weight:bold}.f{text-align:center;margin-top:10px;font-size:10px}</style></head><body><div class="h"><b>Cave de Gilbert</b><br/>${new Date().toLocaleDateString('fr-FR')}<br/>N° ${vente.numero}</div>${(vente.lignes||[]).map((l:any)=>`<div class="l"><span>${l.qte}x ${l.nom}${l.millesime?' '+l.millesime:''}</span><span>${l.total.toFixed(2)}€</span></div>`).join('')}<div class="t"><div class="l"><span>TOTAL TTC</span><span>${vente.total.toFixed(2)}€</span></div></div>${(vente.paiements||[]).map((p:any)=>`<div class="l"><span>${p.label}</span><span>${p.montant.toFixed(2)}€</span></div>`).join('')}<div class="f">Merci de votre visite !</div></body></html>`
    const win = window.open('', '_blank'); if (win) { win.document.write(html); win.document.close(); win.print() }
  }

  const handleValider = async () => {
    const numero = `VTE-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`
    const sp = paiements.some(p => p.mode === 'non_regle') ? 'non_regle' : totalNet <= totalPaye ? 'regle' : 'partiel'
    const { data: v } = await supabase.from('ventes').insert({ numero, session_id: session.id, user_id: vendeur.id, customer_id: client?.id || null, site_id: session.site_id, type_doc: typeDoc, statut: 'validee', statut_paiement: sp, total_ht: totalNet / 1.20, total_ttc: totalNet, notes: noteGlobaleActive && noteGlobale ? noteGlobale : null }).select('id').single()
    if (v) {
      await supabase.from('vente_lignes').insert(lignes.map(l => ({ vente_id: v.id, product_id: l.product_id, nom_produit: l.nom_modifie || l.nom, millesime: l.millesime, quantite: l.qte, prix_unitaire_ttc: l.prix_unit, remise_pct: l.remise_pct, total_ttc: l.total })))
      await supabase.from('vente_paiements').insert(paiements.map(p => ({ vente_id: v.id, mode: p.mode, montant: p.montant })))
      for (const l of lignes) { if (!l.is_divers) await supabase.rpc('move_stock', { p_product_id: l.product_id, p_site_id: session.site_id, p_raison: 'vente', p_quantite: l.qte, p_note: `Vente ${numero}`, p_order_id: null, p_transfer_id: null }) }
      if (client && !client.tarif_pro && sp === 'regle') await supabase.from('loyalty_points').insert({ customer_id: client.id, points: Math.floor(totalNet), raison: `Vente ${numero}` })
    }
    setDerniereVente({ numero, total: totalNet, lignes: [...lignes], paiements: [...paiements] })
    setVenteOk(true)
  }

  const handleFermerCaisse = async () => {
    await supabase.from('caisse_sessions').update({ statut: 'fermee', ferme_le: new Date().toISOString(), especes_fermeture: parseFloat(espacesFermeture) || 0 }).eq('id', session.id)
    onFermer()
  }

  const MODES_PAI = [
    { id: 'cb', label: '💳 CB', c: '#6e9ec9' },
    { id: 'especes', label: '💶 Espèces', c: '#6ec96e' },
    { id: 'virement', label: '🏦 Virement', c: '#c9b06e' },
    { id: 'bon_achat', label: '🎟 Bon', c: GOLD },
    { id: 'non_regle', label: '📋 Compte', c: '#c96e6e' },
  ]

  const DOCS = [
    { id: 'ticket', label: '🧾 Ticket' },
    { id: 'devis', label: '📄 Devis' },
    { id: 'commande', label: '📦 Cde' },
    { id: 'bl', label: '🚚 BL' },
    { id: 'facture', label: '💼 Facture' },
  ]

  const nomClient = client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : null

  return (
    <div style={{ height: '100vh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Barre du haut ── */}
      <div style={{ height: 56, background: BG2, borderBottom: `0.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', flexShrink: 0 }}>
        <img src={getLogo(session.site_nom || '')} alt="" style={{ height: 30, maxWidth: 80, objectFit: 'contain' }} onError={e => (e.currentTarget.style.display = 'none')} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: GOLD }}>{session.site_nom || 'Cave de Gilbert'}</div>
        <div style={{ width: 1, height: 24, background: BORDER }} />
        <select value={vendeur.id} onChange={e => { const v = vendeurs.find(u => u.id === e.target.value); if (v) setVendeur(v) }} style={{ background: 'transparent', border: 'none', color: GOLD, fontSize: 14, cursor: 'pointer', outline: 'none' }}>
          {vendeurs.map(v => <option key={v.id} value={v.id} style={{ background: '#1a1408' }}>{v.prenom} {v.nom}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {/* Ventes en attente */}
        {attentes.map(a => (
          <button key={a.id} onClick={() => reprendreAttente(a)} style={{ background: 'rgba(201,169,110,0.12)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, color: GOLD, padding: '6px 12px', fontSize: 12, cursor: 'pointer', touchAction: 'manipulation' }}>
            ⏸ {a.label}
          </button>
        ))}
        <button onClick={() => setShowHistorique(true)} style={{ background: 'transparent', border: `0.5px solid ${BORDER}`, borderRadius: 8, color: 'rgba(232,224,213,0.5)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>📋</button>
        <button onClick={() => setShowLocation(true)} style={{ background: 'transparent', border: `0.5px solid ${BORDER}`, borderRadius: 8, color: 'rgba(232,224,213,0.5)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>🍺</button>
        <button onClick={() => setShowFermeture(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 8, color: '#c96e6e', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Fermer</button>
      </div>

      {/* ── Corps principal : 2 colonnes ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ══ Colonne gauche : Produits + Panier ══ */}
        <div style={{ flex: '0 0 58%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `0.5px solid ${BORDER}` }}>

          {/* Barre recherche */}
          <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${BORDER}`, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input ref={searchRef} type="text" placeholder="🔍 Rechercher un produit…" value={searchProduit}
                onChange={e => { setSearchProduit(e.target.value); clearTimeout(prodTimer.current); prodTimer.current = setTimeout(() => searchProduits(e.target.value), 220) }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: `0.5px solid rgba(201,169,110,0.35)`, borderRadius: 10, color: '#f0e8d8', fontSize: 17, padding: '13px 16px', outline: 'none' }} />
              <button onClick={() => setShowDivers(!showDivers)} style={{ background: showDivers ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.05)', border: `0.5px solid ${showDivers ? 'rgba(201,169,110,0.3)' : BORDER}`, borderRadius: 10, color: showDivers ? GOLD : 'rgba(232,224,213,0.4)', padding: '13px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', touchAction: 'manipulation' }}>＋ Divers</button>
            </div>

            {/* Article divers */}
            {showDivers && (
              <div style={{ marginTop: 10, background: BG3, borderRadius: 10, padding: '14px', border: `0.5px solid rgba(201,169,110,0.2)` }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input value={diversNom} onChange={e => setDiversNom(e.target.value)} placeholder="Désignation"
                    style={{ flex: 2, minWidth: 160, background: 'rgba(255,255,255,0.06)', border: `0.5px solid rgba(255,255,255,0.15)`, borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '10px 12px' }} />
                  <input type="number" step="0.01" value={diversPrix} onChange={e => setDiversPrix(e.target.value)} placeholder="Prix TTC" inputMode="decimal"
                    style={{ width: 100, background: 'rgba(255,255,255,0.06)', border: `0.5px solid rgba(255,255,255,0.15)`, borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '10px 12px' }} />
                  {([20, 5.5] as const).map(t => (
                    <button key={t} onClick={() => setDiversTva(t)} style={{ background: diversTva === t ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${diversTva === t ? GOLD : BORDER}`, color: diversTva === t ? GOLD : 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer' }}>{t}%</button>
                  ))}
                  <button onClick={addDivers} disabled={!diversNom.trim() || !diversPrix} style={{ background: diversNom.trim() && diversPrix ? GOLD : '#2a2a1e', color: diversNom.trim() && diversPrix ? BG : '#555', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>＋ Ajouter</button>
                </div>
              </div>
            )}

            {/* Résultats produit */}
            {produits.length > 0 && (
              <div style={{ position: 'absolute', left: 14, right: 14, top: '100%', background: '#1a1408', border: `0.5px solid rgba(201,169,110,0.25)`, borderRadius: 12, zIndex: 50, maxHeight: 340, overflowY: 'auto' }}>
                {produits.map((p: any) => (
                  <button key={p.id} onClick={() => addProduit(p)} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `0.5px solid rgba(255,255,255,0.05)`, color: '#e8e0d5', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', touchAction: 'manipulation' }}
                    onTouchStart={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.08)')}
                    onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: COULEURS[p.couleur] || '#888', fontSize: 13 }}>●</span>
                        <span style={{ fontSize: 16 }}>{p.nom}{p.millesime ? ` ${p.millesime}` : ''}</span>
                        {p.bio && <span style={{ fontSize: 13 }}>🌿</span>}
                      </div>
                      {(p.nom_cuvee || p.domaine_nom) && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2, paddingLeft: 21 }}>{[p.nom_cuvee, p.domaine_nom].filter(Boolean).join(' · ')}</div>}
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
                      <div style={{ fontSize: 17, color: GOLD, fontFamily: 'Georgia, serif' }}>{((client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc).toFixed(2)}€</div>
                      <div style={{ fontSize: 11, color: p.stock <= 0 ? '#c96e6e' : 'rgba(232,224,213,0.4)' }}>stk: {p.stock ?? '—'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lignes du panier */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px' }}>
            {lignes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(232,224,213,0.2)', fontSize: 16 }}>
                Recherchez un produit pour l'ajouter au panier
              </div>
            ) : lignes.map((l, i) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `0.5px solid rgba(255,255,255,0.05)` }}>
                {/* Nom + domaine */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: '#f0e8d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nom_modifie || l.nom}{l.millesime ? ` ${l.millesime}` : ''}</div>
                  {(l as any).domaine_nom && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{(l as any).domaine_nom}</div>}
                  <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>{fmt(l.prix_unit)} / u.{l.remise_pct > 0 ? ` · -${l.remise_pct}%` : ''}</div>
                </div>
                {/* Contrôle quantité */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                  <button onClick={() => updateQte(l.id, -1)} style={{ background: 'transparent', border: 'none', color: '#e8e0d5', width: 44, height: 44, fontSize: 22, cursor: 'pointer', touchAction: 'manipulation' }}>−</button>
                  <span style={{ fontSize: 17, minWidth: 28, textAlign: 'center', color: '#f0e8d8' }}>{l.qte}</span>
                  <button onClick={() => updateQte(l.id, 1)} style={{ background: 'transparent', border: 'none', color: '#e8e0d5', width: 44, height: 44, fontSize: 22, cursor: 'pointer', touchAction: 'manipulation' }}>+</button>
                </div>
                {/* Total ligne */}
                <div style={{ fontSize: 17, color: GOLD, fontFamily: 'Georgia, serif', fontWeight: 600, minWidth: 70, textAlign: 'right', flexShrink: 0 }}>{fmt(l.total)}</div>
                {/* Supprimer */}
                <button onClick={() => setLignes(prev => prev.filter(x => x.id !== l.id))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 22, cursor: 'pointer', padding: '0 4px', touchAction: 'manipulation', flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* ══ Colonne droite : Client + Type + Total + Paiement ══ */}
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {!showPaiement ? (
            <>
              {/* Client */}
              <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${BORDER}` }}>
                <button onClick={() => setShowClientSheet(true)} style={{ width: '100%', background: client ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${client ? 'rgba(201,169,110,0.3)' : BORDER}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', textAlign: 'left', touchAction: 'manipulation' }}>
                  {client ? (
                    <div>
                      <div style={{ fontSize: 12, color: GOLD, marginBottom: 2, letterSpacing: 1 }}>👤 CLIENT</div>
                      <div style={{ fontSize: 16, color: '#f0e8d8', fontWeight: 500 }}>{nomClient}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        {client.tarif_pro && <span style={{ fontSize: 11, background: '#2a2a1e', color: '#c9b06e', padding: '2px 6px', borderRadius: 3 }}>PRO</span>}
                        {client.remise_pct > 0 && <span style={{ fontSize: 11, background: '#2a1e2a', color: '#c96ec9', padding: '2px 6px', borderRadius: 3 }}>-{client.remise_pct}%</span>}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 15, color: 'rgba(232,224,213,0.4)', textAlign: 'center', padding: '4px 0' }}>👤 Sélectionner un client</div>
                  )}
                </button>
              </div>

              {/* Type de document */}
              <div style={{ padding: '10px 14px', borderBottom: `0.5px solid ${BORDER}` }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {DOCS.map(d => (
                    <button key={d.id} onClick={() => setTypeDoc(d.id)} style={{ flex: 1, background: typeDoc === d.id ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${typeDoc === d.id ? GOLD : BORDER}`, color: typeDoc === d.id ? GOLD : 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '9px 4px', fontSize: 11, cursor: 'pointer', touchAction: 'manipulation' }}>{d.label}</button>
                  ))}
                </div>
              </div>

              {/* Remise globale */}
              <div style={{ padding: '10px 14px', borderBottom: `0.5px solid ${BORDER}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>Remise :</div>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                  {[{ v: 'pct', l: '%' }, { v: 'eur', l: '€' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setRemiseType(v as any)} style={{ background: remiseType === v ? 'rgba(201,169,110,0.2)' : 'transparent', border: 'none', color: remiseType === v ? GOLD : 'rgba(232,224,213,0.4)', padding: '8px 14px', fontSize: 14, cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>
                <input type="number" step="0.01" placeholder="0" value={remise} onChange={e => setRemise(e.target.value)} inputMode="decimal"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: `0.5px solid rgba(255,255,255,0.12)`, borderRadius: 8, color: '#e8e0d5', fontSize: 16, padding: '8px 12px' }} />
              </div>

              {/* Total */}
              <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${BORDER}` }}>
                {remiseVal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}><span>Remise</span><span>-{fmt(remiseVal)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, color: 'rgba(232,224,213,0.45)' }}>TOTAL TTC</span>
                  <span style={{ fontSize: 34, color: GOLD, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{fmt(totalNet)}</span>
                </div>
              </div>

              {/* Boutons action */}
              <div style={{ padding: '12px 14px', display: 'flex', gap: 10 }}>
                {lignes.length > 0 && attentes.length < 4 && (
                  <button onClick={mettreEnAttente} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${BORDER}`, borderRadius: 12, color: 'rgba(232,224,213,0.5)', padding: '14px', fontSize: 14, cursor: 'pointer', touchAction: 'manipulation' }}>⏸ Attente</button>
                )}
                <button onClick={() => lignes.length > 0 && setShowPaiement(true)} disabled={lignes.length === 0}
                  style={{ flex: 2, background: lignes.length > 0 ? GOLD : '#2a2a1e', color: lignes.length > 0 ? BG : '#555', border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, cursor: lignes.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 700, touchAction: 'manipulation' }}>
                  {lignes.length > 0 ? `💳 Encaisser ${fmt(totalNet)}` : 'Panier vide'}
                </button>
              </div>
            </>
          ) : (
            /* ══ Panel paiement ══ */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Header paiement */}
              <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => { setShowPaiement(false); setPaiements([]); setMontantSaisi('') }} style={{ background: 'transparent', border: 'none', color: GOLD, fontSize: 22, cursor: 'pointer' }}>←</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.5)' }}>À encaisser</div>
                  <div style={{ fontSize: 26, color: GOLD, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{fmt(totalNet)}</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                {/* Modes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  {MODES_PAI.map(m => (
                    <button key={m.id} onClick={() => setModePai(m.id)} style={{ background: modePai === m.id ? `${m.c}18` : 'rgba(255,255,255,0.04)', border: `2px solid ${modePai === m.id ? m.c : 'rgba(255,255,255,0.08)'}`, color: modePai === m.id ? m.c : 'rgba(232,224,213,0.5)', borderRadius: 10, padding: '13px 6px', fontSize: 13, cursor: 'pointer', touchAction: 'manipulation', fontWeight: modePai === m.id ? 600 : 400 }}>{m.label}</button>
                  ))}
                </div>

                {/* Affichage montant */}
                <div style={{ background: BG3, borderRadius: 12, padding: '12px 16px', marginBottom: 12, border: `0.5px solid rgba(201,169,110,0.2)`, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, marginBottom: 4 }}>
                    {modePai === 'non_regle' ? 'Mise en compte' : `Montant ${MODES_PAI.find(m => m.id === modePai)?.label}`}
                  </div>
                  <div style={{ fontSize: 30, color: '#f0e8d8', fontFamily: 'Georgia, serif', minHeight: 40 }}>
                    {montantSaisi ? `${montantSaisi} €` : <span style={{ color: 'rgba(232,224,213,0.25)' }}>{fmt(resteAPayer)}</span>}
                  </div>
                </div>

                {/* Numpad */}
                {modePai !== 'non_regle' && (
                  <div style={{ marginBottom: 12 }}>
                    <Numpad value={montantSaisi} onChange={setMontantSaisi} />
                  </div>
                )}

                {/* Bouton ajouter */}
                <button onClick={addPaiement} style={{ width: '100%', background: 'rgba(201,169,110,0.12)', border: `1px solid rgba(201,169,110,0.3)`, borderRadius: 10, color: GOLD, padding: '14px', fontSize: 16, cursor: 'pointer', fontWeight: 600, marginBottom: 14, touchAction: 'manipulation' }}>
                  {modePai === 'non_regle' ? '📋 Mettre en compte' : `+ Ajouter ${montantSaisi ? montantSaisi + ' €' : fmt(resteAPayer)}`}
                </button>

                {/* Récap paiements */}
                {paiements.length > 0 && (
                  <div style={{ background: BG3, borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: `0.5px solid ${BORDER}` }}>
                    {paiements.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < paiements.length - 1 ? `0.5px solid rgba(255,255,255,0.05)` : 'none' }}>
                        <span style={{ fontSize: 15, color: 'rgba(232,224,213,0.7)' }}>{p.label}</span>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 16, color: GOLD, fontFamily: 'Georgia, serif' }}>{fmt(p.montant)}</span>
                          <button onClick={() => setPaiements(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 18, cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `0.5px solid rgba(255,255,255,0.08)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 15, color: resteAPayer > 0 ? '#c96e6e' : '#6ec96e', fontWeight: 600 }}>
                        {resteAPayer > 0 ? `Reste : ${fmt(resteAPayer)}` : monnaie > 0 ? `Monnaie : ${fmt(monnaie)}` : '✓ Soldé'}
                      </span>
                      <span style={{ fontSize: 18, color: GOLD, fontFamily: 'Georgia, serif' }}>{fmt(totalPaye)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Valider */}
              <div style={{ padding: '12px 14px 16px', borderTop: `0.5px solid ${BORDER}` }}>
                <button onClick={() => canValider && handleValider()} style={{ width: '100%', background: canValider ? GOLD : '#2a2a1e', color: canValider ? BG : '#555', border: 'none', borderRadius: 14, padding: '18px', fontSize: 18, cursor: canValider ? 'pointer' : 'not-allowed', fontWeight: 700, touchAction: 'manipulation', letterSpacing: 0.5 }}>
                  {canValider ? `✓ Valider — ${fmt(totalNet)}` : 'Ajouter un paiement'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Bottom sheet — Client ══ */}
      {showClientSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={e => e.target === e.currentTarget && setShowClientSheet(false)}>
          <div style={{ width: '100%', background: BG2, borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px', flexShrink: 0 }} />
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: '#f0e8d8', marginBottom: 16, flexShrink: 0 }}>Sélectionner un client</div>
            <input type="text" placeholder="🔍 Nom, prénom, email…" value={searchClient}
              onChange={e => { setSearchClient(e.target.value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => searchClients(e.target.value), 280) }}
              autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: `0.5px solid rgba(201,169,110,0.3)`, borderRadius: 12, color: '#f0e8d8', fontSize: 17, padding: '14px 16px', boxSizing: 'border-box', marginBottom: 14, outline: 'none', flexShrink: 0 }} />
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <button onClick={() => selectClient(null)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 10, color: 'rgba(232,224,213,0.5)', padding: '14px 16px', fontSize: 15, cursor: 'pointer', textAlign: 'left', marginBottom: 8, touchAction: 'manipulation' }}>👤 Client anonyme</button>
              {clientsFound.map(c => (
                <button key={c.id} onClick={() => selectClient(c)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 10, color: '#e8e0d5', padding: '14px 16px', fontSize: 15, cursor: 'pointer', textAlign: 'left', marginBottom: 8, touchAction: 'manipulation' }}>
                  <div style={{ fontWeight: 500 }}>{c.est_societe ? c.raison_sociale : `${c.prenom} ${c.nom}`}</div>
                  {c.email && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 3 }}>{c.email}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {c.tarif_pro && <span style={{ fontSize: 11, background: '#2a2a1e', color: '#c9b06e', padding: '2px 6px', borderRadius: 3 }}>PRO</span>}
                    {c.remise_pct > 0 && <span style={{ fontSize: 11, background: '#2a1e2a', color: '#c96ec9', padding: '2px 6px', borderRadius: 3 }}>-{c.remise_pct}%</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal alertes client ══ */}
      {alertesClient && clientEnAttente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div style={{ background: BG3, border: `0.5px solid rgba(201,169,110,0.3)`, borderRadius: 16, padding: '32px', maxWidth: 500, width: '90%' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 8 }}>⚠ Alertes client</div>
            <div style={{ fontSize: 15, color: 'rgba(232,224,213,0.5)', marginBottom: 24 }}>{clientEnAttente.est_societe ? clientEnAttente.raison_sociale : `${clientEnAttente.prenom} ${clientEnAttente.nom}`}</div>
            {alertesClient.bons?.length > 0 && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: GOLD, letterSpacing: 1, marginBottom: 8 }}>🎟 BONS D'ACHAT</div>{alertesClient.bons.map((b: any) => <div key={b.id} style={{ background: 'rgba(201,169,110,0.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 6, color: GOLD, fontFamily: 'Georgia, serif', fontSize: 18 }}>{b.montant}€ — {b.code}</div>)}</div>}
            {alertesClient.demandes?.length > 0 && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: '#6e9ec9', letterSpacing: 1, marginBottom: 8 }}>📋 DEMANDES EN ATTENTE</div>{alertesClient.demandes.map((d: any) => <div key={d.id} style={{ background: 'rgba(110,158,201,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 6, fontSize: 14 }}>{d.titre}</div>)}</div>}
            {alertesClient.factures?.length > 0 && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: '#c96e6e', letterSpacing: 1, marginBottom: 8 }}>💳 FACTURES NON RÉGLÉES</div>{alertesClient.factures.map((f: any) => <div key={f.id} style={{ background: 'rgba(201,110,110,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 6, fontSize: 14, color: '#c96e6e' }}>{f.numero} — {parseFloat(f.total_ttc).toFixed(2)}€</div>)}</div>}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={() => { setAlertesClient(null); setClientEnAttente(null) }} style={{ flex: 1, background: 'transparent', border: `0.5px solid rgba(255,255,255,0.15)`, color: 'rgba(232,224,213,0.5)', borderRadius: 10, padding: '14px', fontSize: 15, cursor: 'pointer' }}>← Retour</button>
              <button onClick={() => { setClient(clientEnAttente); setAlertesClient(null); setClientEnAttente(null) }} style={{ flex: 2, background: GOLD, color: BG, border: 'none', borderRadius: 10, padding: '14px', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>Continuer →</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Vente OK ══ */}
      {venteOk && derniereVente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: BG3, border: `0.5px solid rgba(201,169,110,0.3)`, borderRadius: 20, padding: '44px 40px', textAlign: 'center', maxWidth: 440, width: '90%' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#6ec96e', marginBottom: 6 }}>Vente enregistrée !</div>
            <div style={{ fontSize: 15, color: 'rgba(232,224,213,0.5)', marginBottom: 32 }}>{derniereVente.numero} — {fmt(derniereVente.total)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => imprimerTicket(derniereVente)} style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: `0.5px solid rgba(255,255,255,0.15)`, borderRadius: 12, color: '#e8e0d5', padding: '16px', fontSize: 17, cursor: 'pointer', touchAction: 'manipulation' }}>🖨 Imprimer le ticket</button>
              <button onClick={() => { setVenteOk(false); setDerniereVente(null); resetVente() }} style={{ width: '100%', background: GOLD, border: 'none', borderRadius: 12, color: BG, padding: '18px', fontSize: 18, cursor: 'pointer', fontWeight: 700, touchAction: 'manipulation' }}>✓ Fin de la vente</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Fermeture caisse ══ */}
      {showFermeture && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: BG3, border: `0.5px solid rgba(201,169,110,0.3)`, borderRadius: 16, padding: '36px', maxWidth: 420, width: '90%' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#f0e8d8', marginBottom: 24 }}>Fermeture de caisse</div>
            <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 10 }}>ESPÈCES EN CAISSE</div>
            <input type="number" step="0.01" placeholder="0.00" value={espacesFermeture} onChange={e => setEspacesFermeture(e.target.value)} inputMode="decimal"
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: `0.5px solid rgba(201,169,110,0.3)`, borderRadius: 10, color: '#f0e8d8', fontSize: 24, padding: '16px', boxSizing: 'border-box', textAlign: 'center', marginBottom: 24 }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowFermeture(false)} style={{ flex: 1, background: 'transparent', border: `0.5px solid rgba(255,255,255,0.15)`, color: 'rgba(232,224,213,0.5)', borderRadius: 10, padding: '16px', fontSize: 16, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleFermerCaisse} style={{ flex: 2, background: '#c96e6e', color: '#fff', border: 'none', borderRadius: 10, padding: '16px', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>Fermer la caisse</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlays location / livraison / historique */}
      {showLocation && <div style={{ position: 'fixed', inset: 0, zIndex: 600 }}><ModuleLocation session={session} user={vendeur} onClose={() => setShowLocation(false)} /></div>}
      {showLivraison && <div style={{ position: 'fixed', inset: 0, zIndex: 700 }}><ModuleLivraisonLocation onClose={() => setShowLivraison(false)} /></div>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function CaisseIpadPage() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  return (
    <>
      {!user && <EcranLogin onLogin={setUser} />}
      {user && !session && <EcranOuverture user={user} onOuvrir={setSession} />}
      {user && session && <CaisseIpad user={user} session={session} onFermer={() => { setSession(null); setUser(null) }} />}
    </>
  )
}