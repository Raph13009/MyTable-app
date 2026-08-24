<div align="center">

<img src="docs/github/hero.svg" alt="Guide My Table — live" width="100%" />

<br/>

<a href="https://guidemytable.fr"><img src="https://img.shields.io/badge/SITE-guidemytable.fr-FBCF03?style=for-the-badge&labelColor=0A0A0A" alt="Site" /></a>
&nbsp;
<a href="https://app.guidemytable.fr"><img src="https://img.shields.io/badge/APP-app.guidemytable.fr-F7F4EC?style=for-the-badge&labelColor=0A0A0A" alt="App" /></a>
&nbsp;
<a href="https://app.guidemytable.fr/explore"><img src="https://img.shields.io/badge/EXPLORE-carte_des_chefs-111111?style=for-the-badge&labelColor=FBCF03&color=111111" alt="Explorer" /></a>

<br/><br/>

<img src="https://img.shields.io/badge/STATUS-LIVE-FBCF03?style=flat-square&labelColor=0A0A0A" alt="Live" />
<img src="https://img.shields.io/badge/Next.js-14-white?style=flat-square&labelColor=0A0A0A" alt="Next.js 14" />
<img src="https://img.shields.io/badge/Supabase-Postgres_+_Auth_+_Realtime-3FCF8E?style=flat-square&labelColor=0A0A0A" alt="Supabase" />
<img src="https://img.shields.io/badge/Mapbox-explore-4264FB?style=flat-square&labelColor=0A0A0A" alt="Mapbox" />
<img src="https://img.shields.io/badge/i18n-FR_/_EN-F7F4EC?style=flat-square&labelColor=0A0A0A" alt="FR / EN" />

<p>
  <sub>
    <a href="https://guidemytable.fr">guidemytable.fr</a>
    &nbsp;·&nbsp;
    <a href="https://app.guidemytable.fr">app.guidemytable.fr</a>
    &nbsp;·&nbsp;
    <a href="mailto:contact@guidemytable.fr">contact@guidemytable.fr</a>
  </sub>
</p>

</div>

---

**Guide My Table** est live.

C’est la plateforme qui met une table privée chez vous : des chefs sélectionnés, une carte pour les trouver, une réservation pour les engager, un chat pour tout caler. Le site éditorial vit sur [`guidemytable.fr`](https://guidemytable.fr). Le produit — explorer, booker, parler — tourne ici, sur [`app.guidemytable.fr`](https://app.guidemytable.fr).

Ce dépôt n’est plus un chantier « coming soon ». C’est le code de production.

<img src="docs/github/system.svg" alt="Explorer, réserver, parler, opérer" width="100%" />

## Surface

| | Produit | Où |
| :--- | :--- | :--- |
| **01** | Carte des chefs, fiches, galerie, recherche embarquée WordPress | [`/explore`](https://app.guidemytable.fr/explore) |
| **02** | Réservation dîner / cours / événement, validation, emails | `/book/[slug]` |
| **03** | Conversation client ↔ chef en temps réel | `/chat` |
| **04** | Admin, visibilité, comptes, relances | `/admin` |

Auth email + mot de passe. Comptes créés confirmés. Rôles client, chef, admin. FR et EN partout.

## Architecture

```mermaid
flowchart LR
  W["guidemytable.fr<br/>éditorial"] -->|embed recherche| A
  A["app.guidemytable.fr<br/>Next.js 14"] --> S["Supabase<br/>Postgres · Auth · Realtime · Storage"]
  A --> M["Mapbox"]
  A --> R["Resend"]
```

- **App** — Next.js 14 App Router, TypeScript, Tailwind, Motion
- **Data** — Supabase Postgres, RLS, Realtime pour le chat
- **Map** — Mapbox GL, autocomplete d’adresse
- **Mail** — Resend, templates transactionnels
- **I18n** — `next-intl`, `messages/fr.json` + `en.json`

## Local

Le mode d’emploi agent / Cloud est dans [`AGENTS.md`](./AGENTS.md) — stack Supabase locale, CSP `*.supabase.co`, bootstrap SQL, caveats email & Mapbox. Ne pas dupliquer ici.

```bash
npm install
cp .env.example .env.local   # puis coller les clés
npm run dev                  # http://localhost:3000
```

```bash
npm run lint
npm run test:unit
npm run build
```

## Repo

Projet privé. Pas de contributions publiques.

© Guide My Table — tous droits réservés.
