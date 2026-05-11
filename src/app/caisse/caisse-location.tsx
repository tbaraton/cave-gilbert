'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fmt = (n: number) => n.toFixed(2) + '€'

const TYPE_LABELS: Record<string, string> = {
  blonde: '🍺 Blonde', blanche: '🌾 Blanche', ambree: '🍂 Ambrée',
  IPA: '🌿 IPA', triple: '⚡ Triple', neipa: '🌴 Neipa', blanche_framboise: '🍓 Blanche Framboise'
}

type Client = { id: string; prenom: string; nom: string; raison_sociale: string; est_societe: boolean; email: string; telephone: string }
type Session = { id: string; site_id: string }
type User = { id: string; prenom: string; nom: string }

export function ModuleLocation({ session, user, onClose }: { session: Session; user: User; onClose: () => void }) {
  const [etape, setEtape] = useState<'client' | 'futs' | 'tireuse' | 'recapitulatif'>('client')
  const [futs, setFuts] = useState<any[]>([])
  const [tireuses, setTireuses] = useState<any[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [searchClient, setSearchClient] = useState('')
  const [clientsFound, setClientsFound] = useState<Client[]>([])
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [lignesFuts, setLignesFuts] = useState<{ fut_id: string; quantite: number }[]>([])
  const [tireusesChoisies, setTireusesChoisies] = useState<string[]>([])
  const [cautionPayee, setCautionPayee] = useState(false)
  const [alertesStock, setAlertesStock] = useState<any[]>([])
  const [conflitsTireuses, setConflitsTireuses] = useState<Record<string, string>>({})
  const [remiseType, setRemiseType] = useState<'pct' | 'eur'>('pct')
  const [remiseVal, setRemiseVal] = useState('')
  const [prixCustom, setPrixCustom] = useState<Record<string, number>>({})
  const [siteRetrait, setSiteRetrait] = useState('')
  const [siteRetour, setSiteRetour] = useState('')
  const [saving, setSaving] = useState(false)
  const [resaCreee, setResaCreee] = useState<string | null>(null)
  const [resaId, setResaId] = useState<string | null>(null)
  const [showAcompte, setShowAcompte] = useState(false)
  const [acompteMode, setAcompteMode] = useState('cb')
  const [acompteMontant, setAcompteMontant] = useState('')
  const [showSignature, setShowSignature] = useState(false)
  const [signatureClient, setSignatureClient] = useState<string | null>(null)
  const [signatureCave] = useState<string>('Cave de Gilbert')
  const [envoyerEnCours, setEnvoyerEnCours] = useState(false)
  const [emailEnvoye, setEmailEnvoye] = useState(false)
  const canvasRef = { current: null as HTMLCanvasElement | null }
  let isDrawing = false
  let lastX = 0
  let lastY = 0

  const initCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || canvasRef.current === canvas) return
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0d0a08'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#f0e8d8'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  const startDraw = (e: any) => {
    e.preventDefault()
    isDrawing = true
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e, canvas)
    lastX = pos.x; lastY = pos.y
  }

  const draw = (e: any) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastX = pos.x; lastY = pos.y
  }

  const stopDraw = (e: any) => {
    e.preventDefault()
    isDrawing = false
    const canvas = canvasRef.current
    if (canvas) setSignatureClient(canvas.toDataURL('image/png'))
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#0d0a08'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    setSignatureClient(null)
  }

  const envoyerAvecSignature = async (emailDest: string) => {
    if (!signatureClient) return
    setEnvoyerEnCours(true)
    try {
      const html = genererBonReservation(signatureClient)
      const res = await fetch('/api/envoyer-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailDest,
          numero: resaCreee,
          clientNom: client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : 'Client',
          html,
        }),
      })
      if (res.ok) {
        setEmailEnvoye(true)
        setShowSignature(false)
      } else {
        alert('Erreur envoi email')
      }
    } catch {
      alert('Erreur réseau')
    }
    setEnvoyerEnCours(false)
  }

  useEffect(() => {
    const load = async () => {
      const [{ data: futsData, error: futsError }, { data: tireusesData }] = await Promise.all([
        supabase.from('futs_catalogue').select('*').order('type_biere').order('contenance_litres', { ascending: false }),
        supabase.from('tireuses').select('*').order('nom'),
      ])
      if (futsError) console.error('Futs error:', futsError)
      console.log('Futs loaded:', futsData?.length, futsData)
      setFuts(futsData || [])
      setTireuses(tireusesData || [])
    }
    load()
  }, [])

  const searchClients = async (q: string) => {
    if (!q.trim()) { setClientsFound([]); return }
    const { data } = await supabase.from('customers')
      .select('id, prenom, nom, raison_sociale, est_societe, email, telephone')
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,raison_sociale.ilike.%${q}%`)
      .limit(6)
    setClientsFound(data || [])
  }

  // Vérifier disponibilité tireuses sur la période
  const tireusesDisponibles = async () => {
    if (!dateDebut || !dateFin) return tireuses
    const { data } = await supabase.from('reservation_tireuses')
      .select('tireuse_id, reservation:reservations_location!inner(statut, date_debut, date_fin)')
      .filter('reservation.statut', 'not.in', '("annulée","terminée")')
      .filter('reservation.date_debut', 'lte', dateFin)
      .filter('reservation.date_fin', 'gte', dateDebut)
    const occupees = new Set((data || []).map((r: any) => r.tireuse_id))
    return tireuses.filter(t => !occupees.has(t.id))
  }

  // Vérifier stock fûts sur la période
  const verifierStock = async () => {
    const alertes: any[] = []
    for (const ligne of lignesFuts.filter(l => l.fut_id && l.quantite > 0)) {
      const fut = futs.find(f => f.id === ligne.fut_id)
      if (!fut) continue
      // Stock dispo = stock réel - fûts déjà réservés sur la période (confirmés ou en cours)
      const { data: resasConflict } = await supabase
        .from('reservation_futs')
        .select('quantite, reservation:reservations_location!inner(statut, date_debut, date_fin)')
        .eq('fut_catalogue_id', ligne.fut_id)
        .in('reservation.statut', ['confirmée', 'en_cours'])
      const qteDejaPrise = (resasConflict || []).reduce((acc: number, rf: any) => {
        const r = rf.reservation
        if (!r) return acc
        const overlap = new Date(r.date_debut) <= new Date(dateFin) && new Date(r.date_fin) >= new Date(dateDebut)
        return overlap ? acc + rf.quantite : acc
      }, 0)
      const dispo = fut.stock_actuel - qteDejaPrise
      if (dispo < ligne.quantite) {
        alertes.push({ fut, manque: ligne.quantite - dispo, demande: ligne.quantite, dispo })
      }
    }
    setAlertesStock(alertes)
    return alertes
  }

  const passerEtapeFuts = () => {
    if (!dateDebut || !dateFin) return
    if (lignesFuts.length === 0) setLignesFuts([{ fut_id: '', quantite: 1 }])
    setEtape('futs')
  }

  const passerEtapeTireuse = async () => {
    const alertes = await verifierStock()
    // Vérifier conflits tireuses
    if (dateDebut && dateFin) {
      const { data: resasConflict } = await supabase
        .from('reservation_tireuses')
        .select(`tireuse_id, reservation:reservations_location!inner(statut, date_debut, date_fin, customer:customers(prenom, nom, raison_sociale, est_societe))`)
        .neq('reservation.statut', 'annulée')
        .neq('reservation.statut', 'terminée')
      
      const conflits: Record<string, string> = {}
      for (const rt of (resasConflict || []) as any[]) {
        const r = rt.reservation
        if (!r) continue
        const debutResa = new Date(r.date_debut)
        const finResa = new Date(r.date_fin)
        const debutDemande = new Date(dateDebut)
        const finDemande = new Date(dateFin)
        if (debutResa <= finDemande && finResa >= debutDemande) {
          const clientNom = r.customer?.est_societe ? r.customer.raison_sociale : `${r.customer?.prenom || ''} ${r.customer?.nom || ''}`.trim()
          conflits[rt.tireuse_id] = `${clientNom} (${new Date(r.date_debut).toLocaleDateString('fr-FR')} → ${new Date(r.date_fin).toLocaleDateString('fr-FR')})`
        }
      }
      setConflitsTireuses(conflits)
    }
    setEtape('tireuse')
  }

  const passerRecapitulatif = () => setEtape('recapitulatif')

  const getPrixLigne = (fut_id: string) => {
    const fut = futs.find(f => f.id === fut_id)
    return prixCustom[fut_id] !== undefined ? prixCustom[fut_id] : (fut?.prix_vente_ttc || 0)
  }
  const totalFuts = lignesFuts.reduce((acc, l) => acc + getPrixLigne(l.fut_id) * l.quantite, 0)
  const remise = remiseVal ? parseFloat(remiseVal) : 0
  const totalApresRemise = remiseType === 'pct' ? totalFuts * (1 - remise / 100) : Math.max(0, totalFuts - remise)
  const totalConsignesFuts = lignesFuts.reduce((acc, l) => {
    const fut = futs.find(f => f.id === l.fut_id)
    return acc + (fut ? fut.montant_consigne * l.quantite : 0)
  }, 0)
  const cautionTireuse = tireusesChoisies.length * 900
  const totalTTC = totalApresRemise  // Caution et consignes gérées séparément

  const creerReservation = async () => {
    setSaving(true)
    const numero = `LOC-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`

    const { data: resa } = await supabase.from('reservations_location').insert({
      numero, customer_id: client?.id || null, site_id: session.site_id, user_id: user.id,
      date_debut: dateDebut, date_fin: dateFin, statut: 'confirmée',
      caution_tireuse_ttc: cautionTireuse, caution_payee: false,
      total_ttc: totalTTC,
      site_retrait: siteRetrait || null,
      site_retour: siteRetour || null,
    }).select('id').single()

    if (resa) {
      // Lignes fûts
      const lignesValides = lignesFuts.filter(l => l.fut_id && l.quantite > 0)
      if (lignesValides.length) {
        await supabase.from('reservation_futs').insert(
          lignesValides.map(l => {
            const fut = futs.find(f => f.id === l.fut_id)
            return { reservation_id: resa.id, fut_catalogue_id: l.fut_id, quantite: l.quantite, prix_unitaire_ttc: fut?.prix_vente_ttc || 0, montant_consigne: 0 }
          })
        )
        // Stock décrémenté uniquement au départ physique des fûts (statut en_cours) via le backoffice
      }
      // Tireuses
      if (tireusesChoisies.length) {
        await supabase.from('reservation_tireuses').insert(
          tireusesChoisies.map(tid => ({ reservation_id: resa.id, tireuse_id: tid }))
        )
      }
      setResaCreee(numero)
      if (resa) setResaId(resa.id)
    }
    setSaving(false)
  }

  const container = { height: '100dvh', maxHeight: '100dvh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }
  const header = { padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, background: '#0d0a08' }
  const btnPrimary = { background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, cursor: 'pointer', fontWeight: 700, width: '100%', touchAction: 'manipulation' as const }

  const MODES_PAIEMENT = [
    { id: 'cb', label: '💳 CB' },
    { id: 'especes', label: '💶 Espèces' },
    { id: 'cheque', label: '📝 Chèque' },
    { id: 'virement', label: '🏦 Virement' },
  ]

  const SITE_LABELS_LOC: Record<string, string> = {
    cave_gilbert: 'Cave de Gilbert', petite_cave: 'La Petite Cave',
    entrepot: 'Entrepôt', livraison: '🚚 À livrer',
  }

  const genererBonReservation = (sigClient?: string) => {
    const acompte30 = Math.round(totalTTC * 0.30 * 100) / 100
    const tireusesStr = tireusesChoisies.map(tid => {
      const t = tireuses.find(x => x.id === tid)
      return (t?.nom || '') + ' (' + (t?.modele || '') + ')'
    }).join(', ')
    const lignesHtml = lignesFuts.filter(l => l.fut_id && l.quantite > 0).map(l => {
      const fut = futs.find(f => f.id === l.fut_id)
      const prix = getPrixLigne(l.fut_id)
      return '<tr><td>' + (fut?.nom_cuvee || '') + ' ' + (fut?.contenance_litres || '') + 'L</td><td style="text-align:center;font-weight:700;color:#c9a96e">' + l.quantite + '</td><td style="text-align:right;color:rgba(232,224,213,0.7)">' + fmt(prix) + '</td><td style="text-align:right;font-weight:600;color:#f0e8d8">' + fmt(prix * l.quantite) + '</td></tr>'
    }).join('')
    const sigHtml = sigClient
      ? '<img src="' + sigClient + '" style="max-width:200px;max-height:80px;border:0.5px solid rgba(201,169,110,0.3);border-radius:4px;background:#fff" />'
      : '<div style="height:60px;border:0.5px dashed rgba(201,169,110,0.3);border-radius:4px"></div>'

    return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bon de r\u00e9servation ' + resaCreee + '</title>' +
      '<style>' +
      '* { margin: 0; padding: 0; box-sizing: border-box; }' +
      'body { font-family: Arial, sans-serif; background: #0d0a08; color: #e8e0d5; max-width: 860px; margin: 0 auto; padding: 48px 40px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      '@media print { body { background: #0d0a08 !important; color: #e8e0d5 !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }' +
      '.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid rgba(201,169,110,0.3); }' +
      '.logo-wrap img { height: 56px; object-fit: contain; display: block; margin-bottom: 10px; }' +
      '.cave-name { font-size: 20px; color: #c9a96e; font-family: Georgia, serif; letter-spacing: 2px; }' +
      '.cave-info { font-size: 11px; color: rgba(232,224,213,0.4); line-height: 1.9; margin-top: 6px; }' +
      '.doc-info { text-align: right; }' +
      '.doc-title { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: rgba(201,169,110,0.6); margin-bottom: 6px; }' +
      '.doc-numero { font-size: 22px; color: #c9a96e; font-family: Georgia, serif; }' +
      '.doc-date { font-size: 12px; color: rgba(232,224,213,0.4); margin-top: 6px; }' +
      '.section { margin-bottom: 24px; }' +
      '.section-title { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,169,110,0.5); margin-bottom: 10px; font-weight: 400; border-bottom: 0.5px solid rgba(201,169,110,0.2); padding-bottom: 6px; }' +
      '.info-row { display: flex; gap: 12px; margin-bottom: 6px; font-size: 13px; }' +
      '.info-label { color: rgba(232,224,213,0.35); width: 90px; flex-shrink: 0; font-size: 11px; }' +
      '.info-val { color: #f0e8d8; }' +
      'table { width: 100%; border-collapse: collapse; }' +
      'thead tr { border-bottom: 1px solid rgba(201,169,110,0.3); }' +
      'thead th { padding: 10px 14px; text-align: left; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,169,110,0.5); font-weight: 400; }' +
      'tbody tr { border-bottom: 0.5px solid rgba(255,255,255,0.05); }' +
      'td { padding: 12px 14px; font-size: 13px; }' +
      '.totaux { border-top: 1px solid rgba(201,169,110,0.2); margin-top: 0; }' +
      '.total-line { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; color: rgba(232,224,213,0.4); }' +
      '.total-line.grand { background: rgba(201,169,110,0.08); border: 0.5px solid rgba(201,169,110,0.2); border-radius: 6px; margin: 12px 0; font-size: 17px; font-weight: 700; color: #c9a96e; font-family: Georgia, serif; padding: 14px; }' +
      '.acompte-box { background: rgba(110,201,110,0.06); border: 0.5px solid rgba(110,201,110,0.2); border-radius: 6px; padding: 12px 14px; margin-top: 12px; }' +
      '.conditions { background: rgba(255,255,255,0.02); border-left: 3px solid rgba(201,169,110,0.3); padding: 14px 18px; font-size: 11px; color: rgba(232,224,213,0.4); line-height: 1.9; border-radius: 0 6px 6px 0; margin-bottom: 32px; }' +
      '.signature-zone { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }' +
      '.sig-box { border-top: 0.5px solid rgba(201,169,110,0.3); padding-top: 12px; font-size: 11px; color: rgba(232,224,213,0.3); min-height: 80px; }' +
      '.sig-title { color: rgba(201,169,110,0.6); font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }' +
      '.footer { margin-top: 32px; padding-top: 16px; border-top: 0.5px solid rgba(255,255,255,0.06); font-size: 10px; color: rgba(232,224,213,0.2); line-height: 2; }' +
      '.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 80px; color: rgba(255,255,255,0.03); font-family: Georgia, serif; letter-spacing: 8px; pointer-events: none; white-space: nowrap; }' +
      '</style></head><body>' +
      '<div class="watermark">CAVE DE GILBERT</div>' +
      '<div class="header">' +
        '<div class="logo-wrap">' +
          '<img src="https://cavedegilbert.vercel.app/logo.png" onerror="this.style.display=&quot;none&quot;" />' +
          '<div class="cave-name">Cave de Gilbert</div>' +
          '<div class="cave-info">Avenue Jean Colomb \u2014 69280 Marcy l\u2019\u00c9toile<br>04 22 91 41 09 \u00b7 contact@cavedegilbert.fr<br>Mar\u2013Sam : 9h30\u201313h / 15h30\u201319h</div>' +
        '</div>' +
        '<div class="doc-info">' +
          '<div class="doc-title">Bon de r\u00e9servation</div>' +
          '<div class="doc-numero">' + resaCreee + '</div>' +
          '<div class="doc-date">\u00c9mis le ' + new Date().toLocaleDateString('fr-FR') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="section">' +
        '<div class="section-title">Client</div>' +
        '<div class="info-row"><span class="info-label">Nom</span><span class="info-val">' + (client ? (client.est_societe ? client.raison_sociale : client.prenom + ' ' + client.nom) : 'Client anonyme') + '</span></div>' +
        (client?.telephone ? '<div class="info-row"><span class="info-label">T\u00e9l\u00e9phone</span><span class="info-val">' + client.telephone + '</span></div>' : '') +
        (client?.email ? '<div class="info-row"><span class="info-label">Email</span><span class="info-val">' + client.email + '</span></div>' : '') +
      '</div>' +
      '<div class="section">' +
        '<div class="section-title">P\u00e9riode de location</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
          '<div><div style="font-size:10px;color:rgba(201,169,110,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Retrait</div><div style="font-size:14px;color:#f0e8d8">' + new Date(dateDebut).toLocaleDateString('fr-FR', {weekday:'long',day:'2-digit',month:'long',year:'numeric'}) + '</div>' + (siteRetrait ? '<div style="font-size:11px;color:#6ec96e;margin-top:2px">\ud83d\udccd ' + (SITE_LABELS_LOC[siteRetrait] || siteRetrait) + '</div>' : '') + '</div>' +
          '<div><div style="font-size:10px;color:rgba(201,169,110,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Retour</div><div style="font-size:14px;color:#f0e8d8">' + new Date(dateFin).toLocaleDateString('fr-FR', {weekday:'long',day:'2-digit',month:'long',year:'numeric'}) + '</div>' + (siteRetour ? '<div style="font-size:11px;color:#c9b06e;margin-top:2px">\ud83d\udccd ' + (SITE_LABELS_LOC[siteRetour] || siteRetour) + '</div>' : '') + '</div>' +
        '</div>' +
      '</div>' +
      (tireusesStr ? '<div class="section"><div class="section-title">Tireuse(s)</div><div style="font-size:14px;color:#f0e8d8">' + tireusesStr + '</div><div style="font-size:11px;color:rgba(232,224,213,0.4);margin-top:4px">Caution : <strong style="color:#c9a96e">' + fmt(cautionTireuse) + '</strong> par ch\u00e8que (non encaiss\u00e9 \u2014 restitu\u00e9 au retour)</div></div>' : '') +
      '<div class="section"><div class="section-title">F\u00fbts command\u00e9s</div>' +
        '<table><thead><tr><th>D\u00e9signation</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix u. TTC</th><th style="text-align:right">Total TTC</th></tr></thead><tbody>' + lignesHtml + '</tbody></table>' +
        '<div class="totaux"><div class="total-line grand"><span>TOTAL TTC</span><span>' + fmt(totalTTC) + '</span></div></div>' +
        '<div class="acompte-box"><div style="font-size:13px;color:#6ec96e;margin-bottom:4px"><strong>Acompte 30% \u00e0 la commande : ' + fmt(acompte30) + '</strong></div><div style="font-size:11px;color:rgba(232,224,213,0.4)">Solde de <strong style="color:#f0e8d8">' + fmt(totalTTC - acompte30) + '</strong> \u00e0 r\u00e9gler au retour de la tireuse</div></div>' +
      '</div>' +
      '<div class="conditions">' +
        '\u2022 La caution de ' + fmt(cautionTireuse) + ' par ch\u00e8que est obligatoire et sera restitu\u00e9e au retour du mat\u00e9riel en bon \u00e9tat.<br>' +
        '\u2022 Les f\u00fbts non percut\u00e9s (non entam\u00e9s) sont rembours\u00e9s au prix de vente TTC.<br>' +
        '\u2022 Le solde est exigible au retour de la tireuse et des f\u00fbts.<br>' +
        '\u2022 La tireuse doit \u00eatre rendue propre et en bon \u00e9tat de fonctionnement.<br>' +
        '\u2022 Cave de Gilbert d\u00e9cline toute responsabilit\u00e9 en cas de mauvaise utilisation du mat\u00e9riel.' +
      '</div>' +
      '<div class="signature-zone">' +
        '<div class="sig-box"><div class="sig-title">Signature client \u2014 Bon pour accord</div>' + sigHtml + '</div>' +
        '<div class="sig-box"><div class="sig-title">Cave de Gilbert</div><div style="font-family:Georgia,serif;font-size:18px;color:#c9a96e;margin-top:8px">Cave de Gilbert</div></div>' +
      '</div>' +
      '<div class="footer">Cave de Gilbert \u00b7 Avenue Jean Colomb, 69280 Marcy l\u2019\u00c9toile \u00b7 contact@cavedegilbert.fr \u00b7 04 22 91 41 09</div>' +
      '</body></html>'
  }

  const imprimerBon = () => {
    const html = genererBonReservation(signatureClient || undefined)
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const envoyerEmail = async () => {
    if (!client?.email) { alert("Pas d'email pour ce client"); return }
    if (!signatureClient) {
      setShowSignature(true)
      return
    }
    await envoyerAvecSignature(client.email)
  }

  const enregistrerAcompte = async () => {
    if (!resaId || !acompteMontant) return
    const montant = parseFloat(acompteMontant)
    await supabase.from('reservations_location').update({
      acompte_ttc: montant,
      acompte_mode: acompteMode,
      acompte_paye_le: new Date().toISOString().split('T')[0],
    }).eq('id', resaId)
    setShowAcompte(false)
    alert(`Acompte de ${fmt(montant)} enregistré (${acompteMode})`)
  }

  // Succès
  if (resaCreee) return (
    <div style={{ ...container, overflowY: 'auto' as const }}>
      <div style={{ padding: '24px 16px' }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 13, cursor: 'pointer', padding: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Retour à la caisse
        </button>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🍺</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#6ec96e', marginBottom: 4 }}>Réservation confirmée</div>
          <div style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'monospace' }}>{resaCreee}</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginTop: 4 }}>
            {new Date(dateDebut).toLocaleDateString('fr-FR')} → {new Date(dateFin).toLocaleDateString('fr-FR')}
          </div>
        </div>

        {alertesStock.length > 0 && (
          <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ color: '#c96e6e', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>⚠ Stock insuffisant</div>
            {alertesStock.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: '#e8e0d5' }}>{a.fut?.nom_cuvee} {a.fut?.contenance_litres}L — manque {a.manque} fût(s)</div>
            ))}
          </div>
        )}

        {/* Acompte */}
        <div style={{ background: '#18130e', borderRadius: 12, padding: 16, marginBottom: 16, border: '0.5px solid rgba(201,169,110,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, color: '#f0e8d8' }}>Acompte 30%</div>
              <div style={{ fontSize: 20, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(Math.round(totalTTC * 0.30 * 100) / 100)}</div>
            </div>
            <button onClick={() => setShowAcompte(!showAcompte)}
              style={{ background: showAcompte ? 'rgba(201,110,110,0.1)' : 'rgba(201,169,110,0.15)', border: `0.5px solid ${showAcompte ? 'rgba(201,110,110,0.3)' : 'rgba(201,169,110,0.3)'}`, borderRadius: 8, color: showAcompte ? '#c96e6e' : '#c9a96e', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
              {showAcompte ? '✕ Annuler' : '💰 Encaisser acompte'}
            </button>
          </div>
          {showAcompte && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' as const }}>
                {MODES_PAIEMENT.map(m => (
                  <button key={m.id} onClick={() => setAcompteMode(m.id)}
                    style={{ flex: 1, background: acompteMode === m.id ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${acompteMode === m.id ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: acompteMode === m.id ? '#c9a96e' : 'rgba(232,224,213,0.5)', padding: '8px 4px', fontSize: 12, cursor: 'pointer' }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" value={acompteMontant} onChange={e => setAcompteMontant(e.target.value)}
                  placeholder={`${Math.round(totalTTC * 0.30 * 100) / 100}`}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, color: '#f0e8d8', fontSize: 16, padding: '10px' }} />
                <button onClick={enregistrerAcompte}
                  style={{ background: '#c9a96e', border: 'none', borderRadius: 8, color: '#0d0a08', padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
                  ✓
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions document */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 16 }}>
          <button onClick={imprimerBon}
            style={{ ...btnPrimary, background: '#18130e', color: '#c9a96e', border: '0.5px solid rgba(201,169,110,0.3)' }}>
            🖨 Imprimer le bon de réservation
          </button>
          {client?.email && !emailEnvoye && (
            <button onClick={() => setShowSignature(true)}
              style={{ ...btnPrimary, background: '#18130e', color: '#6e9ec9', border: '0.5px solid rgba(110,158,201,0.3)' }}>
              ✍ Faire signer & envoyer par email
            </button>
          )}
          {emailEnvoye && (
            <div style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#6ec96e', textAlign: 'center' as const }}>
              ✓ Document signé envoyé à {client?.email}
            </div>
          )}
        </div>

        {/* Modal signature */}
        {showSignature && (
          <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ padding: '16px', borderBottom: '0.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>✍ Signature du client</div>
              <button onClick={() => setShowSignature(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, padding: 16, overflow: 'auto' }}>
              <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 12, textAlign: 'center' as const }}>
                {client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : 'Client'} — {resaCreee}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>Signez ci-dessous avec votre doigt :</div>
              <div style={{ background: '#0d0a08', borderRadius: 12, overflow: 'hidden', border: '0.5px solid rgba(201,169,110,0.3)', position: 'relative' as const }}>
                <canvas
                  ref={initCanvas}
                  width={Math.min(window.innerWidth - 64, 600)}
                  height={180}
                  style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                {!signatureClient && (
                  <div style={{ position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' as const }}>
                    <span style={{ color: 'rgba(232,224,213,0.15)', fontSize: 14 }}>← Signez ici →</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={clearCanvas} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(232,224,213,0.5)', padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                  🗑 Effacer
                </button>
                <button onClick={() => envoyerAvecSignature(client?.email || '')}
                  disabled={!signatureClient || envoyerEnCours}
                  style={{ flex: 2, background: signatureClient ? '#6e9ec9' : '#2a2a1e', border: 'none', borderRadius: 8, color: signatureClient ? '#fff' : '#555', padding: '12px', fontSize: 14, cursor: signatureClient ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                  {envoyerEnCours ? '⟳ Envoi...' : `📧 Envoyer à ${client?.email}`}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 10, textAlign: 'center' as const }}>
                Le document sera envoyé avec votre signature et celle de la Cave de Gilbert
              </div>
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ ...btnPrimary }}>✓ Retour à la caisse</button>
      </div>
    </div>
  )

  return (
    <div style={container}>
      {/* Header */}
      <div style={header}>
        <button onClick={etape === 'client' ? onClose : () => setEtape(etape === 'futs' ? 'client' : etape === 'tireuse' ? 'futs' : 'tireuse')}
          style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>🍺 Location tireuse & fûts</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>
            {etape === 'client' ? 'Étape 1/4 — Client & dates' : etape === 'futs' ? 'Étape 2/4 — Fûts' : etape === 'tireuse' ? 'Étape 3/4 — Tireuse' : 'Étape 4/4 — Récapitulatif'}
          </div>
        </div>
      </div>

      {/* ── ÉTAPE 1 : CLIENT & DATES ── */}
      {etape === 'client' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Client & dates</div>

          {/* Recherche client */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>CLIENT</div>
            {client ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: '#f0e8d8' }}>{client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`}</div>
                  {client.telephone && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{client.telephone}</div>}
                </div>
                <button onClick={() => setClient(null)} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' as const }}>
                <input type="text" placeholder="🔍 Nom, prénom, email..." value={searchClient}
                  onChange={e => { setSearchClient(e.target.value); searchClients(e.target.value) }}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 16, padding: '14px', boxSizing: 'border-box' as const }} />
                {clientsFound.length > 0 && (
                  <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, zIndex: 10, marginTop: 4 }}>
                    {clientsFound.map(c => (
                      <button key={c.id} onClick={() => { setClient(c); setClientsFound([]); setSearchClient('') }}
                        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', color: '#e8e0d5', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' as const }}>
                        <div style={{ fontSize: 15 }}>{c.est_societe ? c.raison_sociale : `${c.prenom} ${c.nom}`}</div>
                        {c.telephone && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{c.telephone}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>DATE DE DÉPART</div>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 15, padding: '14px', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>DATE DE RETOUR</div>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} min={dateDebut}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 15, padding: '14px', boxSizing: 'border-box' as const }} />
            </div>
          </div>

          {dateDebut && dateFin && (
            <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: 'rgba(232,224,213,0.6)' }}>
              📅 {Math.ceil((new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / 86400000)} jour(s) de location
            </div>
          )}

        </div>
        <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(255,255,255,0.07)", background: "#0d0a08" }}>
          <button onClick={passerEtapeFuts} disabled={!dateDebut || !dateFin}
            style={{ ...btnPrimary, opacity: (!dateDebut || !dateFin) ? 0.4 : 1, cursor: (!dateDebut || !dateFin) ? 'not-allowed' : 'pointer' }}>
            Suivant → Choisir les fûts
          </button>
        </div>
        </div>
      )}

      {/* ── ÉTAPE 2 : FÛTS ── */}
      {etape === 'futs' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Sélection des fûts</div>

          {lignesFuts.map((l, i) => (
            <div key={i} style={{ background: '#18130e', borderRadius: 10, padding: '14px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>Fût {i + 1}</div>
                <button onClick={() => setLignesFuts(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <select value={l.fut_id} onChange={e => setLignesFuts(prev => prev.map((x, j) => j === i ? { ...x, fut_id: e.target.value } : x))}
                style={{ width: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#e8e0d5', fontSize: 14, padding: '12px', cursor: 'pointer', marginBottom: 10 }}>
                <option value="">— Choisir un fût —</option>
                {futs.map(f => (
                  <option key={f.id} value={f.id} disabled={f.stock_actuel <= 0}>
                    {TYPE_LABELS[f.type_biere]} "{f.nom_cuvee}" {f.contenance_litres}L — {fmt(f.prix_vente_ttc)} {f.stock_actuel <= 0 ? '(rupture)' : `(stock: ${f.stock_actuel})`}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>Quantité :</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 12px' }}>
                  <button onClick={() => setLignesFuts(prev => prev.map((x, j) => j === i ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))}
                    style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 22, cursor: 'pointer', width: 28 }}>−</button>
                  <span style={{ fontSize: 18, minWidth: 24, textAlign: 'center' as const }}>{l.quantite}</span>
                  <button onClick={() => setLignesFuts(prev => prev.map((x, j) => j === i ? { ...x, quantite: x.quantite + 1 } : x))}
                    style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 22, cursor: 'pointer', width: 28 }}>+</button>
                </div>
                {l.fut_id && (
                  <span style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif', marginLeft: 'auto' }}>
                    {fmt(getPrixLigne(l.fut_id) * l.quantite)}
                  </span>
                )}
              </div>
              {l.fut_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Prix u. TTC :</span>
                  <input type="number" step="0.01" value={getPrixLigne(l.fut_id)}
                    onChange={e => setPrixCustom(p => ({ ...p, [l.fut_id]: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 85, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '5px 8px' }} />
                  <span style={{ fontSize: 11, color: '#c9a96e' }}>€</span>
                  {prixCustom[l.fut_id] !== undefined && (
                    <button onClick={() => setPrixCustom(p => { const n = { ...p }; delete n[l.fut_id]; return n })}
                      style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>reset</button>
                  )}
                </div>
              )}
            </div>
          ))}

          <button onClick={() => setLignesFuts(prev => [...prev, { fut_id: '', quantite: 1 }])}
            style={{ width: '100%', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, color: '#c9a96e', padding: '14px', fontSize: 14, cursor: 'pointer', marginBottom: 20 }}>
            + Ajouter un autre fût
          </button>

          {lignesFuts.some(l => l.fut_id) && (
            <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'rgba(232,224,213,0.5)', marginBottom: 8 }}>
                <span>Sous-total</span><span>{fmt(totalFuts)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: remiseVal ? 8 : 0 }}>
                <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Remise :</span>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                  {(['pct','eur'] as const).map(t => (
                    <button key={t} onClick={() => setRemiseType(t)} style={{ background: remiseType === t ? 'rgba(201,169,110,0.2)' : 'transparent', border: 'none', color: remiseType === t ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>{t === 'pct' ? '%' : '€'}</button>
                  ))}
                </div>
                <input type="number" step="0.01" value={remiseVal} onChange={e => setRemiseVal(e.target.value)} placeholder="0"
                  style={{ width: 70, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '4px 8px' }} />
              </div>
              {remiseVal && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif', paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span>Total après remise</span><span>{fmt(totalApresRemise)}</span>
                </div>
              )}
              {!remiseVal && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                  <span>Total</span><span>{fmt(totalFuts)}</span>
                </div>
              )}
            </div>
          )}

        </div>
        <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.07)', background: '#0d0a08' }}>
          <button onClick={passerEtapeTireuse} disabled={!lignesFuts.some(l => l.fut_id && l.quantite > 0)}
            style={{ ...btnPrimary, opacity: !lignesFuts.some(l => l.fut_id && l.quantite > 0) ? 0.4 : 1, cursor: !lignesFuts.some(l => l.fut_id && l.quantite > 0) ? 'not-allowed' : 'pointer' }}>
            Suivant → Choisir la tireuse
          </button>
        </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : TIREUSE ── */}
      {etape === 'tireuse' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 8 }}>Tireuse</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 20 }}>Caution : 900€ par tireuse</div>

          {alertesStock.length > 0 && (
            <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#c96e6e', fontWeight: 600, marginBottom: 6 }}>⚠ Stock insuffisant pour certains fûts</div>
              {alertesStock.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: '#e8e0d5' }}>
                  {a.fut?.nom_cuvee} {a.fut?.contenance_litres}L — demandé: {a.demande}, disponible: {a.dispo}
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 6 }}>Une commande La Loupiote sera nécessaire</div>
            </div>
          )}

          {tireuses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#c96e6e' }}>⚠ Aucune tireuse disponible</div>
          ) : tireuses.map(t => {
            const conflit = conflitsTireuses[t.id]
            const isSelected = tireusesChoisies.includes(t.id)
            return (
              <button key={t.id}
                onClick={() => { if (!conflit) setTireusesChoisies(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]) }}
                style={{ width: '100%', background: conflit ? 'rgba(201,110,110,0.05)' : isSelected ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${conflit ? 'rgba(201,110,110,0.3)' : isSelected ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '16px', cursor: conflit ? 'not-allowed' : 'pointer', textAlign: 'left' as const, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: conflit ? 0.7 : 1 }}>
                <div>
                  <div style={{ fontSize: 16, color: conflit ? '#c96e6e' : isSelected ? '#c9a96e' : '#e8e0d5', marginBottom: 4 }}>{t.nom}</div>
                  <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{t.modele} · {t.nb_tirages} tirage{t.nb_tirages > 1 ? 's' : ''}</div>
                  {conflit && <div style={{ fontSize: 12, color: '#c96e6e', marginTop: 6 }}>⚠ Déjà réservée — {conflit}</div>}
                </div>
                <div style={{ fontSize: 22 }}>{conflit ? '✕' : isSelected ? '✓' : '○'}</div>
              </button>
            )
          })}

          {tireusesChoisies.length > 0 && (
            <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>
                ℹ️ Caution tireuse : {fmt(cautionTireuse)} — chèque physique conservé, restitué au retour
              </div>
            </div>
          )}

        </div>
        <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(255,255,255,0.07)", background: "#0d0a08" }}>
          <button onClick={passerRecapitulatif} style={{ ...btnPrimary }}>Suivant → Récapitulatif</button>
        </div>
        </div>
      )}

      {/* ── ÉTAPE 4 : RÉCAPITULATIF ── */}
      {etape === 'recapitulatif' && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Récapitulatif</div>

          {/* Client */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 6, letterSpacing: 1 }}>CLIENT</div>
            <div style={{ fontSize: 15, color: '#f0e8d8' }}>{client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : 'Client anonyme'}</div>
          </div>

          {/* Site retrait / retour */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 10, letterSpacing: 1 }}>RETRAIT & RETOUR</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>Retrait</div>
                <select value={siteRetrait} onChange={e => setSiteRetrait(e.target.value)}
                  style={{ width: '100%', background: '#1a1408', border: `0.5px solid ${siteRetrait ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, color: siteRetrait ? '#c9a96e' : 'rgba(232,224,213,0.4)', fontSize: 13, padding: '10px 8px' }}>
                  <option value="">— Choisir —</option>
                  <option value="cave_gilbert">Cave de Gilbert</option>
                  <option value="petite_cave">La Petite Cave</option>
                  <option value="entrepot">Entrepôt</option>
                  <option value="livraison">🚚 À livrer</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>Retour</div>
                <select value={siteRetour} onChange={e => setSiteRetour(e.target.value)}
                  style={{ width: '100%', background: '#1a1408', border: `0.5px solid ${siteRetour ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, color: siteRetour ? '#c9a96e' : 'rgba(232,224,213,0.4)', fontSize: 13, padding: '10px 8px' }}>
                  <option value="">— Choisir —</option>
                  <option value="cave_gilbert">Cave de Gilbert</option>
                  <option value="petite_cave">La Petite Cave</option>
                  <option value="entrepot">Entrepôt</option>
                  <option value="livraison">🚚 À livrer</option>
                </select>
              </div>
            </div>
            {(!siteRetrait || !siteRetour) && (
              <div style={{ fontSize: 11, color: '#c9b06e', marginTop: 8 }}>⚠ Veuillez indiquer le site de retrait et de retour</div>
            )}
          </div>

          {/* Dates */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>DÉPART</div><div style={{ fontSize: 14, color: '#f0e8d8' }}>{new Date(dateDebut).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div></div>
            <div><div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>RETOUR</div><div style={{ fontSize: 14, color: '#f0e8d8' }}>{new Date(dateFin).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div></div>
          </div>

          {/* Fûts */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 10, letterSpacing: 1 }}>FÛTS</div>
            {lignesFuts.filter(l => l.fut_id).map((l, i) => {
              const fut = futs.find(f => f.id === l.fut_id)
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e8e0d5', marginBottom: 6 }}>
                  <span>{l.quantite}× {fut?.nom_cuvee} {fut?.contenance_litres}L</span>
                  <span style={{ color: '#c9a96e' }}>{fmt((fut?.prix_vente_ttc || 0) * l.quantite)}</span>
                </div>
              )
            })}

          </div>

          {/* Tireuses */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', letterSpacing: 1 }}>TIREUSE(S)</div>
              <button onClick={() => setEtape('tireuse')} style={{ fontSize: 11, color: '#c9a96e', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>✎ Modifier</button>
            </div>
            {tireuses.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: tireusesChoisies.includes(t.id) ? '#f0e8d8' : 'rgba(232,224,213,0.25)' }}>
                  {t.nom} — {t.modele}
                </div>
                <button onClick={() => setTireusesChoisies(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  style={{ fontSize: 12, background: tireusesChoisies.includes(t.id) ? 'rgba(201,110,110,0.1)' : 'rgba(110,201,110,0.1)', border: 'none', borderRadius: 4, color: tireusesChoisies.includes(t.id) ? '#c96e6e' : '#6ec96e', padding: '2px 8px', cursor: 'pointer' }}>
                  {tireusesChoisies.includes(t.id) ? '✕ Retirer' : '+ Ajouter'}
                </button>
              </div>
            ))}
            {tireusesChoisies.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)', fontStyle: 'italic' }}>Aucune tireuse sélectionnée</div>
            )}
            {tireusesChoisies.length > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginTop: 6, paddingTop: 6, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                Caution {fmt(cautionTireuse)} en chèque — non encaissée
              </div>
            )}
          </div>

          {/* Total */}
          <div style={{ background: 'rgba(201,169,110,0.08)', borderRadius: 10, padding: '16px', marginBottom: 24, border: '0.5px solid rgba(201,169,110,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: 8 }}><span>TOTAL TTC</span><span>{fmt(totalTTC)}</span></div>
            {tireusesChoisies.length > 0 && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>+ Caution {fmt(cautionTireuse)} en chèque (non encaissé)</div>}
          </div>

        </div>
        <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.07)', background: '#0d0a08' }}>
          <button onClick={creerReservation} disabled={saving || !siteRetrait || !siteRetour}
            style={{ ...btnPrimary, background: (saving || !siteRetrait || !siteRetour) ? '#2a2a1e' : '#c9a96e', color: (saving || !siteRetrait || !siteRetour) ? '#555' : '#0d0a08', opacity: (!siteRetrait || !siteRetour) ? 0.5 : 1 }}>
            {saving ? '⟳ Création...' : '✓ Confirmer la réservation'}
          </button>
        </div>
        </div>
      )}
    </div>
  )
}