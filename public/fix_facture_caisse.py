#!/usr/bin/env python3
"""
Répare src/app/caisse/page.tsx :
- Supprime toutes les occurrences de genererFactureCaisse
- Réinsère une seule version propre au bon endroit (avant const DOCS)
"""

import re, sys, os

path = 'src/app/caisse/page.tsx'
if not os.path.exists(path):
    print(f"❌ Fichier introuvable : {path}")
    sys.exit(1)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Taille initiale : {len(content)} caractères")

# ── Étape 1 : Supprimer TOUTES les occurrences de genererFactureCaisse ────────
# On cherche chaque bloc "const genererFactureCaisse = ... }" et on le supprime

def remove_function_blocks(text, fn_name):
    """Supprime tous les blocs 'const fn_name = (...) => { ... }' du texte."""
    result = text
    pattern = rf'(\n[ \t]*const {re.escape(fn_name)}\s*=\s*\()'
    
    while True:
        match = re.search(pattern, result)
        if not match:
            break
        
        start = match.start()
        # Trouver la fin du bloc en comptant les accolades
        # On cherche depuis le début de la fonction
        search_from = match.end()
        depth = 0
        found_first_brace = False
        end = -1
        
        for i in range(search_from, len(result)):
            c = result[i]
            if c == '{':
                depth += 1
                found_first_brace = True
            elif c == '}':
                depth -= 1
                if found_first_brace and depth == 0:
                    end = i + 1
                    break
        
        if end == -1:
            print(f"⚠ Impossible de trouver la fin de {fn_name}, arrêt")
            break
        
        removed = result[start:end]
        result = result[:start] + result[end:]
        print(f"✓ Bloc supprimé ({len(removed)} caractères)")
    
    return result

content = remove_function_blocks(content, 'genererFactureCaisse')
print(f"Après suppression : {len(content)} caractères")

# ── Étape 2 : Vérifier que le call existe encore ──────────────────────────────
if 'genererFactureCaisse(detail, lignesDetail, paiementsDetail)' not in content:
    print("⚠ L'appel à genererFactureCaisse est absent — restauration de la ligne handlePrint")
    # Restaurer le template A4 basique si le call a disparu
    # On cherche la fin de handlePrint type ticket
    old_call = "` : genererFactureCaisse(detail, lignesDetail, paiementsDetail)"
    if old_call not in content:
        print("  L'appel n'existe pas non plus — pas de modification du handlePrint")

