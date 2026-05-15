'use client'

import { CartProvider, useCart, FRANCO_PORT, FRAIS_PORT } from './CartContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
function BoutiqueNav() {
  const { totalItems, openCart } = useCart()
  const pathname = usePathname()

  const isCheckout = pathname?.includes('/checkout')

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 800,
      background: 'rgba(13,10,8,0.95)', backdropFilter: 'blur(12px)',
      borderBottom: '0.5px solid rgba(255,255,255,0.07)',
      padding: '0 40px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Logo */}
      <Link href="/boutique" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Cave de Gilbert" style={{ height: 36, objectFit: 'contain' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#c9a96e', letterSpacing: 2 }}>
          Cave de Gilbert
        </span>
      </Link>

      {/* Nav links */}
      {!isCheckout && (
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[
            { href: '/boutique', label: 'Nos vins' },
            { href: '/boutique?couleur=rouge', label: 'Rouges' },
            { href: '/boutique?couleur=blanc', label: 'Blancs' },
            { href: '/boutique?couleur=rosé', label: 'Rosés' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{
              fontSize: 13, letterSpacing: 0.5,
              color: 'rgba(232,224,213,0.6)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0e8d8')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(232,224,213,0.6)')}>
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Panier */}
      <button onClick={openCart} style={{
        background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)',
        borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, color: '#c9a96e',
        fontSize: 13, position: 'relative',
      }}>
        <span style={{ fontSize: 16 }}>🛒</span>
        <span>Panier</span>
        {totalItems > 0 && (
          <span style={{
            background: '#c9a96e', color: '#0d0a08', borderRadius: '50%',
            width: 20, height: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 700,
          }}>
            {totalItems}
          </span>
        )}
      </button>
    </nav>
  )
}

// ── Layout ────────────────────────────────────────────────────
export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div style={{
        minHeight: '100vh', background: '#0d0a08',
        color: '#e8e0d5', fontFamily: "'DM Sans', system-ui, sans-serif",
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
  )
}