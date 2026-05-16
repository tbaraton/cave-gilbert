'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../AuthContext'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

type Onglet = 'profil' | 'commandes' | 'adresses' | 'alertes' | 'securite'

const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '—'
const fmtDateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtMontant = (n: number) => `${n.toFixed(2)} €`

export default function ComptePage() {
  const { user, isPro, loading, signOut, refresh } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('profil')

  if (loading) return <div style={loadingScreen}>⟳ Chargement…</div>
  if (!user) return (
    <div style={loadingScreen}>
      <div>Tu dois être connecté pour accéder à ton compte.</div>
      <a href="/boutique" style={{ color: '#8a6a3e', marginTop: 12 }}>← Retour à la boutique</a>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 60px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 300, color: '#0a0a0a', marginBottom: 6 }}>Mon compte</h1>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)' }}>
          {user.prenom ? `${user.prenom} ${user.nom || ''}` : user.email}
          {isPro && <span style={{ marginLeft: 8, fontSize: 9, background: '#8a6a3e', color: '#fff', padding: '2px 8px', borderRadius: 2, letterSpacing: 0.5, fontWeight: 600, verticalAlign: 'middle' }}>PRO</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
        {/* Sidebar onglets */}
        <aside>
          <nav style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            {[
              { id: 'profil' as Onglet, icon: '👤', label: 'Profil' },
              { id: 'commandes' as Onglet, icon: '📦', label: 'Mes commandes' },
              { id: 'adresses' as Onglet, icon: '🏠', label: 'Adresses' },
              { id: 'alertes' as Onglet, icon: '🔔', label: 'Alertes stock' },
              { id: 'securite' as Onglet, icon: '🔐', label: 'Sécurité' },
            ].map(t => (
              <button key={t.id} onClick={() => setOnglet(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                fontSize: 13, color: onglet === t.id ? '#8a6a3e' : 'rgba(0,0,0,0.65)',
                background: onglet === t.id ? 'rgba(138,106,62,0.06)' : 'transparent',
                border: 'none', borderLeft: `3px solid ${onglet === t.id ? '#8a6a3e' : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.15s',
                fontWeight: onglet === t.id ? 600 : 400,
              }}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
            <button onClick={() => signOut()} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
              fontSize: 13, color: '#a04444', background: 'transparent', border: 'none',
              borderTop: '0.5px solid rgba(0,0,0,0.06)', borderLeft: '3px solid transparent',
              cursor: 'pointer', textAlign: 'left' as const,
            }}>
              <span>↩</span>Se déconnecter
            </button>
          </nav>
        </aside>

        {/* Contenu */}
        <main>
          {onglet === 'profil' && <OngletProfil user={user} onUpdated={refresh} />}
          {onglet === 'commandes' && <OngletCommandes customerId={user.id} />}
          {onglet === 'adresses' && <OngletAdresses user={user} onUpdated={refresh} />}
          {onglet === 'alertes' && <OngletAlertes email={user.email} />}
          {onglet === 'securite' && <OngletSecurite email={user.email} />}
        </main>
      </div>
    </div>
  )
}

// ─── Profil ──────────────────────────────────────────────────
function OngletProfil({ user, onUpdated }: { user: any; onUpdated: () => void }) {
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('customers').select('*').eq('email', user.email).maybeSingle()
      setForm(data || { email: user.email })
    })()
  }, [user.email])

  if (!form) return <div style={empty}>⟳ Chargement…</div>

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMsg(''); setErr('')
    const { error } = await supabase.from('customers').update({
      civilite: form.civilite || null,
      prenom: form.prenom || null,
      nom: form.nom || null,
      raison_sociale: form.raison_sociale || null,
      siret: form.siret || null,
      telephone: form.telephone || null,
      newsletter: !!form.newsletter,
    }).eq('email', user.email)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setMsg('✓ Profil mis à jour')
    onUpdated()
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <section style={card}>
      <h2 style={cardTitle}>Profil</h2>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
        <Field label="Civilité">
          <select value={form.civilite || 'M'} onChange={e => setForm({ ...form, civilite: e.target.value })} style={inp}>
            <option value="M">M.</option>
            <option value="Mme">Mme</option>
            <option value="Autre">Autre</option>
          </select>
        </Field>
        <Field label="Prénom"><input value={form.prenom || ''} onChange={e => setForm({ ...form, prenom: e.target.value })} style={inp} /></Field>
        <Field label="Nom"><input value={form.nom || ''} onChange={e => setForm({ ...form, nom: e.target.value })} style={inp} /></Field>
        {form.est_societe && <>
          <Field label="Raison sociale"><input value={form.raison_sociale || ''} onChange={e => setForm({ ...form, raison_sociale: e.target.value })} style={inp} /></Field>
          <Field label="SIRET"><input value={form.siret || ''} onChange={e => setForm({ ...form, siret: e.target.value.replace(/\D/g, '').slice(0, 14) })} pattern="[0-9]{14}" style={inp} /></Field>
        </>}
        <Field label="Email"><input value={form.email} disabled style={{ ...inp, background: '#f5f5f5', color: 'rgba(0,0,0,0.5)' }} /></Field>
        <Field label="Téléphone"><input type="tel" value={form.telephone || ''} onChange={e => setForm({ ...form, telephone: e.target.value })} style={inp} /></Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(0,0,0,0.7)', cursor: 'pointer', marginTop: 4 }}>
          <input type="checkbox" checked={!!form.newsletter} onChange={e => setForm({ ...form, newsletter: e.target.checked })} style={{ accentColor: '#8a6a3e' }} />
          Je souhaite recevoir la newsletter
        </label>

        {msg && <div style={msgOk}>{msg}</div>}
        {err && <div style={msgErr}>{err}</div>}
        <button type="submit" disabled={saving} style={btnPrimary}>{saving ? '⟳' : 'Enregistrer'}</button>
      </form>
    </section>
  )
}

// ─── Commandes ───────────────────────────────────────────────
function OngletCommandes({ customerId }: { customerId: string }) {
  const [ventes, setVentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      if (!customerId) { setLoading(false); return }
      const { data } = await supabase.from('ventes')
        .select('id, numero, type_doc, created_at, total_ttc, statut, statut_paiement')
        .eq('customer_id', customerId)
        .eq('statut', 'validee')
        .order('created_at', { ascending: false })
        .limit(200)
      setVentes(data || [])
      setLoading(false)
    })()
  }, [customerId])

  return (
    <section style={card}>
      <h2 style={cardTitle}>Mes commandes</h2>
      {loading ? <div style={empty}>⟳ Chargement…</div>
        : ventes.length === 0 ? <div style={empty}>Aucune commande pour le moment.</div>
        : (
        <table style={tbl}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
              {['Date', 'N°', 'Type', 'Montant', 'Statut'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {ventes.map((v, i) => (
              <tr key={v.id} style={{ borderBottom: i < ventes.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none' }}>
                <td style={td}>{fmtDate(v.created_at)}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{v.numero}</td>
                <td style={{ ...td, textTransform: 'capitalize' as const }}>{v.type_doc}</td>
                <td style={{ ...td, fontFamily: 'Georgia, serif', color: '#8a6a3e' }}>{fmtMontant(parseFloat(v.total_ttc))}</td>
                <td style={td}>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 2, background: v.statut_paiement === 'regle' ? 'rgba(42,138,42,0.1)' : 'rgba(201,176,110,0.15)', color: v.statut_paiement === 'regle' ? '#2a8a2a' : '#8a6a3e' }}>
                    {v.statut_paiement === 'regle' ? '✓ Réglée' : 'À régler'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// ─── Adresses ────────────────────────────────────────────────
function OngletAdresses({ user, onUpdated }: { user: any; onUpdated: () => void }) {
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [memeAdresse, setMemeAdresse] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('customers').select('*').eq('email', user.email).maybeSingle()
      setForm(data || {})
      // Si pas d'adresse facturation distincte, on coche "même adresse"
      setMemeAdresse(!data?.adresse_facturation)
    })()
  }, [user.email])

  if (!form) return <div style={empty}>⟳ Chargement…</div>

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMsg('')
    const payload: any = {
      adresse: form.adresse || null,
      code_postal: form.code_postal || null,
      ville: form.ville || null,
      pays: form.pays || 'France',
    }
    if (memeAdresse) {
      payload.adresse_facturation = null
      payload.code_postal_facturation = null
      payload.ville_facturation = null
      payload.pays_facturation = null
    } else {
      payload.adresse_facturation = form.adresse_facturation || null
      payload.code_postal_facturation = form.code_postal_facturation || null
      payload.ville_facturation = form.ville_facturation || null
      payload.pays_facturation = form.pays_facturation || 'France'
    }
    const { error } = await supabase.from('customers').update(payload).eq('email', user.email)
    setSaving(false)
    if (error) { setMsg('Erreur : ' + error.message); return }
    setMsg('✓ Adresses mises à jour')
    onUpdated()
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <section style={card}>
      <h2 style={cardTitle}>Adresses</h2>
      <form onSubmit={handleSave}>
        <h3 style={subTitle}>📦 Adresse de livraison</h3>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12, marginBottom: 24 }}>
          <Field label="Adresse"><input value={form.adresse || ''} onChange={e => setForm({ ...form, adresse: e.target.value })} placeholder="3 rue Peillon" style={inp} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <Field label="Code postal"><input value={form.code_postal || ''} onChange={e => setForm({ ...form, code_postal: e.target.value })} placeholder="69210" style={inp} /></Field>
            <Field label="Ville"><input value={form.ville || ''} onChange={e => setForm({ ...form, ville: e.target.value })} placeholder="L'Arbresle" style={inp} /></Field>
          </div>
          <Field label="Pays"><input value={form.pays || 'France'} onChange={e => setForm({ ...form, pays: e.target.value })} style={inp} /></Field>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(0,0,0,0.7)', cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={memeAdresse} onChange={e => setMemeAdresse(e.target.checked)} style={{ accentColor: '#8a6a3e' }} />
          Adresse de facturation identique à la livraison
        </label>

        {!memeAdresse && (
          <>
            <h3 style={subTitle}>🧾 Adresse de facturation</h3>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12, marginBottom: 16 }}>
              <Field label="Adresse"><input value={form.adresse_facturation || ''} onChange={e => setForm({ ...form, adresse_facturation: e.target.value })} style={inp} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <Field label="Code postal"><input value={form.code_postal_facturation || ''} onChange={e => setForm({ ...form, code_postal_facturation: e.target.value })} style={inp} /></Field>
                <Field label="Ville"><input value={form.ville_facturation || ''} onChange={e => setForm({ ...form, ville_facturation: e.target.value })} style={inp} /></Field>
              </div>
              <Field label="Pays"><input value={form.pays_facturation || 'France'} onChange={e => setForm({ ...form, pays_facturation: e.target.value })} style={inp} /></Field>
            </div>
          </>
        )}

        {msg && <div style={msg.startsWith('Erreur') ? msgErr : msgOk}>{msg}</div>}
        <button type="submit" disabled={saving} style={btnPrimary}>{saving ? '⟳' : 'Enregistrer'}</button>
      </form>
    </section>
  )
}

// ─── Alertes stock ────────────────────────────────────────────
function OngletAlertes({ email }: { email: string }) {
  const [alertes, setAlertes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('stock_alerts')
      .select('id, created_at, notified_at, product:products(id, nom, slug, image_url, prix_vente_ttc, couleur)')
      .eq('email', email)
      .order('created_at', { ascending: false })
    setAlertes(data || [])
    setLoading(false)
  }, [email])

  useEffect(() => { load() }, [load])

  const handleSupprimer = async (id: string) => {
    if (!confirm('Annuler cette alerte ?')) return
    await supabase.from('stock_alerts').delete().eq('id', id)
    load()
  }

  return (
    <section style={card}>
      <h2 style={cardTitle}>Mes alertes stock</h2>
      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', marginBottom: 16 }}>
        Tu es notifié(e) par email quand un de ces produits revient en stock.
      </div>
      {loading ? <div style={empty}>⟳ Chargement…</div>
        : alertes.length === 0 ? <div style={empty}>Aucune alerte. Pour t'inscrire, va sur une fiche produit en rupture et clique « Me prévenir ».</div>
        : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {alertes.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: '#fbfaf6', borderRadius: 4, border: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ width: 48, height: 64, background: '#fff', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {a.product?.image_url ? <img src={a.product.image_url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' as const }} /> : <span style={{ fontSize: 20 }}>🍷</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/boutique/${a.product?.slug}`} style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#0a0a0a', textDecoration: 'none' }}>
                  {a.product?.nom || '(produit supprimé)'}
                </a>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 3 }}>
                  Inscrit le {fmtDateTime(a.created_at)}
                  {a.notified_at && <span style={{ marginLeft: 8, color: '#2a8a2a' }}>· ✓ Notifié le {fmtDate(a.notified_at)}</span>}
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#8a6a3e', fontFamily: 'Georgia, serif' }}>{a.product?.prix_vente_ttc?.toFixed(2)}€</div>
              <button onClick={() => handleSupprimer(a.id)} title="Annuler l'alerte" style={{ background: 'transparent', border: '0.5px solid rgba(160,68,68,0.3)', color: '#a04444', borderRadius: 3, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Sécurité ─────────────────────────────────────────────────
function OngletSecurite({ email }: { email: string }) {
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(''); setErr('')
    if (pwd.length < 8) { setErr('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (pwd !== pwd2) { setErr('Les deux mots de passe ne correspondent pas.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setMsg('✓ Mot de passe modifié')
    setPwd(''); setPwd2('')
    setTimeout(() => setMsg(''), 3000)
  }

  const handleReset = async () => {
    if (!confirm(`Envoyer un email de réinitialisation à ${email} ?`)) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) setErr(error.message)
    else setMsg('Email de réinitialisation envoyé')
  }

  return (
    <section style={card}>
      <h2 style={cardTitle}>Sécurité</h2>
      <form onSubmit={handleChange} style={{ display: 'flex', flexDirection: 'column' as const, gap: 12, marginBottom: 28 }}>
        <h3 style={subTitle}>Changer mon mot de passe</h3>
        <Field label="Nouveau mot de passe"><input type="password" value={pwd} onChange={e => setPwd(e.target.value)} minLength={8} placeholder="8 caractères minimum" autoComplete="new-password" style={inp} /></Field>
        <Field label="Confirmer le nouveau mot de passe"><input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} minLength={8} autoComplete="new-password" style={inp} /></Field>
        {msg && <div style={msgOk}>{msg}</div>}
        {err && <div style={msgErr}>{err}</div>}
        <button type="submit" disabled={saving || !pwd} style={btnPrimary}>{saving ? '⟳' : 'Modifier'}</button>
      </form>

      <div style={{ paddingTop: 20, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <h3 style={subTitle}>Mot de passe oublié</h3>
        <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', marginBottom: 10 }}>
          Reçois un lien de réinitialisation par email.
        </p>
        <button onClick={handleReset} style={btnGhost}>📧 M'envoyer un lien de réinitialisation</button>
      </div>
    </section>
  )
}

// ─── Helpers UI ──────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}

const loadingScreen: any = { minHeight: 'calc(100vh - 64px)', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.6)', flexDirection: 'column' as const, gap: 12, padding: 32 }
const card: any = { background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 6, padding: '28px 32px' }
const cardTitle: any = { fontFamily: 'Georgia, serif', fontSize: 20, color: '#0a0a0a', fontWeight: 300, marginBottom: 18, marginTop: 0 }
const subTitle: any = { fontSize: 12, color: '#8a6a3e', textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 0, marginBottom: 14, fontWeight: 600 }
const inp: any = { width: '100%', background: '#fbfaf6', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 3, padding: '10px 14px', fontSize: 13, color: '#1a1a1a', boxSizing: 'border-box' as const, outline: 'none', fontFamily: "'DM Sans', system-ui, sans-serif" }
const btnPrimary: any = { background: '#8a6a3e', color: '#fff', border: 'none', padding: '12px 24px', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' as const, cursor: 'pointer', borderRadius: 3, fontWeight: 600, alignSelf: 'flex-start' as const }
const btnGhost: any = { background: 'transparent', color: '#8a6a3e', border: '0.5px solid rgba(138,106,62,0.4)', padding: '10px 18px', fontSize: 12, cursor: 'pointer', borderRadius: 3 }
const empty: any = { padding: 40, textAlign: 'center' as const, color: 'rgba(0,0,0,0.45)', fontSize: 13 }
const tbl: any = { width: '100%', borderCollapse: 'collapse' as const }
const th: any = { padding: '10px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.45)', fontWeight: 400, textTransform: 'uppercase' as const }
const td: any = { padding: '12px', fontSize: 12, color: '#1a1a1a' }
const msgOk: any = { fontSize: 12, color: '#2a8a2a', padding: '8px 12px', background: 'rgba(42,138,42,0.08)', borderRadius: 3 }
const msgErr: any = { fontSize: 12, color: '#a04444', padding: '8px 12px', background: 'rgba(160,68,68,0.06)', borderRadius: 3 }
