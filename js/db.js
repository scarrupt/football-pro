const DB_NAME    = 'fpip_db';
const DB_VERSION = 2;

export const db = {
  _db: null,

  /**
   * Opens the IndexedDB database. Creates object stores on first run.
   */
  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const database = event.target.result;

        // sessions store
        if (!database.objectStoreNames.contains('sessions')) {
          const sessions = database.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('date', 'date', { unique: false });
        }

        // planner store
        if (!database.objectStoreNames.contains('planner')) {
          const planner = database.createObjectStore('planner', { keyPath: 'id' });
          planner.createIndex('date', 'date', { unique: false });
        }

        // badges store
        if (!database.objectStoreNames.contains('badges')) {
          database.createObjectStore('badges', { keyPath: 'id' });
        }

        // settings store
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }

        // testAttempts store — all raw attempt values, linked to a session
        if (!database.objectStoreNames.contains('testAttempts')) {
          const ta = database.createObjectStore('testAttempts', { keyPath: 'id' });
          ta.createIndex('sessionId', 'sessionId', { unique: false });
          ta.createIndex('date',      'date',      { unique: false });
        }
      };

      request.onsuccess = event => {
        this._db = event.target.result;
        resolve(this._db);
      };

      request.onerror = event => {
        reject(event.target.error);
      };
    });
  },

  /**
   * Internal helper: wraps a transaction operation in a promise.
   */
  async _tx(storeName, mode, fn) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      if (request) {
        request.onsuccess = event => resolve(event.target.result);
        request.onerror  = event => reject(event.target.error);
      }
      tx.onerror = event => reject(event.target.error);
      // For put/delete, resolve on tx complete if no request result needed
      if (!request) {
        tx.oncomplete = () => resolve(undefined);
      }
    });
  },

  /**
   * Get a single record by key.
   */
  async get(store, key) {
    return this._tx(store, 'readonly', s => s.get(key));
  },

  /**
   * Get all records from a store.
   */
  async getAll(store) {
    return this._tx(store, 'readonly', s => s.getAll());
  },

  /**
   * Get all records matching an index value.
   */
  async getByIndex(store, indexName, value) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx      = database.transaction(store, 'readonly');
      const s       = tx.objectStore(store);
      const index   = s.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror   = event => reject(event.target.error);
    });
  },

  /**
   * Get records within an index range (inclusive both ends).
   */
  async getRange(store, indexName, lower, upper) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const tx      = database.transaction(store, 'readonly');
      const s       = tx.objectStore(store);
      const index   = s.index(indexName);
      const range   = IDBKeyRange.bound(lower, upper);
      const request = index.getAll(range);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror   = event => reject(event.target.error);
    });
  },

  /**
   * Put (insert or update) a record.
   */
  async put(store, item) {
    return this._tx(store, 'readwrite', s => s.put(item));
  },

  /**
   * Delete a record by key.
   */
  async delete(store, key) {
    return this._tx(store, 'readwrite', s => s.delete(key));
  },

  /**
   * Count all records in a store.
   */
  async count(store) {
    return this._tx(store, 'readonly', s => s.count());
  },
};
