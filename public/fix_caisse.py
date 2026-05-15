#!/usr/bin/env python3
"""
Corrige src/app/caisse/page.tsx :
1. Supprime le contenu de location/page.tsx collé en bas du fichier
2. Corrige le bouton 🚚 imbriqué dans le bouton Location (mobile)
3. Ajoute le render {showLivraison} dans mobile et desktop
4. Ajoute showLivraison state + bouton + render dans CaisseDesktop
"""

import os, sys

path = 'src/app/caisse/page.tsx'
if not os.path.exists(path):
    print(f"❌ Fichier introuvable : {path}")
    sys.exit(1)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Taille initiale : {len(content)} caractères")

# ── FIX 1 : Supprimer tout ce qui est après la fin de CaissePage ──────────────
# Le vrai fichier doit se terminer après le return de CaissePage
# On cherche le marqueur de fin du fichier propre
marker = "  return <CaisseDesktop user={user} session={session} onFermer={()=>{setSession(null);setUser(null)}}/>\n}"
pos = content.find(marker)
if pos != -1:
    content = content[:pos + len(marker)] + "\n"
    print("✓ Fix 1 : contenu de location/page.tsx supprimé")
else:
    print("⚠ Fix 1 : marqueur de fin non trouvé (peut-être déjà propre ?)")

# ── FIX 2 : Corriger le bouton 🚚 imbriqué dans le bouton Location (mobile) ──
old_nested = """          {/* Location tireuse */}
          <button onClick={() => setShowLocation(true)} style={{ width: '100%', background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 12, padding: '16px', cursor: 'pointer', textAlign: 'left' as const, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setShowLivraison(true)} style={{ /* même style que location */ }}>
  🚚 Livraisons
</button>
            <span style={{ fontSize: 22 }}>🍺</span>
            <div>
              <div style={{ fontSize: 14, color: '#c9a96e' }}>Location tireuse & fûts</div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>Créer une réservation de tireuse</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'rgba(232,224,213,0.3)', fontSize: 18 }}>→</span>
          </button>"""

new_fixed = """          {/* Location tireuse */}
          <button onClick={() => setShowLocation(true)} style={{ width: '100%', background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 12, padding: '16px', cursor: 'pointer', textAlign: 'left' as const, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🍺</span>
            <div>
              <div style={{ fontSize: 14, color: '#c9a96e' }}>Location tireuse & fûts</div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>Créer une réservation de tireuse</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'rgba(232,224,213,0.3)', fontSize: 18 }}>→</span>
          </button>

          {/* Livraison location */}
          <button onClick={() => setShowLivraison(true)} style={{ width: '100%', background: '#18130e', border: '0.5px solid rgba(110,201,110,0.2)', borderRadius: 12, padding: '16px', cursor: 'pointer', textAlign: 'left' as const, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🚚</span>
            <div>
              <div style={{ fontSize: 14, color: '#6ec96e' }}>Livraisons du jour</div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>Bon de livraison + signature → en cours</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'rgba(232,224,213,0.3)', fontSize: 18 }}>→</span>
          </button>"""

if old_nested in content:
    content = content.replace(old_nested, new_fixed, 1)
    print("✓ Fix 2 : bouton imbriqué corrigé + bouton Livraisons ajouté (mobile)")
else:
    print("⚠ Fix 2 : bloc non trouvé (vérifier manuellement)")

# ── FIX 3 : Ajouter render showLivraison dans le return mobile ────────────────
old_mobile_render = "      {showLocation && <div style={{ position: 'fixed' as const, inset: 0, zIndex: 600 }}><ModuleLocation session={session} user={vendeur} onClose={() => setShowLocation(false)} /></div>}\n    </div>\n  )\n\n  // ── ÉTAPE DOCUMENT"
new_mobile_render = "      {showLocation && <div style={{ position: 'fixed' as const, inset: 0, zIndex: 600 }}><ModuleLocation session={session} user={vendeur} onClose={() => setShowLocation(false)} /></div>}\n      {showLivraison && <div style={{ position: 'fixed' as const, inset: 0, zIndex: 600 }}><ModuleLivraisonLocation onClose={() => setShowLivraison(false)} /></div>}\n    </div>\n  )\n\n  // ── ÉTAPE DOCUMENT"

if old_mobile_render in content:
    content = content.replace(old_mobile_render, new_mobile_render, 1)
    print("✓ Fix 3 : render showLivraison ajouté dans mobile (onglet gestion)")
