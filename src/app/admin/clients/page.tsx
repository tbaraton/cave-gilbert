'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return <span style={{ background: bg, color, fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>{label}</span>
}

function Spinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><div style={{ fontSize: 24, color: '#c9a96e', animation: 'spin 1.5s linear infinite' }}>⟳</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
}

// ── Modal Ajout/Édition Client ────────────────────────────────
function ModalClient({ client, onClose, onSaved }: { client?: any; onClose: () => void; onSaved: () => void }) {
  const isNew = !client?.id
  const [form, setForm] = useState({
    prenom: client?.prenom || '',
    nom: client?.nom || '',
    email: client?.email || '',
    telephone: client?.telephone || '',
    adresse: client?.adresse || client?.adresse_ligne1 || '',
    code_postal: client?.code_postal || '',
    ville: client?.ville || '',
    pays: client?.pays || 'France',
    est_societe: client?.est_societe || false,
    raison_sociale: client?.raison_sociale || '',
    siret: client?.siret || '',
    tarif_pro: client?.tarif_pro || false,
    remise_pct: client?.remise_pct ? String(client.remise_pct) : '',
    remise_raison: client?.remise_raison || '',
    notes: client?.notes || client?.notes_admin || '',
    newsletter: client?.newsletter || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [villesSuggestions, setVillesSuggestions] = useState<string[]>([])
  const [loadingVilles, setLoadingVilles] = useState(false)

  const lookupCP = async (cp: string) => {
    if (cp.length !== 5) { setVillesSuggestions([]); return }
    setLoadingVilles(true)
    try {
      const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom&format=json`)
      const data = await res.json()
      const villes = data.map((c: any) => c.nom).sort()
      setVillesSuggestions(villes)
      if (villes.length === 1) setForm(f => ({ ...f, ville: villes[0] }))
    } catch {
      setVillesSuggestions([])
    }
    setLoadingVilles(false)
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
      prenom: form.prenom,
      nom: form.nom,
      email: form.email || null,
      telephone: form.telephone || null,
      adresse: form.adresse || null,
      code_postal: form.code_postal || null,
      ville: form.ville || null,
      pays: form.pays || 'France',
      est_societe: form.est_societe,
      raison_sociale: form.est_societe ? form.raison_sociale : null,
      siret: form.est_societe ? form.siret : null,
      tarif_pro: form.tarif_pro,
      remise_pct: form.remise_pct ? parseFloat(form.remise_pct) : 0,
      remise_raison: form.remise_raison || null,
      notes: form.notes || null,
      newsletter: form.newsletter,
    }
    const { error: err } = isNew
      ? await supabase.from('customers').insert(payload)
      : await supabase.from('customers').update(payload).eq('id', client.id)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(); onClose()
  }

  const field = (label: string, key: string, opts?: { type?: string; col?: string; placeholder?: string }) => (
    <div style={{ gridColumn: opts?.col }}>
      <label style={lbl}>{label}</label>
      <input type={opts?.type || 'text'} placeholder={opts?.placeholder || ''} value={(form as any)[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
    </div>
  )

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' as const, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>{isNew ? 'Nouveau client' : 'Modifier le client'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        {/* Case Société */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: form.est_societe ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 6, border: `0.5px solid ${form.est_societe ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}
          onClick={() => setForm(f => ({ ...f, est_societe: !f.est_societe }))}>
          <div style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${form.est_societe ? '#c9a96e' : 'rgba(255,255,255,0.3)'}`, background: form.est_societe ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {form.est_societe && <span style={{ fontSize: 11, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#f0e8d8', fontWeight: 500 }}>Client Société / Professionnel</div>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>Cochez pour afficher les champs entreprise</div>
          </div>
        </div>

        {/* Identité */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Identité</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {field('Prénom', 'prenom')}
          {field('Nom *', 'nom')}
          {field('Email', 'email', { type: 'email' })}
          {field('Téléphone', 'telephone')}
        </div>

        {/* Champs société */}
        {form.est_societe && (
          <>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Entreprise</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {field('Raison sociale', 'raison_sociale', { col: '1 / -1' })}
              {field('SIRET', 'siret')}
              <div>
                <label style={lbl}>Tarif applicable</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: false, label: 'Particulier TTC' }, { val: true, label: 'Tarif professionnel' }].map(({ val, label }) => (
                    <button key={String(val)} onClick={() => setForm(f => ({ ...f, tarif_pro: val }))} style={{
                      flex: 1, background: form.tarif_pro === val ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `0.5px solid ${form.tarif_pro === val ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      color: form.tarif_pro === val ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                      borderRadius: 4, padding: '8px', fontSize: 11, cursor: 'pointer',
                    }}>{label}</button>
                  ))}
                </div>
                {form.tarif_pro && <div style={{ fontSize: 10, color: '#c9b06e', marginTop: 6 }}>⚠ Tarif pro = pas de programme fidélité</div>}
              </div>
            </div>
          </>
        )}

        {/* Adresse */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Adresse</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {field('Adresse', 'adresse', { col: '1 / -1' })}
          <div>
            <label style={lbl}>Code postal *</label>
            <input value={form.code_postal}
              onChange={e => {
                setForm(f => ({ ...f, code_postal: e.target.value }))
                lookupCP(e.target.value)
              }}
              placeholder="69001" maxLength={5} style={inp} />
          </div>
          <div>
            <label style={lbl}>Ville *</label>
            {villesSuggestions.length > 1 ? (
              <select value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
                style={{ ...inp, background: '#1a1408', cursor: 'pointer' }}>
                <option value="">— Choisir la ville —</option>
                {villesSuggestions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <div style={{ position: 'relative' as const }}>
                <input value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
                  placeholder={loadingVilles ? 'Chargement...' : 'Ville'} style={inp} />
              </div>
            )}
          </div>
          {field('Pays', 'pays')}
        </div>

        {/* Remise permanente */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Remise permanente</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Remise (%)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" step="0.5" min="0" max="100" value={form.remise_pct}
                onChange={e => setForm(f => ({ ...f, remise_pct: e.target.value }))}
                placeholder="0" style={{ ...inp, width: '100%' }} />
              <span style={{ color: '#c9a96e', fontSize: 14, flexShrink: 0 }}>%</span>
            </div>
          </div>
          <div>
            <label style={lbl}>Raison de la remise</label>
            <input value={form.remise_raison} onChange={e => setForm(f => ({ ...f, remise_raison: e.target.value }))}
              placeholder="Ex: Commerçant local, partenaire, fidélité..." style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Notes internes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
            style={{ ...inp, resize: 'vertical' as const }} placeholder="Préférences, informations utiles..." />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, newsletter: !f.newsletter }))}>
          <div style={{ width: 14, height: 14, borderRadius: 2, border: `0.5px solid ${form.newsletter ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: form.newsletter ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {form.newsletter && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>Abonné newsletter</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳ Enregistrement...' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Suppression Bon ─────────────────────────────────────
function ModalSupprimerBon({ bon, onClose, onDeleted }: { bon: any; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 8, padding: '28px 32px', maxWidth: 420, width: '100%' }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 300, color: '#f0e8d8', marginBottom: 12 }}>Supprimer le bon d'achat</h3>
        <p style={{ fontSize: 13, color: 'rgba(232,224,213,0.6)', marginBottom: 20 }}>
          Voulez-vous supprimer ce bon de <strong style={{ color: '#c9a96e' }}>{bon.montant}€</strong> ? Cette action est irréversible.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Non, annuler</button>
          <button disabled={deleting} onClick={async () => {
            setDeleting(true)
            await supabase.from('loyalty_vouchers').delete().eq('id', bon.id)
            onDeleted()
          }} style={{ flex: 1, background: '#c96e6e', color: '#fff', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
            {deleting ? '⟳' : 'Oui, supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Fiche Client ──────────────────────────────────────────────
function FicheClient({ client, onBack, onEdit }: { client: any; onBack: () => void; onEdit: () => void }) {
  const [commandes, setCommandes] = useState<any[]>([])
  const [points, setPoints] = useState(0)
  const [vouchers, setVouchers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bonASupprimer, setBonASupprimer] = useState<any>(null)
  const [demandes, setDemandes] = useState<any[]>([])
  const [showNouvelleDemandeForm, setShowNouvelleDemandeForm] = useState(false)
  const [nouvelleDemande, setNouvelleDemande] = useState({ titre: '', description: '', date_limite: '' })
  const [savingDemande, setSavingDemande] = useState(false)

  const beneficieFidelite = !client.tarif_pro

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: cmds }, { data: pts }, { data: vouchs }, { data: reqs }] = await Promise.all([
      supabase.from('orders').select('id, numero, created_at, total_ttc, statut, payee, nb_articles').eq('customer_id', client.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('loyalty_points').select('points').eq('customer_id', client.id),
      supabase.from('loyalty_vouchers').select('*').eq('customer_id', client.id).order('created_at', { ascending: false }),
      supabase.from('customer_requests').select('*').eq('customer_id', client.id).order('created_at', { ascending: false }),
    ])
    setCommandes(cmds || [])
    setPoints((pts || []).reduce((acc: number, p: any) => acc + (p.points || 0), 0))
    setVouchers(vouchs || [])
    setDemandes(reqs || [])
    setLoading(false)
  }, [client.id])

  useEffect(() => { loadData() }, [loadData])

  const totalAchats = commandes.reduce((acc, c) => acc + parseFloat(c.total_ttc || 0), 0)
  const commandesEnCours = commandes.filter(c => ['en_cours', 'confirmée', 'préparée'].includes(c.statut))
  const factures = commandes.filter(c => c.statut === 'facturée' && !c.payee)
  const bonsDisponibles = vouchers.filter(v => !v.utilise)
  const card = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px 22px' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 8 }}>← Retour</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
              {client.est_societe ? (client.raison_sociale || `${client.prenom} ${client.nom}`) : `${client.prenom || ''} ${client.nom}`}
            </h1>
            {client.est_societe && <Badge label="Société" bg="#1e202a" color="#6e9ec9" />}
            {client.tarif_pro ? <Badge label="Tarif pro" bg="#2a2a1e" color="#c9b06e" /> : <Badge label="Particulier" bg="#1e2a1e" color="#6ec96e" />}
            {client.remise_pct > 0 && <Badge label={`-${client.remise_pct}%`} bg="#2a1e2a" color="#c96ec9" />}
          </div>
          {client.est_societe && client.prenom && <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginTop: 4 }}>Contact : {client.prenom} {client.nom}</div>}
        </div>
        <button onClick={onEdit} style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.4)', color: '#c9a96e', borderRadius: 4, padding: '9px 18px', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
          Modifier
        </button>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total achats', value: `${totalAchats.toFixed(2)}€`, color: '#c9a96e' },
              { label: 'Commandes', value: String(commandes.length), color: '#e8e0d5' },
              { label: 'Points fidélité', value: beneficieFidelite ? String(points) : 'N/A', color: beneficieFidelite ? '#6ec96e' : '#555' },
              { label: 'Bons disponibles', value: String(bonsDisponibles.length), color: bonsDisponibles.length > 0 ? '#c9b06e' : '#555' },
            ].map(({ label, value, color }) => (
              <div key={label} style={card}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 28, color, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Coordonnées */}
            <div style={card}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 14 }}>Coordonnées</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {[
                  { label: 'Email', value: client.email },
                  { label: 'Téléphone', value: client.telephone },
                  { label: 'Adresse', value: [client.adresse, [client.code_postal, client.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') },
                  client.siret ? { label: 'SIRET', value: client.siret } : null,
                ].filter(Boolean).map((item: any) => item.value ? (
                  <div key={item.label} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', width: 80, flexShrink: 0 }}>{item.label}</span>
                    <span style={{ fontSize: 13, color: '#e8e0d5' }}>{item.value}</span>
                  </div>
                ) : null)}
                {client.notes && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 12, color: 'rgba(232,224,213,0.5)', fontStyle: 'italic' }}>{client.notes}</div>
                )}
              </div>
            </div>

            {/* Fidélité */}
            <div style={card}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 14 }}>Programme fidélité</div>
              {!beneficieFidelite ? (
                <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', fontStyle: 'italic' }}>Tarif professionnel remisé — programme fidélité non applicable.</div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{points % 500} / 500 points</span>
                      <span style={{ fontSize: 12, color: '#c9a96e' }}>{500 - (points % 500)} pts avant bon 15€</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${((points % 500) / 500) * 100}%`, background: '#c9a96e', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 4 }}>Total cumulé : {points} points — {Math.floor(points / 500)} bon{Math.floor(points / 500) > 1 ? 's' : ''} généré{Math.floor(points / 500) > 1 ? 's' : ''}</div>
                  </div>

                  {bonsDisponibles.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, marginBottom: 8 }}>BONS DISPONIBLES</div>
                      {bonsDisponibles.map(bon => (
                        <div key={bon.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 4, padding: '8px 12px', marginBottom: 6 }}>
                          <div>
                            <span style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{bon.montant}€</span>
                            {bon.code && <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginLeft: 8 }}>{bon.code}</span>}
                          </div>
                          <button onClick={() => setBonASupprimer(bon)} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 16 }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {vouchers.filter(v => v.utilise).length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1, marginBottom: 6 }}>BONS UTILISÉS</div>
                      {vouchers.filter(v => v.utilise).slice(0, 3).map(bon => (
                        <div key={bon.id} style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)', padding: '3px 0', textDecoration: 'line-through' }}>
                          {bon.montant}€ — {bon.code}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Alertes en cours */}
          {(commandesEnCours.length > 0 || factures.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${[commandesEnCours.length > 0, factures.length > 0].filter(Boolean).length}, 1fr)`, gap: 14, marginBottom: 20 }}>
              {commandesEnCours.length > 0 && (
                <div style={{ ...card, border: '0.5px solid rgba(110,158,201,0.3)' }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#6e9ec9', textTransform: 'uppercase' as const, marginBottom: 10 }}>Commandes en cours ({commandesEnCours.length})</div>
                  {commandesEnCours.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                      <span style={{ color: '#e8e0d5' }}>{c.numero || c.id.slice(0, 8)}</span>
                      <span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{parseFloat(c.total_ttc || 0).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
              {factures.length > 0 && (
                <div style={{ ...card, border: '0.5px solid rgba(201,110,110,0.3)' }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#c96e6e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Factures non réglées ({factures.length})</div>
                  {factures.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                      <span style={{ color: '#e8e0d5' }}>{c.numero || c.id.slice(0, 8)}</span>
                      <span style={{ color: '#c96e6e', fontFamily: 'Georgia, serif' }}>{parseFloat(c.total_ttc || 0).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Historique commandes */}
          <div style={card}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 16 }}>Historique des achats</div>
            {commandes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, padding: '24px 0' }}>Aucune commande enregistrée</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {['N°', 'Date', 'Total TTC', 'Statut', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commandes.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < commandes.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{c.numero || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{parseFloat(c.total_ttc || 0).toFixed(2)}€</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: c.statut === 'payée' ? '#1e2a1e' : c.statut === 'annulée' ? '#2a1e1e' : '#1e202a', color: c.statut === 'payée' ? '#6ec96e' : c.statut === 'annulée' ? '#c96e6e' : '#6e9ec9' }}>
                          {c.statut || 'en cours'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>Facture</button>
                          <button style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.2)', color: '#c9a96e', borderRadius: 3, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>+ Caisse</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

          {/* Remise permanente */}
          {client.remise_pct > 0 && (
            <div style={{ ...card, marginBottom: 20, border: '0.5px solid rgba(201,110,201,0.25)' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#c96ec9', textTransform: 'uppercase' as const, marginBottom: 10 }}>Remise permanente</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 32, color: '#c96ec9', fontFamily: 'Georgia, serif', fontWeight: 300 }}>-{client.remise_pct}%</div>
                {client.remise_raison && <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.6)', fontStyle: 'italic' }}>{client.remise_raison}</div>}
              </div>
            </div>
          )}

          {/* Locations tireuses */}
          {reservationsLocation.length > 0 && (
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 16 }}>🍺 Locations tireuse & fûts</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {reservationsLocation.map((r: any) => {
                  const statutColor: Record<string, string> = { devis: '#6e9ec9', confirmée: '#c9a96e', en_cours: '#6ec96e', terminée: '#888', annulée: '#c96e6e' }
                  const SITES: Record<string, string> = { cave_gilbert: 'Cave de Gilbert', petite_cave: 'La Petite Cave', entrepot: 'Entrepôt', livraison: '🚚 Livraison' }
                  return (
                    <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 16px', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#c9a96e' }}>{r.numero}</span>
                          <span style={{ fontSize: 11, color: `${statutColor[r.statut]}`, background: `${statutColor[r.statut]}22`, padding: '2px 8px', borderRadius: 3, marginLeft: 8, textTransform: 'capitalize' as const }}>{r.statut}</span>
                        </div>
                        <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{r.total_ttc?.toFixed(2)}€</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 6 }}>
                        {new Date(r.date_debut).toLocaleDateString('fr-FR')} → {new Date(r.date_fin).toLocaleDateString('fr-FR')}
                        {r.site_retrait && <span style={{ color: '#6ec96e', marginLeft: 8 }}>↓ {SITES[r.site_retrait]}</span>}
                        {r.site_retour && <span style={{ color: '#c9b06e', marginLeft: 8 }}>↑ {SITES[r.site_retour]}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                        {r.reservation_tireuses?.map((rt: any) => (
                          <span key={rt.id} style={{ fontSize: 11, background: 'rgba(201,169,110,0.1)', borderRadius: 3, padding: '2px 8px', color: '#c9a96e' }}>
                            {rt.tireuse?.nom}
                          </span>
                        ))}
                        {r.reservation_futs?.map((rf: any) => (
                          <span key={rf.id} style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '2px 8px', color: 'rgba(232,224,213,0.5)' }}>
                            {rf.quantite}× {rf.fut?.nom_cuvee} {rf.fut?.contenance_litres}L
                          </span>
                        ))}
                      </div>
                      {r.acompte_ttc > 0 && (
                        <div style={{ fontSize: 11, color: '#6ec96e', marginTop: 6 }}>
                          ✓ Acompte {r.acompte_ttc?.toFixed(2)}€ encaissé ({r.acompte_mode})
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Demandes client */}
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const }}>Demandes client ({demandes.length})</div>
              <button onClick={() => setShowNouvelleDemandeForm(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 4, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>+ Nouvelle demande</button>
            </div>

            {showNouvelleDemandeForm && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '16px', marginBottom: 16, border: '0.5px solid rgba(201,169,110,0.15)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Titre / Objet *</label>
                    <input value={nouvelleDemande.titre} onChange={e => setNouvelleDemande(d => ({ ...d, titre: e.target.value }))} placeholder="Ex: Recherche Pommard 2019, Devis 24 bouteilles..." style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Date limite de réponse</label>
                    <input type="date" value={nouvelleDemande.date_limite} onChange={e => setNouvelleDemande(d => ({ ...d, date_limite: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Description</label>
                    <input value={nouvelleDemande.description} onChange={e => setNouvelleDemande(d => ({ ...d, description: e.target.value }))} placeholder="Détails..." style={inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowNouvelleDemandeForm(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '8px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
                  <button disabled={savingDemande || !nouvelleDemande.titre.trim()} onClick={async () => {
                    setSavingDemande(true)
                    await supabase.from('customer_requests').insert({
                      customer_id: client.id,
                      titre: nouvelleDemande.titre,
                      description: nouvelleDemande.description || null,
                      date_limite: nouvelleDemande.date_limite || null,
                      statut: 'en_attente',
                    })
                    setNouvelleDemande({ titre: '', description: '', date_limite: '' })
                    setShowNouvelleDemandeForm(false)
                    setSavingDemande(false)
                    loadData()
                  }} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '8px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                    {savingDemande ? '⟳' : '✓ Enregistrer'}
                  </button>
                </div>
              </div>
            )}

            {demandes.length === 0 && !showNouvelleDemandeForm && (
              <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, padding: '16px 0' }}>Aucune demande enregistrée</div>
            )}

            {demandes.map(d => {
              const isExpired = d.date_limite && new Date(d.date_limite) < new Date() && d.statut === 'en_attente'
              return (
                <div key={d.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 4, marginBottom: 8, border: `0.5px solid ${isExpired ? 'rgba(201,110,110,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#f0e8d8', marginBottom: 4 }}>{d.titre}</div>
                      {d.description && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 4 }}>{d.description}</div>}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {d.date_limite && (
                          <span style={{ fontSize: 11, color: isExpired ? '#c96e6e' : 'rgba(232,224,213,0.4)' }}>
                            {isExpired ? '⚠ ' : '📅 '}Limite : {new Date(d.date_limite).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: d.statut === 'traitée' ? '#1e2a1e' : d.statut === 'annulée' ? '#2a1e1e' : '#1e202a', color: d.statut === 'traitée' ? '#6ec96e' : d.statut === 'annulée' ? '#c96e6e' : '#c9b06e' }}>
                          {d.statut}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {d.statut === 'en_attente' && (
                        <button onClick={async () => {
                          await supabase.from('customer_requests').update({ statut: 'traitée' }).eq('id', d.id)
                          loadData()
                        }} style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', color: '#6ec96e', borderRadius: 3, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>✓ Traiter</button>
                      )}
                      <button onClick={async () => {
                        await supabase.from('customer_requests').delete().eq('id', d.id)
                        loadData()
                      }} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.2)', color: '#c96e6e', borderRadius: 3, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

      {bonASupprimer && (
        <ModalSupprimerBon bon={bonASupprimer} onClose={() => setBonASupprimer(null)} onDeleted={() => { setBonASupprimer(null); loadData() }} />
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function AdminClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'tous' | 'particulier' | 'societe' | 'pro'>('tous')
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [showNouveauClient, setShowNouveauClient] = useState(false)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 100
  const [sortCol, setSortCol] = useState('nom')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [mainTab, setMainTab] = useState<'clients' | 'demandes'>('clients')
  const [allDemandes, setAllDemandes] = useState<any[]>([])
  const [loadingDemandes, setLoadingDemandes] = useState(false)

  const loadClients = useCallback(async () => {
    setLoading(true)
    const from = page * PAGE_SIZE

    if (search.trim()) {
      // Recherche floue via RPC (accents + fautes de frappe)
      const { data, error } = await supabase.rpc('search_customers_fuzzy', {
        search_term: search.trim(),
        p_limit: PAGE_SIZE,
        p_offset: from,
      })
      if (error) {
        // Fallback si la fonction n'existe pas encore
        console.error('RPC error, fallback:', error)
        const s = search.trim()
        const sNorm = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        let q = supabase.from('customers')
          .select('id, prenom, nom, email, telephone, ville, code_postal, adresse, pays, est_societe, raison_sociale, siret, tarif_pro, remise_pct, remise_raison, notes, newsletter, created_at', { count: 'exact' })
          .or(`nom.ilike.%${s}%,prenom.ilike.%${s}%,email.ilike.%${s}%,raison_sociale.ilike.%${s}%,nom.ilike.%${sNorm}%,prenom.ilike.%${sNorm}%`)
          .order(sortCol, { ascending: sortDir === 'asc' }).range(from, from + PAGE_SIZE - 1)
        if (filterType === 'particulier') q = q.eq('est_societe', false)
        else if (filterType === 'societe') q = q.eq('est_societe', true)
        else if (filterType === 'pro') q = q.eq('tarif_pro', true)
        const { data: d2, count } = await q
        setClients(d2 || []); if (count !== null) setTotalCount(count)
      } else {
        let filtered = data || []
        if (filterType === 'particulier') filtered = filtered.filter((c: any) => !c.est_societe)
        else if (filterType === 'societe') filtered = filtered.filter((c: any) => c.est_societe)
        else if (filterType === 'pro') filtered = filtered.filter((c: any) => c.tarif_pro)
        setClients(filtered)
        setTotalCount(filtered.length)
      }
    } else {
      // Sans recherche : requête normale paginée
      let query = supabase
        .from('customers')
        .select('id, prenom, nom, email, telephone, ville, code_postal, adresse, pays, est_societe, raison_sociale, siret, tarif_pro, remise_pct, remise_raison, notes, newsletter, created_at', { count: 'exact' })
        .order(sortCol, { ascending: sortDir === 'asc' })
      if (filterType === 'particulier') query = query.eq('est_societe', false)
      else if (filterType === 'societe') query = query.eq('est_societe', true)
      else if (filterType === 'pro') query = query.eq('tarif_pro', true)
      const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1)
      if (error) console.error('Clients error:', error)
      setClients(data || [])
      if (count !== null) setTotalCount(count)
    }
    setLoading(false)
  }, [page, search, filterType, sortCol, sortDir])

  useEffect(() => { loadClients() }, [loadClients])
  useEffect(() => { setPage(0) }, [search, filterType, sortCol, sortDir])

  const loadAllDemandes = useCallback(async () => {
    setLoadingDemandes(true)
    const { data } = await supabase
      .from('customer_requests')
      .select('*, customer:customers(prenom, nom, raison_sociale, est_societe)')
      .order('date_limite', { ascending: true, nullsFirst: false })
    setAllDemandes(data || [])
    setLoadingDemandes(false)
  }, [])

  useEffect(() => { if (mainTab === 'demandes') loadAllDemandes() }, [mainTab, loadAllDemandes])

  const filtres = clients // Filtres appliqués côté serveur

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <a href="/admin" style={{ display: 'block', marginBottom: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="Cave de Gilbert" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', maxHeight: 52, objectFit: 'contain', cursor: 'pointer' }} />
          </a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>CLIENTS</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          {[
            { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
            { label: 'Produits', href: '/admin', icon: '⬥' },
            { label: 'Commandes', href: '/admin/commandes', icon: '◻' },
            { label: 'Fournisseurs', href: '/admin/fournisseurs', icon: '◈' },
            { label: 'Transferts', href: '/admin/transferts', icon: '⇄' },
            { label: 'Inventaire', href: '/admin/inventaire', icon: '◉' },
            { label: 'Assistant IA', href: '/admin/ia', icon: '✦' },
          ].map(({ label, href, icon }) => (
            <a key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.45)', borderLeft: '2px solid transparent', textDecoration: 'none' }}>
              <span>{icon}</span>{label}
            </a>
          ))}
          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
          <a href="/admin/clients" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: '#c9a96e', borderLeft: '2px solid #c9a96e', textDecoration: 'none', background: 'rgba(201,169,110,0.08)' }}>
            <span>◎</span>Clients
          </a>
        </nav>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>
        {selectedClient ? (
          <FicheClient client={selectedClient} onBack={() => setSelectedClient(null)} onEdit={() => setEditingClient(selectedClient)} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Clients</h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{totalCount} client{totalCount > 1 ? 's' : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {mainTab === 'clients' && (
                  <button onClick={() => setShowNouveauClient(true)} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px 22px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
                    + Nouveau client
                  </button>
                )}
              </div>
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
              {[{ id: 'clients', label: '👥 Clients' }, { id: 'demandes', label: '📋 Demandes' }].map(tab => (
                <button key={tab.id} onClick={() => setMainTab(tab.id as any)} style={{
                  background: mainTab === tab.id ? 'rgba(201,169,110,0.15)' : 'transparent',
                  border: 'none', borderRight: tab.id === 'clients' ? '0.5px solid rgba(255,255,255,0.08)' : 'none',
                  color: mainTab === tab.id ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                  padding: '9px 20px', fontSize: 12, cursor: 'pointer',
                }}>{tab.label}{tab.id === 'demandes' && allDemandes.filter(d => d.statut === 'en_attente').length > 0 && <span style={{ marginLeft: 6, background: '#c96e6e', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{allDemandes.filter(d => d.statut === 'en_attente').length}</span>}</button>
              ))}
            </div>

            {mainTab === 'demandes' && (
              <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                {loadingDemandes ? <div style={{ padding: 48, textAlign: 'center' as const, color: 'rgba(232,224,213,0.3)' }}>Chargement...</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                        {['Client', 'Demande', 'Date limite', 'Statut', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allDemandes.map((d, i) => {
                        const isExpired = d.date_limite && new Date(d.date_limite) < new Date() && d.statut === 'en_attente'
                        const clientNom = d.customer?.est_societe ? (d.customer?.raison_sociale || `${d.customer?.prenom} ${d.customer?.nom}`) : `${d.customer?.prenom || ''} ${d.customer?.nom || ''}`
                        return (
                          <tr key={d.id} style={{ borderBottom: i < allDemandes.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', background: isExpired ? 'rgba(201,110,110,0.04)' : 'transparent' }}>
                            <td style={{ padding: '11px 14px' }}>
                              <button onClick={async () => {
                                const { data: c } = await supabase.from('customers').select('*').eq('id', d.customer_id).single()
                                if (c) setSelectedClient(c)
                              }} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(201,169,110,0.3)', padding: 0 }}>
                                {clientNom}
                              </button>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ fontSize: 13, color: '#f0e8d8' }}>{d.titre}</div>
                              {d.description && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{d.description}</div>}
                            </td>
                            <td style={{ padding: '11px 14px', fontSize: 12, color: isExpired ? '#c96e6e' : 'rgba(232,224,213,0.5)', whiteSpace: 'nowrap' as const }}>
                              {d.date_limite ? `${isExpired ? '⚠ ' : ''}${new Date(d.date_limite).toLocaleDateString('fr-FR')}` : '—'}
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: d.statut === 'traitée' ? '#1e2a1e' : d.statut === 'annulée' ? '#2a1e1e' : '#1e202a', color: d.statut === 'traitée' ? '#6ec96e' : d.statut === 'annulée' ? '#c96e6e' : '#c9b06e' }}>
                                {d.statut}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              {d.statut === 'en_attente' && (
                                <button onClick={async () => {
                                  await supabase.from('customer_requests').update({ statut: 'traitée' }).eq('id', d.id)
                                  loadAllDemandes()
                                }} style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', color: '#6ec96e', borderRadius: 3, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>✓ Traiter</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {allDemandes.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center' as const, color: 'rgba(232,224,213,0.3)' }}>Aucune demande enregistrée</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {mainTab === 'clients' && (<>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
              <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 200px', ...inp, boxSizing: 'border-box' as const }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'tous', label: 'Tous' },
                  { key: 'particulier', label: 'Particuliers' },
                  { key: 'societe', label: 'Sociétés' },
                  { key: 'pro', label: 'Tarif pro' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setFilterType(key as any)} style={{
                    background: filterType === key ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `0.5px solid ${filterType === key ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: filterType === key ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                    borderRadius: 20, padding: '6px 14px', fontSize: 11, cursor: 'pointer',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {loading ? <Spinner /> : (
              <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                      {[
                        { label: 'Client', col: 'nom' },
                        { label: 'Type', col: 'est_societe' },
                        { label: 'Email', col: 'email' },
                        { label: 'Téléphone', col: 'telephone' },
                        { label: 'Ville', col: 'ville' },
                        { label: 'Tarif', col: 'tarif_pro' },
                        { label: '', col: null },
                      ].map(({ label, col }) => (
                        <th key={label} onClick={() => {
                          if (!col) return
                          if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                          else { setSortCol(col); setSortDir('asc') }
                          setPage(0)
                        }} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: sortCol === col ? '#c9a96e' : 'rgba(232,224,213,0.3)', fontWeight: 400, cursor: col ? 'pointer' : 'default', userSelect: 'none' as const, whiteSpace: 'nowrap' as const }}>
                          {label}{col && sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : col ? ' ↕' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.map((c, i) => (
                      <tr key={c.id} onClick={() => setSelectedClient(c)} style={{ borderBottom: i < filtres.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, color: '#f0e8d8' }}>{c.est_societe ? (c.raison_sociale || `${c.prenom} ${c.nom}`) : `${c.prenom || ''} ${c.nom}`.trim()}</div>
                          {c.est_societe && c.prenom && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{c.prenom} {c.nom}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {c.est_societe ? <Badge label="Société" bg="#1e202a" color="#6e9ec9" /> : <Badge label="Particulier" bg="rgba(255,255,255,0.05)" color="rgba(232,224,213,0.5)" />}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{c.email || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{c.telephone || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{c.ville || '—'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {c.tarif_pro ? <Badge label="Pro" bg="#2a2a1e" color="#c9b06e" /> : <Badge label="TTC" bg="#1e2a1e" color="#6ec96e" />}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button onClick={e => { e.stopPropagation(); setEditingClient(c) }} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtres.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center' as const, color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucun client trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

              {/* Pagination */}
              {totalCount > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} sur {totalCount} clients
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: page === 0 ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: page === 0 ? 'default' : 'pointer' }}>← Précédent</button>
                  <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', padding: '6px 10px' }}>Page {page + 1} / {Math.ceil(totalCount / PAGE_SIZE)}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: (page + 1) * PAGE_SIZE >= totalCount ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: (page + 1) * PAGE_SIZE >= totalCount ? 'default' : 'pointer' }}>Suivant →</button>
                </div>
              </div>
            )}
            </>)}
          </>
        )}
      </main>

      {showNouveauClient && <ModalClient onClose={() => setShowNouveauClient(false)} onSaved={() => { loadClients(); setShowNouveauClient(false) }} />}
      {editingClient && <ModalClient client={editingClient} onClose={() => setEditingClient(null)} onSaved={async () => {
        await loadClients()
        // Refresh selectedClient if it's the one being edited
        if (selectedClient?.id === editingClient.id) {
          const { data } = await supabase.from('customers').select('id, prenom, nom, email, telephone, ville, code_postal, adresse, pays, est_societe, raison_sociale, siret, tarif_pro, remise_pct, remise_raison, notes, newsletter, created_at').eq('id', editingClient.id).single()
          if (data) setSelectedClient(data)
        }
        setEditingClient(null)
      }} />}
    </div>
  )
}