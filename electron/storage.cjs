const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_DATA = Object.freeze({
  assets: [],
  inventory: [],
  inventoryTransactions: [],
  maintenance: [],
  finances: [],
  suppliers: [],
});

function isValidDataFileName(name) {
  return Object.hasOwn(DEFAULT_DATA, name);
}

function validateData(name, value) {
  // Phase 1 files are collections, so require a JSON array before writing.
  if (!isValidDataFileName(name) || !Array.isArray(value)) {
    throw new TypeError('Storage accepts only known collection files containing arrays.');
  }
  return value;
}

async function ensureStorage(dataDirectory) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await Promise.all(Object.entries(DEFAULT_DATA).map(async ([name, initialValue]) => {
    const filePath = path.join(dataDirectory, `${name}.json`);
    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.writeFile(filePath, `${JSON.stringify(initialValue, null, 2)}\n`, { flag: 'wx' });
    }
  }));
}

async function readCollection(dataDirectory, name) {
  if (!isValidDataFileName(name)) throw new TypeError('Unknown storage collection.');
  const text = await fs.readFile(path.join(dataDirectory, `${name}.json`), 'utf8');
  return validateData(name, JSON.parse(text));
}

async function writeCollection(dataDirectory, name, value) {
  const safeValue = validateData(name, value);
  const filePath = path.join(dataDirectory, `${name}.json`);
  const temporaryPath = `${filePath}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(safeValue, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

module.exports = { ensureStorage, readCollection, writeCollection };
