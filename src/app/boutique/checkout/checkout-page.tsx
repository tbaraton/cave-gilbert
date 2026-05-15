'use client'

import { useState } from 'react'
import { useCart, FRANCO_PORT, FRAIS_PORT } from '../CartContext'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const SITE_RETRAIT = [
  { id: 'marcy', nom: 'Cave de Gilbert', adresse: 'Avenue Jean Colomb, 69280 Marcy l\'Étoile', horaires: 'Mar–Sam : 9h30–13h / 15h30–19h' },
  { id: 'arbresle', nom: 'La Petite Cave', adresse: 'Place du marché, 69210 L\'Arbresle', horaires: 'Mar–Sam : 9h30–13h / 15h30–19h' },
]

type Etape = 'livraison' | 'contact' | 'paiement'

export default function CheckoutPage() {
  const { items, totalTTC, fraisPort, totalAvecPort, clearCart } = useCart()
  const router = useRouter()

  const [etape, setEtape] = useState<Etape>('livraison')
  const [modeLivraison, setModeLivraison] = useState<'livraison' | 'click_collect' | null>(null)
  const [siteRetrait, setSiteRetrait] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Formulaire contact
  const [form, setForm] = useState({
    prenom: '', nom: '', email: '', telephone: '',
    adresse: '', complement: '', code_postal: '', ville: '',
  })

  const fraisCalcules = modeLivraison === 'click_collect' ? 0 : fraisPort
  const totalFinal = totalTTC + fraisCalcules

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#f0e8d8', marginBottom: 12 }}>
          Votre panier est vide
        </div>
        <a href="/boutique" style={{ color: '#c9a96e', fontSize: 14 }}>← Retour à la boutique</a>
      </div>
    )
  }

  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8,
    color: '#f0e8d8', fontSize: 15, padding: '12px 14px',
    boxSizing: 'border-box' as const, outline: 'none',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  }

  const handlePaiement = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          modeLivraison,
          siteRetrait,
          fraisPort: fraisCalcules,
          totalTTC: totalFinal,
          client: form,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')

      // Rediriger vers Stripe Checkout
      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe non chargé')
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })
      if (stripeError) throw new Error(stripeError.message)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: 1100, margin: '0 auto', padding: '48px 40px',
      fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5',
      display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48,
    }}>
      {/* Colonne gauche — Étapes */}
      <div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#f0e8d8', marginBottom: 8 }}>
          Finaliser la commande
        </div>

        {/* Indicateur étapes */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 40, alignItems: 'center' }}>
          {[
            { id: 'livraison', label: '1. Livraison' },
            { id: 'contact', label: '2. Coordonnées' },
            { id: 'paiement', label: '3. Paiement' },
          ].map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                fontSize: 12, letterSpacing: 0.5, padding: '6px 0',
                color: etape === e.id ? '#c9a96e' : etape > e.id ? 'rgba(232,224,213,0.4)' : 'rgba(232,224,213,0.25)',
                fontWeight: etape === e.id ? 600 : 400,
                borderBottom: `2px solid ${etape === e.id ? '#c9a96e' : 'transparent'}`,
              }}>
                {e.label}
              </div>
              {i < 2 && <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 12px' }} />}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Livraison ── */}
        {etape === 'livraison' && (
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 20 }}>
              Comment souhaitez-vous recevoir votre commande ?
            </div>

            {/* Click & Collect */}
            <button onClick={() => setModeLivraison('click_collect')} style={{
              width: '100%', background: modeLivraison === 'click_collect' ? 'rgba(201,169,110,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${modeLivraison === 'click_collect' ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 12, padding: '20px 24px', cursor: 'pointer',
              textAlign: 'left', marginBottom: 12, color: '#e8e0d5',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, color: modeLivraison === 'click_collect' ? '#c9a96e' : '#f0e8d8', fontWeight: 600, marginBottom: 4 }}>
                    🏪 Retrait en boutique
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
                    Gratuit · Disponible sous 2h si en stock
                  </div>
                </div>
                <div style={{ fontSize: 16, color: '#6ec96e', fontWeight: 700 }}>
                  Gratuit
                </div>
              </div>
            </button>

            {/* Choix du site */}
            {modeLivraison === 'click_collect' && (
              <div style={{ marginLeft: 16, marginBottom: 12 }}>
                {SITE_RETRAIT.map(site => (
                  <button key={site.id} onClick={() => setSiteRetrait(site.id)} style={{
                    width: '100%', background: siteRetrait === site.id ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${siteRetrait === site.id ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 8, padding: '14px 18px', cursor: 'pointer',
                    textAlign: 'left', marginBottom: 8, color: '#e8e0d5',
                  }}>
                    <div style={{ fontSize: 14, color: siteRetrait === site.id ? '#c9a96e' : '#f0e8d8', marginBottom: 4 }}>
                      {siteRetrait === site.id ? '◉' : '○'} {site.nom}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{site.adresse}</div>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 2 }}>{site.horaires}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Livraison */}
            <button onClick={() => { setModeLivraison('livraison'); setSiteRetrait(null) }} style={{
              width: '100%', background: modeLivraison === 'livraison' ? 'rgba(201,169,110,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${modeLivraison === 'livraison' ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 12, padding: '20px 24px', cursor: 'pointer',
              textAlign: 'left', marginBottom: 24, color: '#e8e0d5',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, color: modeLivraison === 'livraison' ? '#c9a96e' : '#f0e8d8', fontWeight: 600, marginBottom: 4 }}>
                    📦 Livraison à domicile — Colissimo
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
                    France métropolitaine · 2 à 3 jours ouvrés
                  </div>
                  {totalTTC >= FRANCO_PORT && (
                    <div style={{ fontSize: 12, color: '#6ec96e', marginTop: 4 }}>✓ Livraison offerte dès {FRANCO_PORT} €</div>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: fraisPort === 0 ? '#6ec96e' : '#f0e8d8' }}>
                  {fraisPort === 0 ? 'Offerte' : `${FRAIS_PORT.toFixed(2)} €`}
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                if (!modeLivraison) return
                if (modeLivraison === 'click_collect' && !siteRetrait) return
                setEtape('contact')
              }}
              disabled={!modeLivraison || (modeLivraison === 'click_collect' && !siteRetrait)}
              style={{
                width: '100%', background: modeLivraison ? '#c9a96e' : '#2a2a1e',
                color: modeLivraison ? '#0d0a08' : '#555',
                border: 'none', borderRadius: 10, padding: '16px',
                fontSize: 15, cursor: modeLivraison ? 'pointer' : 'not-allowed',
                fontWeight: 700,
              }}>
              Continuer →
            </button>
          </div>
        )}

        {/* ── ÉTAPE 2 : Coordonnées ── */}
        {etape === 'contact' && (
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 20 }}>
              Vos coordonnées
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                  PRÉNOM *
                </label>
                <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                  autoCapitalize="words" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                  NOM *
                </label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  autoCapitalize="words" style={inp} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                  EMAIL *
                </label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                  TÉLÉPHONE *
                </label>
                <input type="tel" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                  style={inp} />
              </div>
            </div>

            {/* Adresse uniquement si livraison */}
            {modeLivraison === 'livraison' && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#f0e8d8', marginBottom: 16 }}>
                  Adresse de livraison
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                    ADRESSE *
                  </label>
                  <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                    style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                    COMPLÉMENT
                  </label>
                  <input value={form.complement} onChange={e => setForm(f => ({ ...f, complement: e.target.value }))}
                    placeholder="Appartement, étage, digicode..." style={inp} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                      CODE POSTAL *
                    </label>
                    <input value={form.code_postal} onChange={e => setForm(f => ({ ...f, code_postal: e.target.value }))}
                      maxLength={5} inputMode="numeric" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                      VILLE *
                    </label>
                    <input value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
                      style={inp} />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setEtape('livraison')} style={{
                flex: 1, background: 'transparent',
                border: '0.5px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '14px',
                color: 'rgba(232,224,213,0.5)', fontSize: 14, cursor: 'pointer',
              }}>
                ← Retour
              </button>
              <button
                onClick={() => {
                  const required = [form.prenom, form.nom, form.email, form.telephone]
                  if (modeLivraison === 'livraison') required.push(form.adresse, form.code_postal, form.ville)
                  if (required.some(v => !v.trim())) { setError('Veuillez remplir tous les champs obligatoires'); return }
                  setError('')
                  setEtape('paiement')
                }}
                style={{
                  flex: 2, background: '#c9a96e', color: '#0d0a08',
                  border: 'none', borderRadius: 10, padding: '14px',
                  fontSize: 15, cursor: 'pointer', fontWeight: 700,
                }}>
                Continuer →
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#c96e6e', background: 'rgba(201,110,110,0.1)', borderRadius: 6, padding: '10px 14px' }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 3 : Paiement ── */}
        {etape === 'paiement' && (
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 20 }}>
              Paiement sécurisé
            </div>

            {/* Récap commande */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', letterSpacing: 1, marginBottom: 12 }}>
                RÉCAPITULATIF
              </div>
              <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 6 }}>
                <strong style={{ color: '#c9a96e' }}>{form.prenom} {form.nom}</strong> — {form.email}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
                {modeLivraison === 'click_collect'
                  ? `🏪 Retrait : ${SITE_RETRAIT.find(s => s.id === siteRetrait)?.nom}`
                  : `📦 Livraison : ${form.adresse}, ${form.code_postal} ${form.ville}`
                }
              </div>
            </div>

            {/* Stripe */}
            <div style={{ background: 'rgba(110,158,201,0.06)', border: '0.5px solid rgba(110,158,201,0.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#6e9ec9', marginBottom: 8 }}>
                🔒 Paiement 100% sécurisé par Stripe
              </div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                Vous allez être redirigé vers la page de paiement sécurisée Stripe. Vos données bancaires ne transitent jamais par nos serveurs.
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, fontSize: 13, color: '#c96e6e', background: 'rgba(201,110,110,0.1)', borderRadius: 6, padding: '10px 14px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEtape('contact')} style={{
                flex: 1, background: 'transparent',
                border: '0.5px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '14px',
                color: 'rgba(232,224,213,0.5)', fontSize: 14, cursor: 'pointer',
              }}>
                ← Retour
              </button>
              <button onClick={handlePaiement} disabled={loading} style={{
                flex: 2, background: loading ? '#2a2a1e' : '#c9a96e',
                color: loading ? '#555' : '#0d0a08',
                border: 'none', borderRadius: 10, padding: '16px',
                fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700,
              }}>
                {loading ? '⟳ Redirection...' : `🔒 Payer ${totalFinal.toFixed(2)} €`}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(232,224,213,0.25)' }}>
              En passant commande, vous acceptez nos{' '}
              <a href="/boutique/cgv" style={{ color: 'rgba(201,169,110,0.5)' }}>CGV</a>
            </div>
          </div>
        )}
      </div>

      {/* Colonne droite — Récap panier */}
      <div>
        <div style={{
          position: 'sticky', top: 88,
          background: '#18130e', border: '0.5px solid rgba(201,169,110,0.15)',
          borderRadius: 12, padding: '24px',
        }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#f0e8d8', marginBottom: 16 }}>
            Votre commande
          </div>

          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#f0e8d8' }}>
                  {item.nom}{item.millesime ? ` ${item.millesime}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                  × {item.quantite}
                </div>
              </div>
              <div style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif', whiteSpace: 'nowrap' }}>
                {(item.prix_unitaire_ttc * item.quantite).toFixed(2)} €
              </div>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 6 }}>
              <span>Sous-total</span>
              <span>{totalTTC.toFixed(2)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12, color: fraisCalcules === 0 ? '#6ec96e' : 'rgba(232,224,213,0.5)' }}>
              <span>Livraison</span>
              <span>{fraisCalcules === 0 ? 'Offerte' : `${fraisCalcules.toFixed(2)} €`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 600, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
              <span>Total TTC</span>
              <span>{totalFinal.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}