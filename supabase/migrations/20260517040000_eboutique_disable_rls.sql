-- Désactivation RLS sur les 4 tables e-boutique (cohérent avec le reste du projet
-- qui n'utilise pas RLS et sécurise via le check auth côté React + anon key).

ALTER TABLE boutique_badges          DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_badges           DISABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_carousel_slides DISABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_slide_products  DISABLE ROW LEVEL SECURITY;
