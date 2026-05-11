'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fmt = (n: number) => n.toFixed(2) + '€'

const SITE_LABELS: Record<string, string> = {
  cave_gilbert: 'Cave de Gilbert',
  petite_cave: 'La Petite Cave',
  entrepot: 'Entrepôt',
  livraison: '🚚 À livrer',
}

const TYPE_LABELS: Record<string, string> = {
  blonde: '🍺 Blonde', blanche: '🌾 Blanche', ambree: '🍂 Ambrée',
  IPA: '🌿 IPA', triple: '⚡ Triple', neipa: '🌴 Neipa', blanche_framboise: '🍓 Blanche Framboise'
}
const TYPE_COLORS: Record<string, string> = {
  blonde: '#f5c842', blanche: '#e8e0d5', ambree: '#c9783a',
  IPA: '#6ec96e', triple: '#c9a96e', neipa: '#f5a442', blanche_framboise: '#e87090'
}

export default function LocationPage() {
  const [onglet, setOnglet] = useState<'catalogue' | 'reservations' | 'calendrier' | 'loupiote' | 'consignes'>('reservations')
  const [futs, setFuts] = useState<any[]>([])
  const [tireuses, setTireuses] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [commandesLoupiote, setCommandesLoupiote] = useState<any[]>([])
  const [consignes, setConsignes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [alertes, setAlertes] = useState<any[]>([])

  // Modals
  const [showEditFut, setShowEditFut] = useState<any>(null)
  const [showDetailResa, setShowDetailResa] = useState<any>(null)
  const [showAnnulees, setShowAnnulees] = useState(false)
  const [showNouvelleCommande, setShowNouvelleCommande] = useState(false)
  const [dateLivraisonSouhaitee, setDateLivraisonSouhaitee] = useState('')
  const [cmdReception, setCmdReception] = useState<any>(null)
  const [qtesRecues, setQtesRecues] = useState<Record<string, number>>({})
  const [envoyerEnCours, setEnvoyerEnCours] = useState(false)
  const [ajouteAlertes, setAjouteAlertes] = useState<Set<string>>(new Set())

  // Recalcule quels alertes sont couverts par la commande en attente
  const alertesCouvertes = new Set(
    alertes.filter((a: any) =>
      a.manques.every((m: any) => {
        const cmdEnAttente = commandesLoupiote.find((cmd: any) => cmd.statut === 'en_attente')
        if (!cmdEnAttente) return false
        const ligne = cmdEnAttente.lignes?.find((l: any) => l.fut_catalogue_id === m.fut.id)
        return ligne && ligne.quantite >= m.manque
      })
    ).map((a: any) => a.resa.id)
  )
  const [showRetourFuts, setShowRetourFuts] = useState<any>(null)
  const [showNouvelleConsigne, setShowNouvelleConsigne] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: futsData },
      { data: tireusesData },
      { data: resasData },
      { data: commandesData },
      { data: consignesData },
    ] = await Promise.all([
      supabase.from('futs_catalogue').select('*').eq('actif', true).order('type_biere').order('contenance_litres', { ascending: false }),
      supabase.from('tireuses').select('*').order('nom'),
      supabase.from('reservations_location').select(`
        *, customer:customers(prenom, nom, raison_sociale, est_societe, email, telephone),
        reservation_futs(*, fut:futs_catalogue(*)),
        reservation_tireuses(*, tireuse:tireuses(*))
      `).order('date_debut', { ascending: true }).limit(100),
      supabase.from('commandes_loupiote').select(`*, lignes:commandes_loupiote_lignes(*, fut:futs_catalogue(*))`).order('created_at', { ascending: false }),
      supabase.from('consignes_loupiote').select('*').order('date_retour_futs', { ascending: false }),
    ])
    setFuts(futsData || [])
    setTireuses(tireusesData || [])
    console.log('Reservations loaded:', resasData?.length)
    resasData?.forEach((r: any) => console.log('Resa:', r.numero, 'statut:', JSON.stringify(r.statut), 'tireuses:', r.reservation_tireuses?.length))
    setReservations(resasData || [])
    setCommandesLoupiote(commandesData || [])
    setConsignes(consignesData || [])

    // Calculer alertes stock — groupées par réservation
    const resasActives = (resasData || []).filter((r: any) => !['annulée', 'terminée'].includes(r.statut))
    const alertesParResa: Record<string, any> = {}

    for (const fut of (futsData || [])) {
      const resasParFut = resasActives.filter((r: any) =>
        r.reservation_futs?.some((rf: any) => rf.fut_catalogue_id === fut.id)
      ).sort((a: any, b: any) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime())

      let stockCumul = fut.stock_actuel
      for (const resa of resasParFut) {
        const ligne = resa.reservation_futs.find((rf: any) => rf.fut_catalogue_id === fut.id)
        stockCumul -= ligne?.quantite || 0
        if (stockCumul < 0) {
          if (!alertesParResa[resa.id]) {
            alertesParResa[resa.id] = { resa, manques: [] }
          }
          alertesParResa[resa.id].manques.push({
            fut, manque: Math.abs(stockCumul), quantite: ligne?.quantite || 0
          })
        }
      }
    }
    setAlertes(Object.values(alertesParResa))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const commandeEnAttente = commandesLoupiote.find((cmd: any) => cmd.statut === 'en_attente')

  const getOuCreerCommandeEnAttente = async (): Promise<string | null> => {
    // Cherche la commande en attente en base directement (pas depuis le state)
    const { data: existing } = await supabase.from('commandes_loupiote')
      .select('id').eq('statut', 'en_attente').order('created_at').limit(1).single()
    if (existing) return existing.id
    // Créer une nouvelle commande globale
    const numero = 'CMD-LPT-' + new Date().getFullYear() + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(Math.floor(Math.random()*9999)).padStart(4,'0')
    const { data } = await supabase.from('commandes_loupiote').insert({
      numero, statut: 'en_attente',
      date_commande: new Date().toISOString().split('T')[0],
      montant_total_ht: 0, montant_consignes: 0,
    }).select('id').single()
    return data?.id || null
  }

  const recalculerTotaux = async (cmdId: string) => {
    const { data: lignes } = await supabase.from('commandes_loupiote_lignes')
      .select('quantite, prix_achat_ht, montant_consigne_unitaire').eq('commande_id', cmdId)
    const totalHT = (lignes||[]).reduce((a: number, l: any) => a + l.quantite * l.prix_achat_ht, 0)
    const totalC = (lignes||[]).reduce((a: number, l: any) => a + l.quantite * 36, 0)
    await supabase.from('commandes_loupiote').update({ montant_total_ht: totalHT, montant_consignes: totalC }).eq('id', cmdId)
  }

  const ajouterACommande = async (resa: any, manques: any[]) => {
    const cmdId = await getOuCreerCommandeEnAttente()
    if (!cmdId) return
    const { data: lignesExist } = await supabase.from('commandes_loupiote_lignes')
      .select('*').eq('commande_id', cmdId)
    for (const m of manques) {
      const exist = (lignesExist || []).find((l: any) => l.fut_catalogue_id === m.fut.id)
      if (exist) {
        await supabase.from('commandes_loupiote_lignes')
          .update({ quantite: exist.quantite + m.manque }).eq('id', exist.id)
      } else {
        await supabase.from('commandes_loupiote_lignes').insert({
          commande_id: cmdId, fut_catalogue_id: m.fut.id,
          quantite: m.manque, prix_achat_ht: m.fut.prix_achat_ht, montant_consigne_unitaire: 36,
        })
      }
    }
    await recalculerTotaux(cmdId)
    // badge computed from data
    await load()
  }

  const supprimerLigneCommande = async (ligneId: string, cmdId: string) => {
    await supabase.from('commandes_loupiote_lignes').delete().eq('id', ligneId)
    await recalculerTotaux(cmdId)
    // badge computed from data // reset badges
    await load()
  }

  const genererBonCommande = (cmd: any, dateLiv?: string) => {
    const lignes = cmd.lignes || []
    const totalHT_futs = lignes.reduce((a: number, l: any) => a + l.prix_achat_ht * l.quantite, 0)
    const totalConsignes = lignes.reduce((a: number, l: any) => a + 30 * l.quantite, 0)
    const tva = totalHT_futs * 0.20
    const totalTTC = totalHT_futs * 1.20 + totalConsignes
    const lignesHtml = lignes.map((l: any) =>
      '<tr><td><div class="produit-nom">' + (l.fut?.nom_cuvee || '') + '</div>' +
      '<div class="produit-type">' + (l.fut?.type_biere || '') + '</div>' +
      '<div class="consigne-note">Consigne : 30,00 \u20ac HT \u00d7 ' + l.quantite + ' f\u00fbt(s) = ' + (30 * l.quantite).toFixed(2) + ' \u20ac (non soumise \u00e0 TVA)</div></td>' +
      '<td style="color:rgba(232,224,213,0.6)">' + l.fut?.contenance_litres + 'L</td>' +
      '<td style="text-align:center;font-weight:700;color:#c9a96e">' + l.quantite + '</td>' +
      '<td style="text-align:right;color:rgba(232,224,213,0.7)">' + Number(l.prix_achat_ht).toFixed(2) + ' \u20ac</td>' +
      '<td style="text-align:right;font-weight:600;color:#f0e8d8">' + (l.prix_achat_ht * l.quantite).toFixed(2) + ' \u20ac</td></tr>'
    ).join('')
    const dateLivHtml = dateLiv ? '<div class="livraison-badge">\ud83d\udce6 Livraison avant le ' + new Date(dateLiv).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'}) + '</div>' : ''
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bon de commande ' + cmd.numero + '</title>' +
      '<style>* { margin: 0; padding: 0; box-sizing: border-box; }' +
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
      '.livraison-badge { display: inline-block; background: rgba(201,169,110,0.1); border: 0.5px solid rgba(201,169,110,0.4); border-radius: 4px; padding: 5px 12px; font-size: 12px; color: #c9a96e; margin-top: 10px; }' +
      '.fournisseur { background: rgba(255,255,255,0.03); border-left: 3px solid rgba(201,169,110,0.4); padding: 12px 18px; margin-bottom: 32px; font-size: 13px; color: rgba(232,224,213,0.7); border-radius: 0 6px 6px 0; }' +
      '.fournisseur strong { color: #c9a96e; }' +
      'table { width: 100%; border-collapse: collapse; }' +
      'thead tr { border-bottom: 1px solid rgba(201,169,110,0.3); }' +
      'thead th { padding: 10px 14px; text-align: left; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,169,110,0.5); font-weight: 400; }' +
      'tbody tr { border-bottom: 0.5px solid rgba(255,255,255,0.05); }' +
      'td { padding: 14px; vertical-align: top; font-size: 13px; }' +
      '.produit-nom { font-weight: 600; color: #f0e8d8; margin-bottom: 3px; }' +
      '.produit-type { font-size: 10px; color: rgba(232,224,213,0.3); text-transform: uppercase; letter-spacing: 1px; }' +
      '.consigne-note { font-size: 10px; color: rgba(201,169,110,0.4); margin-top: 5px; font-style: italic; }' +
      '.totaux { border-top: 1px solid rgba(201,169,110,0.2); }' +
      '.total-line { display: flex; justify-content: space-between; padding: 10px 14px; font-size: 13px; }' +
      '.total-line.sub { color: rgba(232,224,213,0.4); }' +
      '.total-line.tva { color: rgba(232,224,213,0.6); border-top: 0.5px solid rgba(255,255,255,0.05); }' +
      '.total-line.grand { background: rgba(201,169,110,0.08); border: 0.5px solid rgba(201,169,110,0.2); border-radius: 6px; margin: 12px 0 0; font-size: 18px; font-weight: 700; color: #c9a96e; font-family: Georgia, serif; padding: 14px; }' +
      '.signature-zone { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }' +
      '.sig-box { border-top: 0.5px solid rgba(201,169,110,0.3); padding-top: 12px; font-size: 11px; color: rgba(232,224,213,0.3); min-height: 80px; }' +
      '.sig-title { color: rgba(201,169,110,0.6); font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }' +
      '.footer { margin-top: 40px; padding-top: 16px; border-top: 0.5px solid rgba(255,255,255,0.06); font-size: 10px; color: rgba(232,224,213,0.2); line-height: 2; }' +
      '.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 80px; color: rgba(255,255,255,0.03); font-family: Georgia, serif; letter-spacing: 8px; pointer-events: none; white-space: nowrap; }' +
      '</style></head><body>' +
      '<div class="watermark">CAVE DE GILBERT</div>' +
      '<div class="header"><div class="logo-wrap">' +
      '<img src="https://cavedegilbert.vercel.app/logo.png" onerror="this.style.display=\'none\'" />' +
      '<div class="cave-name">Cave de Gilbert</div>' +
      '<div class="cave-info">Avenue Jean Colomb \u2014 69280 Marcy l\'\u00c9toile<br>04 22 91 41 09 \u00b7 contact@cavedegilbert.fr<br>Mar\u2013Sam : 9h30\u201313h / 15h30\u201319h</div>' +
      '</div><div class="doc-info">' +
      '<div class="doc-title">Bon de commande fournisseur</div>' +
      '<div class="doc-numero">' + cmd.numero + '</div>' +
      '<div class="doc-date">' + new Date(cmd.date_commande).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'}) + '</div>' +
      dateLivHtml +
      '</div></div>' +
      '<div class="fournisseur"><strong>Fournisseur :</strong>&nbsp; La Loupiote Brasserie &nbsp;\u00b7&nbsp; commandelaloupiote@gmail.com</div>' +
      '<table><thead><tr>' +
      '<th>D\u00e9signation</th><th>Contenance</th><th style="text-align:center">Qt\u00e9</th><th style="text-align:right">Prix HT / f\u00fbt</th><th style="text-align:right">Total HT</th>' +
      '</tr></thead><tbody>' + lignesHtml + '</tbody></table>' +
      '<div class="totaux">' +
      '<div class="total-line sub"><span>Total HT f\u00fbts</span><span>' + totalHT_futs.toFixed(2) + ' \u20ac</span></div>' +
      '<div class="total-line tva"><span>TVA 20 % (sur f\u00fbts)</span><span>' + tva.toFixed(2) + ' \u20ac</span></div>' +
      '<div class="total-line sub" style="border-top:0.5px solid rgba(255,255,255,0.05)"><span>Consignes HT \u2014 exon\u00e9r\u00e9es TVA</span><span>' + totalConsignes.toFixed(2) + ' \u20ac</span></div>' +
      '<div class="total-line grand"><span>TOTAL TTC</span><span>' + totalTTC.toFixed(2) + ' \u20ac</span></div>' +
      '</div>' +
      '<div class="signature-zone"><div class="sig-box"><div class="sig-title">Bon pour accord \u2014 Cave de Gilbert</div></div>' +
      '<div class="sig-box"><div class="sig-title">Accus\u00e9 de r\u00e9ception \u2014 La Loupiote</div></div></div>' +
      '<div class="footer"><p>Cave de Gilbert \u00b7 Avenue Jean Colomb, 69280 Marcy l\'É toile \u00b7 contact@cavedegilbert.fr \u00b7 04 22 91 41 09</p></div>' +
      '</body></html>'
  }

  const envoyerCommande = async (cmd: any) => {
    setEnvoyerEnCours(true)
    try {
      const html = genererBonCommande(cmd, dateLivraisonSouhaitee || undefined)
      if (dateLivraisonSouhaitee) {
        await supabase.from('commandes_loupiote').update({ date_livraison_prevue: dateLivraisonSouhaitee }).eq('id', cmd.id)
      }
      const res = await fetch('/api/envoyer-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'commandelaloupiote@gmail.com', numero: cmd.numero, clientNom: 'La Loupiote', html }),
      })
      if (res.ok) {
        await supabase.from('commandes_loupiote').update({ statut: 'commandée' }).eq('id', cmd.id)
        await load()
        alert('Commande envoyée à La Loupiote ✓')
      } else { alert('Erreur envoi email') }
    } catch { alert('Erreur réseau') }
    setEnvoyerEnCours(false)
  }

  const clientNom = (r: any) => {
    if (!r.customer) return 'Client anonyme'
    return r.customer.est_societe ? r.customer.raison_sociale : `${r.customer.prenom} ${r.customer.nom}`
  }

  const statutColor: Record<string, string> = {
    devis: '#6e9ec9', confirmée: '#c9a96e', en_cours: '#6ec96e', terminée: '#888', annulée: '#c96e6e'
  }

  const s = { background: '#0d0a08', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ background: '#100d0a', borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/admin" style={{ color: 'rgba(232,224,213,0.4)', textDecoration: 'none', fontSize: 13 }}>← Admin</a>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e' }}>🍺 Location Tireuses & Fûts</div>
        {alertes.length > 0 && (
          <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#c96e6e' }}>
            ⚠ {alertes.length} alerte{alertes.length > 1 ? 's' : ''} stock
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a' }}>
        {[
          { id: 'reservations', label: '📋 Réservations' },
          { id: 'calendrier', label: '📅 Calendrier' },
          { id: 'catalogue', label: '🛢 Fûts & Stock' },
          { id: 'loupiote', label: '🏭 Commandes Loupiote' },
          { id: 'consignes', label: '💰 Consignes' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id as any)} style={{
            background: onglet === o.id ? 'rgba(201,169,110,0.1)' : 'transparent',
            border: 'none', borderBottom: `2px solid ${onglet === o.id ? '#c9a96e' : 'transparent'}`,
            color: onglet === o.id ? '#c9a96e' : 'rgba(232,224,213,0.4)',
            padding: '14px 20px', fontSize: 14, cursor: 'pointer',
          }}>{o.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
      ) : (
        <div style={{ padding: 24 }}>

          {/* Alertes stock */}
          {/* Alertes stock + Tireuses à déplacer */}
          {(() => {
            const hasAlertes = alertes.length > 0
            // Toutes réservations actives avec tireuses, triées par date
            const resasAvecTireuses = reservations
              .filter(r => !['annulée','terminée'].includes(r.statut) && r.reservation_tireuses?.length > 0)
              .sort((a: any, b: any) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime())

            return (
              <div style={{ display: 'grid', gridTemplateColumns: hasAlertes ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 20 }}>
                {hasAlertes && (
                  <div style={{ background: 'rgba(201,110,110,0.07)', border: '0.5px solid rgba(201,110,110,0.25)', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, color: '#c96e6e', fontWeight: 600, marginBottom: 8 }}>⚠ Stock insuffisant</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' as const }}>
                    {alertes.map((a: any, i: number) => (
                      <div key={i} style={{ marginBottom: 6, padding: '6px 10px', background: 'rgba(201,110,110,0.05)', borderRadius: 6, borderLeft: '2px solid rgba(201,110,110,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 12, color: '#c96e6e', fontWeight: 600 }}>
                            {clientNom(a.resa)} · {new Date(a.resa.date_debut).toLocaleDateString('fr-FR')}
                          </div>
                          {!alertesCouvertes.has(a.resa.id) && (
                            <button onClick={async () => { await ajouterACommande(a.resa, a.manques) }}
                              style={{ fontSize: 10, background: 'rgba(201,169,110,0.15)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, color: '#c9a96e', padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' as const, marginLeft: 6 }}>
                              + Ajouter à la commande
                            </button>
                          )}
                          {alertesCouvertes.has(a.resa.id) && (
                            <span style={{ fontSize: 10, background: 'rgba(110,201,110,0.15)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 4, color: '#6ec96e', padding: '2px 8px', marginLeft: 6, whiteSpace: 'nowrap' as const }}>
                              ✓ En commande
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 4 }}>
                          {a.manques.map((m: any, j: number) => (
                            <span key={j} style={{ fontSize: 10, background: 'rgba(201,110,110,0.1)', borderRadius: 3, padding: '1px 6px', color: '#e8a0a0' }}>
                              -{m.manque} {m.fut.nom_cuvee} {m.fut.contenance_litres}L
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
                <div style={{ background: 'rgba(110,158,201,0.07)', border: '0.5px solid rgba(110,158,201,0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: '#6e9ec9', fontWeight: 600, marginBottom: 8 }}>🚛 Tireuses à déplacer</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' as const }}>
                  {resasAvecTireuses.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)', fontStyle: 'italic' }}>Aucun déplacement prévu</div>
                  ) : resasAvecTireuses.map((r: any) => (
                    <div key={r.id} style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(110,158,201,0.05)', borderRadius: 6, borderLeft: '2px solid rgba(110,158,201,0.2)' }}>
                      <div style={{ fontSize: 11, color: '#6e9ec9', marginBottom: 4 }}>
                        {new Date(r.date_debut).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })} — {clientNom(r)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
                        {r.reservation_tireuses?.map((rt: any) => (
                          <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <span style={{ color: '#a0c0e8' }}>📍 {rt.tireuse?.nom} ({rt.tireuse?.modele?.replace('Lenne ', '').replace(' Compresseur', '')})</span>
                            <span style={{ color: 'rgba(232,224,213,0.3)' }}>→</span>
                            <span style={{ color: r.site_retrait ? '#6ec96e' : '#c96e6e', fontWeight: 600 }}>
                              {r.site_retrait ? (SITE_LABELS[r.site_retrait] || r.site_retrait) : '⚠ site non défini'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── RÉSERVATIONS ── */}
          {onglet === 'reservations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>
                    Réservations
                    <span style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', fontFamily: 'DM Sans, sans-serif', marginLeft: 12 }}>
                      {reservations.filter(r => !['annulée','terminée'].includes(r.statut)).length} active{reservations.filter(r => !['annulée','terminée'].includes(r.statut)).length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {(() => {
                    const resasActives = reservations.filter(r => !['annulée','terminée'].includes(r.statut))
                    const totalTTC = resasActives.reduce((acc, r) => acc + (r.total_ttc || 0), 0)
                    // Marge = total TTC / 1.20 - coût achat HT des fûts
                    const totalAchatHT = resasActives.reduce((acc, r) =>
                      acc + (r.reservation_futs || []).reduce((a: number, rf: any) =>
                        a + ((rf.fut?.prix_achat_ht || 0) * rf.quantite), 0), 0)
                    const totalHT = totalTTC / 1.20
                    const margeEur = totalHT - totalAchatHT
                    const margePct = totalHT > 0 ? (margeEur / totalHT) * 100 : 0
                    return (
                      <div style={{ marginTop: 8, display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' as const }}>
                        <div style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                          CA en cours = {totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>
                          Marge nette : <span style={{ color: '#6ec96e' }}>{margeEur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                          <span style={{ color: 'rgba(232,224,213,0.3)', marginLeft: 6 }}>({margePct.toFixed(1)} %)</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
                <button onClick={() => setShowAnnulees(!showAnnulees)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(232,224,213,0.35)', padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
                  {showAnnulees ? '✕ Masquer annulées/terminées' : `Voir annulées/terminées (${reservations.filter(r => ['annulée','terminée'].includes(r.statut)).length})`}
                </button>
              </div>
              {/* Alertes J-1 */}
              {(() => {
                const demain = new Date()
                demain.setDate(demain.getDate() + 1)
                const demainStr = demain.toISOString().split('T')[0]
                const alertesJ1 = reservations.filter(r =>
                  !['annulée','terminée'].includes(r.statut) &&
                  (r.date_debut === demainStr || r.date_fin === demainStr)
                )
                if (alertesJ1.length === 0) return null
                return (
                  <div style={{ background: 'rgba(201,176,110,0.08)', border: '0.5px solid rgba(201,176,110,0.3)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: '#c9b06e', fontWeight: 600, marginBottom: 8 }}>🔔 Rappel J-1</div>
                    {alertesJ1.map((r: any) => (
                      <div key={r.id} style={{ fontSize: 13, color: '#e8e0d5', marginBottom: 6, padding: '8px 12px', background: 'rgba(201,176,110,0.06)', borderRadius: 6 }}>
                        {r.date_debut === demainStr ? (
                          <span><span style={{ color: '#6ec96e', fontWeight: 600 }}>↓ Retrait demain</span> — {clientNom(r)} · {SITE_LABELS[r.site_retrait] || '⚠ site non défini'}</span>
                        ) : (
                          <span><span style={{ color: '#c9b06e', fontWeight: 600 }}>↑ Retour demain</span> — {clientNom(r)} · {SITE_LABELS[r.site_retour] || '⚠ site non défini'}</span>
                        )}
                        <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginLeft: 8 }}>{r.numero}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {reservations.filter(r => showAnnulees ? ['annulée','terminée'].includes(r.statut) : !['annulée','terminée'].includes(r.statut)).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,224,213,0.3)' }}>Aucune réservation</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {reservations.filter(r => showAnnulees ? ['annulée','terminée'].includes(r.statut) : !['annulée','terminée'].includes(r.statut)).map(r => (
                    <button key={r.id} onClick={() => setShowDetailResa(r)} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', display: 'grid', gridTemplateColumns: '180px 1fr 200px 150px', gap: 16, alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.border = '0.5px solid rgba(201,169,110,0.2)')}
                      onMouseLeave={e => (e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.07)')}>
                      <div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>N° réservation</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#c9a96e' }}>{r.numero}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 4 }}>{clientNom(r)}</div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          {r.reservation_futs?.reduce((a: number, l: any) => a + l.quantite, 0)} fût(s) ·
                          {' '}{r.reservation_tireuses?.length || 0} tireuse(s)
                          {(() => {
                            // Calculer stock dispo pour chaque fût de cette réservation
                            const stockOk = (r.reservation_futs || []).every((rf: any) => {
                              const fut = futs.find((f: any) => f.id === rf.fut_catalogue_id)
                              if (!fut) return true
                              // Fûts déjà pris par d'autres réservations actives sur la même période
                              const dejaPris = reservations
                                .filter((other: any) => other.id !== r.id && !['annulée','terminée'].includes(other.statut))
                                .reduce((acc: number, other: any) => {
                                  const overlap = new Date(other.date_debut) <= new Date(r.date_fin) && new Date(other.date_fin) >= new Date(r.date_debut)
                                  if (!overlap) return acc
                                  const autreRf = (other.reservation_futs || []).find((x: any) => x.fut_catalogue_id === rf.fut_catalogue_id)
                                  return acc + (autreRf?.quantite || 0)
                                }, 0)
                              return fut.stock_actuel - dejaPris >= rf.quantite
                            })
                            const alerteResa = alertes.find((a: any) => a.resa?.id === r.id)
                            return !alerteResa
                              ? <span style={{ fontSize: 10, background: 'rgba(110,201,110,0.1)', color: '#6ec96e', padding: '2px 8px', borderRadius: 3 }}>✓ Stock OK</span>
                              : <span style={{ fontSize: 10, background: 'rgba(201,110,110,0.15)', color: '#c96e6e', padding: '2px 8px', borderRadius: 3 }}>⚠ {alerteResa.manques.length} fût(s) en rupture</span>
                          })()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>Période</div>
                        <div style={{ fontSize: 13, color: '#e8e0d5' }}>
                          {new Date(r.date_debut).toLocaleDateString('fr-FR')} → {new Date(r.date_fin).toLocaleDateString('fr-FR')}
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' as const }}>
                          {[
                            { key: 'site_retrait', prefix: '↓', color: r.site_retrait ? '#6ec96e' : 'rgba(232,224,213,0.25)', border: r.site_retrait ? 'rgba(110,201,110,0.3)' : 'rgba(255,255,255,0.08)' },
                            { key: 'site_retour', prefix: '↑', color: r.site_retour ? '#c9b06e' : 'rgba(232,224,213,0.25)', border: r.site_retour ? 'rgba(201,176,110,0.3)' : 'rgba(255,255,255,0.08)' },
                          ].map(({ key, prefix, color, border }) => (
                            <select key={key} value={(r as any)[key] || ''} onChange={async e => {
                              e.stopPropagation()
                              await supabase.from('reservations_location').update({ [key]: e.target.value || null }).eq('id', r.id)
                              setReservations((prev: any[]) => prev.map((x: any) => x.id === r.id ? { ...x, [key]: e.target.value } : x))
                            }} onClick={e => e.stopPropagation()}
                              style={{ background: '#0f0b08', border: `0.5px solid ${border}`, borderRadius: 3, color, fontSize: 10, padding: '1px 4px', cursor: 'pointer', maxWidth: 110 }}>
                              <option value="">{prefix} Site ?</option>
                              <option value="cave_gilbert">{prefix} C. Gilbert</option>
                              <option value="petite_cave">{prefix} Petite Cave</option>
                              <option value="entrepot">{prefix} Entrepôt</option>
                              <option value="livraison">{prefix} 🚚 Livraison</option>
                            </select>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, background: `${statutColor[r.statut]}22`, color: statutColor[r.statut], padding: '3px 10px', borderRadius: 4, textTransform: 'capitalize' }}>{r.statut}</span>
                        <span style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(r.total_ttc || 0)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CALENDRIER TIREUSES ── */}
          {onglet === 'calendrier' && (
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 20 }}>Disponibilité des tireuses</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {tireuses.map(t => {
                  const resasT = reservations.filter(r =>
                    !['annulée', 'annulee', 'terminée', 'terminee'].includes(r.statut) &&
                    r.reservation_tireuses?.some((rt: any) => rt.tireuse_id === t.id)
                  ).sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime())

                  return (
                    <div key={t.id} style={{ background: '#18130e', borderRadius: 12, padding: 20, border: `0.5px solid ${t.statut === 'disponible' ? 'rgba(110,201,110,0.2)' : 'rgba(201,110,110,0.2)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 15, color: '#f0e8d8', marginBottom: 2 }}>{t.nom}</div>
                          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{t.modele} · {t.nb_tirages} tirage{t.nb_tirages > 1 ? 's' : ''}</div>
                        </div>
                        <span style={{ fontSize: 11, background: resasT.length > 0 ? 'rgba(201,110,110,0.1)' : 'rgba(110,201,110,0.1)', color: resasT.length > 0 ? '#c96e6e' : '#6ec96e', padding: '3px 10px', borderRadius: 4 }}>
                          {resasT.length > 0 ? `⚠ ${resasT.length} réservation(s)` : '✓ Disponible'}
                        </span>
                      </div>
                      {resasT.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)', fontStyle: 'italic' }}>Aucune réservation à venir</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {resasT.map((r: any) => (
                            <div key={r.id} style={{ background: 'rgba(201,169,110,0.08)', borderRadius: 6, padding: '8px 12px', border: '0.5px solid rgba(201,169,110,0.15)' }}>
                              <div style={{ fontSize: 12, color: '#c9a96e' }}>{r.numero} — {clientNom(r)}</div>
                              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>
                                {new Date(r.date_debut).toLocaleDateString('fr-FR')} → {new Date(r.date_fin).toLocaleDateString('fr-FR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
                        {['disponible', 'maintenance', 'hors_service'].map(s => (
                          <button key={s} onClick={async () => { await supabase.from('tireuses').update({ statut: s }).eq('id', t.id); load() }}
                            style={{ flex: 1, background: t.statut === s ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${t.statut === s ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`, color: t.statut === s ? '#c9a96e' : 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '6px 4px', fontSize: 10, cursor: 'pointer' }}>
                            {s === 'disponible' ? '✓' : s === 'maintenance' ? '🔧' : '✕'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── CATALOGUE FÛTS ── */}
          {onglet === 'catalogue' && (
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 20 }}>Catalogue fûts & stocks</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
                    {['Type', 'Cuvée', 'Contenance', 'Prix achat HT', 'Prix vente TTC', 'Consigne', 'Stock actuel', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'rgba(232,224,213,0.35)', letterSpacing: 1.5, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {futs.map(f => (
                    <tr key={f.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, color: TYPE_COLORS[f.type_biere] || '#888' }}>● {TYPE_LABELS[f.type_biere] || f.type_biere}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#f0e8d8' }}>{f.nom_cuvee}</td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#e8e0d5' }}>{f.contenance_litres}L</td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#e8e0d5' }}>{fmt(f.prix_achat_ht)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(f.prix_vente_ttc)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>{fmt(f.montant_consigne)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: f.stock_actuel <= 0 ? '#c96e6e' : f.stock_actuel <= 2 ? '#c9b06e' : '#6ec96e' }}>
                          {f.stock_actuel}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => setShowEditFut(f)} style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(232,224,213,0.5)', padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>✎ Modifier</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── COMMANDES LOUPIOTE ── */}
          {onglet === 'loupiote' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>Commandes La Loupiote</div>
                  {commandeEnAttente && <div style={{ fontSize: 12, color: '#c9a96e', marginTop: 4 }}>📋 Panier en cours — {commandeEnAttente.lignes?.length || 0} ligne(s)</div>}
                </div>
                <button onClick={() => setShowNouvelleCommande(true)} style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(232,224,213,0.5)', padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>+ Nouvelle commande</button>
              </div>

              {commandesLoupiote.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,224,213,0.3)' }}>Aucune commande — ajoutez des fûts depuis les alertes stock</div>
              ) : commandesLoupiote.map((cmd: any) => (
                <div key={cmd.id} style={{ background: '#18130e', borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: `0.5px solid ${cmd.statut === 'en_attente' ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#c9a96e' }}>{cmd.numero}</div>
                      <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>Créée le {new Date(cmd.date_commande).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <span style={{ fontSize: 11, background: cmd.statut === 'en_attente' ? 'rgba(201,169,110,0.15)' : cmd.statut === 'commandée' ? 'rgba(110,201,110,0.1)' : 'rgba(255,255,255,0.05)', color: cmd.statut === 'en_attente' ? '#c9a96e' : cmd.statut === 'commandée' ? '#6ec96e' : '#888', padding: '3px 10px', borderRadius: 4 }}>{cmd.statut}</span>
                    {cmd.statut === 'en_attente' && (
                      <button onClick={async () => {
                        if (!confirm('Supprimer cette commande ?')) return
                        await supabase.from('commandes_loupiote_lignes').delete().eq('commande_id', cmd.id)
                        await supabase.from('commandes_loupiote').delete().eq('id', cmd.id)
                        // badge computed from data
                        load()
                      }} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 6, color: '#c96e6e', padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>
                        🗑 Supprimer
                      </button>
                    )}
                  </div>

                  {/* Lignes éditable si en_attente */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                        {['Désignation', 'Qté', 'Prix HT', 'Consigne', 'Total', ''].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, color: 'rgba(232,224,213,0.35)', letterSpacing: 1, fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cmd.lignes?.map((l: any) => (
                        <tr key={l.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px' }}>
                            <div style={{ fontSize: 13, color: '#f0e8d8' }}>{l.fut?.nom_cuvee} {l.fut?.contenance_litres}L</div>
                            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)' }}>{l.fut?.type_biere}</div>
                          </td>
                          <td style={{ padding: '8px' }}>
                            {cmd.statut === 'en_attente' ? (
                              <input type="number" min={1} value={l.quantite}
                                onChange={async e => {
                                  const q = parseInt(e.target.value) || 1
                                  await supabase.from('commandes_loupiote_lignes').update({ quantite: q }).eq('id', l.id)
                                  // badge computed from data
                                  await recalculerTotaux(cmd.id)
                                  load()
                                }}
                                style={{ width: 50, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, color: '#f0e8d8', fontSize: 13, padding: '4px 6px', textAlign: 'center' }} />
                            ) : <span style={{ color: '#e8e0d5' }}>{l.quantite}</span>}
                          </td>
                          <td style={{ padding: '8px' }}>
                            {cmd.statut === 'en_attente' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" step="0.01" value={l.prix_achat_ht}
                                  onChange={async e => {
                                    const p = parseFloat(e.target.value) || 0
                                    await supabase.from('commandes_loupiote_lignes').update({ prix_achat_ht: p }).eq('id', l.id)
                                    await recalculerTotaux(cmd.id)
                                    load()
                                  }}
                                  style={{ width: 70, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, color: '#f0e8d8', fontSize: 13, padding: '4px 6px' }} />
                                <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>€</span>
                              </div>
                            ) : <span style={{ color: '#e8e0d5' }}>{Number(l.prix_achat_ht).toFixed(2)} €</span>}
                          </td>
                          <td style={{ padding: '8px', fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                            30 € × {l.quantite} = {(30 * l.quantite).toFixed(2)} €
                          </td>
                          <td style={{ padding: '8px', color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                            {(l.prix_achat_ht * l.quantite).toFixed(2)} €
                          </td>
                          <td style={{ padding: '8px' }}>
                            {cmd.statut === 'en_attente' && (
                              <button onClick={() => supprimerLigneCommande(l.id, cmd.id)}
                                style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 16, cursor: 'pointer', padding: '2px 6px' }}
                                title="Supprimer cette ligne">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totaux */}
                  <div style={{ background: 'rgba(201,169,110,0.05)', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>
                      <span>Total HT fûts</span><span>{cmd.montant_total_ht?.toFixed(2)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>
                      <span>TVA 20% (sur fûts)</span><span>{(cmd.montant_total_ht * 0.20)?.toFixed(2)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>
                      <span>Consignes HT (30€/fût — exonérées TVA)</span><span>{(cmd.lignes||[]).reduce((a: number, l: any) => a + 30 * l.quantite, 0).toFixed(2)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 700, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <span>TOTAL TTC</span><span>{(cmd.montant_total_ht * 1.20 + (cmd.lignes||[]).reduce((a: number, l: any) => a + 30 * l.quantite, 0)).toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Date livraison + envoi si en_attente */}
                  {cmd.statut === 'en_attente' && (
                    <div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', whiteSpace: 'nowrap' }}>Livraison souhaitée avant le :</span>
                        <input type="date" value={dateLivraisonSouhaitee} onChange={e => setDateLivraisonSouhaitee(e.target.value)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#f0e8d8', fontSize: 13, padding: '6px 10px' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { const html = genererBonCommande(cmd, dateLivraisonSouhaitee); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print() } }}
                          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(232,224,213,0.6)', padding: '10px', fontSize: 13, cursor: 'pointer' }}>
                          🖨 Aperçu / Imprimer
                        </button>
                        <button onClick={() => envoyerCommande(cmd)} disabled={envoyerEnCours}
                          style={{ flex: 2, background: '#c9a96e', border: 'none', borderRadius: 8, color: '#0d0a08', padding: '10px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
                          {envoyerEnCours ? '⟳ Envoi...' : '📧 Valider & envoyer à La Loupiote'}
                        </button>
                      </div>
                    </div>
                  )}
                  {cmd.statut === 'commandée' && (
                    <div style={{ marginTop: 12 }}>
                      <button onClick={() => {
                        setCmdReception(cmd)
                        const init: Record<string, number> = {}
                        cmd.lignes?.forEach((l: any) => { init[l.id] = l.quantite })
                        setQtesRecues(init)
                      }} style={{ width: '100%', background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 8, color: '#6ec96e', padding: '10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                        📦 Réceptionner la livraison
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CONSIGNES ── */}
          {onglet === 'consignes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>Suivi consignes fûts — La Loupiote</div>
                <button onClick={() => setShowNouvelleConsigne(true)} style={{ background: '#c9a96e', border: 'none', borderRadius: 8, color: '#0d0a08', padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>+ Enregistrer retour</button>
              </div>

              {/* Résumé */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'En attente de remboursement', value: consignes.filter(c => c.statut === 'en_attente').reduce((a: number, c: any) => a + (c.montant_consigne_attendu - c.montant_consigne_recu), 0), color: '#c96e6e' },
                  { label: 'Partiellement reçu', value: consignes.filter(c => c.statut === 'partiel').reduce((a: number, c: any) => a + (c.montant_consigne_attendu - c.montant_consigne_recu), 0), color: '#c9b06e' },
                  { label: 'Total soldé', value: consignes.filter(c => c.statut === 'soldé').reduce((a: number, c: any) => a + c.montant_consigne_recu, 0), color: '#6ec96e' },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: '#18130e', borderRadius: 10, padding: '16px 20px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>{kpi.label.toUpperCase()}</div>
                    <div style={{ fontSize: 24, fontFamily: 'Georgia, serif', color: kpi.color }}>{fmt(kpi.value)}</div>
                  </div>
                ))}
              </div>

              {consignes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,224,213,0.3)' }}>Aucun retour enregistré</div>
              ) : consignes.map(c => (
                <div key={c.id} style={{ background: '#18130e', borderRadius: 10, padding: '16px 20px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 4 }}>{c.quantite_futs_rendus} fût(s) rendu(s) le {new Date(c.date_retour_futs).toLocaleDateString('fr-FR')}</div>
                    <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Attendu : {fmt(c.montant_consigne_attendu)} · Reçu : {fmt(c.montant_consigne_recu)}</div>
                    {c.notes && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginTop: 4, fontStyle: 'italic' }}>{c.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, background: c.statut === 'soldé' ? 'rgba(110,201,110,0.1)' : c.statut === 'partiel' ? 'rgba(201,176,110,0.1)' : 'rgba(201,110,110,0.1)', color: c.statut === 'soldé' ? '#6ec96e' : c.statut === 'partiel' ? '#c9b06e' : '#c96e6e', padding: '3px 10px', borderRadius: 4 }}>{c.statut}</span>
                    <select value={c.statut} onChange={async e => { await supabase.from('consignes_loupiote').update({ statut: e.target.value }).eq('id', c.id); load() }}
                      style={{ background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#c9a96e', fontSize: 12, padding: '5px 8px', cursor: 'pointer' }}>
                      {['en_attente', 'partiel', 'soldé'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal réception commande */}
      {cmdReception && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div style={{ background: '#18130e', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 16, padding: 32, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#6ec96e' }}>📦 Réception — {cmdReception.numero}</div>
              <button onClick={() => setCmdReception(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 20 }}>Vérifiez et ajustez les quantités réellement reçues avant de valider l'entrée en stock.</div>
            {cmdReception.lignes?.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#f0e8d8' }}>{l.fut?.nom_cuvee} {l.fut?.contenance_litres}L</div>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>Commandé : {l.quantite} fût(s)</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Reçu :</span>
                  <input type="number" min={0} value={qtesRecues[l.id] ?? l.quantite}
                    onChange={e => setQtesRecues(prev => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                    style={{ width: 65, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 15, padding: '8px', textAlign: 'center' as const }} />
                  <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>fût(s)</span>
                </div>
              </div>
            ))}
            <button onClick={async () => {
              // Incrémenter le stock pour chaque ligne reçue
              for (const l of (cmdReception.lignes || [])) {
                const qteRecue = qtesRecues[l.id] ?? l.quantite
                if (qteRecue > 0) {
                  const { data: fut } = await supabase.from('futs_catalogue').select('stock_actuel').eq('id', l.fut_catalogue_id).single()
                  if (fut) await supabase.from('futs_catalogue').update({ stock_actuel: fut.stock_actuel + qteRecue }).eq('id', l.fut_catalogue_id)
                }
              }
              // Passer la commande en "livrée"
              await supabase.from('commandes_loupiote').update({
                statut: 'livrée',
                date_livraison_reelle: new Date().toISOString().split('T')[0],
              }).eq('id', cmdReception.id)
              setCmdReception(null)
              await load()
            }} style={{ width: '100%', background: '#6ec96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700, marginTop: 12 }}>
              ✓ Valider l'entrée en stock
            </button>
          </div>
        </div>
      )}

      {/* Modal détail réservation */}
      {showDetailResa && <ModalDetailResa resa={showDetailResa} onClose={() => { setShowDetailResa(null); load() }} futs={futs} tireuses={tireuses} />}

      {/* Modal modifier fût */}
      {showEditFut && <ModalEditFut fut={showEditFut} onClose={() => { setShowEditFut(null); load() }} />}

      {/* Modal nouvelle commande Loupiote */}
      {showNouvelleCommande && <ModalNouvelleCommande futs={futs} onClose={() => { setShowNouvelleCommande(false); load() }} />}

      {/* Modal nouvelle consigne */}
      {showNouvelleConsigne && <ModalNouvelleConsigne onClose={() => { setShowNouvelleConsigne(false); load() }} />}
    </div>
  )
}

// ── Modal Détail Réservation ──
function ModalDetailResa({ resa, onClose, futs, tireuses }: { resa: any; onClose: () => void; futs: any[]; tireuses: any[] }) {
  const [r, setR] = useState(resa)
  const [saving, setSaving] = useState(false)
  const [retours, setRetours] = useState<Record<string, number>>({})
  const [editPrix, setEditPrix] = useState(false)
  const [lignesEdit, setLignesEdit] = useState<any[]>(resa.reservation_futs?.map((l: any) => ({ ...l })) || [])
  const [remiseType, setRemiseType] = useState<'pct' | 'eur'>('pct')
  const [remiseVal, setRemiseVal] = useState('')


  const clientNom = r.customer?.est_societe ? r.customer.raison_sociale : `${r.customer?.prenom || ''} ${r.customer?.nom || ''}`.trim()


  const savePrix = async () => {
    setSaving(true)
    for (const l of lignesEdit) {
      await supabase.from('reservation_futs').update({ prix_unitaire_ttc: l.prix_unitaire_ttc, quantite: l.quantite }).eq('id', l.id)
    }
    const sousTotal = lignesEdit.reduce((acc, l) => acc + l.prix_unitaire_ttc * l.quantite, 0)
    const remise = remiseVal ? parseFloat(remiseVal) : 0
    const total = remiseType === 'pct' ? sousTotal * (1 - remise / 100) : Math.max(0, sousTotal - remise)
    await supabase.from('reservations_location').update({ total_ttc: total }).eq('id', r.id)
    setR({ ...r, reservation_futs: lignesEdit, total_ttc: total })
    setEditPrix(false)
    setSaving(false)
  }

  const updateStatut = async (statut: string) => {
    setSaving(true)
    const ancienStatut = r.statut

    // Décrémenter stock quand les fûts partent physiquement
    if (statut === 'en_cours' && ancienStatut !== 'en_cours') {
      for (const ligne of r.reservation_futs || []) {
        const { data: f } = await supabase.from('futs_catalogue').select('stock_actuel').eq('id', ligne.fut_catalogue_id).single()
        if (f) await supabase.from('futs_catalogue').update({ stock_actuel: Math.max(0, f.stock_actuel - ligne.quantite) }).eq('id', ligne.fut_catalogue_id)
      }
    }

    // Remettre en stock si annulation depuis en_cours
    if (statut === 'annulée' && ancienStatut === 'en_cours') {
      for (const ligne of r.reservation_futs || []) {
        const { data: f } = await supabase.from('futs_catalogue').select('stock_actuel').eq('id', ligne.fut_catalogue_id).single()
        if (f) await supabase.from('futs_catalogue').update({ stock_actuel: f.stock_actuel + ligne.quantite }).eq('id', ligne.fut_catalogue_id)
      }
    }

    await supabase.from('reservations_location').update({ statut }).eq('id', r.id)
    setR({ ...r, statut })
    setSaving(false)
    onClose()
  }

  const enregistrerRetour = async () => {
    const { data: retour } = await supabase.from('retours_futs').insert({ reservation_id: r.id, date_retour: new Date().toISOString().split('T')[0] }).select('id').single()
    if (!retour) return
    for (const [fut_id, qte] of Object.entries(retours)) {
      const ligne = r.reservation_futs.find((l: any) => l.fut_catalogue_id === fut_id)
      const qtePercutee = (ligne?.quantite || 0) - (qte as number)
      await supabase.from('retours_futs_lignes').insert({
        retour_id: retour.id, fut_catalogue_id: fut_id,
        quantite_retournee: qte as number, quantite_percutee: qtePercutee,
        montant_rembourse_ttc: 0  // Pas de remboursement consigne client
      })
      // Remettre en stock uniquement les fûts non percutés retournés
      if ((qte as number) > 0) {
        const { data: f } = await supabase.from('futs_catalogue').select('stock_actuel').eq('id', fut_id).single()
        if (f) await supabase.from('futs_catalogue').update({ stock_actuel: f.stock_actuel + (qte as number) }).eq('id', fut_id)
      }
    }
    // Statut → terminée (sans re-décrémenter le stock)
    await supabase.from('reservations_location').update({ statut: 'terminée' }).eq('id', r.id)
    setR({ ...r, statut: 'terminée' })
    onClose()
  }

  const statutColor: Record<string, string> = { devis: '#6e9ec9', confirmée: '#c9a96e', en_cours: '#6ec96e', terminée: '#888', annulée: '#c96e6e' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 640, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e', marginBottom: 4 }}>{r.numero}</div>
            <div style={{ fontSize: 15, color: '#f0e8d8' }}>{clientNom || 'Client anonyme'}</div>
            {r.customer?.telephone && <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>{r.customer.telephone}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Statut */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>STATUT</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['devis', 'confirmée', 'en_cours', 'terminée', 'annulée'].map(s => (
              <button key={s} onClick={() => updateStatut(s)} disabled={saving}
                style={{ flex: 1, background: r.statut === s ? `${statutColor[s]}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${r.statut === s ? statutColor[s] : 'rgba(255,255,255,0.1)'}`, color: r.statut === s ? statutColor[s] : 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '8px 4px', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>DÉPART</div>
            <div style={{ fontSize: 16, color: '#f0e8d8' }}>{new Date(r.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
            {r.site_retrait && <div style={{ fontSize: 12, color: '#6ec96e', marginTop: 4 }}>↓ {SITE_LABELS[r.site_retrait] || r.site_retrait}</div>}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>RETOUR</div>
            <div style={{ fontSize: 16, color: '#f0e8d8' }}>{new Date(r.date_fin).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
            {r.site_retour && <div style={{ fontSize: 12, color: '#c9b06e', marginTop: 4 }}>↑ {SITE_LABELS[r.site_retour] || r.site_retour}</div>}
          </div>
        </div>

        {/* Fûts */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 10, letterSpacing: 1 }}>FÛTS RÉSERVÉS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <button onClick={() => setEditPrix(!editPrix)} style={{ fontSize: 12, background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#c9a96e', padding: '4px 12px', cursor: 'pointer' }}>✎ Modifier prix</button>
          </div>
          {(editPrix ? lignesEdit : r.reservation_futs || []).map((l: any, i: number) => (
            <div key={l.id} style={{ padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, color: '#f0e8d8' }}>{l.fut?.nom_cuvee} {l.fut?.contenance_litres}L</div>
                <div style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(l.quantite * l.prix_unitaire_ttc)}</div>
              </div>
              {editPrix ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Qté</span>
                  <input type="number" min={1} value={l.quantite} onChange={e => setLignesEdit(p => p.map((x, j) => j === i ? { ...x, quantite: parseInt(e.target.value) || 1 } : x))} style={{ width: 55, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '5px', textAlign: 'center' as const }} />
                  <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Prix u. TTC</span>
                  <input type="number" step="0.01" value={l.prix_unitaire_ttc} onChange={e => setLignesEdit(p => p.map((x, j) => j === i ? { ...x, prix_unitaire_ttc: parseFloat(e.target.value) || 0 } : x))} style={{ width: 85, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '5px' }} />
                  <span style={{ fontSize: 11, color: '#c9a96e' }}>€</span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>{l.quantite} fût(s) × {fmt(l.prix_unitaire_ttc)}</div>
              )}
            </div>
          ))}
          {editPrix && (
            <div style={{ marginTop: 12, padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>REMISE GLOBALE</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                  {(['pct','eur'] as const).map(t => <button key={t} onClick={() => setRemiseType(t)} style={{ background: remiseType === t ? 'rgba(201,169,110,0.2)' : 'transparent', border: 'none', color: remiseType === t ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>{t === 'pct' ? '%' : '€'}</button>)}
                </div>
                <input type="number" step="0.01" value={remiseVal} onChange={e => setRemiseVal(e.target.value)} placeholder="0" style={{ width: 80, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '5px 8px' }} />
                {remiseVal && <span style={{ fontSize: 13, color: '#6ec96e' }}>→ {fmt(Math.max(0, lignesEdit.reduce((a,l)=>a+l.prix_unitaire_ttc*l.quantite,0) - (remiseType==='eur' ? parseFloat(remiseVal) : lignesEdit.reduce((a,l)=>a+l.prix_unitaire_ttc*l.quantite,0)*parseFloat(remiseVal)/100)))}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditPrix(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(232,224,213,0.4)', padding: '10px', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
                <button onClick={savePrix} disabled={saving} style={{ flex: 2, background: '#c9a96e', border: 'none', borderRadius: 8, color: '#0d0a08', padding: '10px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>{saving ? '⟳' : '✓ Enregistrer'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Tireuses */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 10, letterSpacing: 1 }}>TIREUSE(S)</div>
          {r.reservation_tireuses?.map((rt: any) => (
            <div key={rt.id} style={{ fontSize: 14, color: '#f0e8d8', padding: '6px 0' }}>
              {rt.tireuse?.nom} — {rt.tireuse?.modele}
            </div>
          ))}
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginTop: 6 }}>
            Caution : {fmt(r.caution_tireuse_ttc)} — {r.caution_payee ? '✓ Payée' : '⚠ Non payée'}
          </div>
        </div>

        {/* Total */}
        <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(232,224,213,0.6)' }}>Total TTC</span>
          <span style={{ fontSize: 22, fontFamily: 'Georgia, serif', color: '#c9a96e' }}>{fmt(r.total_ttc || 0)}</span>
        </div>

        {/* Retour fûts */}
        {['en_cours', 'confirmée'].includes(r.statut) && (
          <div>
            <div style={{ fontSize: 13, color: '#c9a96e', marginBottom: 12 }}>📦 Enregistrer le retour des fûts</div>
            {r.reservation_futs?.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 13, color: '#e8e0d5' }}>{l.fut?.nom_cuvee} {l.fut?.contenance_litres}L (x{l.quantite})</span>
                <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Non percutés :</span>
                <input type="number" min={0} max={l.quantite} value={retours[l.fut_catalogue_id] ?? 0}
                  onChange={e => setRetours(prev => ({ ...prev, [l.fut_catalogue_id]: parseInt(e.target.value) || 0 }))}
                  style={{ width: 60, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '6px 10px', textAlign: 'center' }} />
              </div>
            ))}
            <button onClick={enregistrerRetour} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700, marginTop: 10 }}>
              ✓ Valider le retour & clôturer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal Modifier Fût ──
function ModalEditFut({ fut, onClose }: { fut: any; onClose: () => void }) {
  const [form, setForm] = useState({ prix_achat_ht: fut.prix_achat_ht, prix_vente_ttc: fut.prix_vente_ttc, montant_consigne: fut.montant_consigne, stock_actuel: fut.stock_actuel, stock_minimum: fut.stock_minimum })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('futs_catalogue').update(form).eq('id', fut.id)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 440, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>{fut.nom_cuvee} {fut.contenance_litres}L</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {[
          { label: 'Prix achat HT (€)', key: 'prix_achat_ht' },
          { label: 'Prix vente TTC (€)', key: 'prix_vente_ttc' },
          { label: 'Consigne (€)', key: 'montant_consigne' },
          { label: 'Stock actuel', key: 'stock_actuel' },
          { label: 'Stock minimum alerte', key: 'stock_minimum' },
        ].map(({ label, key }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6, letterSpacing: 1 }}>{label.toUpperCase()}</div>
            <input type="number" step="0.01" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#f0e8d8', fontSize: 16, padding: '12px', boxSizing: 'border-box' }} />
          </div>
        ))}
        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700, marginTop: 8 }}>
          {saving ? '⟳' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Nouvelle Commande Loupiote ──
function ModalNouvelleCommande({ futs, onClose }: { futs: any[]; onClose: () => void }) {
  const [lignes, setLignes] = useState<{ fut_id: string; quantite: number }[]>([{ fut_id: '', quantite: 1 }])
  const [dateLivraison, setDateLivraison] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const total_ht = lignes.reduce((acc, l) => {
    const fut = futs.find(f => f.id === l.fut_id)
    return acc + (fut ? fut.prix_achat_ht * l.quantite : 0)
  }, 0)
  const total_consignes = lignes.reduce((acc, l) => {
    const fut = futs.find(f => f.id === l.fut_id)
    return acc + (fut ? fut.montant_consigne * l.quantite : 0)
  }, 0)

  const save = async () => {
    if (!lignes.some(l => l.fut_id)) return
    setSaving(true)
    const numero = `CMD-LPT-${Date.now()}`
    const { data: cmd } = await supabase.from('commandes_loupiote').insert({
      numero, statut: 'en_attente', date_commande: new Date().toISOString().split('T')[0],
      date_livraison_prevue: dateLivraison || null,
      montant_total_ht: total_ht, montant_consignes: total_consignes, notes: notes || null
    }).select('id').single()
    if (cmd) {
      await supabase.from('commandes_loupiote_lignes').insert(
        lignes.filter(l => l.fut_id).map(l => {
          const fut = futs.find(f => f.id === l.fut_id)
          return { commande_id: cmd.id, fut_catalogue_id: l.fut_id, quantite: l.quantite, prix_achat_ht: fut?.prix_achat_ht || 0, montant_consigne_unitaire: fut?.montant_consigne || 0 }
        })
      )
    }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e' }}>Commande La Loupiote</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {lignes.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            <select value={l.fut_id} onChange={e => setLignes(prev => prev.map((x, j) => j === i ? { ...x, fut_id: e.target.value } : x))}
              style={{ flex: 2, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#e8e0d5', fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
              <option value="">— Choisir un fût —</option>
              {futs.map(f => <option key={f.id} value={f.id}>{f.nom_cuvee} {f.contenance_litres}L — {f.prix_achat_ht}€ HT</option>)}
            </select>
            <input type="number" min={1} value={l.quantite} onChange={e => setLignes(prev => prev.map((x, j) => j === i ? { ...x, quantite: parseInt(e.target.value) || 1 } : x))}
              style={{ width: 70, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '10px', textAlign: 'center' }} />
            <button onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        ))}

        <button onClick={() => setLignes(prev => [...prev, { fut_id: '', quantite: 1 }])} style={{ fontSize: 13, color: '#c9a96e', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', marginBottom: 20 }}>
          + Ajouter un fût
        </button>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>DATE LIVRAISON PRÉVUE</div>
          <input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '10px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>NOTES</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 14, padding: '10px', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>

        <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 4 }}><span>Total HT fûts</span><span>{total_ht.toFixed(2)}€</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 4 }}><span>Consignes</span><span>{total_consignes.toFixed(2)}€</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif', marginTop: 8 }}><span>Total à payer</span><span>{(total_ht + total_consignes).toFixed(2)}€</span></div>
        </div>

        <button onClick={save} disabled={saving || !lignes.some(l => l.fut_id)} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>
          {saving ? '⟳' : '✓ Enregistrer la commande'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Nouvelle Consigne ──
function ModalNouvelleConsigne({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ date_retour_futs: new Date().toISOString().split('T')[0], quantite_futs_rendus: 1, montant_consigne_attendu: 36, montant_consigne_recu: 0, notes: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const statut = form.montant_consigne_recu >= form.montant_consigne_attendu ? 'soldé' : form.montant_consigne_recu > 0 ? 'partiel' : 'en_attente'
    await supabase.from('consignes_loupiote').insert({ ...form, statut })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 440, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e' }}>Retour fûts La Loupiote</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        {[
          { label: 'Date de retour des fûts', key: 'date_retour_futs', type: 'date' },
          { label: 'Nombre de fûts rendus', key: 'quantite_futs_rendus', type: 'number' },
          { label: 'Consigne attendue (€)', key: 'montant_consigne_attendu', type: 'number' },
          { label: 'Consigne reçue (€)', key: 'montant_consigne_recu', type: 'number' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6, letterSpacing: 1 }}>{label.toUpperCase()}</div>
            <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '12px', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>NOTES</div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 14, padding: '10px', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: form.montant_consigne_recu >= form.montant_consigne_attendu ? '#6ec96e' : '#c96e6e', marginBottom: 20 }}>
          <span>Écart</span>
          <span>{(form.montant_consigne_recu - form.montant_consigne_attendu).toFixed(2)}€</span>
        </div>
        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>
          {saving ? '⟳' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  )
}