'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DB_SCHEMA = `
Base de données Cave de Gilbert (Supabase/PostgreSQL) :

Tables principales :
- products (id, nom, nom_cuvee, couleur, millesime, contenance, region_id, appellation_id, domaine_id, prix_achat_ht, prix_vente_ttc, prix_vente_pro, actif, bio, vegan, casher, naturel, biodynamique)
- customers (id, prenom, nom, email, telephone, ville, code_postal)
- domaines (id, nom, contact_nom, email, telephone, ville) — fournisseurs/domaines
- supplier_orders (id, numero, domaine_id, statut, date_commande, notes, created_at) — statuts: brouillon, envoyée, reçue, annulée
- supplier_order_items (id, order_id, product_id, product_nom, quantite_commandee, quantite_recue, prix_achat_ht)
- stock (id, product_id, site_id, quantite)
- sites (id, nom, ville, code, type, actif)
- transfers (id, numero, site_source_id, site_destination_id, statut, demande_le, confirme_le, recu_le)
- transfer_items (id, transfer_id, product_id, quantite_demandee, quantite_expediee, quantite_recue)
- stock_movements (id, product_id, site_id, raison, quantite, stock_avant, stock_apres, note, created_at)
- regions (id, nom)
- appellations (id, nom, region_id)
- product_suppliers (id, product_id, domaine_id, prix_achat_ht, conditionnement, fournisseur_principal)

Vues : v_stock_par_site (product_id, produit, millesime, site, site_id, quantite, stock_statut)

