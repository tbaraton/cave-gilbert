'use client'

import { CartProvider, useCart, FRANCO_PORT, FRAIS_PORT } from './CartContext'
import { AuthProvider, useAuth } from './AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ── Recherche typeahead ──────────────────────────────────────
function SearchTypeahead() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('products')
        .select('id, nom, millesime, couleur, prix_vente_ttc, image_url, slug, domaine:domaines(nom)')
        .eq('actif', true)
        .eq('visible_boutique', true)
        .ilike('nom', `%${q.trim()}%`)
        .limit(8)
      setResults(data || [])
      setOpen(true)
      setLoading(false)
    }, 200)
    return () => clearTimeout(timer.current)
  }, [q])

  return (
    <div ref={containerRef} style={{ flex: 1, maxWidth: 420, position: 'relative' as const, margin: '0 24px' }}>
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder="🔍 Rechercher un vin, un domaine…"
        style={{
          width: '100%', background: 'rgba(0,0,0,0.04)', border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: 999, color: '#1a1a1a', fontSize: 13, padding: '10px 18px',
          outline: 'none', transition: 'border-color 0.2s, background 0.2s',
        }}
        onFocusCapture={e => { e.currentTarget.style.borderColor = '#8a6a3e'; e.currentTarget.style.background = '#fff' }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
      />
      {open && (
        <div style={{
          position: 'absolute' as const, top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 6,
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)', maxHeight: 420, overflowY: 'auto' as const, zIndex: 100,
        }}>
          {loading ? (
            <div style={{ padding: 20, fontSize: 12, color: 'rgba(0,0,0,0.4)', textAlign: 'center' as const }}>⟳ Recherche…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 20, fontSize: 12, color: 'rgba(0,0,0,0.4)', textAlign: 'center' as const }}>Aucun résultat pour « {q} »</div>
          ) : (
            results.map((p: any) => (
              <Link key={p.id} href={`/boutique/${p.slug}`} onClick={() => { setOpen(false); setQ('') }} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                textDecoration: 'none', color: '#1a1a1a', borderBottom: '0.5px solid rgba(0,0,0,0.05)',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 36, height: 48, background: '#fbfaf6', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {p.image_url ? <img src={p.image_url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' as const }} /> : <span style={{ fontSize: 18 }}>🍷</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#0a0a0a', fontFamily: 'Georgia, serif', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                    {p.nom}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)' }}>
                    {p.domaine?.nom || ''}{p.millesime ? ` · ${p.millesime}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#8a6a3e', fontFamily: 'Georgia, serif' }}>
                  {p.prix_vente_ttc?.toFixed(2)}€
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Cart Drawer ───────────────────────────────────────────────
function CartDrawer() {
  const { items, totalItems, totalTTC, fraisPort, totalAvecPort, removeItem, updateQuantite, isOpen, closeCart } = useCart()
  const manquePourFranco = Math.max(0, FRANCO_PORT - totalTTC)

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={closeCart}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 900, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: '#100d0a', borderLeft: '0.5px solid rgba(201,169,110,0.2)',
        zIndex: 901, display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.07)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>
              Votre panier
            </div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>
              {totalItems} article{totalItems > 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={closeCart} style={{
            background: 'transparent', border: 'none',
            color: 'rgba(232,224,213,0.4)', fontSize: 24, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Franco de port */}
        {manquePourFranco > 0 && totalItems > 0 && (
          <div style={{
            padding: '10px 24px', background: 'rgba(201,169,110,0.06)',
            borderBottom: '0.5px solid rgba(201,169,110,0.15)',
            fontSize: 12, color: '#c9a96e',
          }}>
            Plus que <strong>{manquePourFranco.toFixed(2)} €</strong> pour la livraison offerte
            <div style={{
              marginTop: 6, height: 2, background: 'rgba(201,169,110,0.15)',
              borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', background: '#c9a96e', borderRadius: 2,
                width: `${Math.min(100, (totalTTC / FRANCO_PORT) * 100)}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
        {fraisPort === 0 && totalItems > 0 && (
          <div style={{
            padding: '10px 24px', background: 'rgba(110,201,110,0.06)',
            borderBottom: '0.5px solid rgba(110,201,110,0.15)',
            fontSize: 12, color: '#6ec96e',
          }}>
            ✓ Livraison offerte
          </div>
        )}

        {/* Lignes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(232,224,213,0.3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
              <div style={{ fontSize: 15 }}>Votre panier est vide</div>
              <button onClick={closeCart} style={{
                marginTop: 20, background: 'transparent',
                border: '0.5px solid rgba(201,169,110,0.4)',
                color: '#c9a96e', borderRadius: 6, padding: '10px 20px',
                fontSize: 13, cursor: 'pointer',
              }}>
                Découvrir nos vins →
              </button>
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{
              display: 'flex', gap: 14, paddingBottom: 16, marginBottom: 16,
              borderBottom: '0.5px solid rgba(255,255,255,0.05)',
            }}>
              {/* Image */}
              <div style={{
                width: 52, height: 52, background: '#18130e', borderRadius: 6,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '0.5px solid rgba(255,255,255,0.07)',
              }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                  : <span style={{ fontSize: 22 }}>🍷</span>
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.nom}{item.millesime ? ` ${item.millesime}` : ''}
                </div>
                <div style={{ fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif', marginBottom: 8 }}>
                  {item.prix_unitaire_ttc.toFixed(2)} €
                </div>
                {/* Quantité */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateQuantite(item.id, item.quantite - 1)}
                    style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4, color: '#e8e0d5', fontSize: 16, cursor: 'pointer' }}>
                    −
                  </button>
                  <span style={{ fontSize: 15, color: '#f0e8d8', minWidth: 20, textAlign: 'center' }}>
                    {item.quantite}
                  </span>
                  <button onClick={() => updateQuantite(item.id, item.quantite + 1)}
                    disabled={item.quantite >= item.stock_total}
                    style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4, color: '#e8e0d5', fontSize: 16, cursor: item.quantite >= item.stock_total ? 'not-allowed' : 'pointer', opacity: item.quantite >= item.stock_total ? 0.4 : 1 }}>
                    +
                  </button>
                  <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginLeft: 4 }}>
                    = {(item.prix_unitaire_ttc * item.quantite).toFixed(2)} €
                  </span>
                </div>
              </div>

              {/* Supprimer */}
              <button onClick={() => removeItem(item.id)} style={{
                background: 'transparent', border: 'none',
                color: 'rgba(201,110,110,0.5)', fontSize: 18, cursor: 'pointer',
                alignSelf: 'flex-start', padding: 4,
              }}>✕</button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '20px 24px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
            {/* Récap */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 6 }}>
                <span>Sous-total</span>
                <span>{totalTTC.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: fraisPort === 0 ? '#6ec96e' : 'rgba(232,224,213,0.5)', marginBottom: 6 }}>
                <span>Livraison</span>
                <span>{fraisPort === 0 ? 'Offerte' : `${FRAIS_PORT.toFixed(2)} €`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 600, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                <span>Total</span>
                <span>{totalAvecPort.toFixed(2)} €</span>
              </div>
            </div>

            <Link href="/boutique/checkout" onClick={closeCart} style={{
              display: 'block', width: '100%', background: '#c9a96e',
              color: '#0d0a08', textAlign: 'center', textDecoration: 'none',
              borderRadius: 8, padding: '16px', fontSize: 15,
              fontWeight: 700, letterSpacing: 0.5,
            }}>
              Commander →
            </Link>

            <button onClick={closeCart} style={{
              display: 'block', width: '100%', marginTop: 10,
              background: 'transparent', border: 'none',
              color: 'rgba(232,224,213,0.4)', fontSize: 13, cursor: 'pointer',
              padding: '8px',
            }}>
              Continuer mes achats
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Nav ───────────────────────────────────────────────────────
// ── Modal Login / Inscription ────────────────────────────────
function LoginModal({ onClose }: { onClose: () => void }) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Signup
  const [civilite, setCivilite] = useState<'M' | 'Mme' | 'Autre'>('M')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [typeCompte, setTypeCompte] = useState<'particulier' | 'pro'>('particulier')
  const [raisonSociale, setRaisonSociale] = useState('')
  const [siret, setSiret] = useState('')
  const [accepteCgv, setAccepteCgv] = useState(false)
  const [certifieMajeur, setCertifieMajeur] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setErr(''); setMsg('')
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) { setErr(error); return }
        onClose()
      } else {
        if (!certifieMajeur) { setErr('Tu dois certifier avoir 18 ans ou plus pour acheter de l\'alcool.'); return }
        if (!accepteCgv) { setErr('Tu dois accepter les CGV pour t\'inscrire.'); return }
        if (typeCompte === 'pro' && !raisonSociale.trim()) { setErr('La raison sociale est requise pour un compte pro.'); return }
        const { error, needsValidation } = await signUp({
          email, password, civilite, prenom, nom, telephone, type_compte: typeCompte,
          raison_sociale: raisonSociale, siret, newsletter,
        })
        if (error) { setErr(error); return }
        if (needsValidation) {
          setMsg('Compte créé ! Un email de confirmation t\'a été envoyé. Tu pourras ensuite te connecter. L\'accès aux tarifs et stocks pros nécessite une validation par notre équipe.')
        } else {
          setMsg('Compte créé ! Un email de confirmation t\'a été envoyé. Tu peux te connecter.')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' as const }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 6, padding: '28px 32px', maxWidth: 460, width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' as const }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0a0a0a', marginBottom: 6 }}>
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 18 }}>
          {mode === 'login' ? 'Accède à ton compte et tes commandes.' : 'Quelques infos pour mieux te servir.'}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              {/* Type de compte */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: 3, background: '#fbfaf6', borderRadius: 3, border: '0.5px solid rgba(0,0,0,0.08)' }}>
                {[
                  { v: 'particulier', l: 'Particulier' },
                  { v: 'pro', l: 'Professionnel' },
                ].map(({ v, l }) => (
                  <button type="button" key={v} onClick={() => setTypeCompte(v as any)} style={{
                    flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 600,
                    background: typeCompte === v ? '#8a6a3e' : 'transparent',
                    color: typeCompte === v ? '#fff' : 'rgba(0,0,0,0.5)',
                    border: 'none', borderRadius: 3, cursor: 'pointer', letterSpacing: 0.5,
                  }}>{l}</button>
                ))}
              </div>

              {/* Civilité + Prénom + Nom */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <select value={civilite} onChange={e => setCivilite(e.target.value as any)} style={loginInput}>
                  <option value="M">M.</option>
                  <option value="Mme">Mme</option>
                  <option value="Autre">Autre</option>
                </select>
                <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom" required style={loginInput} />
                <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom" required style={loginInput} />
              </div>

              {/* Champs pros */}
              {typeCompte === 'pro' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
                  <input value={raisonSociale} onChange={e => setRaisonSociale(e.target.value)} placeholder="Raison sociale" required style={loginInput} />
                  <input value={siret} onChange={e => setSiret(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="SIRET (14 chiffres)" pattern="[0-9]{14}" style={loginInput} />
                </div>
              )}

              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="Téléphone (optionnel)" style={{ ...loginInput, marginBottom: 10 }} />
            </>
          )}

          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required autoComplete="email" style={{ ...loginInput, marginBottom: 10 }} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Mot de passe (8+ caractères)' : 'Mot de passe'} required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} style={{ ...loginInput, marginBottom: 14 }} />

          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <Checkbox checked={certifieMajeur} onChange={setCertifieMajeur} label="Je certifie avoir 18 ans ou plus (vente d'alcool, art. L.3342-1 CSP)" />
              <Checkbox checked={accepteCgv} onChange={setAccepteCgv} label={<span>J'accepte les <a href="/boutique/cgv" target="_blank" style={{ color: '#8a6a3e' }}>conditions générales</a> et la politique de confidentialité</span>} />
              <Checkbox checked={newsletter} onChange={setNewsletter} label="Je souhaite recevoir la newsletter (sélections, événements, promotions)" />
            </div>
          )}

          {err && <div style={{ fontSize: 12, color: '#a04444', marginBottom: 12, padding: '8px 12px', background: 'rgba(160,68,68,0.06)', borderRadius: 3 }}>{err}</div>}
          {msg && <div style={{ fontSize: 12, color: '#2a8a2a', marginBottom: 12, padding: '10px 12px', background: 'rgba(42,138,42,0.08)', borderRadius: 3, lineHeight: 1.5 }}>{msg}</div>}

          <button type="submit" disabled={loading} style={{
            width: '100%', background: loading ? '#ccc' : '#8a6a3e', color: '#fff', border: 'none',
            padding: '12px', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' as const,
            cursor: loading ? 'wait' : 'pointer', borderRadius: 3, fontWeight: 600,
          }}>
            {loading ? '⟳' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(0,0,0,0.55)', textAlign: 'center' as const }}>
          {mode === 'login' ? (
            <>Pas encore inscrit ? <button onClick={() => { setMode('signup'); setErr(''); setMsg('') }} style={{ background: 'transparent', border: 'none', color: '#8a6a3e', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>Créer un compte</button></>
          ) : (
            <>Déjà un compte ? <button onClick={() => { setMode('login'); setErr(''); setMsg('') }} style={{ background: 'transparent', border: 'none', color: '#8a6a3e', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>Se connecter</button></>
          )}
        </div>
      </div>
    </div>
  )
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 8, fontSize: 11, color: 'rgba(0,0,0,0.7)', lineHeight: 1.5 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, accentColor: '#8a6a3e', flexShrink: 0 }} />
      <span>{label}</span>
    </label>
  )
}

