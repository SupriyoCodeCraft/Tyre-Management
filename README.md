# Tyre Management Prototype

A frontend prototype for one business operator managing client, site, vehicle, vendor, purchase, inspection, tyre history, and scrap records. The application has four business modules: Vehicle Live Inspection, Purchase Register, Tyre History, and Scrap Analysis.

## Technology

- React and Vite (JavaScript/JSX)
- React Router
- CSS
- IndexedDB for browser-local business records
- npm

## Getting started

Requires Node.js 20.19+ or 22.12+ and npm 10+.

```sh
npm install
npm run dev
```

Use `npm run preview` to serve the production build locally.

## Verification commands

```sh
npm run lint
npm run build
npm test
```

## Demo login

- Username: `operator`
- Password: `tyre-demo-2026`

Authentication is a local client-side demonstration gate. The credentials are visible in the frontend and are not production security. No backend or production authentication exists.

## Data architecture

Screens call service functions in `src/services`; services apply workflow validation and call repositories in `src/data/repositories`; repositories perform persistence operations through the versioned database utilities in `src/data/database`. UI components do not open IndexedDB directly. This boundary allows repositories to be replaced with API-backed implementations later.

Database `tyre-management-prototype` is at schema version 3. It has stores for clients, sites, vendors, vehicles, tyres, purchases, tyre history events, inspection sessions, inspection entries, inspection photos, scrap records, and scrap photos. The migration adds scrap stores and indexes while retaining all P3/P4 stores, records, and photos. Tyres use internal UUIDs and a normalized serial-number key for uniqueness/search. The original serial number is retained for display. Registration writes a tyre registration event; purchase registration also writes a purchase association event.

The Purchase Register supports vendor selection or creating a vendor with a purchase, registering multiple tyres atomically with a purchase, searching purchase and tyre serial details, and opening purchase details. Existing tyres can be registered without a purchase. There is no purchase edit, void, or correction workflow yet; completed purchase records are not casually editable.

Vehicle Live Inspection supports client, site, and vehicle setup, recording multiple already-registered tyres and NSD readings for one vehicle per dated session, and viewing historical sessions. Photos are validated, decoded with browser image orientation, resized to a maximum 1920-pixel edge, and compressed to JPEG before storage. The resulting image Blobs are stored in IndexedDB in the same transaction as the session, entries, and history events. Inspection records are not committed if image processing fails.

Tyre History searches existing serials (including partial and case-insensitive matches) and assembles registration, purchase, inspection, and scrap events from linked records. Inspection readings remain separate historical events, with associated photos available in the timeline.

Scrap Analysis records a reason, optional remarks, and required damaged-part and complete-tyre photos for an existing tyre. Both compressed image Blobs, the scrap record, tyre status update, and history event are written atomically. Scrap records can be searched and filtered by serial, reason, date range, client, and site. Summary distributions are calculated from saved records only.

Data persists in the current browser profile's IndexedDB and is device/browser specific. It does not synchronize across browsers or devices. The app requests persistent storage where available, but browser storage can still be cleared or run out of quota. Inspection photos can consume significant local storage; image compression reduces their size but does not guarantee capacity or retention.

## Current implementation status

- Implemented: local demo login, protected routes, dashboard, IndexedDB v3 data foundation, purchase entry/details/search, independent existing tyre registration, vehicle inspections/photos, Tyre History, and Scrap Analysis.
- Not implemented: API/backend, cloud sync, and production authentication.
