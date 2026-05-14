'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Styles ────────────────────────────────────────────────────
const inp = { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#f0e8d8', fontSize: 16, padding: '14px', boxSizing: 'border-box' as const, width: '100%' }
const btn = { background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, cursor: 'pointer', fontWeight: 700, width: '100%', touchAction: 'manipulation' as const }
const card = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '20px 24px' } as React.CSSProperties
const lbl = { fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }
const inpSmall = { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e0d5', fontSize: 13, padding: '10px 12px', boxSizing: 'border-box' as const, width: '100%' }

// ── Jours fériés français ─────────────────────────────────────
function getJoursFeries(year: number): Set<string> {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const fixed = [
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`,
    `${year}-07-14`, `${year}-08-15`, `${year}-11-01`,
    `${year}-11-11`, `${year}-12-25`,
  ]
  // Pâques (algorithme de Meeus/Jones/Butcher)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  const paques = new Date(year, month - 1, day)
  const lundiPaques = new Date(paques); lundiPaques.setDate(paques.getDate() + 1)
  const ascension = new Date(paques); ascension.setDate(paques.getDate() + 39)
  const pentecote = new Date(paques); pentecote.setDate(paques.getDate() + 50)
  return new Set([...fixed, fmt(lundiPaques), fmt(ascension), fmt(pentecote)])
}

// Jours ouvrés Mardi→Samedi (planning Corentin & Hugo)
function countJoursOuvres(debut: string, fin: string): number {
  const feriesSet = new Set([...getJoursFeries(new Date(debut).getFullYear()), ...getJoursFeries(new Date(fin).getFullYear())])
  let count = 0
  const d = new Date(debut)
  const f = new Date(fin)
  while (d <= f) {
    const day = d.getDay() // 0=dim,1=lun,...,6=sam
    const iso = d.toISOString().split('T')[0]
    if (day >= 2 && day <= 6 && !feriesSet.has(iso)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateCourt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// ── Types ─────────────────────────────────────────────────────
type User = { id: string; prenom: string; nom: string; role: string; pin: string }
type Profil = { user_id: string; site_id: string; samedi_offert_par_mois: number; heures_dues_par_samedi_offert: number; conges_acquis_total: number; conges_pris: number }
type Demande = { id: string; user_id: string; type: string; date_debut: string; date_fin: string; nb_jours: number; statut: string; motif_demande: string; motif_refus: string; traite_at: string; created_at: string }
type SamediOffert = { id: string; user_id: string; date_samedi: string; statut: string; note: string }
type EvenementSoiree = { id: string; user_id: string; date_evenement: string; heures: number; mois_reference: string; description: string }

const TYPE_LABEL: Record<string, string> = { cp: 'Congé payé', sans_solde: 'Sans solde', exceptionnel: 'Congé exceptionnel', maladie: 'Arrêt maladie' }
const TYPE_COLOR: Record<string, string> = { cp: '#6e9ec9', sans_solde: '#c9b06e', exceptionnel: '#8ec98e', maladie: '#c96e6e' }
const STATUT_COLOR: Record<string, string> = { en_attente: '#c9b06e', approuve: '#6ec96e', refuse: '#c96e6e', annule: '#888' }
const STATUT_LABEL: Record<string, string> = { en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé', annule: 'Annulé' }

// ── Écran de connexion ────────────────────────────────────────
function EcranLogin({ onLogin }: { onLogin: (u: User) => void }) {
  const [prenom, setPrenom] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const doLogin = async (p = pin) => {
    if (!prenom.trim() || p.length < 4) return
    setLoading(true); setError('')
    const { data } = await supabase.from('users').select('*').ilike('prenom', prenom.trim()).eq('actif', true).maybeSingle()
    if (!data) { setError('Utilisateur introuvable'); setPin(''); setLoading(false); return }
    if (data.pin !== p) { setError('PIN incorrect'); setPin(''); setLoading(false); return }
    onLogin(data)
  }

  const handleKey = (k: string) => {
    if (k === '←') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 4) return
    const np = pin + k
    setPin(np)
    if (np.length === 4) setTimeout(() => doLogin(np), 50)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0d0a08', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
          <img src="/logo.png" alt="Cave de Gilbert" style={{ maxHeight: 56, maxWidth: '80%', objectFit: 'contain', marginBottom: 12 }} onError={e => (e.currentTarget.style.display = 'none')} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e', letterSpacing: 3 }}>Gestion RH</div>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>Congés & Planification</div>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#c96e6e', textAlign: 'center' as const }}>{error}</div>}
        <input type="text" placeholder="Votre prénom" value={prenom} onChange={e => setPrenom(e.target.value)} autoCapitalize="words" style={{ ...inp, marginBottom: 24, textAlign: 'center' as const }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? '#c9a96e' : 'rgba(255,255,255,0.12)', transition: 'background 0.15s' }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {['1','2','3','4','5','6','7','8','9','←','0','✓'].map(k => (
            <button key={k} onClick={() => k === '✓' ? doLogin() : handleKey(k)} style={{ background: k === '✓' ? '#c9a96e' : 'rgba(255,255,255,0.07)', border: `1px solid ${k === '✓' ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, color: k === '✓' ? '#0d0a08' : '#e8e0d5', borderRadius: 12, padding: '18px 0', fontSize: 20, cursor: 'pointer', fontWeight: k === '✓' ? 700 : 400, touchAction: 'manipulation' }}>{k}</button>
          ))}
        </div>
        {loading && <div style={{ textAlign: 'center' as const, marginTop: 20, color: 'rgba(232,224,213,0.4)' }}>⟳ Connexion...</div>}
      </div>
    </div>
  )
}

