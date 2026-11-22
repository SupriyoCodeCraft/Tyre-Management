# Frontend and data architecture

## Application layers

- `src/app` owns route composition and the top-level error boundary.
- `src/features` owns business screens and feature-specific presentation.
- `src/components` contains reusable UI and layout components.
- `src/services` owns workflow validation and coordinates business operations.
- `src/data/repositories` owns entity persistence operations.
- `src/data/database` owns IndexedDB schema, initialization, transaction utilities, and record helpers.

Feature screens call services, not IndexedDB or repositories directly. Services can retain their workflow API if the repository implementations later switch to HTTP requests. Repositories and database utilities remain an implementation detail of the persistence layer.

## IndexedDB schema

Database name: `tyre-management-prototype`. Current schema version: **3**. The version 2 → 3 upgrade adds scrap stores and indexes while preserving existing stores and records, including inspection photo Blobs.

| Object store | Purpose and key relationships |
| --- | --- |
| `clients` | Business clients |
| `sites` | Sites with `clientId` |
| `vendors` | Purchase vendors |
| `vehicles` | Vehicles with client and site references |
| `tyres` | Tyres with a unique normalized `serialNumberKey`, optional purchase and current client/site/vehicle references |
| `purchases` | Vendor reference, invoice, date, price, brand, and model |
| `tyreHistoryEvents` | Tyre reference, event type/date, details, and creation timestamp |
| `inspectionSessions` | One dated session for exactly one vehicle, with client/site references |
| `inspectionEntries` | Session and registered tyre references, serial, brand snapshot, NSD reading |
| `inspectionPhotos` | Session and entry references, image Blob, filename, MIME type, byte length |
| `scrapRecords` | One scrap record per tyre (unique `tyreId`), date/reason/remarks and a snapshot of existing client/site/vehicle references |
| `scrapPhotos` | Separate damaged-part and complete-tyre image Blobs, each linked to a scrap record and category |

Records have stable internal IDs and timestamps where applicable. Tyre history is derived from events connected to tyre records, rather than an unrelated editable timeline. P3 writes registration and purchase-association events. P4 writes inspection events that reference the inspection session, entry, and vehicle. P5 writes scrap events referencing a scrap record and captures the associated vehicle/site/client where the tyre record contains those relationships. Fitment, movement, rotation, and retreading events remain future work and are not fabricated.

Serial lookup trims outer whitespace, removes whitespace within the serial, and compares case-insensitively using uppercase normalization. The original submitted serial remains on the tyre. This duplicate-prevention normalization is a prototype choice that should be confirmed with the business.

## Purchase workflow

The Purchase Register calls `purchaseService`. The service validates confirmed required fields and delegates creation to `purchaseRepository`. Purchase, a newly entered vendor when applicable, all associated tyres, and their registration/purchase history events are committed in one IndexedDB read-write transaction. A failed validation or unique serial constraint aborts the transaction, so it does not leave a partial purchase. Completed purchases have no casual edit action; correction/void policy remains unresolved.

Independent existing tyre registration calls `tyreService` and the tyre repository. It validates optional existing client/site/vehicle references and writes the tyre and registration history event atomically. A purchase is not required.

## Vehicle inspection workflow

The inspection feature calls `inspectionService`, which validates selected records and registered tyre serials. Image validation, orientation-aware decoding, resizing to a 1920-pixel maximum edge, and JPEG compression happen before the write transaction. The repository then verifies client/site/vehicle and tyre references within the transaction and writes the session, all entries, photo Blob records, and one `INSPECTION_RECORDED` history event per tyre atomically. Images are stored as IndexedDB Blobs, never base64 in Local Storage. History screens can retrieve photos through the inspection details repository query.

## Tyre history and scrap workflow

Tyre History finds the existing tyre by its normalized serial and joins its stored event stream with the related purchase, inspection session/entry/photo, and scrap records. Timeline events remain keyed to the tyre ID; purchase-registration noise is suppressed when the purchase-association event already represents that purchase. Inspection NSD readings are retained per entry, and the overview's current recorded NSD is derived from the latest inspection event.

Scrap Analysis validates the tyre and required reason/date/photos in `scrapService`; image validation, orientation-aware decoding, resizing and compression reuse the inspection image service before a transaction begins. `scrapRepository` then rechecks the tyre inside a read-write transaction and commits the scrap record, both categorized photo Blobs, tyre `currentStatus: 'scrapped'`, and `SCRAP_RECORDED` history event together. A unique scrap-record tyre index plus the status check prevents duplicate scrap records. Inspection creation rechecks the same status inside its write transaction and rejects scrapped tyres. No records or earlier history are deleted.

## Persistence and limits

Business data is stored in browser IndexedDB, not React state, Local Storage, or session storage. The application requests persistent storage when the browser exposes that API, but retention is not guaranteed; users can clear browser data and storage quotas can be reached. Records do not synchronize across devices. Image compression reduces, but does not eliminate, quota risk. If any inspection or scrap photo write fails, the corresponding transaction aborts rather than reporting success.

Clients, sites, and vehicles can be created and reviewed inside the Vehicle Live Inspection experience; they remain supporting business records, not additional top-level modules. Tyres default to `registered` and change to `scrapped` on scrap. Scrap reasons remain free text, so analysis groups the values as entered. Browser-local storage remains device-specific and does not synchronize.
