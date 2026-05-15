// src/app/api/envoyer-comptable/route.tsx
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

const JOURNAL_LABELS: Record<string, string> = {
  VE: 'Journal des ventes',
  AC: 'Journal des achats',
  BQ: 'Journal de banque',
  CA: 'Journal de caisse',
  OD: 'Opérations diverses',
  AN: 'À-nouveaux',
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return d.replace(/-/g, '')
}

function formatMontant(n: number | null): string {
  if (n === null || n === undefined) return '0.00'
  return Number(n).toFixed(2)
}

function sanitize(s: string | null): string {
  if (!s) return ''
  return s.replace(/\|/g, ' ').replace(/\n/g, ' ').trim()
}

export async function POST(req: NextRequest) {
  try {
    const { entreprise_id, annee, mois, message_perso } = await req.json()

    if (!entreprise_id || !annee || !mois) {
      return NextResponse.json({ error: 'entreprise_id, annee et mois requis' }, { status: 400 })
    }

    // Récupérer entreprise
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('code, raison_sociale, siret, siren, expert_comptable_email, expert_comptable_nom')
      .eq('id', entreprise_id)
      .single()

    if (!entreprise?.expert_comptable_email) {
      return NextResponse.json({ error: 'Email expert-comptable non configuré' }, { status: 400 })
    }

    const m = parseInt(mois).toString().padStart(2, '0')
    const lastDay = new Date(parseInt(annee), parseInt(mois), 0).getDate()
    const dateDebut = `${annee}-${m}-01`
    const dateFin = `${annee}-${m}-${lastDay}`

    const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    const moisLabel = moisNoms[parseInt(mois) - 1] + ' ' + annee

    // ── Générer le FEC ───────────────────────────────────────
    const { data: ecritures } = await supabase
      .from('ecritures_comptables')
      .select('*, compte:plan_comptable(numero, libelle)')
      .eq('entreprise_id', entreprise_id)
      .gte('date_ecriture', dateDebut)
      .lte('date_ecriture', dateFin)
      .order('journal').order('date_ecriture').order('numero_piece').order('ordre')

    const header = [
      'JournalCode','JournalLib','EcritureNum','EcritureDate',
      'CompteNum','CompteLib','CompAuxNum','CompAuxLib',
      'PieceRef','PieceDate','EcritureLib',
      'Debit','Credit','EcritureLet','DateLet','ValidDate',
      'Montantdevise','Idevise',
    ].join('|')

    const lignes = (ecritures || []).map(e => [
      e.journal || '',
      JOURNAL_LABELS[e.journal || ''] || e.journal || '',
      sanitize(e.numero_piece),
      formatDate(e.date_ecriture),
      e.compte?.numero || '',
      sanitize(e.compte?.libelle || ''),
      '', '',
      sanitize(e.numero_piece),
      formatDate(e.date_ecriture),
      sanitize(e.libelle),
      formatMontant(e.debit),
      formatMontant(e.credit),
      e.lettrage || '', '',
      e.validee ? formatDate(e.date_ecriture) : '',
      '', '',
    ].join('|'))

    const fecContent = [header, ...lignes].join('\r\n')
    const siren = (entreprise.siren || entreprise.siret?.substring(0, 9) || '000000000').replace(/\s/g, '')
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const fecFilename = `${siren}FEC${today}_${annee}${m}.txt`
    const fecBase64 = Buffer.from(fecContent, 'utf-8').toString('base64')

    // ── Récupérer PDFs factures achat ────────────────────────
    const { data: factures } = await supabase
      .from('factures_achat')
      .select('id, numero_interne, fournisseur_nom, date_facture, montant_ttc, fichier_base64')
      .eq('entreprise_id', entreprise_id)
      .gte('date_facture', dateDebut)
      .lte('date_facture', dateFin)
      .not('fichier_base64', 'is', null)
      .order('date_facture')

    // ── Construire les pièces jointes ────────────────────────
    const attachments: any[] = [
      {
        filename: fecFilename,
        content: fecBase64,
        content_type: 'text/plain',
      },
    ]

    const facturesListHtml = (factures || []).map(f => {
      // Ajouter PDF si présent (max 5 PDFs pour éviter des emails trop lourds)
      return `<li>${f.numero_interne} — ${f.fournisseur_nom} — ${parseFloat(f.montant_ttc).toFixed(2)} €</li>`
    }).join('')

    let nbPdfs = 0
    for (const f of (factures || [])) {
      if (f.fichier_base64 && nbPdfs < 5) {
        // Extraire le base64 pur (peut contenir data:application/pdf;base64,...)
        const b64 = f.fichier_base64.includes(',')
          ? f.fichier_base64.split(',')[1]
          : f.fichier_base64

        attachments.push({
          filename: `${f.numero_interne || 'facture'}_${f.fournisseur_nom?.replace(/\s/g, '_') || 'fournisseur'}.pdf`,
          content: b64,
          content_type: 'application/pdf',
        })
        nbPdfs++
      }
    }

    const totalHT = (ecritures || [])
      .filter(e => e.compte?.numero?.startsWith('7'))
      .reduce((s, e) => s + parseFloat(e.credit || 0), 0)

    const totalTVA = (ecritures || [])
      .filter(e => e.compte?.numero?.startsWith('445'))
      .reduce((s, e) => s + parseFloat(e.credit || 0), 0)

    // ── Envoyer l'email ──────────────────────────────────────
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Cave de Gilbert <compta@cavedegilbert.fr>',
      to: entreprise.expert_comptable_email,
      subject: `[${entreprise.raison_sociale}] Pièces comptables — ${moisLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
          <h2 style="color: #8B6914;">Pièces comptables — ${moisLabel}</h2>
          <p>Bonjour${entreprise.expert_comptable_nom ? ' ' + entreprise.expert_comptable_nom : ''},</p>
          <p>Veuillez trouver ci-joint les pièces comptables de <strong>${entreprise.raison_sociale}</strong> pour la période <strong>${moisLabel}</strong>.</p>
          ${message_perso ? `<p style="background:#f5f5f5;padding:12px;border-radius:4px;"><em>${message_perso}</em></p>` : ''}
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
          <h3 style="color: #8B6914;">FEC — ${ecritures?.length || 0} écritures</h3>
          <ul>
            <li>CA HT : <strong>${totalHT.toFixed(2)} €</strong></li>
            <li>TVA collectée : <strong>${totalTVA.toFixed(2)} €</strong></li>
          </ul>
          ${factures && factures.length > 0 ? `
            <h3 style="color: #8B6914;">Factures d'achat (${factures.length})</h3>
            <ul>${facturesListHtml}</ul>
            ${nbPdfs < (factures?.length || 0) ? `<p style="color:#c9a96e;font-size:12px;">⚠ Seuls les ${nbPdfs} premiers PDFs sont joints (limite de taille). Les autres sont disponibles sur demande.</p>` : ''}
          ` : '<p>Aucune facture d\'achat pour cette période.</p>'}
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
          <p style="font-size:12px;color:#999;">Cave de Gilbert — Envoi automatique depuis le backoffice</p>
        </div>
      `,
      attachments,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json({ error: 'Erreur envoi email : ' + emailError.message }, { status: 500 })
    }

    // Logger l'envoi (optionnel — table à créer si besoin)
    return NextResponse.json({
      ok: true,
      email_id: emailData?.id,
      destinataire: entreprise.expert_comptable_email,
      nb_ecritures: ecritures?.length || 0,
      nb_factures: factures?.length || 0,
      nb_pdfs_joints: nbPdfs,
      fec_filename: fecFilename,
    })

  } catch (e: any) {
    console.error('Erreur envoyer-comptable:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}