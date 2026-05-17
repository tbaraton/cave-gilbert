-- Module e-boutique : macarons/badges + carrousel d'accueil
--
-- Crée 4 tables :
--   boutique_badges          : définition des macarons (image ou généré)
--   product_badges           : association produit ↔ badge (many-to-many)
--   boutique_carousel_slides : slides du carrousel d'accueil
--   carousel_slide_products  : produits associés à chaque slide (opération)

-- ── BADGES / MACARONS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS boutique_badges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT        NOT NULL,
  slug            TEXT        NOT NULL UNIQUE,
  mode            TEXT        NOT NULL DEFAULT 'genere' CHECK (mode IN ('genere', 'image')),
  -- Mode 'image' : URL d'un PNG/SVG circulaire uploadé (médailles, prix, etc.)
  image_url       TEXT,
  -- Mode 'genere' : composition CSS (emoji + texte sur fond coloré rond)
  icone           TEXT,          -- emoji ou caractère unicode (❤, ★, ⚡, 🍷…)
  texte_macaron   TEXT,          -- texte sous l'icône (max ~12 caractères : "RARE", "BIO", "TOP")
  couleur_bg      TEXT          NOT NULL DEFAULT '#8a6a3e',
  couleur_fg      TEXT          NOT NULL DEFAULT '#ffffff',
  couleur_border  TEXT,          -- optionnel : couleur du liseré
  -- Métadonnées
  description     TEXT          NOT NULL,  -- texte du tooltip au survol
  ordre           INTEGER       NOT NULL DEFAULT 0,
  actif           BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boutique_badges_actif_ordre
  ON boutique_badges (actif, ordre) WHERE actif = true;

COMMENT ON TABLE boutique_badges IS 'Macarons/badges visuels affichés à gauche de la photo bouteille sur la boutique.';
COMMENT ON COLUMN boutique_badges.mode IS '''genere'' = composition CSS (icone+texte+couleur), ''image'' = PNG/SVG uploadé.';
COMMENT ON COLUMN boutique_badges.description IS 'Texte affiché dans le tooltip au survol du macaron.';

CREATE TABLE IF NOT EXISTS product_badges (
  product_id  UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  badge_id    UUID         NOT NULL REFERENCES boutique_badges(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_product_badges_badge ON product_badges (badge_id);

COMMENT ON TABLE product_badges IS 'Association many-to-many entre produits et macarons.';

-- ── CARROUSEL D'ACCUEIL ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS boutique_carousel_slides (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  titre           TEXT         NOT NULL,            -- "Opération rosé"
  sous_titre      TEXT,                              -- "Jusqu'à -30% sur 100 références"
  description     TEXT,                              -- texte plus long sous le titre
  image_url       TEXT,                              -- image de fond du slide (16:9 ou 21:9 recommandé)
  couleur_bg      TEXT,                              -- fallback si pas d'image (hex)
  couleur_texte   TEXT         NOT NULL DEFAULT '#ffffff',
  position_texte  TEXT         NOT NULL DEFAULT 'gauche' CHECK (position_texte IN ('gauche', 'centre', 'droite')),
  -- Lien : par défaut /boutique?operation=<slug>, mais peut être overridé
  slug            TEXT         NOT NULL UNIQUE,
  cta_label       TEXT         NOT NULL DEFAULT 'Découvrir',
  cta_url_custom  TEXT,                              -- override (sinon = /boutique?operation=<slug>)
  ordre           INTEGER      NOT NULL DEFAULT 0,
  actif           BOOLEAN      NOT NULL DEFAULT true,
  date_debut      TIMESTAMPTZ,                       -- programmation : visible à partir de
  date_fin        TIMESTAMPTZ,                       -- programmation : masqué après
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carousel_slides_actif_ordre
  ON boutique_carousel_slides (actif, ordre) WHERE actif = true;

COMMENT ON TABLE boutique_carousel_slides IS 'Slides du carrousel hero de la page d''accueil.';
COMMENT ON COLUMN boutique_carousel_slides.slug IS 'Identifiant URL : /boutique?operation=<slug>.';
COMMENT ON COLUMN boutique_carousel_slides.cta_url_custom IS 'Override le lien par défaut (utile pour pointer vers une URL externe).';

CREATE TABLE IF NOT EXISTS carousel_slide_products (
  slide_id    UUID         NOT NULL REFERENCES boutique_carousel_slides(id) ON DELETE CASCADE,
  product_id  UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ordre       INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (slide_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_carousel_slide_products_slide
  ON carousel_slide_products (slide_id, ordre);

COMMENT ON TABLE carousel_slide_products IS 'Produits associés à une slide (= participants de l''opération).';

-- ── SEEDS : 8 macarons par défaut ─────────────────────────────

INSERT INTO boutique_badges (slug, nom, mode, icone, texte_macaron, couleur_bg, couleur_fg, couleur_border, description, ordre)
VALUES
  ('coup-de-coeur',       'Coup de cœur du caviste',  'genere', '❤',  'COUP DE CŒUR', '#c93838', '#ffffff', '#fff',     'Un vin sélectionné personnellement par notre caviste pour son caractère unique.', 1),
  ('vin-rare',            'Vin rare',                  'genere', '◆',  'RARE',         '#2c1a4a', '#e8d28a', '#e8d28a',  'Production confidentielle ou millésime difficile à trouver.', 2),
  ('pepite',              'Pépite',                    'genere', '✦',  'PÉPITE',       '#1e4a3a', '#e8d28a', '#e8d28a',  'Un excellent rapport qualité-prix repéré par notre équipe.', 3),
  ('vin-du-moment',       'Vin du moment',             'genere', '★',  'DU MOMENT',    '#8a6a3e', '#ffffff', '#fff',     'Notre sélection à découvrir ce mois-ci.', 4),
  ('medaille',            'Médaillé concours',         'genere', '🏆', 'MÉDAILLE',     '#c9a96e', '#1a1a1a', '#a07d3e',  'Distingué dans un concours de référence (Paris, Lyon, Mâcon…).', 5),
  ('bio-engage',          'Bio engagé',                'genere', '🌿', 'BIO',          '#2a8a2a', '#ffffff', '#fff',     'Domaine certifié Agriculture Biologique.', 6),
  ('selection-sommelier', 'Sélection sommelier',       'genere', '👨‍🍳','SOMMELIER',    '#1a3a5a', '#ffffff', '#fff',     'Vin recommandé par un sommelier professionnel partenaire.', 7),
  ('idee-cadeau',         'Idée cadeau',               'genere', '🎁', 'CADEAU',       '#8a3e6a', '#ffffff', '#fff',     'Un vin parfait à offrir, avec emballage cadeau disponible.', 8),
  ('nouveaute',           'Nouveauté',                 'genere', '🆕', 'NOUVEAU',      '#3a6a8a', '#ffffff', '#fff',     'Tout juste arrivé en cave.', 9),
  ('prix-doux',           'Prix doux',                 'genere', '💰', 'PRIX DOUX',    '#6e8b3e', '#ffffff', '#fff',     'Un vin de qualité à moins de 12€.', 10)
ON CONFLICT (slug) DO NOTHING;
