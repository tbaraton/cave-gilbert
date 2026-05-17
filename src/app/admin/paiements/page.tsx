'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabaseDb as supabase } from '@/lib/supabase-db'
import { genererFactureCaisseHtml } from '@/lib/pdf-templates'
import { envoyerDocument, buildPdfFilename } from '@/lib/email-sender'
import { getSiteInfo } from '@/lib/site-info'

type Onglet = 'fournisseurs' | 'clients'

const DELAI_CLIENT_DEFAUT_JOURS = 30

const todayIso = () => new Date().toISOString().slice(0, 10)
const addDays = (iso: string, days: number) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const joursRestants = (echeance: string | null) => {
  if (!echeance) return null
  const ms = new Date(echeance).getTime() - new Date(todayIso()).getTime()
  return Math.floor(ms / 86400000)
}
const fmt = (n: number) => n.toFixed(2)
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '—'
const fmtMontant = (n: number) => `${fmt(n)} €`

// Badge d'urgence selon les jours restants avant échéance (ou de retard si négatif).
function badgeUrgence(joursRestants: number | null) {
  if (joursRestants === null) return { label: '—', bg: 'rgba(232,224,213,0.05)', color: 'rgba(232,224,213,0.4)' }
  if (joursRestants < 0) return { label: `${Math.abs(joursRestants)} j de retard`, bg: 'rgba(201,110,110,0.18)', color: '#e88a8a' }
  if (joursRestants === 0) return { label: 'Échéance aujourd\'hui', bg: 'rgba(201,169,110,0.18)', color: '#e8c98a' }
  if (joursRestants <= 7) return { label: `J-${joursRestants}`, bg: 'rgba(201,169,110,0.12)', color: '#c9a96e' }
  return { label: `${joursRestants} j`, bg: 'rgba(232,224,213,0.05)', color: 'rgba(232,224,213,0.5)' }
}

export default function PaiementsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [onglet, setOnglet] = useState<Onglet>('fournisseurs')

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setAuthReady(true); return }
        const { data: profile } = await supabase.from('users').select('*').eq('auth_user_id', authUser.id).maybeSingle()
        if (!profile) { setAuthReady(true); return }
        setCurrentUser(profile)
        if (profile.role === 'admin') { setHasAccess(true); setAuthReady(true); return }
        const { data: perms } = await supabase.from('user_permissions').select('acces_comptabilite').eq('user_id', profile.id).maybeSingle()
        setHasAccess(perms?.acces_comptabilite === true)
      } finally {
        setAuthReady(true)
      }
    })()
  }, [])

  if (!authReady) return <div style={loadingScreen}>⟳ Chargement…</div>
  if (!currentUser) return <div style={loadingScreen}>Non connecté — <a href="/login" style={{ color: '#c9a96e', marginLeft: 8 }}>Se connecter</a></div>
  if (!hasAccess) return <div style={loadingScreen}>Accès refusé — permission « Comptabilité » requise<br/><a href="/admin" style={{ color: '#c9a96e', marginTop: 16 }}>← Retour</a></div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <Sidebar currentUser={currentUser} />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', maxWidth: 'calc(100vw - 220px)' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 6 }}>Suivi des paiements</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {[
            { id: 'fournisseurs' as Onglet, label: 'Fournisseurs à payer' },
            { id: 'clients' as Onglet, label: 'Clients impayés' },
          ].map(t => (
            <button key={t.id} onClick={() => setOnglet(t.id)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '12px 22px', fontSize: 13, letterSpacing: 1,
              color: onglet === t.id ? '#c9a96e' : 'rgba(232,224,213,0.5)',
              borderBottom: onglet === t.id ? '2px solid #c9a96e' : '2px solid transparent',
              fontWeight: onglet === t.id ? 600 : 400,
            }}>{t.label}</button>
          ))}
        </div>

        {onglet === 'fournisseurs' && <OngletFournisseurs currentUser={currentUser} />}
        {onglet === 'clients' && <OngletClients currentUser={currentUser} />}
      </main>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// FOURNISSEURS À PAYER
