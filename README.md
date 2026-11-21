# SmartWater

SmartWater is a desktop application built with Electron, React, and Vite. The current UI foundation includes an operations dashboard, section navigation, illustrative sample data, one health-check IPC call, and a local JSON storage service.

## Run locally

```sh
npm install
npm run dev
```

The development command starts the Vite renderer and Electron desktop window together. To build the renderer, run `npm run build`. To open the built application locally, run `npm start` after building. `npm run dist` builds the renderer and creates an Electron Builder package for the current platform.

## Architecture

The renderer calls only the `window.smartWater.checkHealth()` method exposed by the preload script. That method invokes a named IPC handler in Electron's main process. The main process initializes JSON files in Electron's `userData/data` directory before opening the app window. The renderer has no direct Node.js or filesystem access.

Asset Management is the first functional module. Inventory, Maintenance, Finance, Suppliers, Reports, and Settings remain UI previews. The dashboard uses real local asset records for asset totals and status; its other module figures are illustrative sample data. The initial storage collections are `assets.json`, `inventory.json`, `maintenance.json`, `finances.json`, and `suppliers.json`; they are created as empty arrays when first launched. Data read/write operations are only exposed for assets.

## Asset management

The Asset Management section reads and writes `assets.json` through five narrow preload methods: `listAssets`, `getAsset`, `createAsset`, `updateAsset`, and `deleteAsset`. Asset IDs and timestamps are assigned in the Electron main process. Asset codes are normalized and checked for uniqueness there, and the JSON collection is written atomically through the existing storage service. The dashboard reads live asset totals and status distribution; its other module figures and activity examples remain labeled sample data.

Run `npm test` for the asset service and search/filter checks.
