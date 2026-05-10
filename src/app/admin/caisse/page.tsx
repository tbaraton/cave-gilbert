'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────
type User = { id: string; nom: string; prenom: string; email: string; pin: string; role: string }
type Session = { id: string; user_id: string; site_id: string; statut: string; especes_ouverture: number }
type Client = { id: string; prenom: string; nom: string; raison_sociale: string; est_societe: boolean; tarif_pro: boolean; remise_pct: number; email: string; telephone: string }
type Ligne = { id: string; product_id: string; nom: string; nom_modifie?: string; millesime: number; qte: number; prix_unit: number; remise_pct: number; total: number; commentaire?: string }
type Paiement = { mode: string; montant: number; label: string }
type VenteEnAttente = { id: string; client: Client | null; lignes: Ligne[]; typeDoc: string; remise: string; remiseType: 'pct' | 'eur'; label: string }

const COULEURS: Record<string, string> = { rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0', champagne: '#d4c88a', effervescent: '#a0b0e0', autre: '#888' }
const fmt = (n: number) => n.toFixed(2) + '€'

// ── Login ─────────────────────────────────────────────────────
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
    <div style={{ minHeight: '100dvh', background: '#0d0a08', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const }}>Cave de Gilbert</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>Caisse</div>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 8, padding: '12px', marginBottom: 16, fontSize: 14, color: '#c96e6e', textAlign: 'center' as const }}>{error}</div>}

        <input type="text" placeholder="Votre prénom" value={prenom} onChange={e => setPrenom(e.target.value)} autoCapitalize="words"
          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#f0e8d8', fontSize: 18, padding: '16px', boxSizing: 'border-box' as const, marginBottom: 24, textAlign: 'center' as const, outline: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < pin.length ? '#c9a96e' : 'rgba(255,255,255,0.12)', transition: 'background 0.15s' }} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {['1','2','3','4','5','6','7','8','9','←','0','✓'].map(k => (
            <button key={k} onClick={() => k === '✓' ? doLogin() : handleKey(k)} style={{
              background: k === '✓' ? '#c9a96e' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${k === '✓' ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`,
              color: k === '✓' ? '#0d0a08' : '#e8e0d5',
              borderRadius: 12, padding: '20px 0', fontSize: 22, cursor: 'pointer', fontWeight: k === '✓' ? 700 : 400,
              touchAction: 'manipulation',
            }}>{k}</button>
          ))}
        </div>
        {loading && <div style={{ textAlign: 'center' as const, marginTop: 20, color: 'rgba(232,224,213,0.4)' }}>⟳ Connexion...</div>}
      </div>
    </div>
  )
}

// ── Ouverture Caisse ──────────────────────────────────────────
function EcranOuverture({ user, onOuvrir }: { user: User; onOuvrir: (s: Session) => void }) {
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')
  const [especes, setEspeces] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Charger les sites d'abord
      const { data: sitesData } = await supabase.from('sites').select('*').eq('actif', true).order('nom')
      setSites(sitesData || [])
      if (sitesData?.length) setSiteId(sitesData[0].id)

      // Ensuite vérifier session existante
      const { data: session } = await supabase.from('caisse_sessions').select('*').eq('user_id', user.id).eq('statut', 'ouverte').maybeSingle()
      if (session) onOuvrir(session)
    }
    load()
  }, [])

  const handleOuvrir = async () => {
    if (!siteId) return
    setLoading(true)
    const { data } = await supabase.from('caisse_sessions').insert({
      user_id: user.id, site_id: siteId,
      especes_ouverture: parseFloat(especes) || 0,
      fond_caisse_ouverture: parseFloat(especes) || 0,
      statut: 'ouverte',
    }).select('*').single()
    if (data) onOuvrir(data)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0d0a08', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: '32px 28px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 4 }}>Ouverture de caisse</div>
        <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.4)', marginBottom: 28 }}>Bonjour {user.prenom} !</div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 8 }}>SITE</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ width: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#e8e0d5', fontSize: 16, padding: '14px', cursor: 'pointer' }}>
            {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 8 }}>ESPÈCES EN CAISSE</label>
          <input type="number" step="0.01" placeholder="0.00" value={especes} onChange={e => setEspeces(e.target.value)} inputMode="decimal"
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 8, color: '#f0e8d8', fontSize: 22, padding: '14px', boxSizing: 'border-box' as const, textAlign: 'center' as const }} />
        </div>

        <button onClick={handleOuvrir} disabled={loading} style={{ width: '100%', background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12, padding: '18px', fontSize: 16, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, touchAction: 'manipulation' }}>
          {loading ? '⟳' : '✓ Ouvrir la caisse'}
        </button>
      </div>
    </div>
  )
}


// ── Modal Nouveau/Edit Client (Caisse) ───────────────────────
function ModalClientForm({ client, onClose, onSaved }: { client?: any; onClose: () => void; onSaved: (c: any) => void }) {
  const isNew = !client?.id
  const [form, setForm] = useState({
    prenom: client?.prenom || '',
    nom: client?.nom || '',
    email: client?.email || '',
    telephone: client?.telephone || '',
    adresse: client?.adresse || '',
    code_postal: client?.code_postal || '',
    ville: client?.ville || '',
    pays: client?.pays || 'France',
    est_societe: client?.est_societe || false,
    raison_sociale: client?.raison_sociale || '',
    siret: client?.siret || '',
    tarif_pro: client?.tarif_pro || false,
    remise_pct: client?.remise_pct ? String(client.remise_pct) : '',
    remise_raison: client?.remise_raison || '',
    notes: client?.notes || '',
    newsletter: client?.newsletter || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [villesSugg, setVillesSugg] = useState<string[]>([])
  const [showDemande, setShowDemande] = useState(false)
  const [demande, setDemande] = useState({ titre: '', description: '', date_limite: '' })

  const lookupCP = async (cp: string) => {
    if (cp.length !== 5) { setVillesSugg([]); return }
    try {
      const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom&format=json`)
      const data = await res.json()
      const villes = data.map((c: any) => c.nom).sort()
      setVillesSugg(villes)
      if (villes.length === 1) setForm(f => ({ ...f, ville: villes[0] }))
    } catch { setVillesSugg([]) }
  }

  const handleSave = async () => {
    if (!form.est_societe && !form.nom.trim()) { setError('Le nom est obligatoire'); return }
    if (!form.est_societe && !form.prenom.trim()) { setError('Le prénom est obligatoire'); return }
    if (form.est_societe && !form.raison_sociale.trim()) { setError('La raison sociale est obligatoire'); return }
    if (!form.email.trim()) { setError("L'email est obligatoire"); return }
    if (!form.code_postal.trim()) { setError('Le code postal est obligatoire'); return }
    if (!form.ville.trim()) { setError('La ville est obligatoire'); return }
    setSaving(true); setError('')
    const payload = {
      prenom: form.prenom, nom: form.nom, email: form.email || null,
      telephone: form.telephone || null, adresse: form.adresse || null,
      code_postal: form.code_postal || null, ville: form.ville || null,
      pays: form.pays || 'France', est_societe: form.est_societe,
      raison_sociale: form.est_societe ? form.raison_sociale : null,
      siret: form.est_societe ? form.siret : null,
      tarif_pro: form.tarif_pro,
      remise_pct: form.remise_pct ? parseFloat(form.remise_pct) : 0,
      remise_raison: form.remise_raison || null,
      notes: form.notes || null, newsletter: form.newsletter,
    }
    const SELECT_FIELDS = 'id, prenom, nom, raison_sociale, est_societe, tarif_pro, remise_pct, remise_raison, email, telephone, adresse, code_postal, ville, pays, siret, notes, newsletter'
    let data: any = null, err: any = null
    if (isNew) {
      const res = await supabase.from('customers').insert(payload).select(SELECT_FIELDS).single()
      data = res.data; err = res.error
    } else {
      const res = await supabase.from('customers').update(payload).eq('id', client.id).select(SELECT_FIELDS).single()
      data = res.data; err = res.error
    }
    if (err) {
      if (err.code === '23505' || err.message?.includes('email')) {
        setError("Un client avec cet email existe déjà. Recherchez-le dans la liste pour le modifier.")
      } else {
        setError(err.message)
      }
      setSaving(false)
      return
    }
    if (!data) { setError('Erreur lors de la sauvegarde'); setSaving(false); return }
    onSaved(data)
  }

  const handleSaveDemande = async () => {
    const clientId = client?.id
    if (!demande.titre.trim() || !clientId) { alert('Impossible de sauvegarder : client non identifié'); return }
    const { error } = await supabase.from('customer_requests').insert({
      customer_id: clientId, titre: demande.titre,
      description: demande.description || null,
      date_limite: demande.date_limite || null, statut: 'en_attente'
    })
    if (error) { alert('Erreur: ' + error.message); return }
    setDemande({ titre: '', description: '', date_limite: '' })
    setShowDemande(false)
    alert('Demande enregistrée ✓')
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#f0e8d8', fontSize: 15, padding: '14px', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block' as const, marginBottom: 6 }
  const section = (title: string) => <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 12, marginTop: 4 }}>{title}</div>

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: '#0d0a08', zIndex: 500, overflowY: 'auto' as const, fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, background: '#0d0a08', position: 'sticky' as const, top: 0, zIndex: 10 }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#f0e8d8' }}>{isNew ? 'Nouveau client' : 'Modifier le client'}</div>
      </div>

      <div style={{ padding: '20px 16px 120px' }}>
        {error && <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 8, padding: '12px', marginBottom: 16, fontSize: 14, color: '#c96e6e' }}>{error}</div>}

        {/* Société toggle */}
        <div onClick={() => setForm(f => ({ ...f, est_societe: !f.est_societe }))}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: form.est_societe ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `0.5px solid ${form.est_societe ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', marginBottom: 20 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, border: `2px solid ${form.est_societe ? '#c9a96e' : 'rgba(255,255,255,0.3)'}`, background: form.est_societe ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {form.est_societe && <span style={{ fontSize: 13, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: 15, color: '#f0e8d8' }}>Client Société / Professionnel</div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Cochez pour afficher les champs entreprise</div>
          </div>
        </div>

        {/* Entreprise */}
        {form.est_societe && (
          <div style={{ marginBottom: 20 }}>
            {section('Entreprise')}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Raison sociale *</label>
              <input value={form.raison_sociale} onChange={e => setForm(f => ({ ...f, raison_sociale: e.target.value }))} style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>SIRET</label>
              <input value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))} style={inp} inputMode="numeric" />
            </div>
            <div>
              <label style={lbl}>Tarif applicable</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ v: false, l: 'Particulier TTC' }, { v: true, l: 'Tarif professionnel' }].map(({ v, l }) => (
                  <button key={String(v)} onClick={() => setForm(f => ({ ...f, tarif_pro: v }))}
                    style={{ flex: 1, background: form.tarif_pro === v ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.tarif_pro === v ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, color: form.tarif_pro === v ? '#c9a96e' : 'rgba(232,224,213,0.4)', borderRadius: 8, padding: '12px', fontSize: 14, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
              {form.tarif_pro && <div style={{ fontSize: 11, color: '#c9b06e', marginTop: 6 }}>⚠ Tarif pro = pas de programme fidélité</div>}
            </div>
          </div>
        )}

        {/* Identité */}
        {section('Identité')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Prénom {!form.est_societe && '*'}</label>
            <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} style={inp} autoCapitalize="words" />
          </div>
          <div>
            <label style={lbl}>Nom {!form.est_societe && '*'}</label>
            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inp} autoCapitalize="words" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Email *</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} inputMode="email" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Téléphone</label>
          <input type="tel" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} style={inp} inputMode="tel" />
        </div>

        {/* Adresse */}
        {section('Adresse')}
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Adresse</label>
          <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} style={inp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={lbl}>Code postal *</label>
            <input value={form.code_postal} onChange={e => { setForm(f => ({ ...f, code_postal: e.target.value })); lookupCP(e.target.value) }} style={inp} inputMode="numeric" maxLength={5} />
          </div>
          <div>
            <label style={lbl}>Ville *</label>
            {villesSugg.length > 1 ? (
              <select value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} style={{ ...inp, background: '#1a1408', cursor: 'pointer' }}>
                <option value="">— Choisir —</option>
                {villesSugg.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <input value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} style={inp} />
            )}
          </div>
        </div>

        {/* Remise permanente */}
        {section('Remise permanente')}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={lbl}>Remise (%)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" step="0.5" min={0} max={100} value={form.remise_pct} onChange={e => setForm(f => ({ ...f, remise_pct: e.target.value }))} placeholder="0" style={{ ...inp }} inputMode="decimal" />
              <span style={{ color: '#c9a96e', flexShrink: 0 }}>%</span>
            </div>
          </div>
          <div>
            <label style={lbl}>Raison</label>
            <input value={form.remise_raison} onChange={e => setForm(f => ({ ...f, remise_raison: e.target.value }))} placeholder="Ex: Commerçant local..." style={inp} />
          </div>
        </div>

        {/* Notes + newsletter */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Notes internes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' as const }} placeholder="Préférences, informations utiles..." />
        </div>
        <div onClick={() => setForm(f => ({ ...f, newsletter: !f.newsletter }))} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
          <div style={{ width: 18, height: 18, borderRadius: 3, border: `0.5px solid ${form.newsletter ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: form.newsletter ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {form.newsletter && <span style={{ fontSize: 11, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 14, color: 'rgba(232,224,213,0.6)' }}>Abonné newsletter</span>
        </div>

        {/* Demande client (édition uniquement) */}
        {!isNew && (
          <div style={{ background: '#18130e', borderRadius: 12, padding: '16px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showDemande ? 16 : 0 }}>
              <div style={{ fontSize: 14, color: '#c9a96e' }}>📋 Ajouter une demande</div>
              <button onClick={() => setShowDemande(!showDemande)} style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                {showDemande ? 'Annuler' : '+ Nouvelle'}
              </button>
            </div>
            {showDemande && (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Objet / Titre *</label>
                  <input value={demande.titre} onChange={e => setDemande(d => ({ ...d, titre: e.target.value }))} style={inp} placeholder="Ex: Recherche Pommard 2019..." />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Description</label>
                  <input value={demande.description} onChange={e => setDemande(d => ({ ...d, description: e.target.value }))} style={inp} placeholder="Détails..." />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Date limite</label>
                  <input type="date" value={demande.date_limite} onChange={e => setDemande(d => ({ ...d, date_limite: e.target.value }))} style={inp} />
                </div>
                <button onClick={handleSaveDemande} disabled={!demande.titre.trim()}
                  style={{ width: '100%', background: demande.titre.trim() ? '#c9a96e' : '#2a2a1e', color: demande.titre.trim() ? '#0d0a08' : '#555', border: 'none', borderRadius: 8, padding: '14px', fontSize: 15, cursor: demande.titre.trim() ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                  ✓ Enregistrer la demande
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bouton save sticky */}
      <div style={{ position: 'fixed' as const, bottom: 0, left: 0, right: 0, padding: '16px 16px 32px', background: '#0d0a08', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12, padding: '18px', fontSize: 16, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, touchAction: 'manipulation' }}>
          {saving ? '⟳ Enregistrement...' : isNew ? '✓ Créer le client' : '✓ Enregistrer les modifications'}
        </button>
      </div>
    </div>
  )
}

// ── Caisse Principale ─────────────────────────────────────────
function CaissePrincipale({ user, session, onFermer }: { user: User; session: Session; onFermer: () => void }) {
  // Étapes: client → produits → document → paiement
  const [etape, setEtape] = useState<'client' | 'produits' | 'document' | 'paiement'>('client')

  // État vente courante
  const [client, setClient] = useState<Client | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [typeDoc, setTypeDoc] = useState('ticket')
  const [remise, setRemise] = useState('')
  const [remiseType, setRemiseType] = useState<'pct' | 'eur'>('pct')
  const [vendeur, setVendeur] = useState(user)
  const [vendeurs, setVendeurs] = useState<User[]>([])

  // Ventes en attente (max 4)
  const [attentes, setAttentes] = useState<VenteEnAttente[]>([])

  // Recherche client
  const [searchClient, setSearchClient] = useState('')
  const [clientsFound, setClientsFound] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [alertesClient, setAlertesClient] = useState<any>(null)
  const [clientEnAttente, setClientEnAttente] = useState<Client | null>(null)

  // Recherche produit
  const [searchProduit, setSearchProduit] = useState('')
  const [produits, setProduits] = useState<any[]>([])

  // Onglet produits
  const [onglet, setOnglet] = useState<'caisse' | 'gestion'>('caisse')
  const [ligneEditId, setLigneEditId] = useState<string | null>(null)
  const [ligneCommentId, setLigneCommentId] = useState<string | null>(null)

  // UI
  const [venteOk, setVenteOk] = useState(false)
  const [showFermeture, setShowFermeture] = useState(false)
  const [espacesFermeture, setEspacesFermeture] = useState('')
  const [showDevisEmail, setShowDevisEmail] = useState(false)
  const [devisEmail, setDevisEmail] = useState('')
  const searchTimer = useRef<any>(null)
  const searchProduitTimer = useRef<any>(null)

  useEffect(() => {
    supabase.from('users').select('*').eq('actif', true).then(({ data }) => setVendeurs(data || []))
  }, [])

  // Calculs totaux
  const totalBrut = lignes.reduce((acc, l) => acc + l.total, 0)
  const remiseVal = remise ? (remiseType === 'pct' ? totalBrut * parseFloat(remise) / 100 : parseFloat(remise)) : 0
  const totalNet = Math.max(0, totalBrut - remiseVal)

  // ── Recherche client ──
  const searchClients = async (q: string) => {
    if (!q.trim()) { setClientsFound([]); return }
    setLoadingClients(true)
    const { data } = await supabase.from('customers')
      .select('id, prenom, nom, raison_sociale, est_societe, tarif_pro, remise_pct, email, telephone')
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,raison_sociale.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
    setClientsFound(data || [])
    setLoadingClients(false)
  }

  const handleSearchClient = (v: string) => {
    setSearchClient(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchClients(v), 300)
  }

  const selectClient = async (c: Client | null) => {
    if (!c) { setClient(null); setEtape('produits'); return }
    // Vérifier alertes
    const [{ data: bons }, { data: demandes }, { data: factures }] = await Promise.all([
      supabase.from('loyalty_vouchers').select('*').eq('customer_id', c.id).eq('utilise', false),
      supabase.from('customer_requests').select('*').eq('customer_id', c.id).eq('statut', 'en_attente'),
      supabase.from('ventes').select('id, numero, total_ttc').eq('customer_id', c.id).eq('statut_paiement', 'non_regle').eq('statut', 'validee'),
    ])
    const a = { bons: bons || [], demandes: demandes || [], factures: factures || [] }
    if (a.bons.length || a.demandes.length || a.factures.length) {
      setClientEnAttente(c)
      setAlertesClient(a)
    } else {
      setClient(c)
      setEtape('produits')
    }
  }

  const confirmerClientAlertes = () => {
    setClient(clientEnAttente)
    setAlertesClient(null)
    setClientEnAttente(null)
    setEtape('produits')
  }

  // ── Recherche produit ──
  const searchProduits = async (q: string) => {
    if (!q.trim()) { setProduits([]); return }
    const { data } = await supabase.from('products')
      .select('id, nom, millesime, couleur, prix_vente_ttc, prix_vente_pro')
      .ilike('nom', `%${q}%`).eq('actif', true).limit(10)
    if (data?.length) {
      const ids = data.map((p: any) => p.id)
      const { data: stockData } = await supabase.from('stock').select('product_id, quantite').eq('site_id', session.site_id).in('product_id', ids)
      const stockMap = Object.fromEntries((stockData || []).map((s: any) => [s.product_id, s.quantite || 0]))
      setProduits(data.map((p: any) => ({ ...p, stock: stockMap[p.id] || 0 })))
    } else setProduits([])
  }

  const handleSearchProduit = (v: string) => {
    setSearchProduit(v)
    clearTimeout(searchProduitTimer.current)
    searchProduitTimer.current = setTimeout(() => searchProduits(v), 250)
  }

  const addProduit = (p: any) => {
    const prix = (client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc
    const remisePct = client?.remise_pct || 0
    const existing = lignes.find(l => l.product_id === p.id)
    if (existing) {
      setLignes(prev => prev.map(l => l.product_id === p.id ? { ...l, qte: l.qte + 1, total: (l.qte + 1) * l.prix_unit * (1 - l.remise_pct / 100) } : l))
    } else {
      setLignes(prev => [...prev, { id: Math.random().toString(36).slice(2), product_id: p.id, nom: p.nom, millesime: p.millesime, qte: 1, prix_unit: prix, remise_pct: remisePct, total: prix * (1 - remisePct / 100) }])
    }
    setSearchProduit(''); setProduits([])
  }

  const updateLigne = (id: string, field: 'qte' | 'remise_pct' | 'nom_modifie' | 'commentaire', val: any) => {
    setLignes(prev => prev.map(l => {
      if (l.id !== id) return l
      const u = { ...l, [field]: val }
      if (field === 'qte' || field === 'remise_pct') u.total = u.qte * u.prix_unit * (1 - u.remise_pct / 100)
      return u
    }))
  }

  // ── Ventes en attente ──
  const mettreEnAttente = () => {
    if (attentes.length >= 4) return
    const label = client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : `Vente ${attentes.length + 1}`
    setAttentes(prev => [...prev, { id: Math.random().toString(36).slice(2), client, lignes, typeDoc, remise, remiseType, label }])
    resetVente()
  }

  const reprendreAttente = (a: VenteEnAttente) => {
    setClient(a.client); setLignes(a.lignes); setTypeDoc(a.typeDoc); setRemise(a.remise); setRemiseType(a.remiseType)
    setAttentes(prev => prev.filter(x => x.id !== a.id))
    setEtape('produits')
  }

  const resetVente = () => {
    setClient(null); setLignes([]); setTypeDoc('ticket'); setRemise(''); setRemiseType('pct')
    setSearchClient(''); setClientsFound([]); setEtape('client')
  }

  // ── Validation vente ──
  const handleValiderVente = async (paiements: Paiement[]) => {
    const numero = `VTE-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`
    const totalPaye = paiements.reduce((a, p) => a + p.montant, 0)
    const statutPaiement = paiements.some(p => p.mode === 'non_regle') ? 'non_regle' : totalNet <= totalPaye ? 'regle' : 'partiel'

    const { data: vente } = await supabase.from('ventes').insert({
      numero, session_id: session.id, user_id: vendeur.id,
      customer_id: client?.id || null, site_id: session.site_id,
      type_doc: typeDoc, statut: 'validee', statut_paiement: statutPaiement,
      total_ht: totalNet / 1.20, total_ttc: totalNet,
      remise_globale_pct: remiseType === 'pct' ? parseFloat(remise) || 0 : 0,
      remise_globale_eur: remiseType === 'eur' ? parseFloat(remise) || 0 : 0,
    }).select('id').single()

    if (vente) {
      await supabase.from('vente_lignes').insert(lignes.map(l => ({
        vente_id: vente.id, product_id: l.product_id,
        nom_produit: l.nom_modifie || l.nom, millesime: l.millesime,
        quantite: l.qte, prix_unitaire_ttc: l.prix_unit,
        remise_pct: l.remise_pct, total_ttc: l.total,
      })))
      await supabase.from('vente_paiements').insert(paiements.map(p => ({ vente_id: vente.id, mode: p.mode, montant: p.montant })))
      for (const l of lignes) {
        await supabase.rpc('move_stock', { p_product_id: l.product_id, p_site_id: session.site_id, p_raison: 'vente', p_quantite: l.qte, p_note: `Vente ${numero}`, p_order_id: null, p_transfer_id: null })
      }
      // Fidélité
      if (client && !client.tarif_pro && statutPaiement === 'regle') {
        await supabase.from('loyalty_points').insert({ customer_id: client.id, points: Math.floor(totalNet), raison: `Vente ${numero}` })
      }
    }
    setVenteOk(true)
    setTimeout(() => { setVenteOk(false); resetVente() }, 2000)
  }

  const handleFermerCaisse = async () => {
    await supabase.from('caisse_sessions').update({ statut: 'fermee', ferme_le: new Date().toISOString(), especes_fermeture: parseFloat(espacesFermeture) || 0 }).eq('id', session.id)
    onFermer()
  }

  // ── Styles communs ──
  const btnPrimary = { background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12, padding: '18px', fontSize: 16, cursor: 'pointer', fontWeight: 700, width: '100%', touchAction: 'manipulation' as const }
  const btnSecondary = { background: 'rgba(255,255,255,0.06)', color: '#e8e0d5', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '16px', fontSize: 15, cursor: 'pointer', width: '100%', touchAction: 'manipulation' as const }
  const container = { minHeight: '100dvh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex', flexDirection: 'column' as const }
  const header = { padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, background: '#0d0a08', position: 'sticky' as const, top: 0, zIndex: 10 }

  // ── ÉTAPE CLIENT ──────────────────────────────────────────────
  if (etape === 'client' && !alertesClient) return (
    <div style={container}>
      <div style={header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>Cave de Gilbert</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{user.prenom} — Étape 1/4</div>
        </div>
        {attentes.length > 0 && (
          <div style={{ background: 'rgba(201,169,110,0.15)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 20, padding: '6px 12px', fontSize: 12, color: '#c9a96e' }}>
            {attentes.length} en attente
          </div>
        )}
        <button onClick={() => setShowFermeture(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>Fermer</button>
      </div>

      <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' as const }}>
        <div style={{ fontSize: 20, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Quel client ?</div>

        <input type="text" placeholder="🔍 Nom, prénom, email..." value={searchClient} onChange={e => handleSearchClient(e.target.value)} autoFocus
          style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 12, color: '#f0e8d8', fontSize: 17, padding: '16px', boxSizing: 'border-box' as const, marginBottom: 16, outline: 'none' }} />

        {/* Ventes en attente */}
        {attentes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#c9a96e', letterSpacing: 1.5, marginBottom: 10 }}>VENTES EN ATTENTE</div>
            {attentes.map(a => (
              <button key={a.id} onClick={() => reprendreAttente(a)} style={{ ...btnSecondary, marginBottom: 8, textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{a.label}</span>
                <span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(a.lignes.reduce((acc, l) => acc + l.total, 0))}</span>
              </button>
            ))}
          </div>
        )}

        <button onClick={() => selectClient(null)} style={{ ...btnSecondary, marginBottom: 12, color: 'rgba(232,224,213,0.6)' }}>
          👤 Client anonyme
        </button>
        <button onClick={() => setShowNouveauClient(true)} style={{ ...btnSecondary, marginBottom: 16, color: '#6ec96e', border: '0.5px solid rgba(110,201,110,0.3)' }}>
          + Créer un nouveau client
        </button>

        {loadingClients && <div style={{ textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', padding: 16 }}>⟳</div>}

        {clientsFound.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => selectClient(c)} style={{ ...btnSecondary, flex: 1, textAlign: 'left' as const }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16 }}>{c.est_societe ? c.raison_sociale : `${c.prenom} ${c.nom}`}</div>
                  {c.email && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>{c.email}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {c.tarif_pro && <span style={{ fontSize: 11, background: '#2a2a1e', color: '#c9b06e', padding: '3px 8px', borderRadius: 4 }}>PRO</span>}
                  {c.remise_pct > 0 && <span style={{ fontSize: 11, background: '#2a1e2a', color: '#c96ec9', padding: '3px 8px', borderRadius: 4 }}>-{c.remise_pct}%</span>}
                </div>
              </div>
            </button>
            <button onClick={() => setEditingClient(c)} style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px', fontSize: 18, cursor: 'pointer', color: 'rgba(232,224,213,0.5)', touchAction: 'manipulation' }}>✎</button>
          </div>
        ))}
      </div>

      {/* Modals nouveau/edit client */}
      {showNouveauClient && (
        <ModalClientForm
          onClose={() => setShowNouveauClient(false)}
          onSaved={(c) => { setClient(c); setShowNouveauClient(false); setEtape('produits') }}
        />
      )}
      {editingClient && (
        <ModalClientForm
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={(c) => { if (client?.id === c.id) setClient(c); setEditingClient(null) }}
        />
      )}

      {/* Fermeture caisse */}
      {showFermeture && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ width: '100%', background: '#18130e', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 20 }}>Fermeture de caisse</div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>ESPÈCES EN CAISSE</div>
            <input type="number" step="0.01" placeholder="0.00" value={espacesFermeture} onChange={e => setEspacesFermeture(e.target.value)} inputMode="decimal"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 22, padding: '16px', boxSizing: 'border-box' as const, textAlign: 'center' as const, marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowFermeture(false)} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
              <button onClick={handleFermerCaisse} style={{ flex: 2, background: '#c96e6e', color: '#fff', border: 'none', borderRadius: 12, padding: '18px', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>Fermer la caisse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── ALERTES CLIENT ──
  if (alertesClient && clientEnAttente) return (
    <div style={container}>
      <div style={{ flex: 1, padding: '24px 16px', overflowY: 'auto' as const }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 4 }}>⚠ Alertes client</div>
        <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.5)', marginBottom: 24 }}>{clientEnAttente.est_societe ? clientEnAttente.raison_sociale : `${clientEnAttente.prenom} ${clientEnAttente.nom}`}</div>

        {alertesClient.bons.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#c9a96e', letterSpacing: 1.5, marginBottom: 10 }}>🎟 BONS D'ACHAT DISPONIBLES</div>
            {alertesClient.bons.map((b: any) => <div key={b.id} style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, padding: '14px', marginBottom: 8, fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{b.montant}€ — {b.code}</div>)}
          </div>
        )}
        {alertesClient.demandes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#6e9ec9', letterSpacing: 1.5, marginBottom: 10 }}>📋 DEMANDES EN ATTENTE</div>
            {alertesClient.demandes.map((d: any) => <div key={d.id} style={{ background: 'rgba(110,158,201,0.08)', border: '0.5px solid rgba(110,158,201,0.2)', borderRadius: 8, padding: '12px', marginBottom: 8, fontSize: 14, color: '#e8e0d5' }}>{d.titre}</div>)}
          </div>
        )}
        {alertesClient.factures.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#c96e6e', letterSpacing: 1.5, marginBottom: 10 }}>💳 FACTURES NON RÉGLÉES</div>
            {alertesClient.factures.map((f: any) => <div key={f.id} style={{ background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.2)', borderRadius: 8, padding: '12px', marginBottom: 8, fontSize: 14, color: '#c96e6e' }}>{f.numero} — {parseFloat(f.total_ttc).toFixed(2)}€</div>)}
          </div>
        )}
      </div>
      <div style={{ padding: '16px', display: 'flex', gap: 12 }}>
        <button onClick={() => { setAlertesClient(null); setClientEnAttente(null) }} style={{ ...btnSecondary, flex: 1 }}>← Retour</button>
        <button onClick={confirmerClientAlertes} style={{ ...btnPrimary, flex: 2 }}>Continuer →</button>
      </div>
    </div>
  )

  // ── ÉTAPE PRODUITS ────────────────────────────────────────────
  if (etape === 'produits') return (
    <div style={container}>
      <div style={header}>
        <button onClick={() => setEtape('client')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: '#f0e8d8' }}>{client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : 'Client anonyme'}</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Étape 2/4 — {lignes.length} article{lignes.length > 1 ? 's' : ''} — {fmt(totalNet)}</div>
        </div>
        <select value={vendeur.id} onChange={e => { const v = vendeurs.find(u => u.id === e.target.value); if (v) setVendeur(v) }}
          style={{ background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#c9a96e', fontSize: 12, padding: '6px 8px', cursor: 'pointer' }}>
          {vendeurs.map(v => <option key={v.id} value={v.id}>{v.prenom}</option>)}
        </select>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        {[{ id: 'caisse', label: '🛒 Caisse' }, { id: 'gestion', label: '⚙ Gestion' }].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id as any)} style={{ flex: 1, background: onglet === o.id ? 'rgba(201,169,110,0.1)' : 'transparent', border: 'none', borderBottom: `2px solid ${onglet === o.id ? '#c9a96e' : 'transparent'}`, color: onglet === o.id ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '12px', fontSize: 14, cursor: 'pointer' }}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'caisse' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
          {/* Recherche produit */}
          <div style={{ padding: '12px 16px', position: 'relative' as const }}>
            <input type="text" placeholder="🔍 Ajouter un produit..." value={searchProduit} onChange={e => handleSearchProduit(e.target.value)} autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 16, padding: '14px', boxSizing: 'border-box' as const, outline: 'none' }} />
            {produits.length > 0 && (
              <div style={{ position: 'absolute' as const, left: 16, right: 16, top: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, zIndex: 50, maxHeight: 280, overflowY: 'auto' as const }}>
                {produits.map(p => (
                  <button key={p.id} onClick={() => addProduit(p)} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', color: '#e8e0d5', padding: '14px 16px', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center', touchAction: 'manipulation' }}>
                    <div>
                      <span style={{ color: COULEURS[p.couleur] || '#888', marginRight: 8 }}>●</span>
                      <span style={{ fontSize: 15 }}>{p.nom}</span>
                      {p.millesime && <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginLeft: 8 }}>{p.millesime}</span>}
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{((client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc).toFixed(2)}€</div>
                      <div style={{ fontSize: 11, color: p.stock <= 0 ? '#c96e6e' : 'rgba(232,224,213,0.4)' }}>stk: {p.stock}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lignes */}
          <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 16px' }}>
            {lignes.length === 0 ? (
              <div style={{ textAlign: 'center' as const, padding: '40px 0', color: 'rgba(232,224,213,0.25)', fontSize: 14 }}>Aucun article</div>
            ) : lignes.map(l => (
              <div key={l.id} style={{ background: '#18130e', borderRadius: 10, marginBottom: 10, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      {ligneEditId === l.id ? (
                        <input value={l.nom_modifie || l.nom} onChange={e => updateLigne(l.id, 'nom_modifie', e.target.value)}
                          onBlur={() => setLigneEditId(null)}
                          style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid #c9a96e', borderRadius: 6, color: '#f0e8d8', fontSize: 15, padding: '6px 10px', width: '100%' }} autoFocus />
                      ) : (
                        <div style={{ fontSize: 15, color: '#f0e8d8' }}>{l.nom_modifie || l.nom}{l.millesime ? ` ${l.millesime}` : ''}</div>
                      )}
                    </div>
                    <button onClick={() => setLignes(prev => prev.filter(x => x.id !== l.id))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 20, cursor: 'pointer', padding: '0 0 0 12px' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Qté */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 10px' }}>
                      <button onClick={() => updateLigne(l.id, 'qte', Math.max(1, l.qte - 1))} style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 20, cursor: 'pointer', width: 28, height: 28, touchAction: 'manipulation' }}>−</button>
                      <span style={{ fontSize: 17, minWidth: 24, textAlign: 'center' as const }}>{l.qte}</span>
                      <button onClick={() => updateLigne(l.id, 'qte', l.qte + 1)} style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 20, cursor: 'pointer', width: 28, height: 28, touchAction: 'manipulation' }}>+</button>
                    </div>
                    {/* Remise */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min={0} max={100} value={l.remise_pct || ''} placeholder="0" inputMode="decimal"
                        onChange={e => updateLigne(l.id, 'remise_pct', parseFloat(e.target.value) || 0)}
                        style={{ width: 52, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e8e0d5', fontSize: 14, padding: '6px 8px', textAlign: 'center' as const }} />
                      <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>%</span>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' as const }}>
                      <div style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 600 }}>{fmt(l.total)}</div>
                      <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{fmt(l.prix_unit)} / u.</div>
                    </div>
                    {/* Boutons modifier nom + commentaire */}
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                      <button onClick={() => setLigneEditId(ligneEditId === l.id ? null : l.id)} title="Modifier le nom" style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(232,224,213,0.4)', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>✎</button>
                      <button onClick={() => setLigneCommentId(ligneCommentId === l.id ? null : l.id)} title="Commentaire" style={{ background: l.commentaire ? 'rgba(201,169,110,0.1)' : 'transparent', border: `0.5px solid ${l.commentaire ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, color: l.commentaire ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>💬</button>
                    </div>
                  </div>
                  {/* Commentaire expand */}
                  {ligneCommentId === l.id && (
                    <div style={{ marginTop: 10 }}>
                      <textarea value={l.commentaire || ''} onChange={e => updateLigne(l.id, 'commentaire', e.target.value)}
                        placeholder="Commentaire sur cet article..."
                        rows={2} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#e8e0d5', fontSize: 13, padding: '10px', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totaux + bouton suivant */}
          <div style={{ padding: '12px 16px 24px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
            {lignes.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                    {[{ v: 'pct', l: '%' }, { v: 'eur', l: '€' }].map(({ v, l }) => (
                      <button key={v} onClick={() => setRemiseType(v as any)} style={{ background: remiseType === v ? 'rgba(201,169,110,0.2)' : 'transparent', border: 'none', color: remiseType === v ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>{l}</button>
                    ))}
                  </div>
                  <input type="number" step="0.01" placeholder="Remise" value={remise} onChange={e => setRemise(e.target.value)} inputMode="decimal"
                    style={{ width: 80, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e8e0d5', fontSize: 15, padding: '8px 10px' }} />
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  {remiseVal > 0 && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>-{fmt(remiseVal)}</div>}
                  <div style={{ fontSize: 22, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 700 }}>{fmt(totalNet)}</div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              {attentes.length < 4 && lignes.length > 0 && (
                <button onClick={mettreEnAttente} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(232,224,213,0.7)', borderRadius: 12, padding: '16px', fontSize: 14, cursor: 'pointer', touchAction: 'manipulation' }}>
                  ⏸ Attente
                </button>
              )}
              <button onClick={() => lignes.length > 0 && setEtape('document')} style={{ ...btnPrimary, flex: 2, opacity: lignes.length === 0 ? 0.4 : 1, cursor: lignes.length === 0 ? 'not-allowed' : 'pointer' }}>
                Suivant →
              </button>
            </div>
          </div>
        </div>
      )}

      {onglet === 'gestion' && (
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 16 }}>Sélectionnez une ligne dans la caisse pour modifier son nom.</div>

          {/* Modifier nom article */}
          <div style={{ background: '#18130e', borderRadius: 12, padding: '16px', marginBottom: 16, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 13, color: '#c9a96e', letterSpacing: 1, marginBottom: 12 }}>✎ MODIFIER NOM D'ARTICLE</div>
            {lignes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.3)' }}>Aucun article dans le panier</div>
            ) : lignes.map(l => (
              <div key={l.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>{l.nom}</div>
                <input value={l.nom_modifie || l.nom} onChange={e => updateLigne(l.id, 'nom_modifie', e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '12px', boxSizing: 'border-box' as const }} />
              </div>
            ))}
          </div>

          {/* Ventes en attente */}
          {attentes.length > 0 && (
            <div style={{ background: '#18130e', borderRadius: 12, padding: '16px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 13, color: '#c9a96e', letterSpacing: 1, marginBottom: 12 }}>⏸ VENTES EN ATTENTE</div>
              {attentes.map(a => (
                <button key={a.id} onClick={() => reprendreAttente(a)} style={{ ...btnSecondary, marginBottom: 8, textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{a.label}</span>
                  <span style={{ color: '#c9a96e' }}>{fmt(a.lignes.reduce((acc, l) => acc + l.total, 0))}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── ÉTAPE DOCUMENT ────────────────────────────────────────────
  if (etape === 'document') return (
    <div style={container}>
      <div style={header}>
        <button onClick={() => setEtape('produits')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: '#f0e8d8' }}>Type de document</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Étape 3/4 — {fmt(totalNet)}</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '24px 16px', overflowY: 'auto' as const }}>
        <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 24 }}>Quel type de document ?</div>
        {[
          { id: 'ticket', label: '🧾 Ticket de caisse', desc: 'Vente simple, impression immédiate' },
          { id: 'devis', label: '📄 Devis', desc: 'Envoi par email, transformable en commande/facture' },
          { id: 'commande', label: '📦 Commande', desc: 'Commande client à préparer' },
          { id: 'bl', label: '🚚 Bon de livraison', desc: 'Pour les livraisons, signature client' },
          { id: 'facture', label: '💼 Facture', desc: 'Facture officielle avec TVA' },
        ].map(d => (
          <button key={d.id} onClick={() => setTypeDoc(d.id)} style={{
            width: '100%', background: typeDoc === d.id ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${typeDoc === d.id ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 12, padding: '18px', cursor: 'pointer', textAlign: 'left' as const, marginBottom: 12, touchAction: 'manipulation',
          }}>
            <div style={{ fontSize: 17, color: typeDoc === d.id ? '#c9a96e' : '#e8e0d5', marginBottom: 4 }}>{d.label}</div>
            <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>{d.desc}</div>
          </button>
        ))}
      </div>
      <div style={{ padding: '16px 16px 32px' }}>
        {typeDoc === 'devis' ? (
          <button onClick={() => setShowDevisEmail(true)} style={{ ...btnPrimary }}>
            📧 Préparer le devis
          </button>
        ) : (
          <button onClick={() => setEtape('paiement')} style={{ ...btnPrimary }}>
            Suivant → Paiement
          </button>
        )}
      </div>

      {/* Modal devis email */}
      {showDevisEmail && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ width: '100%', background: '#18130e', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 20 }}>Envoyer le devis</div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>EMAIL DESTINATAIRE</div>
            <input type="email" value={devisEmail || client?.email || ''} onChange={e => setDevisEmail(e.target.value)} placeholder="email@client.fr" inputMode="email"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 16, padding: '16px', boxSizing: 'border-box' as const, marginBottom: 20 }} />
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '14px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>RÉCAPITULATIF DEVIS</div>
              {lignes.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#e8e0d5', marginBottom: 4 }}><span>{l.qte}× {l.nom_modifie || l.nom}</span><span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(l.total)}</span></div>)}
              <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                <span style={{ color: 'rgba(232,224,213,0.6)' }}>Total</span>
                <span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(totalNet)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowDevisEmail(false)} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
              <button onClick={async () => {
                // Enregistrer le devis en base
                const numero = `DEV-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`
                await supabase.from('ventes').insert({
                  numero, session_id: session.id, user_id: vendeur.id,
                  customer_id: client?.id || null, site_id: session.site_id,
                  type_doc: 'devis', statut: 'validee', statut_paiement: 'non_regle',
                  total_ht: totalNet / 1.20, total_ttc: totalNet,
                })
                setShowDevisEmail(false)
                alert(`Devis ${numero} enregistré.\nEnvoi email à ${devisEmail || client?.email} — fonction email à connecter.`)
                resetVente()
              }} style={{ ...btnPrimary, flex: 2 }}>📧 Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── ÉTAPE PAIEMENT ────────────────────────────────────────────
  if (etape === 'paiement') {
    const [paiements, setPaiements] = useState<Paiement[]>([])
    const [modeCourant, setModeCourant] = useState('cb')
    const [montantSaisi, setMontantSaisi] = useState('')
    const totalPaye = paiements.reduce((acc, p) => acc + p.montant, 0)
    const resteAPayer = Math.max(0, totalNet - totalPaye)
    const monnaie = totalPaye > totalNet ? totalPaye - totalNet : 0
    const canValider = totalPaye >= totalNet || paiements.some(p => p.mode === 'non_regle')

    const MODES = [
      { id: 'cb', label: '💳 CB', color: '#6e9ec9' },
      { id: 'especes', label: '💶 Espèces', color: '#6ec96e' },
      { id: 'virement', label: '🏦 Virement', color: '#c9b06e' },
      { id: 'bon_achat', label: '🎟 Bon', color: '#c9a96e' },
      { id: 'non_regle', label: '📋 Non réglé', color: '#c96e6e' },
    ]

    const addPaiement = () => {
      const montant = modeCourant === 'non_regle' ? resteAPayer : (parseFloat(montantSaisi) || resteAPayer)
      if (montant <= 0) return
      const labels: Record<string, string> = { cb: 'CB', especes: 'Espèces', virement: 'Virement', bon_achat: "Bon d'achat", non_regle: 'Non réglé' }
      setPaiements(prev => [...prev, { mode: modeCourant, montant, label: labels[modeCourant] }])
      setMontantSaisi('')
    }

    return (
      <div style={container}>
        <div style={header}>
          <button onClick={() => setEtape('document')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#f0e8d8' }}>Paiement</div>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Étape 4/4</div>
          </div>
          <div style={{ fontSize: 24, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 700 }}>{fmt(totalNet)}</div>
        </div>

        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' as const }}>
          {/* Mode paiement */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setModeCourant(m.id)} style={{
                background: modeCourant === m.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${modeCourant === m.id ? m.color : 'rgba(255,255,255,0.08)'}`,
                color: modeCourant === m.id ? m.color : 'rgba(232,224,213,0.5)',
                borderRadius: 10, padding: '14px 6px', fontSize: 13, cursor: 'pointer', touchAction: 'manipulation',
              }}>{m.label}</button>
            ))}
          </div>

          {modeCourant !== 'non_regle' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input type="number" step="0.01" inputMode="decimal" placeholder={`${fmt(resteAPayer)}`} value={montantSaisi}
                onChange={e => setMontantSaisi(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 20, padding: '16px', outline: 'none' }} />
              <button onClick={addPaiement} style={{ background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '16px 20px', fontSize: 16, cursor: 'pointer', fontWeight: 700, touchAction: 'manipulation' }}>+</button>
            </div>
          )}

          {modeCourant === 'non_regle' && (
            <button onClick={addPaiement} style={{ ...btnSecondary, border: '1.5px solid rgba(201,110,110,0.4)', color: '#c96e6e', marginBottom: 16 }}>
              Mettre en compte client
            </button>
          )}

          {/* Récap */}
          {paiements.length > 0 && (
            <div style={{ background: '#18130e', borderRadius: 10, padding: '14px', marginBottom: 16, border: '0.5px solid rgba(255,255,255,0.07)' }}>
              {paiements.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, color: 'rgba(232,224,213,0.7)' }}>{p.label}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(p.montant)}</span>
                    <button onClick={() => setPaiements(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 18, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, color: resteAPayer > 0 ? '#c96e6e' : monnaie > 0 ? '#6ec96e' : '#6ec96e', fontWeight: 600 }}>
                  {resteAPayer > 0 ? `Reste : ${fmt(resteAPayer)}` : monnaie > 0 ? `Monnaie : ${fmt(monnaie)}` : '✓ Soldé'}
                </span>
                <span style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 700 }}>{fmt(totalPaye)}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 16px 32px' }}>
          <button onClick={() => canValider && handleValiderVente(paiements)} style={{
            ...btnPrimary, background: canValider ? '#c9a96e' : '#2a2a1e',
            color: canValider ? '#0d0a08' : '#555', cursor: canValider ? 'pointer' : 'not-allowed',
          }}>
            {canValider ? `✓ Valider — ${fmt(totalNet)}` : 'Ajouter un paiement'}
          </button>
        </div>

        {venteOk && (
          <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>✓</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#6ec96e' }}>Vente enregistrée !</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

// ── Page principale ───────────────────────────────────────────
export default function CaissePage() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!user) return <EcranLogin onLogin={setUser} />
  if (!session) return <EcranOuverture user={user} onOuvrir={setSession} />
  if (isMobile) return <CaissePrincipale user={user} session={session} onFermer={() => { setSession(null); setUser(null) }} />
  return <CaisseDesktop user={user} session={session} onFermer={() => { setSession(null); setUser(null) }} />
}

// ── Caisse Desktop ────────────────────────────────────────────
function CaisseDesktop({ user, session, onFermer }: { user: User; session: Session; onFermer: () => void }) {
  const [client, setClient] = useState<Client | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [typeDoc, setTypeDoc] = useState('ticket')
  const [remise, setRemise] = useState('')
  const [remiseType, setRemiseType] = useState<'pct' | 'eur'>('pct')
  const [vendeur, setVendeur] = useState(user)
  const [vendeurs, setVendeurs] = useState<User[]>([])
  const [attentes, setAttentes] = useState<VenteEnAttente[]>([])
  const [searchClient, setSearchClient] = useState('')
  const [clientsFound, setClientsFound] = useState<Client[]>([])
  const [showClientPanel, setShowClientPanel] = useState(false)
  const [alertesClient, setAlertesClient] = useState<any>(null)
  const [searchProduit, setSearchProduit] = useState('')
  const [produits, setProduits] = useState<any[]>([])
  const [showPaiement, setShowPaiement] = useState(false)
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [modeCourant, setModeCourant] = useState('cb')
  const [montantSaisi, setMontantSaisi] = useState('')
  const [venteOk, setVenteOk] = useState(false)
  const [showFermeture, setShowFermeture] = useState(false)
  const [espacesFermeture, setEspacesFermeture] = useState('')
  const [ligneEditId, setLigneEditId] = useState<string | null>(null)
  const [ligneCommentId, setLigneCommentId] = useState<string | null>(null)
  const [showNouveauClient, setShowNouveauClient] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const searchTimer = useRef<any>(null)
  const prodTimer = useRef<any>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('users').select('*').eq('actif', true).then(({ data }) => setVendeurs(data || []))
  }, [])

  const totalBrut = lignes.reduce((a, l) => a + l.total, 0)
  const remiseVal = remise ? (remiseType === 'pct' ? totalBrut * parseFloat(remise) / 100 : parseFloat(remise)) : 0
  const totalNet = Math.max(0, totalBrut - remiseVal)
  const totalPaye = paiements.reduce((a, p) => a + p.montant, 0)
  const resteAPayer = Math.max(0, totalNet - totalPaye)
  const monnaie = totalPaye > totalNet ? totalPaye - totalNet : 0
  const canValider = totalPaye >= totalNet || paiements.some(p => p.mode === 'non_regle')

  const searchClients = async (q: string) => {
    if (!q.trim()) { setClientsFound([]); return }
    const { data } = await supabase.from('customers').select('id, prenom, nom, raison_sociale, est_societe, tarif_pro, remise_pct, email, telephone').or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,raison_sociale.ilike.%${q}%,email.ilike.%${q}%`).limit(8)
    setClientsFound(data || [])
  }

  const selectClient = async (c: Client | null) => {
    if (!c) { setClient(null); setShowClientPanel(false); return }
    const [{ data: bons }, { data: demandes }, { data: factures }] = await Promise.all([
      supabase.from('loyalty_vouchers').select('*').eq('customer_id', c.id).eq('utilise', false),
      supabase.from('customer_requests').select('*').eq('customer_id', c.id).eq('statut', 'en_attente'),
      supabase.from('ventes').select('id, numero, total_ttc').eq('customer_id', c.id).eq('statut_paiement', 'non_regle').eq('statut', 'validee'),
    ])
    const a = { bons: bons || [], demandes: demandes || [], factures: factures || [] }
    if (a.bons.length || a.demandes.length || a.factures.length) setAlertesClient({ client: c, ...a })
    else { setClient(c); setShowClientPanel(false) }
  }

  const searchProduits = async (q: string) => {
    if (!q.trim()) { setProduits([]); return }
    const { data } = await supabase.from('products').select('id, nom, millesime, couleur, prix_vente_ttc, prix_vente_pro').ilike('nom', `%${q}%`).eq('actif', true).limit(12)
    if (data?.length) {
      const ids = data.map((p: any) => p.id)
      const { data: st } = await supabase.from('stock').select('product_id, quantite').eq('site_id', session.site_id).in('product_id', ids)
      const sm = Object.fromEntries((st || []).map((s: any) => [s.product_id, s.quantite || 0]))
      setProduits(data.map((p: any) => ({ ...p, stock: sm[p.id] || 0 })))
    } else setProduits([])
  }

  const addProduit = (p: any) => {
    const prix = (client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc
    const rp = client?.remise_pct || 0
    const ex = lignes.find(l => l.product_id === p.id)
    if (ex) setLignes(prev => prev.map(l => l.product_id === p.id ? { ...l, qte: l.qte + 1, total: (l.qte + 1) * l.prix_unit * (1 - l.remise_pct / 100) } : l))
    else setLignes(prev => [...prev, { id: Math.random().toString(36).slice(2), product_id: p.id, nom: p.nom, millesime: p.millesime, qte: 1, prix_unit: prix, remise_pct: rp, total: prix * (1 - rp / 100) }])
    setSearchProduit(''); setProduits([]); searchRef.current?.focus()
  }

  const updateLigne = (id: string, field: string, val: any) => {
    setLignes(prev => prev.map(l => {
      if (l.id !== id) return l
      const u = { ...l, [field]: val }
      if (field === 'qte' || field === 'remise_pct') u.total = u.qte * u.prix_unit * (1 - u.remise_pct / 100)
      return u
    }))
  }

  const mettreEnAttente = () => {
    if (attentes.length >= 4) return
    const label = client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : `Vente ${attentes.length + 1}`
    setAttentes(prev => [...prev, { id: Math.random().toString(36).slice(2), client, lignes, typeDoc, remise, remiseType, label }])
    resetVente()
  }

  const reprendreAttente = (a: VenteEnAttente) => {
    setClient(a.client); setLignes(a.lignes); setTypeDoc(a.typeDoc); setRemise(a.remise); setRemiseType(a.remiseType)
    setAttentes(prev => prev.filter(x => x.id !== a.id))
  }

  const resetVente = () => { setClient(null); setLignes([]); setTypeDoc('ticket'); setRemise(''); setRemiseType('pct'); setPaiements([]); setSearchClient(''); setClientsFound([]) }

  const addPaiement = () => {
    const montant = modeCourant === 'non_regle' ? resteAPayer : (parseFloat(montantSaisi) || resteAPayer)
    if (montant <= 0) return
    const labels: Record<string, string> = { cb: 'CB', especes: 'Espèces', virement: 'Virement', bon_achat: "Bon d'achat", non_regle: 'Non réglé' }
    setPaiements(prev => [...prev, { mode: modeCourant, montant, label: labels[modeCourant] }])
    setMontantSaisi('')
  }

  const handleValider = async () => {
    const numero = `VTE-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`
    const sp = paiements.some(p => p.mode === 'non_regle') ? 'non_regle' : totalNet <= totalPaye ? 'regle' : 'partiel'
    const { data: v } = await supabase.from('ventes').insert({ numero, session_id: session.id, user_id: vendeur.id, customer_id: client?.id || null, site_id: session.site_id, type_doc: typeDoc, statut: 'validee', statut_paiement: sp, total_ht: totalNet / 1.20, total_ttc: totalNet, remise_globale_pct: remiseType === 'pct' ? parseFloat(remise) || 0 : 0, remise_globale_eur: remiseType === 'eur' ? parseFloat(remise) || 0 : 0 }).select('id').single()
    if (v) {
      await supabase.from('vente_lignes').insert(lignes.map(l => ({ vente_id: v.id, product_id: l.product_id, nom_produit: l.nom_modifie || l.nom, millesime: l.millesime, quantite: l.qte, prix_unitaire_ttc: l.prix_unit, remise_pct: l.remise_pct, total_ttc: l.total })))
      await supabase.from('vente_paiements').insert(paiements.map(p => ({ vente_id: v.id, mode: p.mode, montant: p.montant })))
      for (const l of lignes) await supabase.rpc('move_stock', { p_product_id: l.product_id, p_site_id: session.site_id, p_raison: 'vente', p_quantite: l.qte, p_note: `Vente ${numero}`, p_order_id: null, p_transfer_id: null })
      if (client && !client.tarif_pro && sp === 'regle') await supabase.from('loyalty_points').insert({ customer_id: client.id, points: Math.floor(totalNet), raison: `Vente ${numero}` })
    }
    setShowPaiement(false); setVenteOk(true)
    setTimeout(() => { setVenteOk(false); resetVente() }, 2000)
  }

  const DOCS = ['ticket','devis','commande','bl','facture']
  const MODES = [{ id: 'cb', label: '💳 CB', c: '#6e9ec9' }, { id: 'especes', label: '💶 Espèces', c: '#6ec96e' }, { id: 'virement', label: '🏦 Virement', c: '#c9b06e' }, { id: 'bon_achat', label: '🎟 Bon', c: '#c9a96e' }, { id: 'non_regle', label: '📋 Non réglé', c: '#c96e6e' }]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', overflow: 'hidden' }}>

      {/* ── Colonne gauche : produits ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', borderRight: '0.5px solid rgba(255,255,255,0.07)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e' }}>Cave de Gilbert</div>
          <div style={{ flex: 1 }} />
          <select value={vendeur.id} onChange={e => { const v = vendeurs.find(u => u.id === e.target.value); if (v) setVendeur(v) }} style={{ background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, color: '#c9a96e', fontSize: 12, padding: '5px 8px', cursor: 'pointer' }}>
            {vendeurs.map(v => <option key={v.id} value={v.id}>{v.prenom} {v.nom}</option>)}
          </select>
          {attentes.length > 0 && attentes.map(a => (
            <button key={a.id} onClick={() => reprendreAttente(a)} style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#c9a96e', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
              ⏸ {a.label}
            </button>
          ))}
          <button onClick={() => setShowFermeture(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>Fermer</button>
        </div>

        {/* Recherche produit */}
        <div style={{ padding: '12px 16px', position: 'relative' as const }}>
          <input ref={searchRef} type="text" placeholder="🔍 Rechercher un produit..." value={searchProduit}
            onChange={e => { setSearchProduit(e.target.value); clearTimeout(prodTimer.current); prodTimer.current = setTimeout(() => searchProduits(e.target.value), 200) }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.35)', borderRadius: 8, color: '#f0e8d8', fontSize: 16, padding: '12px 16px', boxSizing: 'border-box' as const, outline: 'none' }} />
          {produits.length > 0 && (
            <div style={{ position: 'absolute' as const, left: 16, right: 16, top: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, zIndex: 50, maxHeight: 320, overflowY: 'auto' as const }}>
              {produits.map((p: any) => (
                <button key={p.id} onClick={() => addProduit(p)} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', color: '#e8e0d5', padding: '11px 16px', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.07)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div><span style={{ color: COULEURS[p.couleur] || '#888', marginRight: 8 }}>●</span>{p.nom}{p.millesime ? ` ${p.millesime}` : ''}</div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ color: '#c9a96e', fontFamily: 'Georgia, serif', fontSize: 15 }}>{((client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc).toFixed(2)}€</div>
                    <div style={{ fontSize: 11, color: p.stock <= 0 ? '#c96e6e' : 'rgba(232,224,213,0.4)' }}>stk: {p.stock}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lignes */}
        <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 16px' }}>
          {lignes.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '60px', color: 'rgba(232,224,213,0.2)', fontSize: 14 }}>Recherchez un produit pour l'ajouter</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead><tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Qté', 'Prix', 'Rem.%', 'Total', ''].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, color: 'rgba(232,224,213,0.3)', fontWeight: 400, letterSpacing: 1.5 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px' }}>
                      {ligneEditId === l.id
                        ? <input value={l.nom_modifie || l.nom} onChange={e => updateLigne(l.id, 'nom_modifie', e.target.value)} onBlur={() => setLigneEditId(null)} autoFocus style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid #c9a96e', borderRadius: 4, color: '#f0e8d8', fontSize: 13, padding: '4px 8px', width: '100%' }} />
                        : <div style={{ fontSize: 14 }}>{l.nom_modifie || l.nom}{l.millesime ? ` ${l.millesime}` : ''}</div>
                      }
                      {ligneCommentId === l.id && <textarea value={l.commentaire || ''} onChange={e => updateLigne(l.id, 'commentaire', e.target.value)} placeholder="Commentaire..." rows={1} style={{ width: '100%', marginTop: 6, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#e8e0d5', fontSize: 12, padding: '6px', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateLigne(l.id, 'qte', Math.max(1, l.qte - 1))} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e8e0d5', width: 26, height: 26, borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>−</button>
                        <span style={{ width: 24, textAlign: 'center' as const, fontSize: 15 }}>{l.qte}</span>
                        <button onClick={() => updateLigne(l.id, 'qte', l.qte + 1)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e8e0d5', width: 26, height: 26, borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{l.prix_unit.toFixed(2)}€</td>
                    <td style={{ padding: '10px' }}>
                      <input type="number" min={0} max={100} value={l.remise_pct || ''} placeholder="0" onChange={e => updateLigne(l.id, 'remise_pct', parseFloat(e.target.value) || 0)} style={{ width: 50, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '4px 6px', textAlign: 'center' as const }} />
                    </td>
                    <td style={{ padding: '10px', fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 600 }}>{fmt(l.total)}</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => setLigneEditId(ligneEditId === l.id ? null : l.id)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(232,224,213,0.4)', padding: '3px 7px', fontSize: 11, cursor: 'pointer', marginRight: 4 }}>✎</button>
                      <button onClick={() => setLigneCommentId(ligneCommentId === l.id ? null : l.id)} style={{ background: l.commentaire ? 'rgba(201,169,110,0.1)' : 'transparent', border: `0.5px solid ${l.commentaire ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 4, color: l.commentaire ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '3px 7px', fontSize: 11, cursor: 'pointer', marginRight: 4 }}>💬</button>
                      <button onClick={() => setLignes(prev => prev.filter(x => x.id !== l.id))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Colonne droite : client + paiement ── */}
      <div style={{ width: 360, display: 'flex', flexDirection: 'column' as const, background: '#100d0a' }}>
        {/* Client */}
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', position: 'relative' as const }}>
          <button onClick={() => setShowClientPanel(!showClientPanel)} style={{ width: '100%', background: client ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${client ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '12px', cursor: 'pointer', textAlign: 'left' as const }}>
            {client ? (
              <div>
                <div style={{ fontSize: 12, color: '#c9a96e', marginBottom: 2 }}>👤 Client</div>
                <div style={{ fontSize: 15, color: '#f0e8d8' }}>{client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {client.tarif_pro && <span style={{ fontSize: 10, background: '#2a2a1e', color: '#c9b06e', padding: '2px 6px', borderRadius: 3 }}>PRO</span>}
                  {client.remise_pct > 0 && <span style={{ fontSize: 10, background: '#2a1e2a', color: '#c96ec9', padding: '2px 6px', borderRadius: 3 }}>-{client.remise_pct}%</span>}
                </div>
              </div>
            ) : <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.4)', textAlign: 'center' as const }}>👤 Sélectionner un client</div>}
          </button>
          {showClientPanel && (
            <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', zIndex: 50, padding: '12px' }}>
              <input autoFocus type="text" placeholder="Rechercher..." value={searchClient}
                onChange={e => { setSearchClient(e.target.value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => searchClients(e.target.value), 300) }}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '10px', boxSizing: 'border-box' as const, marginBottom: 8 }} />
              <button onClick={() => selectClient(null)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(232,224,213,0.5)', padding: '10px', fontSize: 13, cursor: 'pointer', marginBottom: 6, textAlign: 'left' as const }}>👤 Client anonyme</button>
              <button onClick={() => { setShowNouveauClient(true); setShowClientPanel(false) }} style={{ width: '100%', background: 'rgba(110,201,110,0.06)', border: '0.5px solid rgba(110,201,110,0.2)', borderRadius: 6, color: '#6ec96e', padding: '10px', fontSize: 13, cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const }}>+ Nouveau client</button>
              {clientsFound.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <button onClick={() => selectClient(c)} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e8e0d5', padding: '10px', fontSize: 13, cursor: 'pointer', textAlign: 'left' as const }}>
                    <div>{c.est_societe ? c.raison_sociale : `${c.prenom} ${c.nom}`}</div>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{c.email}</div>
                  </button>
                  <button onClick={() => { setEditingClient(c); setShowClientPanel(false) }} style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 10px', fontSize: 14, cursor: 'pointer', color: 'rgba(232,224,213,0.5)' }}>✎</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Type document */}
        <div style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {DOCS.map(d => (
              <button key={d} onClick={() => setTypeDoc(d)} style={{ flex: 1, background: typeDoc === d ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${typeDoc === d ? '#c9a96e' : 'rgba(255,255,255,0.08)'}`, color: typeDoc === d ? '#c9a96e' : 'rgba(232,224,213,0.5)', borderRadius: 6, padding: '8px 4px', fontSize: 11, cursor: 'pointer' }}>
                {d === 'ticket' ? '🧾' : d === 'devis' ? '📄' : d === 'commande' ? '📦' : d === 'bl' ? '🚚' : '💼'} {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Remise + totaux */}
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              {[{ v: 'pct', l: '%' }, { v: 'eur', l: '€' }].map(({ v, l }) => (
                <button key={v} onClick={() => setRemiseType(v as any)} style={{ background: remiseType === v ? 'rgba(201,169,110,0.2)' : 'transparent', border: 'none', color: remiseType === v ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <input type="number" step="0.01" placeholder="Remise" value={remise} onChange={e => setRemise(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 14, padding: '7px 10px' }} />
          </div>
          {remiseVal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}><span>Remise</span><span>-{fmt(remiseVal)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 2 }}><span>HT</span><span>{fmt(totalNet / 1.20)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, fontFamily: 'Georgia, serif', marginTop: 6 }}>
            <span style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', alignSelf: 'flex-end', marginBottom: 3 }}>TTC</span>
            <span style={{ color: '#c9a96e' }}>{fmt(totalNet)}</span>
          </div>
        </div>

        {/* Paiement */}
        {showPaiement ? (
          <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' as const }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {MODES.map(m => (
                <button key={m.id} onClick={() => setModeCourant(m.id)} style={{ background: modeCourant === m.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: `2px solid ${modeCourant === m.id ? m.c : 'rgba(255,255,255,0.07)'}`, color: modeCourant === m.id ? m.c : 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '10px 4px', fontSize: 11, cursor: 'pointer' }}>{m.label}</button>
              ))}
            </div>
            {modeCourant !== 'non_regle' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input type="number" step="0.01" placeholder={fmt(resteAPayer)} value={montantSaisi} onChange={e => setMontantSaisi(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 16, padding: '10px', outline: 'none' }} />
                <button onClick={addPaiement} style={{ background: '#c9a96e', border: 'none', borderRadius: 6, color: '#0d0a08', padding: '10px 16px', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>+</button>
              </div>
            )}
            {modeCourant === 'non_regle' && <button onClick={addPaiement} style={{ width: '100%', background: 'rgba(201,110,110,0.12)', border: '1px solid rgba(201,110,110,0.3)', borderRadius: 8, color: '#c96e6e', padding: '12px', fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>Mettre en compte</button>}
            {paiements.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 14, color: 'rgba(232,224,213,0.7)' }}>{p.label}</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(p.montant)}</span>
                  <button onClick={() => setPaiements(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
            {paiements.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 14, color: resteAPayer > 0 ? '#c96e6e' : '#6ec96e', fontWeight: 600 }}>
                {resteAPayer > 0 ? `Reste: ${fmt(resteAPayer)}` : monnaie > 0 ? `Monnaie: ${fmt(monnaie)}` : '✓ Soldé'}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, padding: '12px 16px' }}>
            {attentes.length < 4 && lignes.length > 0 && (
              <button onClick={mettreEnAttente} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(232,224,213,0.6)', padding: '12px', fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>⏸ Mettre en attente</button>
            )}
          </div>
        )}

        {/* Bouton principal */}
        <div style={{ padding: '12px 16px 20px' }}>
          {!showPaiement ? (
            <button onClick={() => lignes.length > 0 && setShowPaiement(true)} style={{ width: '100%', background: lignes.length > 0 ? '#c9a96e' : '#2a2a1e', color: lignes.length > 0 ? '#0d0a08' : '#555', border: 'none', borderRadius: 10, padding: '16px', fontSize: 16, cursor: lignes.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
              {lignes.length > 0 ? `💳 Encaisser ${fmt(totalNet)}` : 'Panier vide'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowPaiement(false); setPaiements([]) }} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '14px', fontSize: 13, cursor: 'pointer' }}>← Retour</button>
              <button onClick={() => canValider && handleValider()} style={{ flex: 2, background: canValider ? '#c9a96e' : '#2a2a1e', color: canValider ? '#0d0a08' : '#555', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, cursor: canValider ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                {canValider ? `✓ Valider ${fmt(totalNet)}` : 'Ajouter paiement'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alertes client */}
      {alertesClient && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '28px', maxWidth: 460, width: '90%' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 16 }}>⚠ Alertes — {alertesClient.client.est_societe ? alertesClient.client.raison_sociale : `${alertesClient.client.prenom} ${alertesClient.client.nom}`}</div>
            {alertesClient.bons?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, color: '#c9a96e', marginBottom: 8 }}>🎟 BONS D'ACHAT</div>{alertesClient.bons.map((b: any) => <div key={b.id} style={{ background: 'rgba(201,169,110,0.1)', borderRadius: 6, padding: '10px', marginBottom: 6, color: '#c9a96e', fontFamily: 'Georgia, serif', fontSize: 16 }}>{b.montant}€ — {b.code}</div>)}</div>}
            {alertesClient.demandes?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, color: '#6e9ec9', marginBottom: 8 }}>📋 DEMANDES</div>{alertesClient.demandes.map((d: any) => <div key={d.id} style={{ background: 'rgba(110,158,201,0.08)', borderRadius: 6, padding: '10px', marginBottom: 6, fontSize: 14 }}>{d.titre}</div>)}</div>}
            {alertesClient.factures?.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, color: '#c96e6e', marginBottom: 8 }}>💳 FACTURES NON RÉGLÉES</div>{alertesClient.factures.map((f: any) => <div key={f.id} style={{ background: 'rgba(201,110,110,0.08)', borderRadius: 6, padding: '10px', marginBottom: 6, fontSize: 14, color: '#c96e6e' }}>{f.numero} — {parseFloat(f.total_ttc).toFixed(2)}€</div>)}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setAlertesClient(null)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>← Retour</button>
              <button onClick={() => { setClient(alertesClient.client); setAlertesClient(null); setShowClientPanel(false) }} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>Continuer →</button>
            </div>
          </div>
        </div>
      )}

      {venteOk && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: 72 }}>✓</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#6ec96e', marginTop: 12 }}>Vente enregistrée !</div>
          </div>
        </div>
      )}

      {showFermeture && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '32px', maxWidth: 420, width: '90%' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 20 }}>Fermeture de caisse</div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>ESPÈCES EN CAISSE</div>
            <input type="number" step="0.01" placeholder="0.00" value={espacesFermeture} onChange={e => setEspacesFermeture(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, color: '#f0e8d8', fontSize: 20, padding: '14px', boxSizing: 'border-box' as const, textAlign: 'center' as const, marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFermeture(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '14px', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
              <button onClick={async () => { await supabase.from('caisse_sessions').update({ statut: 'fermee', ferme_le: new Date().toISOString(), especes_fermeture: parseFloat(espacesFermeture) || 0 }).eq('id', session.id); onFermer() }} style={{ flex: 2, background: '#c96e6e', color: '#fff', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>Fermer la caisse</button>
            </div>
          </div>
        </div>
      )}

      {showNouveauClient && (
        <ModalClientForm onClose={() => setShowNouveauClient(false)} onSaved={(c) => { setClient(c); setShowNouveauClient(false) }} />
      )}
      {editingClient && (
        <ModalClientForm client={editingClient} onClose={() => setEditingClient(null)} onSaved={(c) => { if (client?.id === c.id) setClient(c); setEditingClient(null) }} />
      )}
    </div>
  )
}comm