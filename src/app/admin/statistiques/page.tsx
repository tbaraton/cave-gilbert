'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseDb as supabase } from '@/lib/supabase-db'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

type Vue = 'ventes_jour' | 'stats_clients' | 'stats_produits'

const GOLD = '#c9a96e'
const BORDER = 'rgba(255,255,255,0.07)'
const BG = '#18130e'
const ID_MARCY    = 'ee3afa96-0c45-407f-87fc-e503fbada6c4'
const ID_ENTREPOT = 'e12d7e47-23dc-4011-95fc-e9e975fc4307'
const ID_ARBRESLE = '3097e864-f452-4c2e-9af3-21e26f0330b7'
const COULEUR_COLORS: Record<string, string> = { rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0', effervescent: '#a0b0e0', champagne: '#d4c88a', spiritueux: '#8ec98e', biere: '#d4a056', autre: '#888' }

function fmtEur(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' }
function fmtNum(n: number) { return n.toLocaleString('fr-FR') }

const tt = { contentStyle: { background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, fontSize: 12 }, labelStyle: { color: GOLD }, itemStyle: { color: '#e8e0d5' } }

function Spinner() { return <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement…</div> }

function VentesJour() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshAt, setRefreshAt] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    const debut = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const fin = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

    const [{ data: ventes }, { data: toutesLignes }] = await Promise.all([
      supabase.from('ventes').select('id, site_id, total_ttc, customer_id, created_at').eq('statut', 'validee').gte('created_at', debut).lte('created_at', fin),
      supabase.from('vente_lignes').select('vente_id, product_id, nom_produit, quantite'),
    ])

    const ventesAuj = ventes || []
    const ventesIds = ventesAuj.map(v => v.id)
    const lignesAuj = (toutesLignes || []).filter(l => ventesIds.includes(l.vente_id))

    const sites = [
      { id: ID_MARCY, nom: 'Cave de Gilbert', icon: '🏪', note: '' },
      { id: ID_ARBRESLE, nom: 'La Petite Cave', icon: '🍷', note: '' },
      { id: ID_ENTREPOT, nom: 'Entrepôt', icon: '📦', note: '(e-commerce)' },
    ]
    const parSite = sites.map(s => {
      const vs = ventesAuj.filter(v => v.site_id === s.id)
      return { ...s, ca: vs.reduce((a, v) => a + parseFloat(v.total_ttc || 0), 0), nb: vs.length, clients: new Set(vs.map(v => v.customer_id).filter(Boolean)).size, panier: vs.length > 0 ? vs.reduce((a, v) => a + parseFloat(v.total_ttc || 0), 0) / vs.length : 0 }
    })

    const parHeure: Record<number, { nb: number; ca: number }> = {}
    ventesAuj.forEach(v => { const h = new Date(v.created_at).getHours(); if (!parHeure[h]) parHeure[h] = { nb: 0, ca: 0 }; parHeure[h].nb++; parHeure[h].ca += parseFloat(v.total_ttc || 0) })
    const timeline = Array.from({ length: 24 }, (_, i) => ({ h: `${i}h`, nb: parHeure[i]?.nb || 0, ca: parHeure[i]?.ca || 0 }))

    const prodAgg: Record<string, { nom: string; qte: number }> = {}
    lignesAuj.forEach(l => { if (!prodAgg[l.product_id]) prodAgg[l.product_id] = { nom: l.nom_produit || l.product_id, qte: 0 }; prodAgg[l.product_id].qte += parseInt(l.quantite || 0) })
    const topProduits = Object.values(prodAgg).sort((a, b) => b.qte - a.qte).slice(0, 8)

    const total = { ca: ventesAuj.reduce((a, v) => a + parseFloat(v.total_ttc || 0), 0), nb: ventesAuj.length, clients: new Set(ventesAuj.map(v => v.customer_id).filter(Boolean)).size }
    setData({ parSite, timeline, topProduits, total })
    setRefreshAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  if (loading) return <Spinner />
  if (!data) return null
  const { parSite, timeline, topProduits, total } = data

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div><h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Ventes du jour</h1><p style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {refreshAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p></div>
        <button onClick={load} style={{ background: 'transparent', border: `0.5px solid ${GOLD}`, color: GOLD, borderRadius: 4, padding: '8px 16px', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>↺ Actualiser</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[{ label: 'CA TTC total', value: fmtEur(total.ca), color: GOLD }, { label: 'Transactions', value: fmtNum(total.nb), color: '#6e9ec9' }, { label: 'Clients distincts', value: fmtNum(total.clients), color: '#6ec96e' }].map(({ label, value, color }) => (
          <div key={label} style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, color, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {parSite.map((s: any) => (
          <div key={s.id} style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><span style={{ fontSize: 18 }}>{s.icon}</span><div><div style={{ fontSize: 13, color: '#f0e8d8', fontWeight: 500 }}>{s.nom}</div>{s.note && <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)' }}>{s.note}</div>}</div></div>
            <div style={{ fontSize: 24, color: GOLD, fontFamily: 'Georgia, serif', marginBottom: 10 }}>{fmtEur(s.ca)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[{ label: 'Ventes', val: s.nb }, { label: 'Clients', val: s.clients }, { label: 'Panier moy.', val: s.panier > 0 ? s.panier.toFixed(0) + '€' : '—' }].map(({ label, val }) => (
                <div key={label} style={{ textAlign: 'center' as const }}><div style={{ fontSize: 15, color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>{val}</div><div style={{ fontSize: 9, color: 'rgba(232,224,213,0.35)', letterSpacing: 1, textTransform: 'uppercase' as const }}>{label}</div></div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 14 }}>Ventes par heure</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="h" tick={{ fill: 'rgba(232,224,213,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: 'rgba(232,224,213,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip {...tt} formatter={(v: any) => [v, 'Ventes']} />
              <Bar dataKey="nb" fill={GOLD} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 14 }}>Top produits</div>
          {topProduits.length === 0 ? (<div style={{ color: 'rgba(232,224,213,0.3)', fontSize: 12, textAlign: 'center' as const, padding: 24 }}>Aucune vente aujourd'hui</div>) : topProduits.map((p: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < topProduits.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', width: 16 }}>#{i + 1}</span><span style={{ fontSize: 12, color: '#e8e0d5' }}>{p.nom}</span></div>
              <span style={{ fontSize: 12, color: GOLD, fontFamily: 'Georgia, serif' }}>{p.qte} btl</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatsClients() {
  type Periode = '7j' | '30j' | '3m' | '6m' | '12m'
  const [periode, setPeriode] = useState<Periode>('30j')
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState('ca_total')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const dateDebut = useCallback(() => {
    const d = new Date()
    if (periode === '7j') d.setDate(d.getDate() - 7)
    else if (periode === '30j') d.setDate(d.getDate() - 30)
    else if (periode === '3m') d.setMonth(d.getMonth() - 3)
    else if (periode === '6m') d.setMonth(d.getMonth() - 6)
    else d.setFullYear(d.getFullYear() - 1)
    return d.toISOString()
  }, [periode])

  const load = useCallback(async () => {
    setLoading(true)
    const debut = dateDebut()
    const { data: ventes } = await supabase.from('ventes').select('id, customer_id, total_ttc, created_at').eq('statut', 'validee').gte('created_at', debut).not('customer_id', 'is', null)
    if (!ventes?.length) { setClients([]); setLoading(false); return }

    const ventesIds = ventes.map(v => v.id)
    const { data: lignes } = await supabase.from('vente_lignes').select('vente_id, quantite').in('vente_id', ventesIds)

    const byClient: Record<string, any> = {}
    ventes.forEach(v => {
      if (!v.customer_id) return
      if (!byClient[v.customer_id]) byClient[v.customer_id] = { id: v.customer_id, ca_total: 0, nb_passages: 0, nb_bouteilles: 0, dernier_achat: '' }
      byClient[v.customer_id].ca_total += parseFloat(v.total_ttc || 0)
      byClient[v.customer_id].nb_passages++
      if (v.created_at > byClient[v.customer_id].dernier_achat) byClient[v.customer_id].dernier_achat = v.created_at
    })
    ;(lignes || []).forEach(l => {
      const v = ventes.find(x => x.id === l.vente_id)
      if (!v?.customer_id || !byClient[v.customer_id]) return
      byClient[v.customer_id].nb_bouteilles += parseInt(l.quantite || 0)
    })

    const cids = Object.keys(byClient)
    const { data: customersData } = await supabase.from('customers').select('id, prenom, nom, email, telephone').in('id', cids)
    const custMap = Object.fromEntries((customersData || []).map(c => [c.id, c]))

    const result = cids.map(cid => ({ ...byClient[cid], ...(custMap[cid] || {}), panier_moyen: byClient[cid].nb_passages > 0 ? byClient[cid].ca_total / byClient[cid].nb_passages : 0 }))
    setClients(result)
    setLoading(false)
  }, [dateDebut])

  useEffect(() => { load() }, [load])

  const loadDetail = async (client: any) => {
    setSelected(client); setLoadingDetail(true)
    const { data: ventes } = await supabase.from('ventes').select('id, total_ttc, created_at, site_id').eq('customer_id', client.id).eq('statut', 'validee').order('created_at', { ascending: false }).limit(50)
    if (!ventes?.length) { setDetail({ ventes: [], topProduits: [] }); setLoadingDetail(false); return }
    const ventesIds = ventes.map(v => v.id)
    const { data: lignes } = await supabase.from('vente_lignes').select('vente_id, product_id, nom_produit, quantite, total_ttc').in('vente_id', ventesIds)
    const { data: sites } = await supabase.from('sites').select('id, nom')
    const siteMap = Object.fromEntries((sites || []).map(s => [s.id, s.nom]))
    const prodAgg: Record<string, { nom: string; qte: number; ca: number }> = {}
    ;(lignes || []).forEach(l => { if (!prodAgg[l.product_id]) prodAgg[l.product_id] = { nom: l.nom_produit || '—', qte: 0, ca: 0 }; prodAgg[l.product_id].qte += parseInt(l.quantite || 0); prodAgg[l.product_id].ca += parseFloat(l.total_ttc || 0) })
    const topProduits = Object.values(prodAgg).sort((a, b) => b.ca - a.ca).slice(0, 10)
    setDetail({ ventes: ventes.map(v => ({ ...v, site_nom: siteMap[v.site_id] || '—' })), topProduits })
    setLoadingDetail(false)
  }

  const handleSort = (col: string) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc') } }
  const si = (col: string) => sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  const filtered = clients.filter(c => { const q = search.toLowerCase(); return !q || [c.prenom, c.nom, c.email].filter(Boolean).some((s: string) => s.toLowerCase().includes(q)) }).sort((a, b) => { const v = sortDir === 'desc' ? b[sortCol] - a[sortCol] : a[sortCol] - b[sortCol]; return isNaN(v) ? 0 : v })

  const PERIODES: { v: Periode; label: string }[] = [{ v: '7j', label: '7j' }, { v: '30j', label: '30j' }, { v: '3m', label: '3m' }, { v: '6m', label: '6m' }, { v: '12m', label: '12m' }]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Stats Clients</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 12, padding: '7px 12px' }} />
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 4, border: '0.5px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              {PERIODES.map(p => (<button key={p.v} onClick={() => setPeriode(p.v)} style={{ background: periode === p.v ? GOLD : 'transparent', color: periode === p.v ? '#0d0a08' : 'rgba(232,224,213,0.5)', border: 'none', padding: '7px 12px', fontSize: 11, fontWeight: periode === p.v ? 600 : 400, cursor: 'pointer' }}>{p.label}</button>))}
            </div>
          </div>
        </div>

        {!loading && clients.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[{ label: 'Clients actifs', value: fmtNum(clients.length) }, { label: 'CA total', value: fmtEur(clients.reduce((a, c) => a + c.ca_total, 0)) }, { label: 'Bouteilles vendues', value: fmtNum(clients.reduce((a, c) => a + c.nb_bouteilles, 0)) }, { label: 'Panier moyen', value: fmtEur(clients.length > 0 ? clients.reduce((a, c) => a + c.panier_moyen, 0) / clients.length : 0) }].map(({ label, value }) => (
              <div key={label} style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '14px 16px' }}><div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div><div style={{ fontSize: 18, color: GOLD, fontFamily: 'Georgia, serif' }}>{value}</div></div>
            ))}
          </div>
        )}

        {loading ? <Spinner /> : (
          <div style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                  {[{ l: 'Client', c: null }, { l: `CA${si('ca_total')}`, c: 'ca_total' }, { l: `Bouteilles${si('nb_bouteilles')}`, c: 'nb_bouteilles' }, { l: `Passages${si('nb_passages')}`, c: 'nb_passages' }, { l: `Panier moy.${si('panier_moyen')}`, c: 'panier_moyen' }, { l: 'Dernier achat', c: null }].map(({ l, c }) => (
                    <th key={l} onClick={c ? () => handleSort(c) : undefined} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: c && sortCol === c ? GOLD : 'rgba(232,224,213,0.3)', fontWeight: 400, cursor: c ? 'pointer' : 'default', userSelect: 'none' as const }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((c: any) => (
                  <tr key={c.id} onClick={() => loadDetail(c)} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: selected?.id === c.id ? 'rgba(201,169,110,0.08)' : 'transparent' }} onMouseEnter={e => { if (selected?.id !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }} onMouseLeave={e => { if (selected?.id !== c.id) e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '10px 14px' }}><div style={{ fontSize: 13, color: '#f0e8d8', fontWeight: 500 }}>{[c.prenom, c.nom].filter(Boolean).join(' ') || 'Anonyme'}</div><div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{c.email || c.telephone || '—'}</div></td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: GOLD, fontFamily: 'Georgia, serif' }}>{fmtEur(c.ca_total)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#e8e0d5' }}>{fmtNum(c.nb_bouteilles)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#e8e0d5' }}>{c.nb_passages}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>{fmtEur(c.panier_moyen)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{c.dernier_achat ? new Date(c.dernier_achat).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center' as const, color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucun client</div>}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ background: BG, border: `0.5px solid rgba(201,169,110,0.25)`, borderRadius: 8, padding: '20px', height: 'fit-content', position: 'sticky' as const, top: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div><div style={{ fontSize: 15, color: '#f0e8d8', fontWeight: 600, marginBottom: 2 }}>{[selected.prenom, selected.nom].filter(Boolean).join(' ') || 'Anonyme'}</div>{selected.email && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{selected.email}</div>}{selected.telephone && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{selected.telephone}</div>}</div>
            <button onClick={() => { setSelected(null); setDetail(null) }} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[{ label: 'CA total', value: fmtEur(selected.ca_total) }, { label: 'Bouteilles', value: fmtNum(selected.nb_bouteilles) }, { label: 'Passages', value: String(selected.nb_passages) }, { label: 'Panier moy.', value: fmtEur(selected.panier_moyen) }].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '8px 10px', textAlign: 'center' as const }}><div style={{ fontSize: 14, color: GOLD, fontFamily: 'Georgia, serif' }}>{value}</div><div style={{ fontSize: 9, color: 'rgba(232,224,213,0.35)', letterSpacing: 1 }}>{label.toUpperCase()}</div></div>
            ))}
          </div>
          {loadingDetail ? <Spinner /> : detail && (
            <>
              {detail.topProduits?.length > 0 && (<><div style={{ fontSize: 10, letterSpacing: 1.5, color: GOLD, textTransform: 'uppercase' as const, marginBottom: 8 }}>Top produits</div>{detail.topProduits.map((p: any, i: number) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontSize: 11 }}><span style={{ color: 'rgba(232,224,213,0.7)' }}>{p.nom}</span><span style={{ color: GOLD }}>{fmtEur(p.ca)} · {p.qte} btl</span></div>))}<div style={{ height: 12 }} /></>)}
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: GOLD, textTransform: 'uppercase' as const, marginBottom: 8 }}>Historique ({detail.ventes?.length})</div>
              <div style={{ maxHeight: 260, overflowY: 'auto' as const }}>
                {detail.ventes?.map((v: any) => (<div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontSize: 11 }}><div><div style={{ color: '#e8e0d5' }}>{new Date(v.created_at).toLocaleDateString('fr-FR')}</div><div style={{ color: 'rgba(232,224,213,0.4)', fontSize: 10 }}>{v.site_nom}</div></div><span style={{ color: GOLD, fontFamily: 'Georgia, serif' }}>{fmtEur(parseFloat(v.total_ttc))}</span></div>))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StatsProduits() {
  type Onglet = 'produits' | 'regions' | 'appellations' | 'couleurs' | 'domaines'
  type Periode = '30j' | '3m' | '6m' | '12m' | 'all'
  const [onglet, setOnglet] = useState<Onglet>('produits')
  const [periode, setPeriode] = useState<Periode>('3m')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState('ca')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const dateDebut = useCallback((): string | null => {
    if (periode === 'all') return null
    const d = new Date()
    if (periode === '30j') d.setDate(d.getDate() - 30)
    else if (periode === '3m') d.setMonth(d.getMonth() - 3)
    else if (periode === '6m') d.setMonth(d.getMonth() - 6)
    else d.setFullYear(d.getFullYear() - 1)
    return d.toISOString()
  }, [periode])

  const load = useCallback(async () => {
    setLoading(true)
    const debut = dateDebut()
    const { data: produits } = await supabase.from('products').select('id, nom, couleur, categorie, prix_achat_ht, prix_vente_ttc, region_id, appellation_id, domaine_id').eq('actif', true)

    let qV = supabase.from('ventes').select('id').eq('statut', 'validee')
    if (debut) qV = qV.gte('created_at', debut)
    const { data: ventesRaw } = await qV
    const ventesIds = (ventesRaw || []).map((v: any) => v.id)

    let lignes: any[] = []
    if (ventesIds.length > 0) {
      const { data: l } = await supabase.from('vente_lignes').select('product_id, quantite, total_ttc').in('vente_id', ventesIds)
      lignes = l || []
    }

    const prodAgg: Record<string, { ca: number; qte: number }> = {}
    lignes.forEach(l => { if (!prodAgg[l.product_id]) prodAgg[l.product_id] = { ca: 0, qte: 0 }; prodAgg[l.product_id].ca += parseFloat(l.total_ttc || 0); prodAgg[l.product_id].qte += parseInt(l.quantite || 0) })

    const prods = (produits || []).map(p => {
      const agg = prodAgg[p.id] || { ca: 0, qte: 0 }
      const ht = parseFloat(p.prix_achat_ht || 0); const ttc = parseFloat(p.prix_vente_ttc || 0)
      return { ...p, ...agg, marge_euro: ht > 0 ? ttc - ht : null, marge_pct: ht > 0 ? ((ttc - ht) / ht) * 100 : null, marge_brute: ht > 0 ? (ttc - ht) * agg.qte : null }
    })

    const [{ data: regionsData }, { data: appsData }, { data: domainesData }] = await Promise.all([
      supabase.from('regions').select('id, nom'),
      supabase.from('appellations').select('id, nom'),
      supabase.from('domaines').select('id, nom'),
    ])
    const regMap = Object.fromEntries((regionsData || []).map(r => [r.id, r.nom]))
    const appMap = Object.fromEntries((appsData || []).map(a => [a.id, a.nom]))
    const domMap = Object.fromEntries((domainesData || []).map(d => [d.id, d.nom]))

    const agg = (key: string, getLabel: (p: any) => string) => {
      const res: Record<string, any> = {}
      prods.filter(p => (p as any)[key]).forEach(p => {
        const k = (p as any)[key]; if (!res[k]) res[k] = { nom: getLabel(p), ca: 0, qte: 0, marge: 0, nb: 0 }
        res[k].ca += p.ca; res[k].qte += p.qte; if (p.marge_brute) res[k].marge += p.marge_brute; res[k].nb++
      })
      return Object.values(res).sort((a, b) => b.ca - a.ca)
    }

    setData({
      produits: prods.sort((a, b) => b.ca - a.ca),
      regions: agg('region_id', p => regMap[p.region_id] || p.region_id),
      appellations: agg('appellation_id', p => appMap[p.appellation_id] || p.appellation_id).slice(0, 20),
      couleurs: Object.entries(prods.reduce((acc: any, p) => { if (!p.couleur) return acc; if (!acc[p.couleur]) acc[p.couleur] = { couleur: p.couleur, ca: 0, qte: 0, marge: 0, nb: 0 }; acc[p.couleur].ca += p.ca; acc[p.couleur].qte += p.qte; if (p.marge_brute) acc[p.couleur].marge += p.marge_brute; acc[p.couleur].nb++; return acc }, {})).map(([, v]) => v).sort((a: any, b: any) => b.ca - a.ca),
      domaines: agg('domaine_id', p => domMap[p.domaine_id] || p.domaine_id).slice(0, 20),
    })
    setLoading(false)
  }, [dateDebut])

  useEffect(() => { load() }, [load])

  const ONGLETS: { id: Onglet; label: string }[] = [{ id: 'produits', label: 'Produits' }, { id: 'regions', label: 'Régions' }, { id: 'appellations', label: 'Appellations' }, { id: 'couleurs', label: 'Couleurs' }, { id: 'domaines', label: 'Domaines' }]
  const PERIODES: { v: Periode; label: string }[] = [{ v: '30j', label: '30j' }, { v: '3m', label: '3m' }, { v: '6m', label: '6m' }, { v: '12m', label: '12m' }, { v: 'all', label: 'Tout' }]

  const handleSort = (col: string) => { if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortCol(col); setSortDir('desc') } }
  const si = (col: string) => sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
  const sortList = (list: any[], col: string) => [...list].sort((a, b) => sortDir === 'desc' ? (b[col] || 0) - (a[col] || 0) : (a[col] || 0) - (b[col] || 0))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Stats Produits</h1>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 4, border: '0.5px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {PERIODES.map(p => (<button key={p.v} onClick={() => setPeriode(p.v)} style={{ background: periode === p.v ? GOLD : 'transparent', color: periode === p.v ? '#0d0a08' : 'rgba(232,224,213,0.5)', border: 'none', padding: '7px 14px', fontSize: 11, fontWeight: periode === p.v ? 600 : 400, cursor: 'pointer' }}>{p.label}</button>))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `0.5px solid ${BORDER}` }}>
        {ONGLETS.map(o => (<button key={o.id} onClick={() => { setOnglet(o.id); setSortCol('ca'); setSortDir('desc') }} style={{ background: 'transparent', border: 'none', borderBottom: onglet === o.id ? `2px solid ${GOLD}` : '2px solid transparent', color: onglet === o.id ? GOLD : 'rgba(232,224,213,0.4)', padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginBottom: -1, letterSpacing: 0.5 }}>{o.label}</button>))}
      </div>

      {loading ? <Spinner /> : !data ? null : (
        <>
          {onglet === 'couleurs' && data.couleurs.filter((c: any) => c.ca > 0).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={data.couleurs.filter((c: any) => c.ca > 0)} dataKey="ca" nameKey="couleur" cx="50%" cy="50%" outerRadius={80} innerRadius={35}>{data.couleurs.filter((c: any) => c.ca > 0).map((c: any, i: number) => (<Cell key={i} fill={COULEUR_COLORS[c.couleur] || '#888'} />))}</Pie><Tooltip {...tt} formatter={(v: any) => [fmtEur(v), 'CA TTC']} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '16px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sortList(data.couleurs.filter((c: any) => c.ca > 0), 'ca')} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: 'rgba(232,224,213,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
                    <YAxis type="category" dataKey="couleur" tick={{ fill: 'rgba(232,224,213,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip {...tt} formatter={(v: any) => [fmtEur(v), 'CA TTC']} />
                    <Bar dataKey="ca" radius={[0, 3, 3, 0]}>{sortList(data.couleurs.filter((c: any) => c.ca > 0), 'ca').map((c: any, i: number) => (<Cell key={i} fill={COULEUR_COLORS[c.couleur] || '#888'} />))}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                  {onglet === 'produits' && [{ l: 'Produit', c: null }, { l: `CA TTC${si('ca')}`, c: 'ca' }, { l: `Qté${si('qte')}`, c: 'qte' }, { l: `Marge €${si('marge_euro')}`, c: 'marge_euro' }, { l: `Marge %${si('marge_pct')}`, c: 'marge_pct' }, { l: `Marge brute${si('marge_brute')}`, c: 'marge_brute' }, { l: 'Couleur', c: null }].map(({ l, c }) => (<th key={l} onClick={c ? () => handleSort(c) : undefined} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: c && sortCol === c ? GOLD : 'rgba(232,224,213,0.3)', fontWeight: 400, cursor: c ? 'pointer' : 'default', userSelect: 'none' as const }}>{l}</th>))}
                  {onglet !== 'produits' && onglet !== 'couleurs' && [{ l: 'Nom', c: null }, { l: `CA TTC${si('ca')}`, c: 'ca' }, { l: `Qté${si('qte')}`, c: 'qte' }, { l: `Marge brute${si('marge')}`, c: 'marge' }, { l: `Réf.${si('nb')}`, c: 'nb' }].map(({ l, c }) => (<th key={l} onClick={c ? () => handleSort(c) : undefined} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: c && sortCol === c ? GOLD : 'rgba(232,224,213,0.3)', fontWeight: 400, cursor: c ? 'pointer' : 'default', userSelect: 'none' as const }}>{l}</th>))}
                  {onglet === 'couleurs' && [{ l: 'Couleur', c: null }, { l: `CA TTC${si('ca')}`, c: 'ca' }, { l: `Qté${si('qte')}`, c: 'qte' }, { l: `Marge brute${si('marge')}`, c: 'marge' }, { l: `Réf.${si('nb')}`, c: 'nb' }].map(({ l, c }) => (<th key={l} onClick={c ? () => handleSort(c) : undefined} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 9, letterSpacing: 1.5, color: c && sortCol === c ? GOLD : 'rgba(232,224,213,0.3)', fontWeight: 400, cursor: c ? 'pointer' : 'default', userSelect: 'none' as const }}>{l}</th>))}
                </tr>
              </thead>
              <tbody>
                {onglet === 'produits' && sortList(data.produits, sortCol).slice(0, 60).map((p: any, i: number) => (
                  <tr key={p.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 14px' }}><div style={{ fontSize: 13, color: '#f0e8d8' }}>{p.nom}</div><div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)' }}>{p.categorie}</div></td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: GOLD, fontFamily: 'Georgia, serif' }}>{p.ca > 0 ? fmtEur(p.ca) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#e8e0d5' }}>{p.qte > 0 ? p.qte : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: p.marge_euro > 0 ? '#6ec96e' : 'rgba(232,224,213,0.4)' }}>{p.marge_euro !== null ? fmtEur(p.marge_euro) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{p.marge_pct !== null ? <span style={{ fontSize: 12, color: p.marge_pct > 50 ? '#6ec96e' : p.marge_pct > 20 ? GOLD : '#c96e6e' }}>{p.marge_pct.toFixed(0)}%</span> : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: p.marge_brute > 0 ? '#6ec96e' : 'rgba(232,224,213,0.4)' }}>{p.marge_brute !== null && p.marge_brute > 0 ? fmtEur(p.marge_brute) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, color: COULEUR_COLORS[p.couleur] || '#888' }}>● {p.couleur}</span></td>
                  </tr>
                ))}
                {onglet !== 'produits' && onglet !== 'couleurs' && sortList(onglet === 'regions' ? data.regions : onglet === 'appellations' ? data.appellations : data.domaines, sortCol).map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#f0e8d8' }}>{r.nom}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: GOLD, fontFamily: 'Georgia, serif' }}>{r.ca > 0 ? fmtEur(r.ca) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#e8e0d5' }}>{r.qte > 0 ? fmtNum(r.qte) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: r.marge > 0 ? '#6ec96e' : 'rgba(232,224,213,0.4)' }}>{r.marge > 0 ? fmtEur(r.marge) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>{r.nb}</td>
                  </tr>
                ))}
                {onglet === 'couleurs' && sortList(data.couleurs, sortCol).map((c: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: COULEUR_COLORS[c.couleur] || '#888', display: 'inline-block' }} /><span style={{ fontSize: 13, color: '#f0e8d8', textTransform: 'capitalize' as const }}>{c.couleur}</span></div></td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: GOLD, fontFamily: 'Georgia, serif' }}>{c.ca > 0 ? fmtEur(c.ca) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#e8e0d5' }}>{c.qte > 0 ? fmtNum(c.qte) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: c.marge > 0 ? '#6ec96e' : 'rgba(232,224,213,0.4)' }}>{c.marge > 0 ? fmtEur(c.marge) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>{c.nb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default function StatistiquesPage() {
  const [vue, setVue] = useState<Vue>('ventes_jour')
  const NAV = [{ id: 'ventes_jour' as Vue, label: 'Ventes du jour', icon: '🗓' }, { id: 'stats_clients' as Vue, label: 'Stats Clients', icon: '👥' }, { id: 'stats_produits' as Vue, label: 'Stats Produits', icon: '🍷' }]

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex' }}>
      <aside style={{ width: 220, background: '#100d0a', borderRight: `0.5px solid ${BORDER}`, padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 10 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: `0.5px solid ${BORDER}` }}>
          <a href="/admin" style={{ display: 'block', textDecoration: 'none' }}><img src="/logo.png" alt="" onError={e => (e.currentTarget.style.display = 'none')} style={{ width: '100%', maxHeight: 44, objectFit: 'contain', marginBottom: 8 }} /></a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: GOLD, letterSpacing: 2, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 2 }}>STATISTIQUES</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          {NAV.map(n => (<button key={n.id} onClick={() => setVue(n.id)} style={{ width: '100%', textAlign: 'left' as const, background: vue === n.id ? 'rgba(201,169,110,0.1)' : 'transparent', borderLeft: `2px solid ${vue === n.id ? GOLD : 'transparent'}`, border: 'none', borderLeftStyle: 'solid' as const, color: vue === n.id ? GOLD : 'rgba(232,224,213,0.5)', padding: '11px 20px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: 0.5 }}><span style={{ fontSize: 16 }}>{n.icon}</span>{n.label}</button>))}
          <div style={{ height: '0.5px', background: BORDER, margin: '12px 0' }} />
          <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.35)', textDecoration: 'none' }}>← Retour au backoffice</a>
        </nav>
      </aside>
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>
        {vue === 'ventes_jour' && <VentesJour />}
        {vue === 'stats_clients' && <StatsClients />}
        {vue === 'stats_produits' && <StatsProduits />}
      </main>
    </div>
  )
}