// ── Calendrier mensuel ────────────────────────────────────────
function CalendrierMois({ year, month, demandes, samedisOfferts, utilisateur, isAdmin }: {
  year: number; month: number
  demandes: (Demande & { user_prenom?: string })[]
  samedisOfferts: SamediOffert[]
  utilisateur?: User
  isAdmin: boolean
}) {
  const feries = getJoursFeries(year)
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // lundi=0
  const days = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1)
  const pad = Array.from({ length: startDow }, (_, i) => i)
  const moisNom = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const getDemandesForDay = (day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return demandes.filter(d => d.statut === 'approuve' && iso >= d.date_debut && iso <= d.date_fin)
  }

  const isSamediOffert = (day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return samedisOfferts.some(s => s.date_samedi === iso && s.statut !== 'annule')
  }

  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#f0e8d8', marginBottom: 16, textTransform: 'capitalize' as const }}>{moisNom}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {JOURS.map(j => <div key={j} style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, padding: '4px 0', letterSpacing: 1 }}>{j}</div>)}
        {pad.map(i => <div key={`p${i}`} />)}
        {days.map(day => {
          const dow = (new Date(year, month, day).getDay() + 6) % 7
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const ferie = feries.has(iso)
          const weekend = dow >= 5 // sam=5, dim=6
          const lundi = dow === 0
          const demandesJour = getDemandesForDay(day)
          const samediOff = dow === 5 && isSamediOffert(day)
          const today = new Date().toISOString().split('T')[0] === iso

          return (
            <div key={day} style={{
              minHeight: 52, padding: '4px 3px', borderRadius: 4,
              background: today ? 'rgba(201,169,110,0.1)' : lundi ? 'rgba(255,255,255,0.01)' : 'transparent',
              border: today ? '0.5px solid rgba(201,169,110,0.3)' : '0.5px solid transparent',
              opacity: lundi ? 0.4 : 1,
            }}>
              <div style={{ fontSize: 11, color: ferie ? '#c96e6e' : lundi || (dow === 6) ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', marginBottom: 2, textAlign: 'center' as const, fontWeight: today ? 700 : 400 }}>{day}</div>
              {ferie && <div style={{ fontSize: 8, color: '#c96e6e', textAlign: 'center' as const, letterSpacing: 0.5 }}>Férié</div>}
              {samediOff && <div style={{ fontSize: 8, background: 'rgba(201,176,110,0.2)', color: '#c9b06e', textAlign: 'center' as const, borderRadius: 2, padding: '1px 2px' }}>Sam. offert</div>}
              {demandesJour.map((d, idx) => (
                <div key={idx} style={{ fontSize: 8, background: `${TYPE_COLOR[d.type] || '#888'}22`, color: TYPE_COLOR[d.type] || '#888', borderRadius: 2, padding: '1px 3px', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {isAdmin && d.user_prenom ? d.user_prenom : TYPE_LABEL[d.type]?.split(' ')[0]}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vue Admin ─────────────────────────────────────────────────
function VueAdmin({ admin }: { admin: User }) {
  const [onglet, setOnglet] = useState<'demandes' | 'calendrier' | 'salaries' | 'evenements'>('demandes')
  const [demandes, setDemandes] = useState<(Demande & { user_prenom?: string; user_nom?: string })[]>([])
  const [salaries, setSalaries] = useState<(User & { profil?: Profil })[]>([])
  const [samedisOfferts, setSamedisOfferts] = useState<SamediOffert[]>([])
  const [evenements, setEvenements] = useState<(EvenementSoiree & { user_prenom?: string })[]>([])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [motifRefus, setMotifRefus] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showNouveauSamedi, setShowNouveauSamedi] = useState(false)
  const [showNouvelEvenement, setShowNouvelEvenement] = useState(false)
  const [selectedSalarie, setSelectedSalarie] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: users }, { data: profils }, { data: dem }, { data: sam }, { data: ev }] = await Promise.all([
      supabase.from('users').select('id, prenom, nom, role').eq('actif', true).in('role', ['vendeur', 'caviste']),
      supabase.from('employe_profils').select('*'),
      supabase.from('conges_demandes').select('*').order('created_at', { ascending: false }),
      supabase.from('samedis_offerts').select('*').order('date_samedi'),
      supabase.from('evenements_soiree').select('*').order('date_evenement', { ascending: false }),
    ])
    const profilMap = Object.fromEntries((profils || []).map(p => [p.user_id, p]))
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]))
    setSalaries((users || []).map(u => ({ ...u, profil: profilMap[u.id] })))
    setDemandes((dem || []).map(d => ({ ...d, user_prenom: userMap[d.user_id]?.prenom, user_nom: userMap[d.user_id]?.nom })))
    setSamedisOfferts(sam || [])
    setEvenements((ev || []).map(e => ({ ...e, user_prenom: userMap[e.user_id]?.prenom })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleStatut = async (id: string, statut: 'approuve' | 'refuse') => {
    const d = demandes.find(x => x.id === id)
    if (!d) return
    await supabase.from('conges_demandes').update({
      statut, traite_par: admin.id, traite_at: new Date().toISOString(),
      motif_refus: statut === 'refuse' ? (motifRefus[id] || '') : null,
    }).eq('id', id)
    if (statut === 'approuve') {
      const profil = salaries.find(s => s.id === d.user_id)?.profil
      if (profil) {
        await supabase.from('employe_profils').update({ conges_pris: (profil.conges_pris || 0) + d.nb_jours }).eq('user_id', d.user_id)
      }
    }
    load()
  }

  const demandesEnAttente = demandes.filter(d => d.statut === 'en_attente')

  // Alertes chevauchement
  const alertesChevauchement = demandesEnAttente.filter(d1 =>
    demandesEnAttente.some(d2 => d2.id !== d1.id && d1.user_id !== d2.user_id && d1.date_debut <= d2.date_fin && d1.date_fin >= d2.date_debut)
  )

  const tabStyle = (t: string) => ({
    background: onglet === t ? 'rgba(201,169,110,0.12)' : 'transparent',
    border: 'none', borderBottom: `2px solid ${onglet === t ? '#c9a96e' : 'transparent'}`,
    color: onglet === t ? '#c9a96e' : 'rgba(232,224,213,0.4)',
    padding: '12px 20px', fontSize: 13, cursor: 'pointer',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#100d0a' }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e' }}>Gestion RH</div>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Administration — {admin.prenom} {admin.nom}</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {demandesEnAttente.length > 0 && (
            <div style={{ background: 'rgba(201,176,110,0.15)', border: '0.5px solid rgba(201,176,110,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#c9b06e' }}>
              {demandesEnAttente.length} demande{demandesEnAttente.length > 1 ? 's' : ''} en attente
            </div>
          )}
          <a href="/admin" style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)', textDecoration: 'none' }}>← Admin</a>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a' }}>
        {[['demandes', `📋 Demandes${demandesEnAttente.length > 0 ? ` (${demandesEnAttente.length})` : ''}`], ['calendrier', '📅 Calendrier'], ['salaries', '👤 Salariés'], ['evenements', '🌙 Événements']].map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id as any)} style={tabStyle(id)}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {loading ? <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div> : (

          <>
            {/* ── DEMANDES ── */}
            {onglet === 'demandes' && (
              <div>
                {alertesChevauchement.length > 0 && (
                  <div style={{ background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 6, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20 }}>⚠</span>
                    <div>
                      <div style={{ fontSize: 13, color: '#c96e6e', fontWeight: 600, marginBottom: 4 }}>Chevauchement détecté</div>
                      <div style={{ fontSize: 12, color: 'rgba(201,110,110,0.7)' }}>Plusieurs demandes couvrent la même période — vérifiez la continuité du service.</div>
                    </div>
                  </div>
                )}

                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8', marginBottom: 20 }}>Demandes de congés</h2>

                {demandes.length === 0 ? (
                  <div style={{ ...card, textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.4)' }}>Aucune demande pour le moment.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                    {demandes.map(d => (
                      <div key={d.id} style={{ ...card, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 15, color: '#f0e8d8', fontWeight: 600 }}>{d.user_prenom} {d.user_nom}</span>
                            <span style={{ background: `${TYPE_COLOR[d.type]}22`, color: TYPE_COLOR[d.type], fontSize: 11, padding: '2px 8px', borderRadius: 3 }}>{TYPE_LABEL[d.type]}</span>
                            <span style={{ background: `${STATUT_COLOR[d.statut]}22`, color: STATUT_COLOR[d.statut], fontSize: 11, padding: '2px 8px', borderRadius: 3 }}>{STATUT_LABEL[d.statut]}</span>
                            {alertesChevauchement.some(a => a.id === d.id) && <span style={{ background: 'rgba(201,110,110,0.15)', color: '#c96e6e', fontSize: 10, padding: '2px 8px', borderRadius: 3 }}>⚠ Chevauchement</span>}
                          </div>
                          <div style={{ fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif', marginBottom: 4 }}>
                            {formatDate(d.date_debut)} → {formatDate(d.date_fin)} · {d.nb_jours} jour{d.nb_jours > 1 ? 's' : ''}
                          </div>
                          {d.motif_demande && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 4 }}>"{d.motif_demande}"</div>}
                          {d.motif_refus && <div style={{ fontSize: 12, color: '#c96e6e' }}>Motif refus : {d.motif_refus}</div>}
                          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>Demandé le {formatDate(d.created_at)}</div>
                        </div>
                        {d.statut === 'en_attente' && (
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, minWidth: 200 }}>
                            <input value={motifRefus[d.id] || ''} onChange={e => setMotifRefus(prev => ({ ...prev, [d.id]: e.target.value }))}
                              placeholder="Motif de refus (optionnel)" style={{ ...inpSmall, fontSize: 12 }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => handleStatut(d.id, 'refuse')} style={{ flex: 1, background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 6, padding: '8px', fontSize: 12, cursor: 'pointer' }}>✕ Refuser</button>
                              <button onClick={() => handleStatut(d.id, 'approuve')} style={{ flex: 1, background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', color: '#6ec96e', borderRadius: 6, padding: '8px', fontSize: 12, cursor: 'pointer' }}>✓ Approuver</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CALENDRIER ── */}
            {onglet === 'calendrier' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8' }}>Calendrier global</h2>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#e8e0d5', borderRadius: 4, padding: '6px 12px', fontSize: 14, cursor: 'pointer' }}>‹</button>
                    <span style={{ fontSize: 14, color: '#c9a96e', minWidth: 140, textAlign: 'center' as const, textTransform: 'capitalize' as const }}>
                      {new Date(calYear, calMonth, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#e8e0d5', borderRadius: 4, padding: '6px 12px', fontSize: 14, cursor: 'pointer' }}>›</button>
                  </div>
                </div>

                {/* Légende */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' as const }}>
                  {salaries.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLOR['cp'] }} />
                      {s.prenom} — Congés approuvés
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(201,176,110,0.4)' }} />
                    Samedi offert
                  </div>
                </div>

                <div style={{ ...card }}>
                  <CalendrierMois
                    year={calYear} month={calMonth}
                    demandes={demandes}
                    samedisOfferts={samedisOfferts}
                    isAdmin={true}
                  />
                </div>
              </div>
            )}

            {/* ── SALARIÉS ── */}
            {onglet === 'salaries' && (
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8', marginBottom: 20 }}>Salariés</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {salaries.map(s => {
                    const acquis = s.profil?.conges_acquis_total || 25
                    const pris = s.profil?.conges_pris || 0
                    const restants = Math.max(0, acquis - pris)
                    const pct = Math.round((pris / acquis) * 100)
                    return (
                      <div key={s.id} style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: 16, color: '#f0e8d8', fontWeight: 600 }}>{s.prenom} {s.nom}</div>
                            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 2, textTransform: 'capitalize' as const }}>{s.role}</div>
                          </div>
                          <div style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, padding: '4px 10px', fontSize: 11, color: '#c9a96e' }}>
                            Mar→Sam
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                          {[{ label: 'Acquis', value: acquis, color: '#6e9ec9' }, { label: 'Pris', value: pris, color: '#c9b06e' }, { label: 'Restants', value: restants, color: restants <= 5 ? '#c96e6e' : '#6ec96e' }].map(({ label, value, color }) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '10px', textAlign: 'center' as const }}>
                              <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginBottom: 4 }}>{label.toUpperCase()}</div>
                              <div style={{ fontSize: 22, color, fontFamily: 'Georgia, serif' }}>{value}</div>
                              <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)' }}>jours</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#c96e6e' : '#c9a96e', borderRadius: 2, transition: 'width 0.5s' }} />
                        </div>
                        {s.profil?.samedi_offert_par_mois > 0 && (
                          <div style={{ background: 'rgba(201,176,110,0.08)', border: '0.5px solid rgba(201,176,110,0.2)', borderRadius: 4, padding: '8px 12px', fontSize: 12, color: '#c9b06e' }}>
                            ☀ {s.profil.samedi_offert_par_mois} samedi offert/mois · {s.profil.heures_dues_par_samedi_offert}h dues/mois
                          </div>
                        )}
                        {/* Modifier solde */}
                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ ...lbl, fontSize: 9 }}>Solde acquis</label>
                            <input type="number" step="0.5" defaultValue={acquis}
                              onBlur={async e => {
                                const v = parseFloat(e.target.value)
                                if (!isNaN(v)) {
                                  await supabase.from('employe_profils').upsert({ user_id: s.id, conges_acquis_total: v }, { onConflict: 'user_id' })
                                  load()
                                }
                              }}
                              style={{ ...inpSmall, fontSize: 13, textAlign: 'center' as const }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ ...lbl, fontSize: 9 }}>Jours pris</label>
                            <input type="number" step="0.5" defaultValue={pris}
                              onBlur={async e => {
                                const v = parseFloat(e.target.value)
                                if (!isNaN(v)) {
                                  await supabase.from('employe_profils').upsert({ user_id: s.id, conges_pris: v }, { onConflict: 'user_id' })
                                  load()
                                }
                              }}
                              style={{ ...inpSmall, fontSize: 13, textAlign: 'center' as const }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── ÉVÉNEMENTS SOIRÉE ── */}
            {onglet === 'evenements' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8' }}>Événements soirée</h2>
                  <button onClick={() => setShowNouvelEvenement(true)}
                    style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    + Ajouter un événement
                  </button>
                </div>

                {/* Compteurs par mois en cours */}
                {salaries.filter(s => s.profil?.samedi_offert_par_mois > 0).map(s => {
                  const moisCourant = new Date().toISOString().slice(0, 7)
                  const hDues = (s.profil?.heures_dues_par_samedi_offert || 7)
                  const hUtilisees = evenements.filter(e => e.user_id === s.id && e.mois_reference === moisCourant).reduce((acc, e) => acc + e.heures, 0)
                  const hRestantes = hDues - hUtilisees
                  return (
                    <div key={s.id} style={{ ...card, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 14, color: '#f0e8d8', fontWeight: 600 }}>{s.prenom} — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ textAlign: 'center' as const }}>
                            <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1 }}>DUES</div>
                            <div style={{ fontSize: 20, color: '#c9b06e', fontFamily: 'Georgia, serif' }}>{hDues}h</div>
                          </div>
                          <div style={{ textAlign: 'center' as const }}>
                            <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1 }}>UTILISÉES</div>
                            <div style={{ fontSize: 20, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{hUtilisees}h</div>
                          </div>
                          <div style={{ textAlign: 'center' as const }}>
                            <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1 }}>RESTANTES</div>
                            <div style={{ fontSize: 20, color: hRestantes <= 0 ? '#6ec96e' : '#c96e6e', fontFamily: 'Georgia, serif' }}>{hRestantes}h</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (hUtilisees / hDues) * 100)}%`, background: hRestantes <= 0 ? '#6ec96e' : '#c9a96e', borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}

                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginTop: 16 }}>
                  {evenements.map(e => (
                    <div key={e.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#f0e8d8' }}>{e.user_prenom} · {formatDate(e.date_evenement)}</div>
                        {e.description && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>{e.description}</div>}
                      </div>
                      <div style={{ textAlign: 'right' as const }}>
                        <div style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{e.heures}h</div>
                        <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>{e.mois_reference}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {showNouvelEvenement && (
                  <ModalNouvelEvenement
                    salaries={salaries}
                    onCreated={() => { setShowNouvelEvenement(false); load() }}
                    onClose={() => setShowNouvelEvenement(false)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Modal Nouvel événement ────────────────────────────────────
function ModalNouvelEvenement({ salaries, onCreated, onClose }: { salaries: any[]; onCreated: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ user_id: salaries[0]?.id || '', date_evenement: new Date().toISOString().split('T')[0], heures: '', description: '', mois_reference: new Date().toISOString().slice(0, 7) })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.user_id || !form.heures) return
    setSaving(true)
    await supabase.from('evenements_soiree').insert({ ...form, heures: parseFloat(form.heures) })
    setSaving(false); onCreated()
  }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: 440, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 300, color: '#f0e8d8', marginBottom: 20 }}>🌙 Ajouter un événement soirée</h2>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          <div><label style={lbl}>Salarié</label>
            <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} style={{ ...inpSmall, background: '#1a1408' }}>
              {salaries.map(s => <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Date de l'événement</label>
            <input type="date" value={form.date_evenement} onChange={e => setForm(f => ({ ...f, date_evenement: e.target.value, mois_reference: e.target.value.slice(0, 7) }))} style={inpSmall} />
          </div>
          <div><label style={lbl}>Heures travaillées</label>
            <input type="number" step="0.5" min={0} value={form.heures} onChange={e => setForm(f => ({ ...f, heures: e.target.value }))} placeholder="Ex: 3.5" style={inpSmall} />
          </div>
          <div><label style={lbl}>Description (optionnel)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Dégustation clients Beaujolais" style={inpSmall} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '11px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving || !form.heures} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vue Employé ───────────────────────────────────────────────
function VueEmploye({ user }: { user: User }) {
  const [onglet, setOnglet] = useState<'accueil' | 'demander' | 'samedis'>('accueil')
  const [profil, setProfil] = useState<Profil | null>(null)
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [samedisOfferts, setSamedisOfferts] = useState<SamediOffert[]>([])
  const [evenements, setEvenements] = useState<EvenementSoiree[]>([])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [form, setForm] = useState({ type: 'cp', date_debut: '', date_fin: '', motif_demande: '' })
  const [nbJoursCalc, setNbJoursCalc] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNouveauSamedi, setShowNouveauSamedi] = useState(false)
  const [nouveauSamedi, setNouveauSamedi] = useState({ date: '', note: '' })

  const hasSamediOffert = (profil?.samedi_offert_par_mois || 0) > 0

  const load = useCallback(async () => {
    const [{ data: p }, { data: d }, { data: s }, { data: e }] = await Promise.all([
      supabase.from('employe_profils').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('conges_demandes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('samedis_offerts').select('*').eq('user_id', user.id).order('date_samedi'),
      supabase.from('evenements_soiree').select('*').eq('user_id', user.id).order('date_evenement', { ascending: false }),
    ])
    setProfil(p)
    setDemandes(d || [])
    setSamedisOfferts(s || [])
    setEvenements(e || [])
  }, [user.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (form.date_debut && form.date_fin && form.date_fin >= form.date_debut) {
      setNbJoursCalc(countJoursOuvres(form.date_debut, form.date_fin))
    } else setNbJoursCalc(0)
  }, [form.date_debut, form.date_fin])

  const handleDemander = async () => {
    if (!form.date_debut || !form.date_fin || nbJoursCalc === 0) { setError('Dates invalides'); return }
    const restants = (profil?.conges_acquis_total || 25) - (profil?.conges_pris || 0)
    if (form.type === 'cp' && nbJoursCalc > restants) { setError(`Solde insuffisant (${restants} jours restants)`); return }
    setSaving(true); setError('')
    await supabase.from('conges_demandes').insert({ user_id: user.id, ...form, nb_jours: nbJoursCalc, statut: 'en_attente' })
    setForm({ type: 'cp', date_debut: '', date_fin: '', motif_demande: '' })
    setSuccess('Demande envoyée avec succès — en attente de validation.')
    setTimeout(() => setSuccess(''), 4000)
    setSaving(false); load()
    setOnglet('accueil')
  }

  const handleSamedi = async () => {
    if (!nouveauSamedi.date) return
    setSaving(true)
    await supabase.from('samedis_offerts').upsert({ user_id: user.id, date_samedi: nouveauSamedi.date, note: nouveauSamedi.note || null, statut: 'prevu' }, { onConflict: 'user_id,date_samedi' })
    setNouveauSamedi({ date: '', note: '' }); setShowNouveauSamedi(false)
    setSaving(false); load()
  }

  const acquis = profil?.conges_acquis_total || 25
  const pris = profil?.conges_pris || 0
  const restants = Math.max(0, acquis - pris)

  const moisCourant = new Date().toISOString().slice(0, 7)
  const hDues = profil?.heures_dues_par_samedi_offert || 7
  const hUtilisees = evenements.filter(e => e.mois_reference === moisCourant).reduce((acc, e) => acc + e.heures, 0)
  const hRestantes = hDues - hUtilisees

  const tabStyle = (t: string) => ({
    background: onglet === t ? 'rgba(201,169,110,0.12)' : 'transparent',
    border: 'none', borderBottom: `2px solid ${onglet === t ? '#c9a96e' : 'transparent'}`,
    color: onglet === t ? '#c9a96e' : 'rgba(232,224,213,0.4)',
    padding: '12px 20px', fontSize: 13, cursor: 'pointer', flex: 1,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>Bonjour {user.prenom} 👋</div>
        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Espace personnel · Congés & Planning</div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a' }}>
        <button onClick={() => setOnglet('accueil')} style={tabStyle('accueil')}>📋 Mes congés</button>
        <button onClick={() => setOnglet('demander')} style={tabStyle('demander')}>+ Demander</button>
        {hasSamediOffert && <button onClick={() => setOnglet('samedis')} style={tabStyle('samedis')}>☀ Samedis & Événements</button>}
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 700, margin: '0 auto' }}>
        {success && <div style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#6ec96e' }}>✓ {success}</div>}

        {/* ── ACCUEIL ── */}
        {onglet === 'accueil' && (
          <>
            {/* Solde */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {[{ label: 'Acquis', v: acquis, c: '#6e9ec9' }, { label: 'Pris', v: pris, c: '#c9b06e' }, { label: 'Restants', v: restants, c: restants <= 5 ? '#c96e6e' : '#6ec96e' }].map(({ label, v, c }) => (
                <div key={label} style={{ ...card, textAlign: 'center' as const, padding: '16px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 2, marginBottom: 8 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 32, color: c, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>jours</div>
                </div>
              ))}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ height: '100%', width: `${Math.round((pris / acquis) * 100)}%`, background: '#c9a96e', borderRadius: 2, transition: 'width 0.5s' }} />
            </div>

            {/* Calendrier personnel */}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#c9a96e', letterSpacing: 1 }}>MON CALENDRIER</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#e8e0d5', borderRadius: 4, padding: '4px 10px', fontSize: 14, cursor: 'pointer' }}>‹</button>
                  <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#e8e0d5', borderRadius: 4, padding: '4px 10px', fontSize: 14, cursor: 'pointer' }}>›</button>
                </div>
              </div>
              <CalendrierMois year={calYear} month={calMonth} demandes={demandes} samedisOfferts={samedisOfferts} isAdmin={false} />
            </div>

            {/* Demandes */}
            <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', marginBottom: 12 }}>MES DEMANDES</div>
            {demandes.length === 0 ? (
              <div style={{ ...card, textAlign: 'center' as const, padding: 32, color: 'rgba(232,224,213,0.4)' }}>
                Aucune demande — <button onClick={() => setOnglet('demander')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>faire une demande</button>
              </div>
            ) : demandes.map(d => (
              <div key={d.id} style={{ ...card, marginBottom: 8, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ background: `${TYPE_COLOR[d.type]}22`, color: TYPE_COLOR[d.type], fontSize: 11, padding: '2px 8px', borderRadius: 3 }}>{TYPE_LABEL[d.type]}</span>
                      <span style={{ background: `${STATUT_COLOR[d.statut]}22`, color: STATUT_COLOR[d.statut], fontSize: 11, padding: '2px 8px', borderRadius: 3 }}>{STATUT_LABEL[d.statut]}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                      {formatDate(d.date_debut)} → {formatDate(d.date_fin)}
                    </div>
                    {d.motif_refus && <div style={{ fontSize: 12, color: '#c96e6e', marginTop: 4 }}>Motif : {d.motif_refus}</div>}
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{d.nb_jours}j</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── DEMANDER ── */}
        {onglet === 'demander' && (
          <div style={card}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 300, color: '#f0e8d8', marginBottom: 20 }}>Nouvelle demande de congé</div>
            {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
              <div>
                <label style={lbl}>Type de congé</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  {[['cp', 'Congé payé'], ['sans_solde', 'Sans solde'], ['exceptionnel', 'Exceptionnel'], ['maladie', 'Arrêt maladie']].map(([v, l]) => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, type: v }))} style={{ background: form.type === v ? `${TYPE_COLOR[v]}22` : 'rgba(255,255,255,0.04)', border: `0.5px solid ${form.type === v ? TYPE_COLOR[v] : 'rgba(255,255,255,0.1)'}`, color: form.type === v ? TYPE_COLOR[v] : 'rgba(232,224,213,0.5)', borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Date de début</label>
                  <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} style={inpSmall} />
                </div>
                <div>
                  <label style={lbl}>Date de fin</label>
                  <input type="date" value={form.date_fin} min={form.date_debut} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} style={inpSmall} />
                </div>
              </div>

              {nbJoursCalc > 0 && (
                <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'rgba(232,224,213,0.6)' }}>Durée calculée (Mar→Sam, hors fériés)</span>
                  <span style={{ fontSize: 20, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 600 }}>{nbJoursCalc} jour{nbJoursCalc > 1 ? 's' : ''}</span>
                </div>
              )}

              {form.type === 'cp' && nbJoursCalc > restants && (
                <div style={{ background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#c96e6e' }}>
                  ⚠ Solde insuffisant — il vous reste {restants} jours, vous en demandez {nbJoursCalc}.
                </div>
              )}

              <div>
                <label style={lbl}>Motif (optionnel)</label>
                <input value={form.motif_demande} onChange={e => setForm(f => ({ ...f, motif_demande: e.target.value }))} placeholder="Vacances, événement familial..." style={inpSmall} />
              </div>

              <button onClick={handleDemander} disabled={saving || nbJoursCalc === 0}
                style={{ background: nbJoursCalc > 0 ? '#c9a96e' : '#2a2a1e', color: nbJoursCalc > 0 ? '#0d0a08' : '#555', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? '⟳ Envoi...' : '✓ Envoyer la demande'}
              </button>
            </div>
          </div>
        )}

        {/* ── SAMEDIS & ÉVÉNEMENTS (Corentin uniquement) ── */}
        {onglet === 'samedis' && hasSamediOffert && (
          <>
            {/* Compteur heures événements mois en cours */}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', marginBottom: 16 }}>HEURES ÉVÉNEMENTS — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                {[{ label: 'Dues', v: hDues, c: '#c9b06e' }, { label: 'Utilisées', v: hUtilisees, c: '#c9a96e' }, { label: 'Restantes', v: hRestantes, c: hRestantes <= 0 ? '#6ec96e' : '#c96e6e' }].map(({ label, v, c }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '12px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginBottom: 6 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 28, color: c, fontFamily: 'Georgia, serif' }}>{v}h</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (hUtilisees / hDues) * 100)}%`, background: hRestantes <= 0 ? '#6ec96e' : '#c9a96e', borderRadius: 2, transition: 'width 0.5s' }} />
              </div>
              {hRestantes <= 0 && <div style={{ fontSize: 12, color: '#6ec96e', marginTop: 8 }}>✓ Heures dues complètes ce mois-ci</div>}
            </div>

            {/* Samedis offerts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,224,213,0.4)' }}>MES SAMEDIS OFFERTS</div>
              <button onClick={() => setShowNouveauSamedi(true)}
                style={{ background: 'rgba(201,176,110,0.1)', border: '0.5px solid rgba(201,176,110,0.3)', color: '#c9b06e', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                + Noter un samedi
              </button>
            </div>

            {showNouveauSamedi && (
              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#f0e8d8', marginBottom: 14 }}>Planifier un samedi offert</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Date du samedi</label>
                    <input type="date" value={nouveauSamedi.date} onChange={e => setNouveauSamedi(s => ({ ...s, date: e.target.value }))} style={inpSmall} />
                  </div>
                  <div>
                    <label style={lbl}>Note (optionnel)</label>
                    <input value={nouveauSamedi.note} onChange={e => setNouveauSamedi(s => ({ ...s, note: e.target.value }))} placeholder="Ex: Week-end en famille" style={inpSmall} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowNouveauSamedi(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '9px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
                  <button onClick={handleSamedi} disabled={!nouveauSamedi.date || saving} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '9px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>✓ Enregistrer</button>
                </div>
              </div>
            )}

            {samedisOfferts.length === 0 ? (
              <div style={{ ...card, textAlign: 'center' as const, padding: 28, color: 'rgba(232,224,213,0.4)' }}>Aucun samedi planifié.</div>
            ) : samedisOfferts.map(s => (
              <div key={s.id} style={{ ...card, marginBottom: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, color: '#f0e8d8' }}>{formatDate(s.date_samedi)}</div>
                  {s.note && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>{s.note}</div>}
                </div>
                <span style={{ background: `${STATUT_COLOR[s.statut] || '#888'}22`, color: STATUT_COLOR[s.statut] || '#888', fontSize: 10, padding: '2px 8px', borderRadius: 3 }}>{STATUT_LABEL[s.statut] || s.statut}</span>
              </div>
            ))}

            {/* Historique événements */}
            {evenements.length > 0 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', margin: '20px 0 12px' }}>HISTORIQUE ÉVÉNEMENTS</div>
                {evenements.map(e => (
                  <div key={e.id} style={{ ...card, marginBottom: 8, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#f0e8d8' }}>{formatDate(e.date_evenement)}</div>
                      {e.description && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{e.description}</div>}
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{e.heures}h</div>
                      <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>{e.mois_reference}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function CongesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { setLoading(false); return }
      const { data: profile } = await supabase
        .from('users').select('*').eq('auth_user_id', authUser.id).maybeSingle()
      if (profile) setUser(profile)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>⟳ Chargement...</div>
  if (!user) return <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.4)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>Profil introuvable. <a href="/login" style={{ color: '#c9a96e', marginLeft: 10 }}>Se reconnecter</a></div>

  const isAdmin = user.role === 'admin'
  if (isAdmin) return <VueAdmin admin={user} />
  return <VueEmploye user={user} />
}