'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Per-user settings persisted as JSON in the OS user-data folder (never in the
 * repo). Reads go to an in-memory cache; writes are atomic (temp file +
 * rename) so a crash mid-write can't leave a corrupt config behind.
 */
class Store {
  /**
   * @param {string} filePath absolute path of the JSON file
   * @param {{ logger?: Pick<Console, 'error' | 'warn'> }} [options]
   */
  constructor(filePath, { logger = console } = {}) {
    this.filePath = filePath;
    this.logger = logger;
    this.data = null;
  }

  /** Re-read from disk, e.g. when the roaming profile wasn't ready at login. */
  reload() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      if (err.code !== 'ENOENT') this.logger.warn('Config unreadable, using defaults:', err);
      // Keep what we already have: the next save would otherwise overwrite the
      // whole config with just that one change.
      this.data ??= {};
    }
    return this.data;
  }

  get(key, fallback) {
    if (this.data === null) this.reload();
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
  }

  /** Merge `patch` into the settings and persist. Returns false on I/O failure. */
  set(patch) {
    if (this.data === null) this.reload();
    this.data = { ...this.data, ...patch };
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.filePath);
      return true;
    } catch (err) {
      this.logger.error('Failed to save config:', err);
      fs.rmSync(tmp, { force: true });
      return false;
    }
  }
}

module.exports = { Store };
