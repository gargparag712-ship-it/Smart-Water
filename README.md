# SmartWater

SmartWater is a desktop application built with Electron, React, and Vite. It includes an operations dashboard, Asset Management, Inventory Management, Maintenance Management, and a local JSON storage service.

## Run locally

```sh
npm install
npm run dev
```

The development command starts the Vite renderer and Electron desktop window together. To build the renderer, run `npm run build`. To open the built application locally, run `npm start` after building. `npm run dist` builds the renderer and creates an Electron Builder package for the current platform.

## Architecture

The renderer calls only the explicitly scoped methods exposed by the preload script. These methods invoke named IPC handlers in Electron's main process. The main process initializes JSON files in Electron's `userData/data` directory before opening the app window. The renderer has no direct Node.js or filesystem access.

Asset Management, Inventory and Maintenance are functional local modules. Finance, Suppliers, Reports, and Settings remain UI previews. The dashboard uses local asset, inventory and maintenance records for their matching indicators; other figures remain illustrative sample data. The storage service creates known collections in the Electron `userData/data` directory when first launched.

## Asset management

The Asset Management section reads and writes `assets.json` through five narrow preload methods: `listAssets`, `getAsset`, `createAsset`, `updateAsset`, and `deleteAsset`. Asset IDs and timestamps are assigned in the Electron main process. Asset codes are normalized and checked for uniqueness there, and the JSON collection is written atomically through the existing storage service. The dashboard reads live asset totals and status distribution; its other module figures and activity examples remain labeled sample data.

Run `npm test` for the asset service and search/filter checks.

## Inventory management

Inventory items are stored in `inventory.json`; stock movements are recorded in `inventoryTransactions.json`. Scoped preload methods support item operations, stock-in/stock-out movements and filtered transaction history. Quantity changes are serialized in the main process, and items with stock history cannot be deleted.

## Maintenance management

Maintenance work orders are stored in `maintenance.json` and reference asset IDs in `assets.json`. Work-order codes are generated in the main process. Status changes follow Scheduled → In Progress → Completed, or Scheduled → Cancelled. Completion records include work performed and calculated labour plus parts cost. Completed/cancelled records are retained, and assets linked to maintenance history cannot be deleted. Sidebar, dashboard and alert counts use local maintenance records and the device's local calendar date.
