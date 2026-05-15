'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ────────────────────────────────────────────────────
type Periode = '7j' | '30j' | '3m' | '6m' | '12m'

// ── Constantes ───────────────────────────────────────────────
const COULEUR_COLORS: Record<string, string> = {
  rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0',
  effervescent: '#a0b0e0', champagne: '#d4c88a',
  spiritueux: '#8ec98e', biere: '#d4a056', autre: '#888888',
}

const CAT_COLORS: Record<string, string> = {
  vin: '#c9b06e', spiritueux: '#8ec98e', biere: '#d4a056',
  epicerie: '#a0c8e0', sans_alcool: '#b0e0b0', divers: '#888',
}

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MOIS_NOMS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const GOLD = '#c9a96e'
const BG_CARD = '#18130e'
const BORDER = 'rgba(255,255,255,0.07)'

// ── Helpers ──────────────────────────────────────────────────
function periodeToRange(p: Periode): { debut: string; fin: string } {
  const now = new Date()
  const fin = now.toISOString().split('T')[0]
  const d = new Date(now)
  if (p === '7j')  d.setDate(d.getDate() - 7)
  if (p === '30j') d.setDate(d.getDate() - 30)
  if (p === '3m')  d.setMonth(d.getMonth() - 3)
  if (p === '6m')  d.setMonth(d.getMonth() - 6)
  if (p === '12m') d.setFullYear(d.getFullYear() - 1)
  return { debut: d.toISOString().split('T')[0], fin }
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toFixed(2)
}

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ── Composants de base ───────────────────────────────────────
function KpiCard({ label, value, sub, color = GOLD }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: BG_CARD, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '20px 22px' }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, color, fontFamily: 'Georgia, serif', fontWeight: 300, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase' as const, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: '0.5px', background: 'rgba(201,169,110,0.2)' }} />
      {children}
      <div style={{ flex: 1, height: '0.5px', background: 'rgba(201,169,110,0.2)' }} />
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, fontSize: 12 },
  labelStyle: { color: '#c9a96e' },
  itemStyle: { color: '#e8e0d5' },
}

// ── Module 1 : KPIs du jour ──────────────────────────────────
function ModuleKPIs({ periode, siteId }: { periode: Periode; siteId: string }) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { debut, fin } = periodeToRange(periode)
      let q = supabase.from('ventes').select('total_ttc, total_ht, created_at, customer_id').eq('statut', 'validee').gte('created_at', debut).lte('created_at', fin + 'T23:59:59')
      if (siteId) q = q.eq('site_id', siteId)
      const { data: ventes } = await q

      const ca = (ventes || []).reduce((s, v) => s + parseFloat(v.total_ttc || 0), 0)
      const caHT = (ventes || []).reduce((s, v) => s + parseFloat(v.total_ht || 0), 0)
      const nb = (ventes || []).length
      const panier = nb > 0 ? ca / nb : 0
      const clients = new Set((ventes || []).map(v => v.customer_id).filter(Boolean)).size
      const tva = ca - caHT

      setData({ ca, caHT, nb, panier, clients, tva })
    }
    load()
  }, [periode, siteId])

  if (!data) return <div style={{ color: 'rgba(232,224,213,0.3)', padding: 20 }}>⟳</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
      <KpiCard label="CA TTC" value={fmtEur(data.ca)} sub={`HT : ${fmtEur(data.caHT)}`} />
      <KpiCard label="Transactions" value={data.nb.toString()} sub={`Panier moyen : ${fmtEur(data.panier)}`} color="#6e9ec9" />
      <KpiCard label="Clients actifs" value={data.clients.toString()} color="#6ec96e" />
      <KpiCard label="TVA collectée" value={fmtEur(data.tva)} color="#c96e6e" />
      <KpiCard label="Panier moyen" value={fmtEur(data.panier)} color="#b0a0c8" />
    </div>
  )
}