Enum statuts commandes : 'brouillon', 'envoyée', 'reçue', 'annulée'
Enum raisons stock : 'achat', 'vente', 'ajustement', 'casse', 'dégustation', 'retour', 'transfert_out', 'transfert_in'
`

type Message = {
  role: 'user' | 'assistant'
  content: string
  data?: any[]
  sql?: string
  loading?: boolean
}

const SUGGESTIONS = [
  "Quand ai-je commandé du Morgon pour la dernière fois et à quel prix ?",
  "Quels produits sont en rupture de stock ?",
  "Quel est mon stock total de vins rouges ?",
  "Combien de commandes ai-je passé ce mois-ci ?",
  "Quels sont mes 5 fournisseurs avec le plus de références ?",
  "Montre-moi les produits bio avec un prix achat inférieur à 8€",
  "Quels transferts sont en attente de réception ?",
  "Quel est le dernier prix auquel j'ai acheté du Fleurie ?",
]

export default function IAPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Je suis votre assistant Cave de Gilbert. Je peux interroger votre base de données en langage naturel — commandes, stock, produits, clients, fournisseurs... Que voulez-vous savoir ?",
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const executeSQL = async (sql: string): Promise<{ data: any[]; error: string | null }> => {
    try {
      const { data, error } = await (supabase as any).rpc('execute_query', { query: sql })
      if (error) return { data: [], error: error.message }
      return { data: Array.isArray(data) ? data : [], error: null }
    } catch (e: any) {
      return { data: [], error: e.message }
    }
  }

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim()
    if (!userText || loading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userText },
      { role: 'assistant', content: '', loading: true }
    ])

    try {
      const res = await fetch('/api/ia-backoffice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userText,
          schema: DB_SCHEMA,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const result = await res.json()

      let data: any[] = []
      let sqlError = null
      if (result.sql) {
        const exec = await executeSQL(result.sql)
        data = exec.data
        sqlError = exec.error
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: sqlError ? result.answer + `\n\n⚠️ Erreur lors de l'exécution : ${sqlError}` : result.answer,
          sql: result.sql,
          data: data.length > 0 ? data : undefined,
        }
      ])
    } catch (e: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Désolé, une erreur s'est produite : ${e.message}` }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <a href="/admin" style={{ display: 'block', marginBottom: 10, textDecoration: 'none' }}>
            <img
              src="/logo.png"
              alt="Cave de Gilbert"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              style={{ width: '100%', maxHeight: 52, objectFit: 'contain', cursor: 'pointer' }}
            />
          </a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ASSISTANT IA</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          {[
            { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
            { label: 'Produits', href: '/admin', icon: '⬥' },
            { label: 'Commandes', href: '/admin/commandes', icon: '◻' },
            { label: 'Fournisseurs', href: '/admin/fournisseurs', icon: '◈' },
            { label: 'Transferts', href: '/admin/transferts', icon: '⇄' },
            { label: 'Clients', href: '/admin/clients', icon: '◎' },
          ].map(({ label, href, icon }) => (
            <a key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.45)', borderLeft: '2px solid transparent', textDecoration: 'none' }}>
              <span>{icon}</span>{label}
            </a>
          ))}
          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
          <a href="/admin/ia" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: '#c9a96e', borderLeft: '2px solid #c9a96e', textDecoration: 'none', background: 'rgba(201,169,110,0.08)' }}>
            <span>✦</span>Assistant IA
          </a>
        </nav>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column' as const, height: '100vh', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 32px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(201,169,110,0.12)', border: '0.5px solid rgba(201,169,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✦</div>
          <div>
            <div style={{ fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 300 }}>Assistant Cave de Gilbert</div>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>Connecté à votre base de données · Powered by Claude</div>
          </div>
          <button onClick={() => setMessages([{ role: 'assistant', content: "Nouvelle conversation démarrée. Que puis-je faire pour vous ?" }])}
            style={{ marginLeft: 'auto', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
            Nouvelle conversation
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto' as const, padding: '24px 32px', display: 'flex', flexDirection: 'column' as const, gap: 20 }}>

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(201,169,110,0.12)', border: '0.5px solid rgba(201,169,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 4 }}>✦</div>
              )}
              <div style={{ maxWidth: '78%' }}>
                <div style={{
                  background: msg.role === 'user' ? 'rgba(201,169,110,0.1)' : '#18130e',
                  border: `0.5px solid ${msg.role === 'user' ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '3px 12px 12px 12px',
                  padding: '11px 15px',
                }}>
                  {msg.loading ? (
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '3px 0' }}>
                      {[0, 1, 2].map(j => (
                        <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9a96e', opacity: 0.4, animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                      ))}
                      <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3} 40%{opacity:1} }`}</style>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: '#e8e0d5', whiteSpace: 'pre-wrap' as const }}>{msg.content}</div>
                  )}
                </div>

                {msg.sql && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 10, color: 'rgba(232,224,213,0.25)', cursor: 'pointer', letterSpacing: 1, userSelect: 'none' as const }}>SQL GÉNÉRÉ</summary>
                    <pre style={{ background: '#100d0a', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '8px 12px', fontSize: 11, color: '#6e9ec9', marginTop: 4, overflowX: 'auto' as const, fontFamily: 'monospace' }}>{msg.sql}</pre>
                  </details>
                )}

                {msg.data && msg.data.length > 0 && (
                  <div style={{ marginTop: 8, background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' as const, maxHeight: 280 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#14100c' }}>
                            {Object.keys(msg.data[0]).map(k => (
                              <th key={k} style={{ padding: '7px 12px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, fontWeight: 400, whiteSpace: 'nowrap' as const }}>{k.replace(/_/g, ' ')}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.data.slice(0, 50).map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: ri < Math.min(msg.data!.length, 50) - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                              {Object.values(row).map((val: any, vi) => (
                                <td key={vi} style={{ padding: '7px 12px', color: '#e8e0d5', whiteSpace: 'nowrap' as const }}>
                                  {val === null || val === undefined ? <span style={{ color: 'rgba(232,224,213,0.2)' }}>—</span>
                                    : typeof val === 'number' ? <span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{val.toLocaleString('fr-FR')}</span>
                                    : typeof val === 'boolean' ? (val ? <span style={{ color: '#6ec96e' }}>✓</span> : <span style={{ color: '#c96e6e' }}>✗</span>)
                                    : String(val).match(/^\d{4}-\d{2}-\d{2}/) ? new Date(String(val)).toLocaleDateString('fr-FR')
                                    : String(val).length > 45 ? String(val).slice(0, 45) + '…'
                                    : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {msg.data.length > 50 && (
                      <div style={{ padding: '5px 12px', fontSize: 10, color: 'rgba(232,224,213,0.25)', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
                        + {msg.data.length - 50} résultats non affichés
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div style={{ padding: '0 32px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' as const, flexShrink: 0 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} style={{
                background: 'rgba(201,169,110,0.05)', border: '0.5px solid rgba(201,169,110,0.18)',
                color: 'rgba(232,224,213,0.55)', borderRadius: 20, padding: '5px 12px',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,110,0.1)'; e.currentTarget.style.color = '#c9a96e' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,169,110,0.05)'; e.currentTarget.style.color = 'rgba(232,224,213,0.55)' }}
              >{s}</button>
            ))}
          </div>
        )}

        {/* Zone de saisie */}
        <div style={{ padding: '12px 32px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, padding: '10px 14px', transition: 'border-color 0.2s' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Posez votre question... (Entrée pour envoyer, Shift+Entrée pour sauter une ligne)"
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#f0e8d8', fontSize: 13, resize: 'none' as const, outline: 'none', lineHeight: 1.6, minHeight: 22, maxHeight: 120, fontFamily: 'inherit' }}
              rows={1}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() && !loading ? '#c9a96e' : 'rgba(201,169,110,0.1)',
                color: input.trim() && !loading ? '#0d0a08' : 'rgba(201,169,110,0.3)',
                border: 'none', borderRadius: 6, width: 34, height: 34, flexShrink: 0,
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
              {loading ? '⟳' : '↑'}
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.15)', marginTop: 6, textAlign: 'center' as const }}>
            Les requêtes sont en lecture seule · Données sécurisées dans votre Supabase
          </div>
        </div>
      </main>
    </div>
  )
}