# EasyPack company and brand reference

Checked on **2026-10-28** against the public company website. These details are
available to the application in `frontend/src/company.ts`; Arabic and English
display text is maintained in `frontend/src/translations.json`.

## Company details

| Field | Value |
| --- | --- |
| Brand | EasyPack / EPE · إيزي باك |
| Business | Manufacturing and supplying filling and packaging machinery |
| Website | https://easypackegypt.com/ |
| Email | info@easypackegypt.com |
| Telephone | +201032432477; +201018146662 |
| WhatsApp | https://wa.me/201032432477 |
| Location | Industrial Zone C8, 10th of Ramadan City, Egypt |
| Published contact hours | Saturday–Thursday, 08:00–17:00; Friday closed (Egypt local time) |

Sources: [contact page](https://easypackegypt.com/اتصل-بنا/) and
[homepage](https://easypackegypt.com/). Contact hours are informational; they do
not configure employee shifts, breaks, or the factory's work calendar.

## Useful product and service context

The company supplies powder, liquid, grain, sugar and pulse filling equipment,
weighing systems, sachet/packet and dual filling machines, shrink wrapping,
automatic labelling, and complete production lines. Its stated services include
spare parts, maintenance, technical assistance, and after-sales support.
Industries mentioned include food, agriculture, chemicals, and pharmaceuticals.

The [about page](https://easypackegypt.com/about-us/) advertises more than 17 years
of experience, 4,000+ machines, and 2,000+ customers. These are website claims at
the retrieval date, not verified application metrics or a confirmed founding year.

Use the [official machinery catalogue (PDF)](https://easypackegypt.com/wp-content/uploads/2025/11/Easy-Pack-Filling-and-Packaging-Machines-Catalog.pdf)
as a reference when preparing product content. Public product categories do not
establish internal model codes, BOMs, inventory quantities, pricing, technical
specifications, or production records; none were imported into the database.

## Original brand assets

### Approved application symbol

The user approved the text-free symbol on 2026-10-28 for both the main and demo
projects. The active asset is `frontend/public/assets/brand/easypack-symbol.png`
(1449 × 1086, PNG with alpha). It is the approved second ImageGen edit of the
website logo, not an unmodified official source file. The edit request was to
retain the upper emblem, remove EPE and the Arabic lettering, preserve the
gray/burgundy appearance, and use a transparent background without added glow.
The exact approved file is copied into both repositories without re-generation.

Both applications use it in their shared Brand component and browser/touch icon
links. CSS preserves its proportions and adds no white background. The original
JPEG downloads listed below remain as source references, not active UI assets.

The following files are exact downloads from the website's logo/icon links, kept
locally so the application does not depend on external image requests.

| Local path under `frontend/public/assets/brand/` | Dimensions | Original source |
| --- | --- | --- |
| `easypack-logo.jpg` | 342 × 431 | [Header logo](https://easypackegypt.com/wp-content/uploads/2025/11/cropped-cropped-467502952_984265777062715_5624262891890648570_n-1.jpg) |
| `favicon-32.jpg` | 32 × 32 | [Browser icon](https://easypackegypt.com/wp-content/uploads/2025/11/cropped-467502952_984265777062715_5624262891890648570_n-1-32x32.jpg) |
| `icon-192.jpg` | 192 × 192 | [Large icon](https://easypackegypt.com/wp-content/uploads/2025/11/cropped-467502952_984265777062715_5624262891890648570_n-1-192x192.jpg) |
| `apple-touch-icon.jpg` | 180 × 180 | [Touch icon](https://easypackegypt.com/wp-content/uploads/2025/11/cropped-467502952_984265777062715_5624262891890648570_n-1-180x180.jpg) |

The original website logo is a JPEG with a white background. These original
downloads remain unchanged; the active approved symbol is the separate PNG above.

## Social links

The visible homepage header links to [Facebook](https://www.facebook.com/easypackegypt),
[YouTube](https://www.youtube.com/channel/UCYj4QDtb8PTX6LJXsXIWGyQ), and
[X](https://x.com/EasyPackEG). These links are saved in the company module.
The website's structured metadata contains some different social-profile URLs;
the visible header links were preferred. Account ownership was not independently
verified.

## Application integration

- `Brand.tsx`: approved text-free symbol on the sign-in screen and application sidebar.
- `index.html`: approved symbol as the browser and Apple touch icon.
- `CompanyDetails.tsx`: expandable, bilingual company contacts, address, hours,
  catalogue and WhatsApp links in the sign-in and application footers.
- The logo update applies to both main and demo applications. Company details
  remain in the main application.

## Approved-symbol verification (2026-10-28)

- The independent GitHub branch was prepared directly on `main` at `cc334c3`,
  containing only these branding/contact changes. Its production frontend build
  and translation audit passed (939 UI strings, 56 reviewed translations).
  The previously merged password visibility feature is retained unchanged.

- Before the GitHub push, the branding-only staged changes were exported over
  the committed main-project baseline and built independently of unrelated local
  work. That production build and translation audit passed (972 UI strings and
  56 reviewed content translations). The existing `PasswordInput` component and
  its visibility-toggle styles remain included from commit `cc334c3`.

- Main and demo production builds and translation audits passed (1,001 main UI
  strings and 908 demo UI strings). Main retains its existing large-chunk warning.
- Both asset copies match SHA-256
  `329192D274C15FD4AD9EA91CE9CD80C1857CF4F23A5BA27B6D76A0F1F38DF9F0`.
- Fresh standalone preview screenshots confirmed the approved symbol on light
  and dark backgrounds, including a 390 px mobile viewport without horizontal
  overflow. The loaded image measured 1449 × 1086 intrinsically and 104 × 78
  when rendered. Screenshots are under `output/playwright/approved-logo-*.png`.
- This was a static sign-in layout preview; authenticated application flows
  and deployment were not tested. The standalone preview has no favicon route;
  application icon links were checked in source and production build output.

## Initial company-information verification (before symbol approval)

- Production frontend build passed; Vite still reports large application chunks.
- Translation audit passed (1,001 UI strings).
- Browser checks confirmed the original 342 × 431 logo loads, all three icon
  URLs return HTTP 200 with `image/jpeg`, company details expand and translate,
  and no horizontal overflow occurs at 1440 px or 390 px viewport widths.
- Reviewed Arabic/light desktop and English/dark mobile screenshots in
  `output/playwright/brand-arabic-light.png` and
  `output/playwright/brand-english-dark-mobile.png` (local, ignored artifacts).
- Browser checks used a local production preview with simulated signed-out
  authentication responses because the backend was unavailable. No live sign-in,
  authenticated sidebar, database workflow, or production deployment was tested.
- Assets use `/assets/brand/`, which matches the existing Spring SPA public-asset
  matcher and resource handler; no backend authorization changes were needed.