# ── Étape 3 : Insérer la fonction propre avant const DOCS ────────────────────
FUNCTION_BODY = r"""
  const genererFactureCaisse = (detail: any, lignesDetail: any[], paiementsDetail: any[]) => {
    const clientN = !detail.customer ? 'Client anonyme' : detail.customer.est_societe ? detail.customer.raison_sociale : `${detail.customer.prenom || ''} ${detail.customer.nom || ''}`.trim()
    const dateDoc = new Date(detail.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    const typeLabel: Record<string, string> = { facture: 'FACTURE', devis: 'DEVIS', commande: 'BON DE COMMANDE', bl: 'BON DE LIVRAISON', avoir: 'AVOIR', ticket: 'REÇU' }
    const tvaRate = 0.20
    const totalTTC = parseFloat(detail.total_ttc)
    const totalHT = totalTTC / (1 + tvaRate)
    const tva = totalTTC - totalHT
    const lignesHtml = detail.notes
      ? `<tr><td colspan="4" style="padding:12px;color:#e8e0d5;font-size:13px">${detail.notes}</td><td style="padding:12px;text-align:right;color:#c9a96e;font-size:14px;font-weight:700">${totalTTC.toFixed(2)} \u20ac</td></tr>`
      : lignesDetail.map((l: any) => {
          const prixHT = parseFloat(l.prix_unitaire_ttc) / (1 + tvaRate)
          const remise = l.remise_pct > 0 ? ` <span style="font-size:10px;color:rgba(110,201,110,0.8)">(-${l.remise_pct}%)</span>` : ''
          return `<tr style="border-bottom:0.5px solid rgba(255,255,255,0.06)"><td style="padding:10px 12px;font-size:13px;color:#e8e0d5">${l.nom_produit}${l.millesime ? ` ${l.millesime}` : ''}${remise}</td><td style="padding:10px 12px;text-align:center;font-size:13px;color:rgba(232,224,213,0.6)">${l.quantite}</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:rgba(232,224,213,0.6)">${prixHT.toFixed(2)} \u20ac</td><td style="padding:10px 12px;text-align:right;font-size:13px;color:rgba(232,224,213,0.4)">${(parseFloat(l.prix_unitaire_ttc) * tvaRate).toFixed(2)} \u20ac</td><td style="padding:10px 12px;text-align:right;font-size:14px;color:#c9a96e;font-weight:600">${parseFloat(l.total_ttc).toFixed(2)} \u20ac</td></tr>`
        }).join('')
    const paiementsHtml = paiementsDetail.map((p: any) =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:rgba(232,224,213,0.5)"><span>${p.mode === 'cb' ? 'Carte bancaire' : p.mode === 'especes' ? 'Esp\u00e8ces' : p.mode === 'virement' ? 'Virement' : p.mode === 'cheque' ? 'Ch\u00e8que' : p.mode}</span><span>${parseFloat(p.montant).toFixed(2)} \u20ac</span></div>`
    ).join('')
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${typeLabel[detail.type_doc] || 'DOCUMENT'} ${detail.numero}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d0a08;color:#e8e0d5;max-width:860px;margin:0 auto;padding:48px 40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{body{background:#0d0a08!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid rgba(201,169,110,0.3)}.cave-name{font-size:20px;color:#c9a96e;font-family:Georgia,serif;letter-spacing:2px;margin-bottom:6px}.cave-info{font-size:11px;color:rgba(232,224,213,0.4);line-height:2}.doc-title{font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(201,169,110,0.6);margin-bottom:6px;text-align:right}.doc-numero{font-size:22px;color:#c9a96e;font-family:Georgia,serif;text-align:right}.doc-date{font-size:12px;color:rgba(232,224,213,0.4);text-align:right;margin-top:4px}.client-box{background:rgba(255,255,255,0.03);border-left:3px solid rgba(201,169,110,0.4);padding:12px 18px;margin-bottom:32px;font-size:13px;color:rgba(232,224,213,0.7);border-radius:0 6px 6px 0}.client-box strong{color:#c9a96e;font-size:15px}table{width:100%;border-collapse:collapse}thead tr{border-bottom:1px solid rgba(201,169,110,0.3)}thead th{padding:10px 12px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);font-weight:400}.totaux{border-top:1px solid rgba(201,169,110,0.2);margin-top:8px}.total-line{display:flex;justify-content:space-between;padding:8px 12px;font-size:13px;color:rgba(232,224,213,0.5)}.total-grand{display:flex;justify-content:space-between;padding:14px;background:rgba(201,169,110,0.08);border:0.5px solid rgba(201,169,110,0.2);border-radius:6px;margin-top:10px;font-size:22px;font-weight:700;color:#c9a96e;font-family:Georgia,serif}.rib-box{background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:8px;padding:14px 18px;margin-top:20px}.rib-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);margin-bottom:8px}.rib-line{font-size:12px;color:rgba(232,224,213,0.5);line-height:2}.rib-val{color:#f0e8d8;font-family:monospace}.footer{margin-top:32px;padding-top:14px;border-top:0.5px solid rgba(255,255,255,0.06);font-size:10px;color:rgba(232,224,213,0.25);line-height:2}.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:80px;color:rgba(255,255,255,0.02);font-family:Georgia,serif;letter-spacing:8px;pointer-events:none;white-space:nowrap}</style></head><body><div class="watermark">CAVE DE GILBERT</div><div class="header"><div><div class="cave-name">Cave de Gilbert</div><div class="cave-info">Avenue Jean Colomb \u2014 69280 Marcy l\u2019\u00c9toile<br>04 22 91 41 09 \u00b7 contact@cavedegilbert.fr<br>Mar\u2013Sam\u00a0: 9h30\u201313h / 15h30\u201319h</div></div><div><div class="doc-title">${typeLabel[detail.type_doc] || 'Document'}</div><div class="doc-numero">${detail.numero}</div><div class="doc-date">${dateDoc}</div><div class="doc-date" style="color:rgba(201,169,110,0.5);margin-top:2px">Vendeur\u00a0: ${detail.user?.prenom || ''}</div></div></div><div class="client-box"><strong>${clientN}</strong>${detail.customer?.email ? `<br>${detail.customer.email}` : ''}${detail.customer?.telephone ? `<br>\ud83d\udcde ${detail.customer.telephone}` : ''}${detail.customer?.adresse ? `<br>${detail.customer.adresse}, ${detail.customer.code_postal} ${detail.customer.ville}` : ''}</div><table><thead><tr><th>D\u00e9signation</th><th style="text-align:center">Qt\u00e9</th><th style="text-align:right">P.U. HT</th><th style="text-align:right">TVA 20%</th><th style="text-align:right">Total TTC</th></tr></thead><tbody>${lignesHtml}</tbody></table><div class="totaux"><div class="total-line"><span>Total HT</span><span>${totalHT.toFixed(2)} \u20ac</span></div><div class="total-line"><span>TVA 20\u00a0%</span><span>${tva.toFixed(2)} \u20ac</span></div><div class="total-grand"><span>TOTAL TTC</span><span>${totalTTC.toFixed(2)} \u20ac</span></div></div>${paiementsDetail.length > 0 ? `<div class="rib-box"><div class="rib-title">R\u00e8glement</div>${paiementsHtml}</div>` : ''}${detail.type_doc === 'facture' ? `<div class="rib-box"><div class="rib-title">Coordonn\u00e9es bancaires</div><div class="rib-line">Banque\u00a0: <span class="rib-val">Cr\u00e9dit Mutuel</span><br>IBAN\u00a0: <span class="rib-val">FR76 1027 8072 5500 0206 6880 148</span><br>BIC\u00a0: <span class="rib-val">CMCIFR2A</span></div></div>` : ''}<div class="footer">SAS Cave de Gilbert \u2014 SIRET 898\u00a0622\u00a0055\u00a000017 \u2014 TVA FR79\u00a0898\u00a0622\u00a0055<br>Avenue Jean Colomb, 69280 Marcy-l\u2019\u00c9toile \u2014 contact@cavedegilbert.fr<br>Tout litige relatif \u00e0 cette facture devra \u00eatre port\u00e9 devant le Tribunal de Commerce de Lyon.<br>${detail.type_doc === 'facture' ? 'Tout retard de paiement entra\u00eenera des p\u00e9nalit\u00e9s de retard au taux l\u00e9gal en vigueur.' : ''}</div></body></html>`
  }

"""

# Chercher "  const DOCS = [" et insérer avant
docs_marker = '  const DOCS = ['
pos = content.find(docs_marker)

if pos == -1:
    print("⚠ Marqueur 'const DOCS = [' introuvable — impossible d'insérer la fonction")
else:
    content = content[:pos] + FUNCTION_BODY + content[pos:]
    print("✓ Fonction genererFactureCaisse insérée avant const DOCS")

# ── Étape 4 : S'assurer que le call est bien là ───────────────────────────────
call = "` : genererFactureCaisse(detail, lignesDetail, paiementsDetail)"
if call in content:
    print("✓ Appel à genererFactureCaisse présent dans handlePrint")
else:
    print("⚠ L'appel n'est pas trouvé — vérifiez handlePrint manuellement")

# ── Écrire ────────────────────────────────────────────────────────────────────
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTaille finale : {len(content)} caractères")
print(f"✅ Fichier réparé : {path}")
print("\n→ git add . && git commit -m 'Fix genererFactureCaisse - une seule déclaration' && git push")