else:
    print("⚠ Fix 3 : position render mobile non trouvée")

# ── FIX 4 : Ajouter showLivraison state dans CaisseDesktop ───────────────────
old_desktop_state = "  const [showLocation, setShowLocation] = useState(false)\n  const [showDivers, setShowDivers] = useState(false)"
new_desktop_state = "  const [showLocation, setShowLocation] = useState(false)\n  const [showLivraison, setShowLivraison] = useState(false)\n  const [showDivers, setShowDivers] = useState(false)"

# Il y en a potentiellement deux occurrences (mobile + desktop), on veut la 2ème (desktop)
# Le mobile en a déjà un, donc on cherche après la 1ère occurrence
first_pos = content.find(old_desktop_state)
second_pos = content.find(old_desktop_state, first_pos + 1)

if second_pos != -1:
    content = content[:second_pos] + new_desktop_state + content[second_pos + len(old_desktop_state):]
    print("✓ Fix 4 : showLivraison state ajouté dans CaisseDesktop")
elif first_pos != -1:
    # Si une seule occurrence, c'est peut-être le desktop qui n'a pas encore été patché
    print("⚠ Fix 4 : une seule occurrence trouvée — vérifier si c'est mobile ou desktop")
else:
    print("⚠ Fix 4 : state showLocation non trouvé dans desktop")

# ── FIX 5 : Ajouter bouton Livraisons dans la barre desktop ──────────────────
old_desktop_btn = "<button onClick={()=>setShowLocation(true)} style={{background:'transparent',border:'0.5px solid rgba(255,255,255,0.15)',color:'rgba(232,224,213,0.5)',borderRadius:4,padding:'6px 12px',fontSize:11,cursor:'pointer'}}>🍺 Location</button>"
new_desktop_btn = "<button onClick={()=>setShowLocation(true)} style={{background:'transparent',border:'0.5px solid rgba(255,255,255,0.15)',color:'rgba(232,224,213,0.5)',borderRadius:4,padding:'6px 12px',fontSize:11,cursor:'pointer'}}>🍺 Location</button>\n          <button onClick={()=>setShowLivraison(true)} style={{background:'transparent',border:'0.5px solid rgba(110,201,110,0.3)',color:'#6ec96e',borderRadius:4,padding:'6px 12px',fontSize:11,cursor:'pointer'}}>🚚 Livraisons</button>"

if old_desktop_btn in content:
    content = content.replace(old_desktop_btn, new_desktop_btn, 1)
    print("✓ Fix 5 : bouton 🚚 Livraisons ajouté dans barre desktop")
else:
    print("⚠ Fix 5 : bouton Location desktop non trouvé")

# ── FIX 6 : Ajouter render showLivraison dans desktop ────────────────────────
old_desktop_render = "      {showLocation && (\n        <div style={{position:'fixed' as const,inset:0,zIndex:1000,background:'#0d0a08'}}>\n          <ModuleLocation session={session} user={vendeur} onClose={()=>setShowLocation(false)}/>\n        </div>\n      )}\n      {retourDesktop &&"
new_desktop_render = "      {showLocation && (\n        <div style={{position:'fixed' as const,inset:0,zIndex:1000,background:'#0d0a08'}}>\n          <ModuleLocation session={session} user={vendeur} onClose={()=>setShowLocation(false)}/>\n        </div>\n      )}\n      {showLivraison && <div style={{position:'fixed' as const,inset:0,zIndex:1000}}><ModuleLivraisonLocation onClose={()=>setShowLivraison(false)}/></div>}\n      {retourDesktop &&"

if old_desktop_render in content:
    content = content.replace(old_desktop_render, new_desktop_render, 1)
    print("✓ Fix 6 : render showLivraison ajouté dans CaisseDesktop")
else:
    print("⚠ Fix 6 : position render desktop non trouvée")

# ── FIX 7 : setSearch → setSearchProduit ─────────────────────────────────────
if "setSearch('')" in content:
    content = content.replace("setSearch('')", "setSearchProduit('')")
    print("✓ Fix 7 : setSearch → setSearchProduit corrigé")

# ── Écrire le fichier corrigé ─────────────────────────────────────────────────
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTaille finale : {len(content)} caractères")
print(f"✅ Fichier corrigé : {path}")
print("\n→ git add . && git commit -m 'Fix caisse: livraison location + bugs' && git push")