import { createClient } from '@supabase/supabase-js'
import { HomeCarousel } from './components/HomeCarousel'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Force dynamique : recharge à chaque visite (pas de cache ISR) pour que les
// modifs admin sur le carrousel soient visibles immédiatement.
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Chargement des slides actives du carrousel d'accueil
  const nowIso = new Date().toISOString()
  const { data: rawSlides } = await supabase
    .from('boutique_carousel_slides')
    .select('id, titre, sous_titre, description, image_url, couleur_bg, couleur_texte, position_texte, slug, cta_label, cta_url_custom, date_debut, date_fin')
    .eq('actif', true)
    .order('ordre')
  // Filtre programmation (date_debut / date_fin) côté JS — Supabase n'a pas de NULL-safe OR simple
  const slides = (rawSlides || []).filter((s: any) =>
    (!s.date_debut || s.date_debut <= nowIso) && (!s.date_fin || s.date_fin >= nowIso)
  )

  return (
    <main style={{ background: '#0d0a08', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 40px', borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        background: '#0d0a08',
      }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e', letterSpacing: 4, textTransform: 'uppercase', fontWeight: 300 }}>
            Cave de Gilbert
          </div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)', letterSpacing: 2, marginTop: 2 }}>
            CAVISTE DEPUIS 1980
          </div>
        </a>
        <nav style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          <a href="/boutique" style={navLink}>Boutique</a>
          <a href="/boutique/compte" style={navLink}>Mon compte</a>
          <a href="/boutique" style={{
            background: '#c9a96e', color: '#0d0a08', padding: '9px 20px', borderRadius: 3,
            fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700,
            textDecoration: 'none',
          }}>Acheter en ligne</a>
        </nav>
      </header>

      {/* ── CARROUSEL HERO ───────────────────────────────────── */}
      {slides.length > 0 ? (
        <HomeCarousel slides={slides as any} />
      ) : (
        // Hero par défaut si aucune slide configurée
        <div style={{
          minHeight: 480, background: 'linear-gradient(135deg, #1a1208 0%, #2a1e10 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#e8e0d5', padding: '60px 40px', textAlign: 'center',
        }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, fontWeight: 300, color: '#c9a96e', marginBottom: 14 }}>
            Cave de Gilbert
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(232,224,213,0.7)', marginBottom: 30, maxWidth: 520, lineHeight: 1.6 }}>
            Sélection de vins, champagnes et spiritueux par notre caviste depuis plus de 40 ans.
          </p>
          <a href="/boutique" style={{
            background: '#c9a96e', color: '#0d0a08', padding: '14px 32px', borderRadius: 3,
            fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
            textDecoration: 'none',
          }}>
            Découvrir notre cave →
          </a>
        </div>
      )}

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{
        padding: '40px', borderTop: '0.5px solid rgba(255,255,255,0.06)', marginTop: 60,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: 'rgba(232,224,213,0.4)', fontSize: 11,
      }}>
        <div style={{ fontFamily: 'Georgia, serif', letterSpacing: 3, textTransform: 'uppercase', color: '#c9a96e' }}>
          Cave de Gilbert
        </div>
        <div>L'abus d'alcool est dangereux pour la santé. À consommer avec modération.</div>
      </footer>
    </main>
  )
}

const navLink: React.CSSProperties = {
  color: 'rgba(232,224,213,0.8)', textDecoration: 'none', fontSize: 13, letterSpacing: 0.5,
}
