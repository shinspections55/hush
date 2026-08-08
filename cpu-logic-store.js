const fsSync = require('fs');
const path = require('path');

const CPU_LOGIC_DATA_DIR = path.join(__dirname, '..', '.hush-data');
const CPU_LOGIC_JSON_FILE = path.join(CPU_LOGIC_DATA_DIR, 'cpu-logic.json');
const CPU_LOGIC_LEGACY_FILE = path.join(__dirname, 'cpulogic.js');

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLoadedConfig(value) {
  return isObject(value) ? value : {};
}

function tryReadJsonConfig() {
  try {
    const raw = fsSync.readFileSync(CPU_LOGIC_JSON_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeLoadedConfig(parsed);
  } catch (_error) {
    return null;
  }
}

function tryReadLegacyJsConfig() {
  try {
    delete require.cache[require.resolve('./cpulogic')];
    const loaded = require('./cpulogic');
    return normalizeLoadedConfig(loaded);
  } catch (_error) {
    return null;
  }
}

function saveCpuLogicConfig(config) {
  const safeConfig = normalizeLoadedConfig(config);
  fsSync.mkdirSync(CPU_LOGIC_DATA_DIR, { recursive: true });
  fsSync.writeFileSync(CPU_LOGIC_JSON_FILE, JSON.stringify(safeConfig, null, 2), 'utf8');
  return safeConfig;
}

function loadCpuLogicConfig() {
  const jsonConfig = tryReadJsonConfig();
  if (jsonConfig) return jsonConfig;

  const legacyConfig = tryReadLegacyJsConfig();
  if (legacyConfig) {
    try {
      saveCpuLogicConfig(legacyConfig);
    } catch (_error) {
      // Keep serving legacy config even if migration write fails.
    }
    return legacyConfig;
  }

  return {};
}

module.exports = {
  CPU_LOGIC_JSON_FILE,
  CPU_LOGIC_LEGACY_FILE,
  loadCpuLogicConfig,
  saveCpuLogicConfig
};
