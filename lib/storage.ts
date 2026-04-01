import { get, set, del, clear } from 'idb-keyval';

export const storage = {
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = await get(key);
      return value !== undefined ? value : null;
    } catch (error) {
      console.error(`Error getting item ${key} from IndexedDB:`, error);
      return null;
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      await set(key, value);
    } catch (error) {
      console.error(`Error setting item ${key} in IndexedDB:`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await del(key);
    } catch (error) {
      console.error(`Error removing item ${key} from IndexedDB:`, error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await clear();
    } catch (error) {
      console.error('Error clearing IndexedDB:', error);
    }
  }
};

export const migrateFromLocalStorage = async (keys: string[]) => {
  for (const key of keys) {
    const localData = localStorage.getItem(key);
    if (localData !== null) {
      try {
        // Try to parse if it's JSON, otherwise store as string
        let value;
        try {
          value = JSON.parse(localData);
        } catch {
          value = localData;
        }
        
        // Check if already in IndexedDB to avoid overwriting newer data if migration runs twice
        // But usually we want to prioritize migration if it's the first time
        const existing = await storage.getItem(key);
        if (!existing) {
          await storage.setItem(key, value);
          console.log(`Migrated ${key} to IndexedDB`);
        }
        
        // Remove from localStorage after successful migration
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Migration failed for key ${key}:`, error);
      }
    }
  }
};