// ── Module 2 : Courbe CA ─────────────────────────────────────
function ModuleCA({ periode, siteId }: { periode: Periode; siteId: string }) {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { debut, fin } = periodeToRange(periode)
      let q = supabase.from('ventes').select('total_ttc, created_at').eq('statut', 'validee').gte('created_at', debut).lte('created_at', fin + 'T23:59:59')
      if (siteId) q = q.eq('site_id', siteId)
      const { data: ventes } = await q

      const byDate: Record<string, { ca: number; nb: number }> = {}
      ;(ventes || []).forEach(v => {
        const d = v.created_at.split('T')[0]
        if (!byDate[d]) byDate[d] = { ca: 0, nb: 0 }
        byDate[d].ca += parseFloat(v.total_ttc || 0)
        byDate[d].nb++
      })
      const rows = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, val]) => ({
        date, label: date.slice(5), ca: Math.round(val.ca * 100) / 100, nb: val.nb,
      }))
      setData(rows)
    }
    load()
  }, [periode, siteId])

  return (
    <div style={{ background: BG_CARD, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '20px 22px', marginBottom: 28 }}>
      <div style={{ fontSize: 12, color: GOLD, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 16 }}>Évolution du CA</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fill: 'rgba(232,224,213,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(232,224,213,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v) + '€'} />
          <Tooltip {...tooltipStyle} formatter={(v: any) => [fmtEur(v), 'CA TTC']} />
          <Line type="monotone" dataKey="ca" stroke={GOLD} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: GOLD }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Module 3 : Top produits ──────────────────────────────────
