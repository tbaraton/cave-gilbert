'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fmt = (n: number) => n.toFixed(2) + '\u20ac'

const SITE_LABELS: Record<string, string> = {
  cave_gilbert: 'Cave de Gilbert',
  petite_cave: 'La Petite Cave',
  entrepot: 'Entrep\u00f4t',
  livraison: '\U0001f69a \u00c0 livrer',
}

const INVENTAIRE_MATERIEL = [
  { id: 1, item: 'Une tireuse froid sec' },
  { id: 2, item: 'Un bec Easy Pracc' },
  { id: 3, item: "L'outil pour retirer le bec Easy Pracc" },
  { id: 4, item: 'Un tuyau gris' },
  { id: 5, item: 'Un tuyau rouge' },
  { id: 6, item: 'Une t\u00eate de percussion' },
  { id: 7, item: 'Une grille de r\u00e9cup\u00e9ration' },
]

interface Props {
  onClose: () => void
}

export function ModuleLivraisonLocation({ onClose }: Props) {
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [etape, setEtape] = useState<'liste' | 'bon' | 'signature' | 'done'>('liste')
  const [signature, setSignature] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [emailEnvoi, setEmailEnvoi] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('reservations_location')
      .select(`
        *, 
        customer:customers(prenom, nom, raison_sociale, est_societe, email, telephone),
        reservation_futs(*, fut:futs_catalogue(*)),
        reservation_tireuses(*, tireuse:tireuses(*))
      `)
      .eq('statut', 'confirm\u00e9e')
      .lte('date_debut', today)
      .order('date_debut', { ascending: true })
    setReservations(data || [])
    setLoading(false)
  }

  const clientNom = (r: any) => {
    if (!r.customer) return 'Client anonyme'
    return r.customer.est_societe
      ? r.customer.raison_sociale
      : `${r.customer.prenom} ${r.customer.nom}`
  }

  // ── Signature canvas ──────────────────────────────────────────
  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#18130e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#c9a96e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }

  useEffect(() => {
    if (showSignaturePad) setTimeout(initCanvas, 100)
  }, [showSignaturePad])

  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0] || e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  const startDraw = (e: any) => {
    drawing.current = true
    const canvas = canvasRef.current!
    lastPos.current = getPos(e, canvas)
    e.preventDefault()
  }
  const draw = (e: any) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }
  const endDraw = () => { drawing.current = false }

  const clearSignature = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#18130e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const validerSignature = () => {
    const canvas = canvasRef.current!
    setSignature(canvas.toDataURL('image/png'))
    setShowSignaturePad(false)
    setEtape('signature')
  }

  // ── G\u00e9n\u00e9ration du bon de livraison HTML ────────────────────────────
  const genererBonLivraison = (sig?: string) => {
    const r = selected
    const clientN = clientNom(r)
    const dateDoc = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    const lignesFuts = (r.reservation_futs || []).map((rf: any) =>
      `<div class="item-ligne"><span class="check">☑</span><span>${rf.quantite} fût(s) ${rf.fut?.nom_cuvee} ${rf.fut?.contenance_litres}L</span></div>`
    ).join('')

    const lignesTireuses = (r.reservation_tireuses || []).map((rt: any) =>
      `<div class="item-ligne"><span class="check">☑</span><span>Tireuse : ${rt.tireuse?.nom} (${rt.tireuse?.modele})</span></div>`
    ).join('')

    const inventaireHtml = INVENTAIRE_MATERIEL.map(m =>
      `<div class="item-ligne"><span class="check">☑</span><span>${m.item}</span></div>`
    ).join('')

    const sigHtml = sig ? `<img src="${sig}" style="max-width:240px;max-height:80px;display:block;margin-top:8px" />` : '<div style="height:60px;border-bottom:1px solid rgba(201,169,110,0.3);margin-top:8px"></div>'

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Bon de livraison ${r.numero}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; background: #0d0a08; color: #e8e0d5; max-width: 800px; margin: 0 auto; padding: 40px 32px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print { body { background: #0d0a08 !important; } * { -webkit-print-color-adjust: exact !important; } }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid rgba(201,169,110,0.3); }
.cave-name { font-size: 20px; color: #c9a96e; font-family: Georgia, serif; letter-spacing: 2px; }
.cave-info { font-size: 11px; color: rgba(232,224,213,0.4); line-height: 2; margin-top: 6px; }
.doc-title { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: rgba(201,169,110,0.6); margin-bottom: 6px; text-align: right; }
.doc-numero { font-size: 22px; color: #c9a96e; font-family: Georgia, serif; text-align: right; }
.doc-date { font-size: 12px; color: rgba(232,224,213,0.4); text-align: right; margin-top: 4px; }
.section { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }
.section-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,169,110,0.6); margin-bottom: 12px; }
.client-nom { font-size: 17px; color: #f0e8d8; font-family: Georgia, serif; margin-bottom: 4px; }
.client-tel { font-size: 13px; color: rgba(232,224,213,0.5); }
.dates { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.date-label { font-size: 10px; color: rgba(232,224,213,0.4); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
.date-val { font-size: 15px; color: #f0e8d8; }
.date-site { font-size: 12px; margin-top: 3px; }
.item-ligne { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; border-bottom: 0.5px solid rgba(255,255,255,0.04); font-size: 14px; color: #e8e0d5; }
.item-ligne:last-child { border-bottom: none; }
.check { color: #c9a96e; font-size: 16px; flex-shrink: 0; }
.warning { background: rgba(201,110,110,0.12); border: 1px solid rgba(201,110,110,0.4); border-radius: 8px; padding: 14px 18px; margin: 16px 0; }
.warning-text { font-size: 14px; color: #c96e6e; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.sig-zone { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
.sig-box { border-top: 0.5px solid rgba(201,169,110,0.3); padding-top: 10px; }
.sig-label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(201,169,110,0.5); margin-bottom: 6px; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 0.5px solid rgba(255,255,255,0.06); font-size: 10px; color: rgba(232,224,213,0.2); line-height: 2; }
</style></head><body>

<div class="header">
  <div>
    <div class="cave-name">Cave de Gilbert</div>
    <div class="cave-info">
      Avenue Jean Colomb — 69280 Marcy l'Étoile<br>
      04 22 91 41 09 · contact@cavedegilbert.fr<br>
      Mar–Sam : 9h30–13h / 15h30–19h
    </div>
  </div>
  <div>
    <div class="doc-title">Bon de livraison location</div>
    <div class="doc-numero">${r.numero}</div>
    <div class="doc-date">${dateDoc} à ${heure}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Client</div>
  <div class="client-nom">${clientN}</div>
  ${r.customer?.telephone ? `<div class="client-tel">📞 ${r.customer.telephone}</div>` : ''}
  ${r.customer?.email ? `<div class="client-tel">${r.customer.email}</div>` : ''}
</div>

<div class="section">
  <div class="section-title">Période de location</div>
  <div class="dates">
    <div>
      <div class="date-label">Départ</div>
      <div class="date-val">${new Date(r.date_debut + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
      ${r.site_retrait ? `<div class="date-site" style="color:#6ec96e">↓ ${SITE_LABELS[r.site_retrait] || r.site_retrait}</div>` : ''}
    </div>
    <div>
      <div class="date-label">Retour prévu</div>
      <div class="date-val">${new Date(r.date_fin + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
      ${r.site_retour ? `<div class="date-site" style="color:#c9b06e">↑ ${SITE_LABELS[r.site_retour] || r.site_retour}</div>` : ''}
    </div>
  </div>
</div>

${lignesFuts || lignesTireuses ? `
<div class="section">
  <div class="section-title">Fûts & tireuse remis</div>
  ${lignesTireuses}
  ${lignesFuts}
</div>` : ''}

<div class="section">
  <div class="section-title">Inventaire du matériel fourni</div>
  ${inventaireHtml}
</div>

<div class="warning">
  <div class="warning-text">⚠ Démontez absolument le bec Easy Pracc avant tout transport de la tireuse</div>
</div>

<div class="section" style="background:rgba(201,110,110,0.05);border-color:rgba(201,110,110,0.2)">
  <div class="section-title">Caution & conditions</div>
  <div style="font-size:13px;color:rgba(232,224,213,0.6);line-height:1.8">
    Caution tireuse : <strong style="color:#f0e8d8">${fmt(r.caution_tireuse_ttc || 0)}</strong>
    ${r.acompte_ttc ? ` · Acompte versé : <strong style="color:#6ec96e">${fmt(r.acompte_ttc)}</strong>` : ''}
    <br>Le matériel est remis en parfait état de fonctionnement. Le locataire s'engage à le restituer dans le même état.
    <br>Tout dommage ou perte sera facturé au prix de remplacement.
  </div>
</div>

<div class="sig-zone">
  <div class="sig-box">
    <div class="sig-label">Signature client — Bon pour accord</div>
    ${sigHtml}
  </div>
  <div class="sig-box">
    <div class="sig-label">Cave de Gilbert</div>
    <div style="font-family:Georgia,serif;font-size:18px;color:#c9a96e;margin-top:8px">Cave de Gilbert</div>
  </div>
</div>

<div class="footer">
  Cave de Gilbert · Avenue Jean Colomb, 69280 Marcy l'Étoile · contact@cavedegilbert.fr · 04 22 91 41 09
</div>

</body></html>`
  }

  // ── Validation livraison ──────────────────────────────────────
  const validerLivraison = async () => {
    if (!selected || !signature) return
    setSaving(true)
    try {
      const r = selected
      // 1. Décrémenter le stock des fûts
      for (const ligne of (r.reservation_futs || [])) {
        const { data: fut } = await supabase
          .from('futs_catalogue')
          .select('stock_actuel')
          .eq('id', ligne.fut_catalogue_id)
          .single()
        if (fut) {
          await supabase
            .from('futs_catalogue')
            .update({ stock_actuel: Math.max(0, fut.stock_actuel - ligne.quantite) })
            .eq('id', ligne.fut_catalogue_id)
        }
      }
      // 2. Passer la réservation en "en_cours"
      await supabase
        .from('reservations_location')
        .update({ statut: 'en_cours' })
        .eq('id', r.id)

      setEtape('done')
    } catch (e) {
      alert('Erreur lors de la validation')
    }
    setSaving(false)
  }

  const imprimerBon = () => {
    const html = genererBonLivraison(signature || undefined)
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const envoyerEmail = async () => {
    if (!selected?.customer?.email) { alert("Pas d'email pour ce client"); return }
    setEmailEnvoi(true)
    try {
      const html = genererBonLivraison(signature || undefined)
      const res = await fetch('/api/envoyer-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selected.customer.email,
          numero: selected.numero,
          clientNom: clientNom(selected),
          html,
        }),
      })
      if (res.ok) alert('Bon envoyé par email ✓')
      else alert('Erreur envoi email')
    } catch { alert('Erreur réseau') }
    setEmailEnvoi(false)
  }

  // ── Styles ────────────────────────────────────────────────────
  const container: any = {
    position: 'fixed', inset: 0, background: '#0d0a08', zIndex: 900,
    display: 'flex', flexDirection: 'column',
    fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5',
  }
  const header: any = {
    padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', gap: 12, background: '#0d0a08', flexShrink: 0,
  }
  const btnPrimary: any = {
    background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12,
    padding: '16px', fontSize: 15, cursor: 'pointer', fontWeight: 700,
    width: '100%', touchAction: 'manipulation',
  }
  const btnSecondary: any = {
    background: 'rgba(255,255,255,0.06)', color: '#e8e0d5',
    border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 12,
    padding: '14px', fontSize: 14, cursor: 'pointer', width: '100%', touchAction: 'manipulation',
  }

  // ── VUE DONE ─────────────────────────────────────────────────
  if (etape === 'done') return (
    <div style={container}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 16 }}>
        <div style={{ fontSize: 56 }}>🍺</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#6ec96e' }}>Livraison validée !</div>
        <div style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'monospace' }}>{selected?.numero}</div>
        <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', textAlign: 'center' }}>
          La réservation est maintenant en cours.<br />Le stock a été mis à jour.
        </div>
        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <button onClick={imprimerBon} style={{ ...btnSecondary }}>🖨 Imprimer le bon de livraison</button>
          {selected?.customer?.email && (
            <button onClick={envoyerEmail} disabled={emailEnvoi} style={{ ...btnSecondary }}>
              {emailEnvoi ? '⟳ Envoi...' : `📧 Envoyer à ${selected.customer.email}`}
            </button>
          )}
          <button onClick={onClose} style={{ ...btnPrimary, marginTop: 8 }}>✓ Terminer</button>
        </div>
      </div>
    </div>
  )

  // ── VUE SIGNATURE ─────────────────────────────────────────────
  if (etape === 'signature') return (
    <div style={container}>
      <div style={header}>
        <button onClick={() => setEtape('bon')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>Signature recueillie</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{selected?.numero}</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '24px 16px', overflowY: 'auto' }}>
        <div style={{ background: '#18130e', borderRadius: 12, padding: 16, marginBottom: 16, border: '0.5px solid rgba(110,201,110,0.3)' }}>
          <div style={{ fontSize: 12, color: '#6ec96e', marginBottom: 8 }}>✓ Signature client enregistrée</div>
          {signature && <img src={signature} style={{ maxWidth: '100%', height: 80, objectFit: 'contain', display: 'block' }} />}
        </div>
        <div style={{ background: 'rgba(201,110,110,0.1)', border: '1px solid rgba(201,110,110,0.4)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: '#c96e6e', fontWeight: 700, letterSpacing: 0.5 }}>
            ⚠ DÉMONTEZ ABSOLUMENT LE BEC AVANT LE TRANSPORT DE LA TIREUSE
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 20, lineHeight: 1.6 }}>
          En validant, la réservation <strong style={{ color: '#c9a96e' }}>{selected?.numero}</strong> passera en statut <strong style={{ color: '#6ec96e' }}>En cours</strong> et le stock des fûts sera décrémenté.
        </div>
      </div>
      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => setShowSignaturePad(true)} style={{ ...btnSecondary }}>✎ Refaire la signature</button>
        <button onClick={validerLivraison} disabled={saving} style={{ ...btnPrimary }}>
          {saving ? '⟳ Validation...' : '✓ Valider la livraison → En cours'}
        </button>
      </div>

      {/* Pad signature */}
      {showSignaturePad && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.6)', marginBottom: 12 }}>Signature du client</div>
          <canvas ref={canvasRef} width={320} height={140} style={{ borderRadius: 12, border: '0.5px solid rgba(201,169,110,0.4)', touchAction: 'none', display: 'block' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
          <div style={{ display: 'flex', gap: 10, marginTop: 14, width: 320 }}>
            <button onClick={clearSignature} style={{ ...btnSecondary, flex: 1 }}>Effacer</button>
            <button onClick={validerSignature} style={{ ...btnPrimary, flex: 2 }}>Valider</button>
          </div>
          <button onClick={() => setShowSignaturePad(false)} style={{ marginTop: 10, background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', cursor: 'pointer' }}>Annuler</button>
        </div>
      )}
    </div>
  )

  // ── VUE BON DE LIVRAISON ──────────────────────────────────────
  if (etape === 'bon' && selected) return (
    <div style={container}>
      <div style={header}>
        <button onClick={() => setEtape('liste')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>Bon de livraison</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{selected.numero} · {clientNom(selected)}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>

        {/* Dates */}
        <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', letterSpacing: 1, marginBottom: 4 }}>DÉPART</div>
            <div style={{ fontSize: 14, color: '#f0e8d8' }}>{new Date(selected.date_debut + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
            {selected.site_retrait && <div style={{ fontSize: 11, color: '#6ec96e', marginTop: 2 }}>↓ {SITE_LABELS[selected.site_retrait] || selected.site_retrait}</div>}
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', letterSpacing: 1, marginBottom: 4 }}>RETOUR</div>
            <div style={{ fontSize: 14, color: '#f0e8d8' }}>{new Date(selected.date_fin + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
            {selected.site_retour && <div style={{ fontSize: 11, color: '#c9b06e', marginTop: 2 }}>↑ {SITE_LABELS[selected.site_retour] || selected.site_retour}</div>}
          </div>
        </div>

        {/* Fûts remis */}
        {(selected.reservation_futs || []).length > 0 && (
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', letterSpacing: 1, marginBottom: 10 }}>FÛTS REMIS</div>
            {selected.reservation_futs.map((rf: any) => (
              <div key={rf.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#c9a96e', fontSize: 16 }}>☑</span>
                <span style={{ fontSize: 14, color: '#f0e8d8' }}>{rf.quantite} × {rf.fut?.nom_cuvee} {rf.fut?.contenance_litres}L</span>
              </div>
            ))}
          </div>
        )}

        {/* Tireuses remises */}
        {(selected.reservation_tireuses || []).length > 0 && (
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', letterSpacing: 1, marginBottom: 10 }}>TIREUSE(S) REMISE(S)</div>
            {selected.reservation_tireuses.map((rt: any) => (
              <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span style={{ color: '#c9a96e', fontSize: 16 }}>☑</span>
                <span style={{ fontSize: 14, color: '#f0e8d8' }}>{rt.tireuse?.nom} ({rt.tireuse?.modele})</span>
              </div>
            ))}
          </div>
        )}

        {/* Inventaire matériel */}
        <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(201,169,110,0.15)' }}>
          <div style={{ fontSize: 10, color: 'rgba(201,169,110,0.6)', letterSpacing: 1, marginBottom: 10 }}>INVENTAIRE DU MATÉRIEL FOURNI</div>
          {INVENTAIRE_MATERIEL.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#c9a96e', fontSize: 16, flexShrink: 0 }}>☑</span>
              <span style={{ fontSize: 14, color: '#e8e0d5' }}>{m.item}</span>
            </div>
          ))}
        </div>

        {/* Avertissement */}
        <div style={{ background: 'rgba(201,110,110,0.12)', border: '1px solid rgba(201,110,110,0.4)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: '#c96e6e', fontWeight: 700, lineHeight: 1.5, letterSpacing: 0.3 }}>
            ⚠ DÉMONTEZ ABSOLUMENT LE BEC EASY PRACC AVANT TOUT TRANSPORT DE LA TIREUSE
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => setShowSignaturePad(true)} style={{ ...btnSecondary }}>✍ Faire signer le client</button>
        <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textAlign: 'center' }}>La signature est obligatoire pour valider la livraison</div>
      </div>

      {/* Pad signature */}
      {showSignaturePad && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.6)', marginBottom: 12 }}>Signature du client · {clientNom(selected)}</div>
          <canvas ref={canvasRef} width={320} height={140} style={{ borderRadius: 12, border: '0.5px solid rgba(201,169,110,0.4)', touchAction: 'none', display: 'block' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
          <div style={{ display: 'flex', gap: 10, marginTop: 14, width: 320 }}>
            <button onClick={clearSignature} style={{ ...btnSecondary, flex: 1 }}>Effacer</button>
            <button onClick={validerSignature} style={{ ...btnPrimary, flex: 2 }}>Valider la signature</button>
          </div>
          <button onClick={() => setShowSignaturePad(false)} style={{ marginTop: 10, background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', cursor: 'pointer' }}>Annuler</button>
        </div>
      )}
    </div>
  )

  // ── VUE LISTE ─────────────────────────────────────────────────
  return (
    <div style={container}>
      <div style={header}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>🚚 Livraisons du jour</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Réservations confirmées à remettre</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
        ) : reservations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 16, color: 'rgba(232,224,213,0.4)' }}>Aucune livraison à effectuer aujourd'hui</div>
            <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.25)', marginTop: 8 }}>Les réservations confirmées dont la date de départ est passée apparaîtront ici</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reservations.map(r => (
              <button key={r.id} onClick={() => { setSelected(r); setEtape('bon') }}
                style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 12, padding: '16px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#c9a96e' }}>{r.numero}</div>
                  <span style={{ fontSize: 10, background: 'rgba(201,169,110,0.15)', color: '#c9a96e', padding: '2px 8px', borderRadius: 3 }}>Confirmée</span>
                </div>
                <div style={{ fontSize: 15, color: '#f0e8d8', marginBottom: 4 }}>{clientNom(r)}</div>
                {r.customer?.telephone && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>📞 {r.customer.telephone}</div>}
                <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>
                  {new Date(r.date_debut + 'T12:00:00').toLocaleDateString('fr-FR')} → {new Date(r.date_fin + 'T12:00:00').toLocaleDateString('fr-FR')}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(r.reservation_tireuses || []).map((rt: any) => (
                    <span key={rt.id} style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 8px', color: 'rgba(232,224,213,0.5)' }}>
                      🍺 {rt.tireuse?.nom}
                    </span>
                  ))}
                  {(r.reservation_futs || []).map((rf: any) => (
                    <span key={rf.id} style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 8px', color: 'rgba(232,224,213,0.5)' }}>
                      {rf.quantite}× {rf.fut?.nom_cuvee} {rf.fut?.contenance_litres}L
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: '#6ec96e', fontWeight: 600 }}>
                  Remettre au client →
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}