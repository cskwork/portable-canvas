import { bytes, retentionPlan } from "./model.js";
export class DrawingStore {
  constructor(name = "portable-canvas-v1") {
    this.name = name;
  }
  async open() {
    if (this.db) return this;
    this.db = await new Promise((resolve, reject) => {
      const q = indexedDB.open(this.name, 1);
      q.onupgradeneeded = () => {
        q.result.createObjectStore("drawings", { keyPath: "key" });
        q.result.createObjectStore("meta", { keyPath: "key" });
      };
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
      q.onblocked = () =>
        reject(new Error("Storage upgrade blocked. Close other tabs."));
    });
    this.db.onversionchange = () => {
      this.db.close();
      this.db = null;
    };
    return this;
  }
  async load(key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["drawings", "meta"], "readwrite");
      let result;
      const q = tx.objectStore("drawings").get(key);
      q.onsuccess = () => {
        result = q.result;
        const m = tx.objectStore("meta").get(key);
        m.onsuccess = () => {
          if (m.result)
            tx.objectStore("meta").put({ ...m.result, accessed: Date.now() });
        };
      };
      tx.oncomplete = () => resolve(result || { key, strokes: [], version: 0 });
      tx.onabort = () => reject(tx.error || new Error("Storage read failed."));
    });
  }
  async recents() {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("meta");
      const q = tx.objectStore("meta").getAll();
      tx.oncomplete = () =>
        resolve(q.result.sort((a, b) => b.accessed - a.accessed));
      tx.onabort = () => reject(tx.error);
    });
  }
  async save(key, strokes, version, settings) {
    await this.open();
    const size = bytes(strokes);
    if (size > settings.maxBytes)
      throw new Error("Drawing exceeds budget. Export it or raise the budget.");
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["drawings", "meta"], "readwrite"),
        ds = tx.objectStore("drawings"),
        ms = tx.objectStore("meta");
      let failure;
      const q = ds.get(key);
      q.onsuccess = () => {
        if ((q.result?.version || 0) !== version) {
          failure = new Error(
            "Another window changed this drawing. Export your work before reloading.",
          );
          tx.abort();
          return;
        }
        const all = ms.getAll();
        all.onsuccess = () => {
          try {
            for (const id of retentionPlan(all.result, key, size, settings)) {
              ds.delete(id);
              ms.delete(id);
            }
            ds.put({ key, strokes, version: version + 1 });
            ms.put({
              key,
              bytes: size,
              accessed: Date.now(),
              version: version + 1,
            });
          } catch (e) {
            failure = e;
            tx.abort();
          }
        };
      };
      tx.oncomplete = () => resolve(version + 1);
      tx.onabort = () =>
        reject(
          failure ||
            tx.error ||
            new Error(
              "Save failed. Browser storage may be full or unavailable.",
            ),
        );
    });
  }
  close() {
    this.db?.close();
    this.db = null;
  }
}
