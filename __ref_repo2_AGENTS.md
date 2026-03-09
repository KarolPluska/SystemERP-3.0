# System ERP 2.0 - AGENTS.md

## Mission
Build Zegger ERP 2.0 correctly from scratch.
Do not repeat the first attempt's mistakes.

## Hard priorities
1. Stable installation and activation.
2. Clean repository structure.
3. UI prototype accepted before heavy plugin integration.
4. Premium app-window UX, not fullscreen admin dashboard.
5. No regression of legacy Offer Panel quality.
6. UTF-8 everywhere, PHP without BOM.
7. No silent automatic legacy migration on activation.

## Workflow rules
- Do not mix large UI redesign with bootstrap/plugin activation changes in one risky pass.
- First create an approved UI prototype.
- Only then integrate into plugin runtime.
- Keep one stable baseline branch/folder for plugin activation.
- Do not create random duplicate files, random preview copies, nested plugin folders, or installer chaos.
- Do not ship any ZIP that has not been structurally validated for WordPress installer.
- Do not change working stable activation code just to experiment with UI.

## Repo hygiene
- One canonical plugin folder.
- One canonical prototype folder.
- One dist folder.
- No duplicate preview files unless explicitly named and tracked.
- Every new ZIP must correspond to a clear stage and must not overwrite history without reason.

## UI rules
- Auth screen may be fullscreen.
- Post-login ERP shell must feel like a compact premium app window.
- Avoid giant white walls.
- Avoid generic enterprise/dashboard aesthetics.
- Avoid heavy sidebar-first layouts.
- Mobile must be designed separately, not compressed desktop.

## Plugin rules
- All PHP files UTF-8 without BOM.
- No malformed ZIP roots.
- Final plugin path after installation must be exactly:
  /wp-content/plugins/zegger-erp/zegger-erp.php
- Validate every require_once/include target before packaging.
- Stable activation is mandatory before further UI iterations.

## Legacy Offer Panel rules
- Legacy panel is a reference-quality module.
- Do not degrade its UX, spacing, compactness, PDF behavior, or work feel.
- If integrated through compatibility layer, do it cleanly and predictably.

## Clean start rules
- No auto migration on activation.
- No auto-created offers, PDFs, users, companies, or historical logs.
- Only technical seed allowed: thread categories, if required.

## What not to do
- Do not patch appearance only through CSS if the UX model is wrong.
- Do not respond with broad reports instead of working packages.
- Do not assume WordPress table prefix is wp_.
- Do not duplicate plugin folders inside ZIP.
- Do not break mobile.
- Do not produce preview screenshots from layouts that are not implementable.

## Deliverable discipline
Every implementation turn must clearly state:
- files changed
- why they changed
- whether activation path was touched
- whether ZIP root was validated
- whether BOM scan was run
- whether runtime was truly tested or only statically validated
