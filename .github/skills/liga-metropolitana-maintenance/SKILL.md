---
name: liga-metropolitana-maintenance
description: Maintain and improve the Liga Metropolitana GitHub Pages portal while preserving its Supabase data, authentication, public workflows, Copa de Clubes rules, and existing repository conventions.
---

# Liga Metropolitana portal maintenance

## Non-negotiable safeguards
- Work on the `redesign-portal-2026` branch unless the user explicitly authorizes another branch.
- Never push changes to `main`, merge, publish a deployment, or alter production settings without explicit approval.
- Preserve the existing Supabase project URL, public key, tables, columns, storage bucket, RLS policies, authentication flow, and stored records.
- Never run destructive SQL, reset tables, delete user data, or change schema as part of a visual redesign.
- Do not expose secrets. The browser configuration contains only the existing public Supabase key; never request or store a service-role key.
- Keep the existing seven clubs, their crest assets, category records, matches, scorers, cards, sanctions, announcements, official documents, and Copa data intact.

## Project map
- `index.html`: public Liga portal and administrator forms.
- `app.js`: Supabase client, public rendering, authentication, administrator actions, and documents.
- `config.js`: existing Supabase URL and public key. Do not modify.
- `copa.html` and `copa.js`: Copa de Clubes 2026.
- `supabase/copa-clubes-2026.sql`: independent Copa tables and RLS setup; do not rerun or alter without explicit need and approval.
- `escudos/`: official club crest PNGs. GitHub paths are lowercase `escudos/`.

## Competition rules
- The Copa uses exactly eight categories: Sub-17 Femenino, 6ta, 5ta, 4ta, 3ra, 1ra, Senior, and 1ra Femenino. Sub-15 Femenino does not participate.
- Seven clubs: Villa Cool (also historically spelled Villa Coll in some existing code/data), CDSV, Defensores de Glew, Malvinas, Lírico, Sakura, Santa Ana.
- Villa Cool advances directly to a semifinal. Quarterfinals: CDSV vs Santa Ana; Defensores de Glew vs Sakura; Malvinas vs Lírico.
- Semifinals: Villa Cool vs winner of quarterfinal 3; winner of quarterfinal 1 vs winner of quarterfinal 2.
- Each tie is decided by aggregate points over the eight categories: win 3, draw 1, loss 0. Tiebreak order: goals for, goal difference, then Fair Play (yellow 1, red 3; lower is better).
- Do not silently invent a further tiebreak if all criteria remain equal; flag it as awaiting official resolution.

## Engineering requirements
- Keep the portal usable on mobile and desktop, accessible by keyboard, and understandable in Argentine Spanish.
- Escape user-entered text before inserting it into HTML. Do not introduce unsafe HTML rendering.
- Validate administrator inputs, surface Supabase errors clearly, and confirm destructive actions.
- Keep public reads separate from administrator writes; preserve the existing `is_admin()` authorization check and RLS.
- Preserve the current database field names unless the actual schema is inspected and a migration is explicitly approved.
- Avoid duplicate event handlers, invalid nested interactive elements, and silent failure states.
- Verify navigation, category filters, standings, general table, scorers, Fair Play icons, sanctions, document filtering/download/upload/delete, login/logout/password recovery, Copa bracket, tiebreaks, and admin score entry.
- Run JavaScript syntax checks and inspect diffs before committing. Never claim a feature is tested unless it was actually tested.
- Update cache-busting query strings when changing frontend assets.