function ModuleProduits({ periode, siteId }: { periode: Periode; siteId: string }) {
  const [tops, setTops] = useState<any[]>([])
  const [byCat, setByCat] = useState<any[]>([])
  const [view, setView] = useState<'ca' | 'volume'>('ca')

  useEffect(() => {
    const load = async () => {
      const { debut, fin } = periodeToRange(periode)
      let qV = supabase.from('ventes').select('id, site_id').eq('statut', 'validee').gte('created_at', debut).lte('created_at', fin + 'T23:59:59')
      if (siteId) qV = qV.eq('site_id', siteId)
      const { data: ventesData } = await qV
      if (!ventesData?.length) { setTops([]); setByCat([]); return }
      const venteIds = ventesData.map(v => v.id)

      const { data: lignes } = await supabase.from('vente_lignes').select('product_id, quantite, total_ttc').in('vente_id', venteIds)
      const pids = [...new Set((lignes || []).map(l => l.product_id).filter(Boolean))]
      if (!pids.length) { setTops([]); setByCat([]); return }

      const { data: produits } = await supabase.from('products').select('id, nom, couleur, categorie').in('id', pids)
      const prodMap = Object.fromEntries((produits || []).map(p => [p.id, p]))

      const agg: Record<string, any> = {}
      ;(lignes || []).forEach(l => {
        if (!l.product_id) return
        const p = prodMap[l.product_id]
        if (!p) return
        if (!agg[l.product_id]) agg[l.product_id] = { id: l.product_id, nom: p.nom, couleur: p.couleur, categorie: p.categorie, ca: 0, qte: 0 }
        agg[l.product_id].ca += parseFloat(l.total_ttc || 0)
        agg[l.product_id].qte += parseInt(l.quantite || 0)
      })

      const sorted = Object.values(agg).sort((a, b) => b.ca - a.ca)

      // Matrice ABC
      const totalCA = sorted.reduce((s, p) => s + p.ca, 0)
      let cumul = 0
      const withABC = sorted.map(p => {
        cumul += p.ca
        const pct = totalCA > 0 ? (cumul / totalCA) * 100 : 0
        return { ...p, abc: pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C', pctCA: totalCA > 0 ? (p.ca / totalCA) * 100 : 0 }
      })
      setTops(withABC.slice(0, 20))

      // Par catégorie
      const catAgg: Record<string, { ca: number; qte: number }> = {}
      Object.values(agg).forEach(p => {
        if (!catAgg[p.categorie]) catAgg[p.categorie] = { ca: 0, qte: 0 }
        catAgg[p.categorie].ca += p.ca
        catAgg[p.categorie].qte += p.qte
      })
      setByCat(Object.entries(catAgg).map(([cat, v]) => ({ name: cat, ca: Math.round(v.ca * 100) / 100, qte: v.qte })).sort((a, b) => b.ca - a.ca))
    }
    load()
  }, [periode, siteId])

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>Produits</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* Top produits */}
        <div style={{ background: BG_CARD, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: GOLD, letterSpacing: 1 }}>Top 20</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ca', 'volume'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ background: view === v ? 'rgba(201,169,110,0.15)' : 'transparent', border: `0.5px solid ${view === v ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`, color: view === v ? GOLD : 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                  {v === 'ca' ? 'Par CA' : 'Par volume'}
                </button>
              ))}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                {['#', 'Produit', 'Cat.', 'ABC', view === 'ca' ? 'CA TTC' : 'Qté', '% CA'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...tops].sort((a, b) => view === 'ca' ? b.ca - a.ca : b.qte - a.qte).map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '7px 10px', fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>{i + 1}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: COULEUR_COLORS[p.couleur] || '#888', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: '#e8e0d5' }}>{p.nom}</span>
                    </div>
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>{p.categorie}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{ fontSize: 10, background: p.abc === 'A' ? 'rgba(110,201,110,0.15)' : p.abc === 'B' ? 'rgba(201,169,110,0.15)' : 'rgba(201,110,110,0.1)', color: p.abc === 'A' ? '#6ec96e' : p.abc === 'B' ? GOLD : '#c96e6e', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>{p.abc}</span>
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 12, color: GOLD, fontFamily: 'Georgia, serif' }}>
                    {view === 'ca' ? fmtEur(p.ca) : p.qte + ' btl'}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ width: p.pctCA + '%', height: '100%', background: GOLD, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>{p.pctCA.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Répartition par catégorie */}
        <div style={{ background: BG_CARD, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, color: GOLD, letterSpacing: 1, marginBottom: 14 }}>Par catégorie</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byCat} dataKey="ca" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                {byCat.map((entry, i) => (
                  <Cell key={i} fill={CAT_COLORS[entry.name] || '#888'} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: any) => [fmtEur(v), 'CA TTC']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginTop: 8 }}>
            {byCat.map(c => (
              <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[c.name] || '#888', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.7)', textTransform: 'capitalize' as const }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 12, color: GOLD, fontFamily: 'Georgia, serif' }}>{fmtEur(c.ca)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Module 4 : Heatmap heure × jour ─────────────────────────
function ModuleHeatmap({ periode, siteId }: { periode: Periode; siteId: string }) {
  const [matrix, setMatrix] = useState<Record<string, { nb: number; ca: number }>>({})
  const [maxNb, setMaxNb] = useState(1)
  const HEURES = Array.from({ length: 24 }, (_, i) => i)

  useEffect(() => {
    const load = async () => {
      const { debut, fin } = periodeToRange(periode)
      let q = supabase.from('ventes').select('total_ttc, created_at').eq('statut', 'validee').gte('created_at', debut).lte('created_at', fin + 'T23:59:59')
      if (siteId) q = q.eq('site_id', siteId)
      const { data: ventes } = await q

      const mat: Record<string, { nb: number; ca: number }> = {}
      let mx = 0
      ;(ventes || []).forEach(v => {
        const d = new Date(v.created_at)
        const heure = d.getHours()
        const jour = d.getDay()
        const key = `${jour}-${heure}`
        if (!mat[key]) mat[key] = { nb: 0, ca: 0 }
        mat[key].nb++
        mat[key].ca += parseFloat(v.total_ttc || 0)
        if (mat[key].nb > mx) mx = mat[key].nb
      })
      setMatrix(mat)
      setMaxNb(mx || 1)
    }
    load()
  }, [periode, siteId])

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>Heatmap des ventes — Heure × Jour</SectionTitle>
      <div style={{ background: BG_CARD, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '20px 22px', overflowX: 'auto' as const }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 28px)', gap: 3, minWidth: 700 }}>
          {/* En-tête heures */}
          <div />
          {HEURES.map(h => (
            <div key={h} style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, paddingBottom: 4 }}>{h}h</div>
          ))}
          {/* Grille jour × heure */}
          {JOURS.map((jour, jourIdx) => (
            <>
              <div key={jour} style={{ fontSize: 10, color: 'rgba(232,224,213,0.5)', display: 'flex', alignItems: 'center' }}>{jour}</div>
              {HEURES.map(h => {
                const key = `${jourIdx}-${h}`
                const cell = matrix[key]
                const intensity = cell ? cell.nb / maxNb : 0
                const bg = cell
                  ? `rgba(201,169,110,${0.08 + intensity * 0.85})`
                  : 'rgba(255,255,255,0.03)'
                return (
                  <div key={h} title={cell ? `${cell.nb} vente(s) — ${fmtEur(cell.ca)}` : 'Aucune vente'}
                    style={{ width: 28, height: 24, background: bg, borderRadius: 3, cursor: cell ? 'pointer' : 'default', transition: 'transform 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  />
                )
              })}
            </>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>Faible</span>
          {[0.08, 0.25, 0.45, 0.65, 0.93].map(op => (
            <div key={op} style={{ width: 20, height: 14, background: `rgba(201,169,110,${op})`, borderRadius: 2 }} />
          ))}
          <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>Fort</span>
        </div>
      </div>
    </div>
  )
}

// ── Module 5 : Clients RFM ───────────────────────────────────
function ModuleClients({ periode, siteId }: { periode: Periode; siteId: string }) {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { debut, fin } = periodeToRange(periode)
      let q = supabase.from('ventes').select('id, total_ttc, customer_id, created_at').eq('statut', 'validee').gte('created_at', debut).lte('created_at', fin + 'T23:59:59').not('customer_id', 'is', null)
      if (siteId) q = q.eq('site_id', siteId)
      const { data: ventes } = await q
      if (!ventes?.length) { setClients([]); setLoading(false); return }

      const byClient: Record<string, any> = {}
      ventes.forEach(v => {
        if (!v.customer_id) return
        if (!byClient[v.customer_id]) byClient[v.customer_id] = { id: v.customer_id, ca: 0, nb: 0, lastDate: '' }
        byClient[v.customer_id].ca += parseFloat(v.total_ttc || 0)
        byClient[v.customer_id].nb++
        if (v.created_at > byClient[v.customer_id].lastDate) byClient[v.customer_id].lastDate = v.created_at
      })

      const cids = Object.keys(byClient)
      const { data: customersData } = await supabase.from('customers').select('id, prenom, nom, email, telephone').in('id', cids)
      const custMap = Object.fromEntries((customersData || []).map(c => [c.id, c]))

      const now = new Date()
      const result = Object.values(byClient).map(c => {
        const cust = custMap[c.id] || {}
        const joursSansAchat = Math.floor((now.getTime() - new Date(c.lastDate).getTime()) / 86400000)
        const rfm = joursSansAchat <= 7 && c.nb >= 3 && c.ca >= 200 ? 'Champion'
          : joursSansAchat <= 30 && c.nb >= 2 ? 'Fidèle'
          : joursSansAchat > 90 ? 'Perdu'
          : joursSansAchat > 60 ? 'À risque'
          : 'Occasionnel'
        return { ...c, ...cust, joursSansAchat, rfm }
      }).sort((a, b) => b.ca - a.ca)

      setClients(result)
      setLoading(false)
    }
    load()
  }, [periode, siteId])

  const rfmColor: Record<string, string> = {
    'Champion': '#6ec96e', 'Fidèle': '#6e9ec9', 'Occasionnel': GOLD,
    'À risque': '#c9b06e', 'Perdu': '#c96e6e',
  }
  const rfmCounts = clients.reduce((acc, c) => { acc[c.rfm] = (acc[c.rfm] || 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>Clients</SectionTitle>

      {/* RFM summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
        {Object.entries(rfmColor).map(([rfm, color]) => (
          <div key={rfm} style={{ background: BG_CARD, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.6)' }}>{rfm}</span>
            <span style={{ fontSize: 16, color, fontFamily: 'Georgia, serif', fontWeight: 600 }}>{rfmCounts[rfm] || 0}</span>
          </div>
        ))}
      </div>

      <div style={{ background: BG_CARD, border: `0.5px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)' }}>⟳ Chargement…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                {['Client', 'Email', 'Segment', 'CA total', 'Achats', 'Dernier achat', 'Inactif depuis'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 30).map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#e8e0d5' }}>{[c.prenom, c.nom].filter(Boolean).join(' ') || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, color: rfmColor[c.rfm], background: rfmColor[c.rfm] + '22', padding: '2px 8px', borderRadius: 3 }}>{c.rfm}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: GOLD, fontFamily: 'Georgia, serif' }}>{fmtEur(c.ca)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>{c.nb}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{c.lastDate ? new Date(c.lastDate).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, color: c.joursSansAchat > 60 ? '#c96e6e' : c.joursSansAchat > 30 ? '#c9b06e' : '#6ec96e' }}>
                      {c.joursSansAchat} j
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Module 6 : Clients par catégorie / produit (le whisky !) ─
function ModuleClientsCategorie({ siteId }: { siteId: string }) {
  const [categorie, setCategorie] = useState('spiritueux')
  const [motCle, setMotCle] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [produitsDispo, setProduitsDispo] = useState<string[]>([])

  const CATEGORIES = ['vin', 'spiritueux', 'biere', 'epicerie', 'sans_alcool', 'divers']

  const search = useCallback(async () => {
    setLoading(true)
    // Récupérer les produits correspondants
    let qP = supabase.from('products').select('id, nom').eq('categorie', categorie).eq('actif', true)
    if (motCle.trim()) qP = qP.ilike('nom', `%${motCle}%`)
    const { data: prods } = await qP
    if (!prods?.length) { setClients([]); setProduitsDispo([]); setLoading(false); return }

    setProduitsDispo(prods.map(p => p.nom))
    const prodIds = prods.map(p => p.id)

    // Lignes de vente pour ces produits
    const { data: lignes } = await supabase.from('vente_lignes').select('vente_id, product_id, total_ttc, quantite').in('product_id', prodIds)
    if (!lignes?.length) { setClients([]); setLoading(false); return }

    const venteIds = [...new Set(lignes.map(l => l.vente_id))]
    let qV = supabase.from('ventes').select('id, customer_id, created_at').eq('statut', 'validee').in('id', venteIds).not('customer_id', 'is', null)
    if (siteId) qV = qV.eq('site_id', siteId)
    const { data: ventes } = await qV
    if (!ventes?.length) { setClients([]); setLoading(false); return }

    const venteMap = Object.fromEntries((ventes || []).map(v => [v.id, v]))
    const ligneMap: Record<string, any[]> = {}
    lignes.forEach(l => {
      const v = venteMap[l.vente_id]
      if (!v?.customer_id) return
      if (!ligneMap[v.customer_id]) ligneMap[v.customer_id] = []
      ligneMap[v.customer_id].push({ ...l, product: prods.find(p => p.id === l.product_id) })
    })

    const cids = Object.keys(ligneMap)
    const { data: customersData } = await supabase.from('customers').select('id, prenom, nom, email, telephone').in('id', cids)
    const custMap = Object.fromEntries((customersData || []).map(c => [c.id, c]))

    const result = cids.map(cid => {
      const ls = ligneMap[cid]
      const ca = ls.reduce((s, l) => s + parseFloat(l.total_ttc || 0), 0)
      const qte = ls.reduce((s, l) => s + parseInt(l.quantite || 0), 0)
      const produits = [...new Set(ls.map(l => l.product?.nom).filter(Boolean))]
      const cust = custMap[cid] || {}
      return { id: cid, ca, qte, produits, ...cust }
    }).sort((a, b) => b.ca - a.ca)

    setClients(result)
    setLoading(false)
  }, [categorie, motCle, siteId])

  useEffect(() => { search() }, [categorie, siteId])

  const handleExportCSV = () => {
    const rows = [
      ['Prénom', 'Nom', 'Email', 'Téléphone', 'CA (€)', 'Qté', 'Produits achetés'],
      ...clients.map(c => [c.prenom || '', c.nom || '', c.email || '', c.telephone || '', c.ca.toFixed(2), c.qte, c.produits.join(' | ')]),
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `clients_${categorie}${motCle ? '_' + motCle : ''}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>Segmentation clients par produit</SectionTitle>
      <div style={{ background: BG_CARD, border: `0.5px solid rgba(201,169,110,0.2)`, borderRadius: 8, padding: '20px 22px' }}>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 16, lineHeight: 1.6 }}>
          Identifiez les clients selon leurs habitudes d'achat pour les inviter à vos événements privés.
        </p>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'end', flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Catégorie</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCategorie(c); setMotCle('') }} style={{ background: categorie === c ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${categorie === c ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`, color: categorie === c ? GOLD : 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' as const }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Filtrer par nom de produit</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={motCle} onChange={e => setMotCle(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder='Ex: "whisky", "bordeaux", "cognac"…' style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px' }} />
              <button onClick={search} disabled={loading} style={{ background: GOLD, color: '#0d0a08', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {loading ? '⟳' : 'Filtrer'}
              </button>
            </div>
          </div>
          {clients.length > 0 && (
            <button onClick={handleExportCSV} style={{ background: 'rgba(110,158,201,0.1)', border: '0.5px solid rgba(110,158,201,0.3)', color: '#6e9ec9', borderRadius: 4, padding: '9px 16px', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
              ↓ Export CSV (invitations)
            </button>
          )}
        </div>

        {/* Produits trouvés */}
        {produitsDispo.length > 0 && (
          <div style={{ marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1 }}>PRODUITS INCLUS :</span>
            {produitsDispo.slice(0, 10).map(p => (
              <span key={p} style={{ fontSize: 10, background: 'rgba(201,169,110,0.1)', color: GOLD, padding: '2px 8px', borderRadius: 10 }}>{p}</span>
            ))}
            {produitsDispo.length > 10 && <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>+{produitsDispo.length - 10} autres</span>}
          </div>
        )}

        {/* Résultats */}
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)' }}>⟳ Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', fontSize: 13 }}>Aucun client trouvé pour ce filtre</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 10 }}>
              <span style={{ color: GOLD, fontFamily: 'Georgia, serif', fontSize: 16 }}>{clients.length}</span> clients identifiés — CA total : <span style={{ color: GOLD }}>{fmtEur(clients.reduce((s, c) => s + c.ca, 0))}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                  {['#', 'Client', 'Email', 'Téléphone', 'CA catégorie', 'Qté', 'Produits achetés'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#e8e0d5', fontWeight: 500 }}>{[c.prenom, c.nom].filter(Boolean).join(' ') || 'Anonyme'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>{c.email || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>{c.telephone || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: GOLD, fontFamily: 'Georgia, serif' }}>{fmtEur(c.ca)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>{c.qte}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                        {c.produits.slice(0, 3).map((p: string) => (
                          <span key={p} style={{ fontSize: 10, background: 'rgba(255,255,255,0.04)', color: 'rgba(232,224,213,0.5)', padding: '2px 6px', borderRadius: 3, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p}</span>
                        ))}
                        {c.produits.length > 3 && <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>+{c.produits.length - 3}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────
export default function StatistiquesPage() {
  const [periode, setPeriode] = useState<Periode>('30j')
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')

  useEffect(() => {
    supabase.from('sites').select('id, nom').eq('actif', true).order('nom')
      .then(({ data }) => setSites(data || []))
  }, [])

  const PERIODES: { v: Periode; label: string }[] = [
    { v: '7j', label: '7 jours' }, { v: '30j', label: '30 jours' },
    { v: '3m', label: '3 mois' }, { v: '6m', label: '6 mois' }, { v: '12m', label: '12 mois' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex' }}>
      {/* Sidebar simple */}
      <aside style={{ width: 200, background: '#100d0a', borderRight: `0.5px solid ${BORDER}`, padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 10 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: `0.5px solid ${BORDER}` }}>
          <a href="/admin" style={{ display: 'block', textDecoration: 'none' }}>
            <img src="/logo.png" alt="" onError={e => (e.currentTarget.style.display = 'none')} style={{ width: '100%', maxHeight: 44, objectFit: 'contain' }} />
          </a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: GOLD, letterSpacing: 2, textTransform: 'uppercase' as const, fontWeight: 300, marginTop: 8 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>STATISTIQUES</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', fontSize: 12, color: 'rgba(232,224,213,0.4)', textDecoration: 'none' }}>
            ← Retour au backoffice
          </a>
          <a href="/admin/comptabilite" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', fontSize: 12, color: 'rgba(232,224,213,0.4)', textDecoration: 'none' }}>
            € Comptabilité
          </a>
        </nav>
      </aside>

      {/* Contenu */}
      <main style={{ marginLeft: 200, flex: 1, padding: '32px 36px' }}>
        {/* Header + filtres */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Statistiques</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 20 }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

          {/* Filtres globaux */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 4 }}>
              {PERIODES.map(p => (
                <button key={p.v} onClick={() => setPeriode(p.v)} style={{ background: periode === p.v ? GOLD : 'transparent', color: periode === p.v ? '#0d0a08' : 'rgba(232,224,213,0.5)', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 11, fontWeight: periode === p.v ? 600 : 400, cursor: 'pointer' }}>{p.label}</button>
              ))}
            </div>
            <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e0d5', fontSize: 12, padding: '8px 12px' }}>
              <option value="">Tous les sites</option>
              {sites.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1408' }}>{s.nom}</option>)}
            </select>
          </div>
        </div>

        {/* Modules */}
        <ModuleKPIs periode={periode} siteId={siteId} />
        <ModuleCA periode={periode} siteId={siteId} />
        <ModuleProduits periode={periode} siteId={siteId} />
        <ModuleHeatmap periode={periode} siteId={siteId} />
        <ModuleClients periode={periode} siteId={siteId} />
        <ModuleClientsCategorie siteId={siteId} />
      </main>
    </div>
  )
}