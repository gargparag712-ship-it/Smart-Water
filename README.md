# SmartWater

SmartWater is a local desktop tool for operators of drinking water supply schemes. It keeps asset registers, inventory and stock movements, maintenance work orders, finance records, supplier contacts, and operational reports together in one application.

## Problem statement

Small water scheme teams often track equipment, consumables, repairs, and operating costs in separate notebooks or spreadsheets. SmartWater provides a simple, offline-first workspace for maintaining these operational records and reviewing them in one place.

## Features

- Dashboard with live saved-record counts and illustrative recent-activity examples.
- Asset register with asset history and maintenance links.
- Inventory register with stock-in/stock-out history, low-stock flags, and optional supplier links.
- Maintenance work orders linked to registered assets.
- Income, expenses, and monthly category budgets, with money stored as integer paise.
- Supplier directory with inventory references and safe deletion restrictions.
- Asset, inventory, stock movement, maintenance, finance, and monthly operational reports.
- PDF export using Electron’s built-in PDF printing.
- Versioned JSON backup export and validated restore, with a safety backup before replacement.

Records are stored locally on the device. SmartWater does not provide cloud synchronization, remote access, or multi-user collaboration. Some dashboard activity examples are illustrative; operational counts and charts indicate when they use saved records.

## Technology stack

- Electron.js
- React and Vite
- JavaScript and CSS
- React Router
- Lucide React icons
- Recharts
- Local JSON collection files
- Electron Builder for macOS packaging

## Architecture

```text
React renderer → secure preload API → Electron Main Process → JSON files
```

Electron Main owns file operations, validation, report generation, backup/restore, native dialogs, and PDF generation. Preload exposes only named application operations through `contextBridge`. The renderer does not receive Node.js or filesystem APIs. The desktop window uses context isolation, disabled Node integration, and sandboxing.

## Project structure

```text
build/                      Required app icons and icon-generation script
electron/                   Main process, preload, storage and domain services
src/components/             Shared shell and module UI components
src/data/                   UI option lists and illustrative dashboard examples
src/hooks/                  Renderer data-loading hooks
src/pages/                  Dashboard and application pages
src/styles/                 Shared design system and module styles
src/utils/                  Renderer-side formatting and filtering helpers
test/                       Node.js automated tests
index.html                  Vite renderer entry point
vite.config.js              Vite configuration
package.json                Scripts, dependencies and Electron Builder settings
package-lock.json           Locked npm dependency tree
```

Generated `dist/` and `release/` outputs are intentionally excluded from Git. The `build/` directory contains required source assets and should be committed.

## Installation

Use a supported Node.js installation and install the locked dependencies:

```sh
npm install
```

## Development

Start Vite and the Electron desktop window together:

```sh
npm run dev
```

Run the automated tests and build the renderer:

```sh
npm test
npm run build
```

Open the built desktop application locally:

```sh
npm start
```

## macOS release build

On an Apple Silicon Mac, create the arm64 DMG:

```sh
npm run dist:mac
```

The DMG is written to `release/`. The package uses the product name **SmartWater** and identifier `org.smartwater.desktop`. The custom macOS icon is configured from `build/icon.icns`. This project does not configure code signing or notarization; macOS may show its normal warning for an unsigned application.

## Screenshots

No application screenshots are included yet. Add screenshots captured from the running application here before publishing if you want the GitHub page to show the interface.

## Local data location

SmartWater stores JSON files under Electron’s `userData/data` directory. On macOS this is normally:

```text
~/Library/Application Support/SmartWater/data/
```

The data directory contains `assets.json`, `inventory.json`, `inventoryTransactions.json`, `maintenance.json`, `finances.json`, `budgets.json`, and `suppliers.json`. The app creates missing collections without overwriting existing files. A backup created automatically before a restore is kept in the sibling `userData/backups` directory.

## Backup and restore

Open **Settings** in SmartWater:

- Choose **Export backup** and select a destination for the versioned JSON backup.
- Choose **Restore backup** and select a backup file. SmartWater validates its version, collections, records, and references, then asks for confirmation.
- After confirmation, SmartWater first creates a safety backup of current records. It then replaces all seven collections. If a write fails, it attempts to roll back to the saved current collections.

Keep exported backup files in a safe location. Restore replaces the current records on this device.

## Known limitations

- This is a single-device local application; there is no cloud or multi-user synchronization.
- The dashboard’s recent activity examples remain illustrative. Its asset, inventory, maintenance, and finance summary values use saved records.
- The macOS DMG is configured for Apple Silicon (`arm64`). There is no Intel or universal build target, code signing, or notarization configured.
- `npm audit` currently reports six moderate findings in Electron Builder’s nested `minimatch` dependency tree. Electron Builder was updated to the compatible patch release available for the configured major, but its dependency range still resolves vulnerable `minimatch` 10.x. The audit’s suggested resolution downgrades Electron Builder across a major version; this project does not force that downgrade or override the package’s dependency with an unsupported major.

## Dependency review

The dependency tree is recorded in `package-lock.json`. To inspect current advisories, run:

```sh
npm audit
```

The remaining advisory is reported as a moderate `minimatch` denial-of-service issue in the build-time Electron Builder dependency tree. It is not included in the application’s runtime production dependency set.