const loginInput: any = { width: '100%', background: '#fbfaf6', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 3, padding: '10px 14px', fontSize: 13, color: '#1a1a1a', boxSizing: 'border-box' as const, outline: 'none' }

// ── Bouton compte (login / mon compte / déconnexion) ─────────
function AccountButton() {
  const { user, isPro, signOut, loading } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  if (loading) return null

  if (!user) {
    return (
      <>
        <button onClick={() => setShowLogin(true)} style={{
          background: 'transparent', border: '0.5px solid rgba(0,0,0,0.15)',
          color: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '8px 14px',
          fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const,
        }}>
          🔑 Espace pro
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </>
    )
  }

  const nom = user.prenom ? `${user.prenom} ${user.nom || ''}`.trim() : user.email.split('@')[0]
  return (
    <div style={{ position: 'relative' as const }}>
      <button onClick={() => setShowMenu(!showMenu)} style={{
        background: isPro ? 'rgba(138,106,62,0.08)' : 'transparent',
        border: '0.5px solid rgba(138,106,62,0.4)',
        color: '#8a6a3e', borderRadius: 8, padding: '8px 14px',
        fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>👤 {nom}</span>
        {isPro && <span style={{ fontSize: 9, background: '#8a6a3e', color: '#fff', padding: '1px 6px', borderRadius: 2, letterSpacing: 0.5, fontWeight: 600 }}>PRO</span>}
      </button>
      {showMenu && (
        <div style={{ position: 'absolute' as const, top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 6, boxShadow: '0 8px 20px rgba(0,0,0,0.1)', minWidth: 220, zIndex: 100 }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, color: '#0a0a0a' }}>{user.email}</div>
            <div style={{ fontSize: 11, color: isPro ? '#2a8a2a' : 'rgba(0,0,0,0.5)', marginTop: 4 }}>
              {isPro ? '✓ Compte pro validé' : 'Compte particulier'}
            </div>
          </div>
          <Link href="/boutique/compte" onClick={() => setShowMenu(false)} style={{ display: 'block', textAlign: 'left' as const, padding: '10px 16px', fontSize: 12, color: '#1a1a1a', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            👤 Mon compte
          </Link>
          <Link href="/boutique/compte?tab=commandes" onClick={() => setShowMenu(false)} style={{ display: 'block', textAlign: 'left' as const, padding: '10px 16px', fontSize: 12, color: '#1a1a1a', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            📦 Mes commandes
          </Link>
          <button onClick={() => { setShowMenu(false); signOut() }} style={{ width: '100%', textAlign: 'left' as const, background: 'transparent', border: 'none', borderTop: '0.5px solid rgba(0,0,0,0.06)', padding: '10px 16px', fontSize: 12, color: '#a04444', cursor: 'pointer' }}>
            ↩ Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}

function BoutiqueNav() {
  const { totalItems, openCart } = useCart()
  const pathname = usePathname()

  const isCheckout = pathname?.includes('/checkout')

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 800,
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
      borderBottom: '0.5px solid rgba(0,0,0,0.08)',
      padding: '0 32px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Logo */}
      <Link href="/boutique" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <img src="/logo.png" alt="Cave de Gilbert" style={{ height: 36, objectFit: 'contain' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#8a6a3e', letterSpacing: 2 }}>
          Cave de Gilbert
        </span>
      </Link>

      {/* Recherche typeahead — au centre */}
      {!isCheckout && <SearchTypeahead />}

      {/* Right side : nav links + panier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        {!isCheckout && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {[
              { href: '/boutique', label: 'Nos vins' },
              { href: '/boutique?couleur=rouge', label: 'Rouges' },
              { href: '/boutique?couleur=blanc', label: 'Blancs' },
              { href: '/boutique?couleur=rosé', label: 'Rosés' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                fontSize: 12, letterSpacing: 0.5,
                color: 'rgba(0,0,0,0.6)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#8a6a3e')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(0,0,0,0.6)')}>
                {label}
              </Link>
            ))}
          </div>
        )}

        <AccountButton />

        <button onClick={openCart} style={{
          background: 'transparent', border: '0.5px solid rgba(138,106,62,0.4)',
          borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, color: '#8a6a3e',
          fontSize: 13, position: 'relative',
        }}>
          <span style={{ fontSize: 16 }}>🛒</span>
          <span>Panier</span>
          {totalItems > 0 && (
            <span style={{
              background: '#8a6a3e', color: '#fff', borderRadius: '50%',
              width: 20, height: 20, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700,
            }}>
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </nav>
  )
}

// ── Layout ────────────────────────────────────────────────────
export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <div style={{
          minHeight: '100vh', background: '#ffffff',
          color: '#1a1a1a', fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          <BoutiqueNav />
          <CartDrawer />
          <main>{children}</main>

        {/* Footer */}
        <footer style={{
          borderTop: '0.5px solid rgba(255,255,255,0.07)',
          padding: '40px',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 40, marginTop: 80,
        }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#c9a96e', marginBottom: 12 }}>
              Cave de Gilbert
            </div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', lineHeight: 2 }}>
              Avenue Jean Colomb<br />
              69280 Marcy l'Étoile<br />
              04 22 91 41 09<br />
              contact@cavedegilbert.fr
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(201,169,110,0.6)', textTransform: 'uppercase', marginBottom: 12 }}>
              Nos sites
            </div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', lineHeight: 2.2 }}>
              Cave de Gilbert — Marcy l'Étoile<br />
              La Petite Cave — L'Arbresle<br />
              Mar–Sam : 9h30–13h / 15h30–19h
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(201,169,110,0.6)', textTransform: 'uppercase', marginBottom: 12 }}>
              Informations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Livraison & retrait', href: '/boutique/livraison' },
                { label: 'Conditions générales', href: '/boutique/cgv' },
                { label: 'Mentions légales', href: '/boutique/mentions-legales' },
              ].map(({ label, href }) => (
                <Link key={href} href={href} style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', textDecoration: 'none' }}>{label}</Link>
              ))}
            </div>
          </div>
        </footer>
        <div style={{ textAlign: 'center', padding: '16px', fontSize: 11, color: 'rgba(232,224,213,0.2)', borderTop: '0.5px solid rgba(255,255,255,0.04)' }}>
          © 2025 Cave de Gilbert · L'abus d'alcool est dangereux pour la santé
        </div>
        </div>
      </CartProvider>
    </AuthProvider>
  )
}