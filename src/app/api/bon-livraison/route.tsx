import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_LABELS: Record<string, string> = {
  cave_gilbert: 'Cave de Gilbert',
  petite_cave: 'La Petite Cave',
  entrepot: 'Entrepôt',
  livraison: 'À livrer',
}

const INVENTAIRE = [
  'Une tireuse froid sec',
  'Un bec Easy Pracc',
  "L'outil pour retirer le bec Easy Pracc",
  'Un tuyau gris',
  'Un tuyau rouge',
  'Une tête de percussion',
  'Une grille de récupération',
]

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return new NextResponse('Paramètre id manquant', { status: 400 })
  }

  const { data: r, error } = await supabase
    .from('reservations_location')
    .select(`
      *,
      customer:customers(prenom, nom, raison_sociale, est_societe, email, telephone),
      reservation_futs(*, fut:futs_catalogue(*)),
      reservation_tireuses(*, tireuse:tireuses(*))
    `)
    .eq('id', id)
    .single()

  if (error || !r) {
    return new NextResponse('Réservation introuvable', { status: 404 })
  }

  if (!r.signature_livraison) {
    return new NextResponse('Aucune signature enregistrée pour cette réservation', { status: 404 })
  }

  const clientNom = r.customer?.est_societe
    ? r.customer.raison_sociale
    : `${r.customer?.prenom || ''} ${r.customer?.nom || ''}`.trim() || 'Client anonyme'

  const dateDoc = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const futsHtml = (r.reservation_futs || []).map((rf: any) =>
    `<div class="item"><span class="check">☑</span><span>${rf.quantite} × ${rf.fut?.nom_cuvee} ${rf.fut?.contenance_litres}L</span></div>`
  ).join('')

  const tirsHtml = (r.reservation_tireuses || []).map((rt: any) =>
    `<div class="item"><span class="check">☑</span><span>Tireuse : ${rt.tireuse?.nom} (${rt.tireuse?.modele})</span></div>`
  ).join('')

  const inventaireHtml = INVENTAIRE.map(i =>
    `<div class="item"><span class="check">☑</span><span>${i}</span></div>`
  ).join('')

  const dateDebut = new Date(r.date_debut + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })
  const dateFin = new Date(r.date_fin + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bon de livraison ${r.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #ffffff;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 32px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { background: #ffffff !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(201,169,110,0.3);
    }
    .cave-name { font-size: 20px; color: #8a6a3e; font-family: Georgia, serif; letter-spacing: 2px; }
    .cave-info { font-size: 11px; color: rgba(0,0,0,0.5); line-height: 2; margin-top: 6px; }
    .doc-title { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: rgba(138,106,62,0.85); margin-bottom: 6px; text-align: right; }
    .doc-numero { font-size: 22px; color: #8a6a3e; font-family: Georgia, serif; text-align: right; }
    .doc-date { font-size: 12px; color: rgba(0,0,0,0.5); text-align: right; margin-top: 4px; }
    .section {
      background: rgba(0,0,0,0.04);
      border: 0.5px solid rgba(0,0,0,0.1);
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(138,106,62,0.85);
      margin-bottom: 10px;
    }
    .client-nom { font-size: 17px; color: #0a0a0a; font-family: Georgia, serif; margin-bottom: 4px; }
    .client-tel { font-size: 13px; color: rgba(0,0,0,0.6); }
    .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .date-label { font-size: 10px; color: rgba(0,0,0,0.5); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
    .date-val { font-size: 15px; color: #0a0a0a; }
    .date-site { font-size: 12px; margin-top: 3px; }
    .item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 7px 0;
      border-bottom: 0.5px solid rgba(0,0,0,0.06);
      font-size: 14px;
      color: #1a1a1a;
    }
    .item:last-child { border-bottom: none; }
    .check { color: #8a6a3e; font-size: 16px; flex-shrink: 0; }
    .warning {
      background: rgba(201,110,110,0.12);
      border: 1px solid rgba(201,110,110,0.4);
      border-radius: 8px;
      padding: 14px 18px;
      margin: 16px 0;
    }
    .warning-text {
      font-size: 14px;
      color: #c96e6e;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .sig-zone {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 32px;
    }
    .sig-box { border-top: 0.5px solid rgba(201,169,110,0.3); padding-top: 12px; }
    .sig-label {
      font-size: 10px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(138,106,62,0.85);
      margin-bottom: 8px;
    }
    .sig-img {
      max-width: 240px;
      max-height: 80px;
      display: block;
      margin-top: 4px;
      border: 0.5px solid rgba(201,169,110,0.2);
      border-radius: 4px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 0.5px solid rgba(0,0,0,0.08);
      font-size: 10px;
      color: rgba(0,0,0,0.35);
      line-height: 2;
    }
    .badge-valide {
      display: inline-block;
      background: rgba(110,201,110,0.1);
      border: 0.5px solid rgba(110,201,110,0.3);
      border-radius: 4px;
      padding: 4px 12px;
      font-size: 11px;
      color: #6ec96e;
      margin-top: 8px;
    }
  </style>
</head>
<body>

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
    <div class="doc-date">${dateDoc}</div>
    <div class="badge-valide">✓ Document signé</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Client</div>
  <div class="client-nom">${clientNom}</div>
  ${r.customer?.telephone ? `<div class="client-tel">📞 ${r.customer.telephone}</div>` : ''}
  ${r.customer?.email ? `<div class="client-tel">${r.customer.email}</div>` : ''}
</div>

<div class="section">
  <div class="section-title">Période de location</div>
  <div class="dates">
    <div>
      <div class="date-label">Départ</div>
      <div class="date-val">${dateDebut}</div>
      ${r.site_retrait ? `<div class="date-site" style="color:#6ec96e">↓ ${SITE_LABELS[r.site_retrait] || r.site_retrait}</div>` : ''}
    </div>
    <div>
      <div class="date-label">Retour prévu</div>
      <div class="date-val">${dateFin}</div>
      ${r.site_retour ? `<div class="date-site" style="color:#c9b06e">↑ ${SITE_LABELS[r.site_retour] || r.site_retour}</div>` : ''}
    </div>
  </div>
</div>

${tirsHtml || futsHtml ? `
<div class="section">
  <div class="section-title">Matériel remis</div>
  ${tirsHtml}
  ${futsHtml}
</div>` : ''}

<div class="section">
  <div class="section-title">Inventaire complet du matériel fourni</div>
  ${inventaireHtml}
</div>

<div class="warning">
  <div class="warning-text">⚠ Démontez absolument le bec Easy Pracc avant tout transport de la tireuse</div>
</div>

<div class="sig-zone">
  <div class="sig-box">
    <div class="sig-label">Signature client — Bon pour accord</div>
    <img
      class="sig-img"
      src="${r.signature_livraison}"
      alt="Signature client"
    />
  </div>
  <div class="sig-box">
    <div class="sig-label">Cave de Gilbert</div>
    <div style="font-family:Georgia,serif;font-size:18px;color:#8a6a3e;margin-top:8px">Cave de Gilbert</div>
  </div>
</div>

<div class="footer">
  Cave de Gilbert · Avenue Jean Colomb, 69280 Marcy l'Étoile · contact@cavedegilbert.fr · 04 22 91 41 09
</div>

</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // On contrôle nous-mêmes les headers — pas de Storage, pas de CSP restrictif
      'Cache-Control': 'private, no-cache',
    },
  })
}