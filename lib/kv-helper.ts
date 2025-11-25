import { getCloudflareContext } from "@opennextjs/cloudflare";

// Cloudflare KV binding for meeting rooms
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

// Declare global memoryStore for development fallback
declare global {
  var memoryStore: Map<string, string> | undefined;
}

const TTL = 24 * 60 * 60; // 24 hours in seconds

export class KVHelper {
  private static instance: KVHelper;
  private kv: KVNamespace | null = null;
  private useMemoryFallback = false;

  private constructor() {
    this.initializeKV();
  }

  static getInstance(): KVHelper {
    if (!this.instance) {
      this.instance = new KVHelper();
    }
    return this.instance;
  }

  private initializeKV() {
    try {
      const { env } = getCloudflareContext();
      
      // @ts-expect-error - Cloudflare KV binding
      this.kv = env.MEETING_ROOMS as KVNamespace;

      if (!this.kv) {
        console.warn("MEETING_ROOMS KV namespace not available, using memory fallback");
        this.useMemoryFallback = true;
        this.initializeMemoryStore();
      }
    } catch (error) {
      console.warn("Failed to get Cloudflare context, using memory fallback:", error);
      this.useMemoryFallback = true;
      this.initializeMemoryStore();
    }
  }

  private initializeMemoryStore() {
    if (!globalThis.memoryStore) {
      globalThis.memoryStore = new Map();
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.useMemoryFallback) {
      return globalThis.memoryStore?.get(key) || null;
    }

    if (!this.kv) {
      console.warn("KV not initialized, falling back to memory storage");
      return globalThis.memoryStore?.get(key) || null;
    }

    try {
      return await this.kv.get(key);
    } catch (error) {
      console.warn("KV GET failed, falling back to memory storage:", error);
      return globalThis.memoryStore?.get(key) || null;
    }
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    if (this.useMemoryFallback) {
      globalThis.memoryStore?.set(key, value);
      return;
    }

    if (!this.kv) {
      console.warn("KV not initialized, falling back to memory storage");
      globalThis.memoryStore?.set(key, value);
      return;
    }

    try {
      await this.kv.put(key, value, options);
    } catch (error) {
      console.warn("KV PUT failed, falling back to memory storage:", error);
      globalThis.memoryStore?.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    if (this.useMemoryFallback) {
      globalThis.memoryStore?.delete(key);
      return;
    }

    if (!this.kv) {
      console.warn("KV not initialized, falling back to memory storage");
      globalThis.memoryStore?.delete(key);
      return;
    }

    try {
      await this.kv.delete(key);
    } catch (error) {
      console.warn("KV DELETE failed, falling back to memory storage:", error);
      globalThis.memoryStore?.delete(key);
    }
  }

  isUsingMemoryFallback(): boolean {
    return this.useMemoryFallback;
  }
}

// Export singleton instance
export const kvHelper = KVHelper.getInstance();