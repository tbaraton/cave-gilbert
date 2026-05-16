-- Migration : enrichissement des fiches produits pour publication en ligne + SEO.
--
-- Ajoute :
--   - visible_boutique : flag de mise en ligne sur le site (par défaut FALSE)
--   - meta_title       : balise <title> SEO (≤ 60 caractères)
--   - meta_description : balise <meta description> SEO (≤ 160 caractères)
--   - temperature_service_min/max : températures conseillées (°C)
--   - garde_potentiel_annees : durée de garde recommandée
--   - accords_mets         : suggestions d'accords mets-vins
--   - notes_degustation    : notes de dégustation rédigées
--
-- Les notes_dégustation/garde/temp peuvent déjà exister dans une table séparée
-- tasting_notes ; on les ajoute aussi en colonnes products pour simplifier la
-- saisie IA et l'affichage boutique sans double jointure.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS visible_boutique BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS temperature_service_min NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS temperature_service_max NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS garde_potentiel_annees INTEGER,
  ADD COLUMN IF NOT EXISTS accords_mets TEXT,
  ADD COLUMN IF NOT EXISTS notes_degustation TEXT;

-- Index partiel pour les requêtes catalogue boutique (très utilisé)
CREATE INDEX IF NOT EXISTS idx_products_visible_boutique
  ON products (visible_boutique)
  WHERE visible_boutique = TRUE;

COMMENT ON COLUMN products.visible_boutique IS 'Produit publié sur le site boutique. Si FALSE le produit reste interne (gestion logicielle uniquement).';
COMMENT ON COLUMN products.meta_title IS 'Balise SEO <title> (≤ 60 caractères recommandé).';
COMMENT ON COLUMN products.meta_description IS 'Balise SEO <meta description> (≤ 160 caractères recommandé).';
COMMENT ON COLUMN products.temperature_service_min IS 'Température de service minimum recommandée (°C).';
COMMENT ON COLUMN products.temperature_service_max IS 'Température de service maximum recommandée (°C).';
COMMENT ON COLUMN products.garde_potentiel_annees IS 'Potentiel de garde en années à compter du millésime.';
COMMENT ON COLUMN products.accords_mets IS 'Suggestions d''accords mets-vins (texte libre).';
COMMENT ON COLUMN products.notes_degustation IS 'Notes de dégustation rédigées (œil, nez, bouche).';