// ───────────────────────────────────────────────────────────────
function OngletFournisseurs({ currentUser }: { currentUser: any }) {
  const [factures, setFactures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'tous' | 'retard' | 'semaine'>('tous')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('factures_achat')
      .select('*, fournisseur:fournisseurs(id, nom, email, telephone), entreprise:entreprises(id, code, raison_sociale)')
      .in('statut', ['validee', 'a_valider'])
      .order('date_echeance', { ascending: true, nullsFirst: false })
      .limit(500)
    setFactures(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtrees = useMemo(() => factures.filter(f => {
    const jr = joursRestants(f.date_echeance)
    if (filtre === 'retard') return jr !== null && jr < 0
    if (filtre === 'semaine') return jr !== null && jr >= 0 && jr <= 7
    return true
  }), [factures, filtre])

  const totaux = useMemo(() => {
    const retard = factures.filter(f => { const jr = joursRestants(f.date_echeance); return jr !== null && jr < 0 })
    const semaine = factures.filter(f => { const jr = joursRestants(f.date_echeance); return jr !== null && jr >= 0 && jr <= 7 })
    return {
      total: factures.reduce((s, f) => s + parseFloat(f.total_ttc || 0), 0),
      nbRetard: retard.length, montantRetard: retard.reduce((s, f) => s + parseFloat(f.total_ttc || 0), 0),
      nbSemaine: semaine.length, montantSemaine: semaine.reduce((s, f) => s + parseFloat(f.total_ttc || 0), 0),
    }
  }, [factures])

  const handleMarquerPayee = async (f: any, mode: string) => {
    const { error } = await supabase.from('factures_achat')
      .update({ statut: 'payee', date_paiement: todayIso(), mode_paiement: mode, validated_by: currentUser?.id })
      .eq('id', f.id)
    if (error) { alert(`Erreur : ${error.message}`); return }
    load()
  }

  return (
    <div>
      {/* Compteurs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Total dû" value={fmtMontant(totaux.total)} sub={`${factures.length} facture${factures.length > 1 ? 's' : ''}`} color="#c9a96e" />
        <KpiCard label="En retard" value={fmtMontant(totaux.montantRetard)} sub={`${totaux.nbRetard} facture${totaux.nbRetard > 1 ? 's' : ''}`} color="#e88a8a" highlight={totaux.nbRetard > 0} />
        <KpiCard label="Dans la semaine" value={fmtMontant(totaux.montantSemaine)} sub={`${totaux.nbSemaine} facture${totaux.nbSemaine > 1 ? 's' : ''}`} color="#e8c98a" />
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'tous' as const, label: 'Toutes' },
          { id: 'retard' as const, label: '🔴 En retard' },
          { id: 'semaine' as const, label: '🟠 Sous 7 jours' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltre(f.id)} style={pill(filtre === f.id)}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={empty}>⟳ Chargement…</div>
      ) : filtrees.length === 0 ? (
        <div style={empty}>Aucune facture à payer pour ce filtre</div>
      ) : (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Échéance', 'Urgence', 'Entreprise', 'Fournisseur', 'N° interne', 'TTC', 'Statut', 'Action'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrees.map((f, i) => {
                const jr = joursRestants(f.date_echeance)
                const b = badgeUrgence(jr)
                return (
                  <tr key={f.id} style={{ borderBottom: i < filtrees.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={td}>{fmtDate(f.date_echeance)}</td>
                    <td style={td}><span style={{ fontSize: 10, background: b.bg, color: b.color, padding: '3px 8px', borderRadius: 3, letterSpacing: 0.5, whiteSpace: 'nowrap' as const }}>{b.label}</span></td>
                    <td style={td}><span style={{ fontSize: 10, background: f.entreprise?.code === 'CDG' ? 'rgba(201,169,110,0.12)' : 'rgba(110,158,201,0.12)', color: f.entreprise?.code === 'CDG' ? '#c9a96e' : '#6e9ec9', padding: '2px 8px', borderRadius: 3 }}>{f.entreprise?.code || '—'}</span></td>
                    <td style={td}>{f.fournisseur?.nom || <em style={{ color: 'rgba(232,224,213,0.3)' }}>—</em>}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: 'rgba(232,224,213,0.6)' }}>{f.numero_interne}</td>
                    <td style={{ ...td, textAlign: 'right' as const, fontFamily: 'Georgia, serif' }}>{fmtMontant(parseFloat(f.total_ttc || 0))}</td>
                    <td style={td}><span style={{ fontSize: 10, background: f.statut === 'validee' ? 'rgba(110,201,176,0.12)' : 'rgba(232,224,213,0.05)', color: f.statut === 'validee' ? '#6ec9b0' : 'rgba(232,224,213,0.5)', padding: '3px 8px', borderRadius: 3 }}>{f.statut === 'validee' ? 'À payer' : 'À valider'}</span></td>
                    <td style={td}>
                      <PayerMenu onPay={(mode) => handleMarquerPayee(f, mode)} />
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

// ───────────────────────────────────────────────────────────────
// CLIENTS IMPAYÉS
// ───────────────────────────────────────────────────────────────
function OngletClients({ currentUser }: { currentUser: any }) {
  const [ventes, setVentes] = useState<any[]>([])
  const [sitesMap, setSitesMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'tous' | 'retard' | 'semaine'>('tous')
  const [sending, setSending] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: s }] = await Promise.all([
      supabase.from('ventes')
        .select('id, numero, type_doc, created_at, total_ttc, total_ht, customer_id, site_id, statut_paiement, notes, customer:customers(id, prenom, nom, raison_sociale, est_societe, email, telephone, adresse, code_postal, ville)')
        .eq('statut', 'validee')
        .eq('statut_paiement', 'non_regle')
        .neq('type_doc', 'devis')
        .order('created_at', { ascending: true })
        .limit(500),
      supabase.from('sites').select('id, nom').eq('actif', true),
    ])
    setVentes(v || [])
    setSitesMap(new Map((s || []).map((x: any) => [x.id, x])))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const enriched = useMemo(() => ventes.map(v => {
    const dateVente = (v.created_at || '').slice(0, 10)
    const echeance = dateVente ? addDays(dateVente, DELAI_CLIENT_DEFAUT_JOURS) : null
    const jr = joursRestants(echeance)
    return { ...v, _echeance: echeance, _jr: jr }
  }), [ventes])

  const filtrees = useMemo(() => enriched.filter(v => {
    if (filtre === 'retard') return v._jr !== null && v._jr < 0
    if (filtre === 'semaine') return v._jr !== null && v._jr >= 0 && v._jr <= 7
    return true
  }), [enriched, filtre])

  const totaux = useMemo(() => {
    const retard = enriched.filter(v => v._jr !== null && v._jr < 0)
    const semaine = enriched.filter(v => v._jr !== null && v._jr >= 0 && v._jr <= 7)
    return {
      total: enriched.reduce((s, v) => s + parseFloat(v.total_ttc || 0), 0),
      nbRetard: retard.length, montantRetard: retard.reduce((s, v) => s + parseFloat(v.total_ttc || 0), 0),
      nbSemaine: semaine.length, montantSemaine: semaine.reduce((s, v) => s + parseFloat(v.total_ttc || 0), 0),
    }
  }, [enriched])

  const handleMarquerReglee = async (v: any, mode: string) => {
    const total = parseFloat(v.total_ttc || 0)
    const { error: errP } = await supabase.from('vente_paiements').insert({
      vente_id: v.id, mode, montant: total,
    })
    if (errP) { alert(`Erreur paiement : ${errP.message}`); return }
    const { error: errV } = await supabase.from('ventes').update({ statut_paiement: 'regle' }).eq('id', v.id)
    if (errV) { alert(`Erreur statut : ${errV.message}`); return }
    load()
  }

  const clientNom = (c: any) => !c ? 'Client anonyme' : c.est_societe ? c.raison_sociale : `${c.prenom || ''} ${c.nom || ''}`.trim()

  // Construit le HTML de la facture à partir des données complètes
  const buildPdfHtml = async (v: any) => {
    const [{ data: lignes }, { data: paiements }] = await Promise.all([
      supabase.from('vente_lignes').select('*').eq('vente_id', v.id),
      supabase.from('vente_paiements').select('*').eq('vente_id', v.id),
    ])
    const siteName = sitesMap.get(v.site_id)?.nom || ''
    const siteInfo = getSiteInfo(siteName)
    const detail = {
      numero: v.numero,
      type_doc: v.type_doc,
      created_at: v.created_at,
      total_ttc: v.total_ttc,
      notes: v.notes,
      customer: v.customer,
      user: null,
    }
    const lignesPdf = (lignes || []).map((l: any) => ({
      quantite: l.quantite,
      nom_produit: l.nom_produit,
      millesime: l.millesime,
      prix_unitaire_ttc: l.prix_unitaire_ttc,
      total_ttc: l.total_ttc,
      remise_pct: l.remise_pct,
    }))
    const paiementsPdf = (paiements || []).map((p: any) => ({ mode: p.mode, montant: p.montant }))
    return { html: genererFactureCaisseHtml(detail, lignesPdf, paiementsPdf, siteInfo), siteName }
  }

  const handleConsulter = async (v: any) => {
    try {
      const { html } = await buildPdfHtml(v)
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    } catch (e: any) {
      alert(`Erreur : ${e.message}`)
    }
  }

  const handleRelancer = async (v: any) => {
    const email = (v.customer?.email || '').trim()
    if (!email) { alert('Pas d\'email enregistré pour ce client'); return }
    if (!confirm(`Envoyer une relance à ${email} pour la facture ${v.numero} (${parseFloat(v.total_ttc).toFixed(2)} €) ?`)) return
    setSending(v.id)
    try {
      const { html, siteName } = await buildPdfHtml(v)
      const dateVente = new Date(v.created_at).toLocaleDateString('fr-FR')
      const echeance = v._echeance ? new Date(v._echeance).toLocaleDateString('fr-FR') : '—'
      const cNom = clientNom(v.customer)
      const montant = parseFloat(v.total_ttc).toFixed(2)
      const entiteNom = getSiteInfo(siteName).nom
      const emailBody = `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6;padding:20px">
<p>Bonjour ${cNom},</p>
<p>Sauf erreur de notre part, nous n'avons pas reçu le règlement de la facture <strong>${v.numero}</strong> d'un montant de <strong>${montant} €</strong>, émise le ${dateVente}, dont l'échéance était fixée au <strong>${echeance}</strong>.</p>
<p>Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais. Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.</p>
<p>Vous trouverez ci-joint un nouvel exemplaire de la facture.</p>
<p style="color:#666;font-size:13px;margin-top:24px">Cordialement,<br>L'équipe ${entiteNom}</p>
</div>`
      await envoyerDocument({
        to: email,
        subject: `Rappel — Facture ${v.numero} en attente de règlement`,
        pdfHtml: html,
        pdfFilename: buildPdfFilename(v.type_doc, v.numero),
        emailBody,
        siteNom: siteName,
      })
      alert(`Relance envoyée à ${email}`)
    } catch (e: any) {
      alert(`Erreur d'envoi : ${e.message}`)
    } finally {
      setSending(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Total impayés" value={fmtMontant(totaux.total)} sub={`${enriched.length} facture${enriched.length > 1 ? 's' : ''}`} color="#c9a96e" />
        <KpiCard label="En retard" value={fmtMontant(totaux.montantRetard)} sub={`${totaux.nbRetard} facture${totaux.nbRetard > 1 ? 's' : ''}`} color="#e88a8a" highlight={totaux.nbRetard > 0} />
        <KpiCard label="Dans la semaine" value={fmtMontant(totaux.montantSemaine)} sub={`${totaux.nbSemaine} facture${totaux.nbSemaine > 1 ? 's' : ''}`} color="#e8c98a" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {[
          { id: 'tous' as const, label: 'Toutes' },
          { id: 'retard' as const, label: '🔴 En retard' },
          { id: 'semaine' as const, label: '🟠 Sous 7 jours' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltre(f.id)} style={pill(filtre === f.id)}>{f.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 16, fontStyle: 'italic' as const }}>
        Échéance calculée par défaut à {DELAI_CLIENT_DEFAUT_JOURS} jours après la date de vente.
      </div>

      {loading ? (
        <div style={empty}>⟳ Chargement…</div>
      ) : filtrees.length === 0 ? (
        <div style={empty}>Aucune facture impayée pour ce filtre 🎉</div>
      ) : (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Échéance', 'Urgence', 'Client', 'N° doc', 'Type', 'TTC', 'Email', 'Action'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrees.map((v, i) => {
                const b = badgeUrgence(v._jr)
                return (
                  <tr key={v.id} style={{ borderBottom: i < filtrees.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={td}>{fmtDate(v._echeance)}</td>
                    <td style={td}><span style={{ fontSize: 10, background: b.bg, color: b.color, padding: '3px 8px', borderRadius: 3, letterSpacing: 0.5, whiteSpace: 'nowrap' as const }}>{b.label}</span></td>
                    <td style={td}>{clientNom(v.customer)}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: 'rgba(232,224,213,0.6)' }}>{v.numero}</td>
                    <td style={{ ...td, fontSize: 11, color: 'rgba(232,224,213,0.6)' }}>{v.type_doc}</td>
                    <td style={{ ...td, textAlign: 'right' as const, fontFamily: 'Georgia, serif' }}>{fmtMontant(parseFloat(v.total_ttc || 0))}</td>
                    <td style={{ ...td, fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>{v.customer?.email || '—'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleConsulter(v)} title="Voir la facture" style={btnIcon}>📄</button>
                        <button onClick={() => handleRelancer(v)} disabled={!v.customer?.email || sending === v.id} title={v.customer?.email ? `Relancer ${v.customer.email}` : 'Pas d\'email'} style={{ ...btnIcon, opacity: (!v.customer?.email || sending === v.id) ? 0.4 : 1, cursor: (!v.customer?.email || sending === v.id) ? 'not-allowed' : 'pointer' }}>{sending === v.id ? '⟳' : '✉'}</button>
                        <PayerMenu onPay={(mode) => handleMarquerReglee(v, mode)} />
                      </div>
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

// ───────────────────────────────────────────────────────────────
// Composants partagés
// ───────────────────────────────────────────────────────────────
function PayerMenu({ onPay }: { onPay: (mode: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' as const }}>
      <button onClick={() => setOpen(!open)} style={btnPay}>✓ Régler</button>
      {open && (
        <div style={{ position: 'absolute' as const, top: '100%', right: 0, marginTop: 4, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, padding: 6, zIndex: 50, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {[
            { id: 'virement', label: '🏦 Virement' },
            { id: 'cheque', label: '💳 Chèque' },
            { id: 'cb', label: '💳 Carte' },
            { id: 'especes', label: '💶 Espèces' },
            { id: 'prelevement', label: '⇋ Prélèvement' },
          ].map(m => (
            <button key={m.id} onClick={() => { setOpen(false); onPay(m.id) }} style={{ display: 'block', width: '100%', textAlign: 'left' as const, background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 12, padding: '8px 10px', borderRadius: 4, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, color, highlight }: { label: string; value: string; sub: string; color: string; highlight?: boolean }) {
  return (
    <div style={{ background: '#18130e', border: `0.5px solid ${highlight ? color : 'rgba(255,255,255,0.07)'}`, borderRadius: 6, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: 'Georgia, serif', color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>{sub}</div>
    </div>
  )
}

function Sidebar({ currentUser }: { currentUser: any }) {
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
        <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(232,224,213,0.25)', padding: '4px 20px 8px', textTransform: 'uppercase' as const }}>Finances</div>
        <a href="/admin/comptabilite" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.5)', textDecoration: 'none', borderLeft: '2px solid transparent' }}>
          <span>€</span>Comptabilité
        </a>
        <a href="/admin/paiements" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: '#c9a96e', textDecoration: 'none', borderLeft: '2px solid #c9a96e', background: 'rgba(201,169,110,0.08)' }}>
          <span>💳</span>Suivi paiements
        </a>
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, color: '#e8e0d5', fontWeight: 600 }}>{currentUser?.prenom}</div>
        <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', textTransform: 'capitalize' as const }}>{currentUser?.role}</div>
      </div>
    </aside>
  )
}

// ───────────────────────────────────────────────────────────────
// Styles partagés
// ───────────────────────────────────────────────────────────────
const loadingScreen: any = { minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.6)', flexDirection: 'column', gap: 12 }
const card: any = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }
const empty: any = { padding: 60, textAlign: 'center', color: 'rgba(232,224,213,0.4)', fontSize: 13, background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6 }
const th: any = { padding: '10px 12px', textAlign: 'left', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400, textTransform: 'uppercase' }
const td: any = { padding: '12px 12px', fontSize: 12, color: '#e8e0d5' }
const btnPay: any = { background: 'rgba(110,201,176,0.12)', border: '0.5px solid rgba(110,201,176,0.3)', color: '#6ec9b0', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }
const btnIcon: any = { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#e8e0d5', borderRadius: 4, padding: '6px 9px', fontSize: 13, cursor: 'pointer', lineHeight: 1 }
const pill = (active: boolean): any => ({
  background: active ? 'rgba(201,169,110,0.18)' : 'rgba(255,255,255,0.04)',
  border: `0.5px solid ${active ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
  color: active ? '#c9a96e' : 'rgba(232,224,213,0.5)',
  borderRadius: 4, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
})
