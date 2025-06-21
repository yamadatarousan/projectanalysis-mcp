/**
 * Multi-level cache management system
 */

import NodeCache from 'node-cache';
import { LRUCache } from 'lru-cache';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getLogger, type ILogger } from './logger.js';

export interface ICacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
}

export interface ICacheOptions {
  readonly memoryTtl: number;
  readonly fileTtl: number;
  readonly maxMemorySize: number;
  readonly maxFileSize: number;
  readonly cacheDirectory: string;
  readonly compression: boolean;
}

export interface ICacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly ttl: number;
  readonly accessCount: number;
  readonly size: number;
}

export class HybridCacheManager implements ICacheManager {
  private readonly memoryCache: LRUCache<string, ICacheEntry<unknown>>;
  private readonly nodeCache: NodeCache;
  private readonly logger: ILogger;
  private readonly options: ICacheOptions;

  constructor(options: Partial<ICacheOptions> = {}) {
    this.options = {
      memoryTtl: 30 * 60 * 1000, // 30 minutes
      fileTtl: 24 * 60 * 60 * 1000, // 24 hours
      maxMemorySize: 100,
      maxFileSize: 1000,
      cacheDirectory: './.cache',
      compression: true,
      ...options
    };

    this.logger = getLogger('cache');

    // LRU Cache for frequently accessed items
    this.memoryCache = new LRUCache({
      max: this.options.maxMemorySize,
      ttl: this.options.memoryTtl,
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Node Cache for immediate access
    this.nodeCache = new NodeCache({
      stdTTL: Math.floor(this.options.memoryTtl / 1000),
      checkperiod: 60,
      useClones: false
    });

    this.ensureCacheDirectory();
  }

  async get<T>(key: string): Promise<T | null> {
    const hashedKey = this.hashKey(key);

    // Check memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(hashedKey) as ICacheEntry<T> | undefined;
    if (memoryEntry && this.isValidEntry(memoryEntry)) {
      this.logger.trace('Cache hit (memory)', { key: hashedKey });
      return memoryEntry.value;
    }

    // Check node cache
    const nodeEntry = this.nodeCache.get<ICacheEntry<T>>(hashedKey);
    if (nodeEntry && this.isValidEntry(nodeEntry)) {
      this.logger.trace('Cache hit (node)', { key: hashedKey });
      // Promote to memory cache
      this.memoryCache.set(hashedKey, nodeEntry);
      return nodeEntry.value;
    }

    // Check file cache (slowest)
    try {
      const fileEntry = await this.getFromFileCache<T>(hashedKey);
      if (fileEntry && this.isValidEntry(fileEntry)) {
        this.logger.trace('Cache hit (file)', { key: hashedKey });
        // Promote to memory caches
        this.nodeCache.set(hashedKey, fileEntry);
        this.memoryCache.set(hashedKey, fileEntry);
        return fileEntry.value;
      }
    } catch (error) {
      this.logger.debug('File cache read error', { key: hashedKey, error });
    }

    this.logger.trace('Cache miss', { key: hashedKey });
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const hashedKey = this.hashKey(key);
    const effectiveTtl = ttl ?? this.options.memoryTtl;
    
    const entry: ICacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: effectiveTtl,
      accessCount: 1,
      size: this.estimateSize(value)
    };

    // Set in all cache levels
    this.memoryCache.set(hashedKey, entry);
    this.nodeCache.set(hashedKey, entry, Math.floor(effectiveTtl / 1000));

    // Write to file cache asynchronously
    this.setToFileCache(hashedKey, entry).catch(error => {
      this.logger.warn('File cache write error', { key: hashedKey, error });
    });

    this.logger.trace('Cache set', { 
      key: hashedKey, 
      size: entry.size, 
      ttl: effectiveTtl 
    });
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear node cache
    for (const key of this.nodeCache.keys()) {
      if (regex.test(key)) {
        this.nodeCache.del(key);
      }
    }

    // Clear file cache
    await this.invalidateFileCache(regex);

    this.logger.info('Cache invalidated', { pattern });
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.nodeCache.flushAll();
    await this.clearFileCache();
    
    this.logger.info('Cache cleared');
  }

  async has(key: string): Promise<boolean> {
    const hashedKey = this.hashKey(key);
    
    if (this.memoryCache.has(hashedKey)) return true;
    if (this.nodeCache.has(hashedKey)) return true;
    
    try {
      const filePath = this.getFilePath(hashedKey);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async size(): Promise<number> {
    const memorySize = this.memoryCache.size;
    const nodeSize = this.nodeCache.keys().length;
    
    let fileSize = 0;
    try {
      const files = await fs.readdir(this.options.cacheDirectory);
      fileSize = files.filter(f => f.endsWith('.cache')).length;
    } catch {
      fileSize = 0;
    }

    return Math.max(memorySize, nodeSize, fileSize);
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private isValidEntry<T>(entry: ICacheEntry<T>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < entry.ttl;
  }

  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.options.cacheDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create cache directory', error as Error);
    }
  }

  private getFilePath(hashedKey: string): string {
    return path.join(this.options.cacheDirectory, `${hashedKey}.cache`);
  }

  private async getFromFileCache<T>(hashedKey: string): Promise<ICacheEntry<T> | null> {
    try {
      const filePath = this.getFilePath(hashedKey);
      const data = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(data) as ICacheEntry<T>;
      
      if (this.isValidEntry(entry)) {
        return entry;
      } else {
        // Clean up expired entry
        await fs.unlink(filePath).catch(() => {});
        return null;
      }
    } catch {
      return null;
    }
  }

  private async setToFileCache<T>(hashedKey: string, entry: ICacheEntry<T>): Promise<void> {
    try {
      const filePath = this.getFilePath(hashedKey);
      const data = JSON.stringify(entry);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (error) {
      this.logger.debug('File cache write failed', { key: hashedKey, error });
    }
  }

  private async invalidateFileCache(regex: RegExp): Promise<void> {
    try {
      const files = await fs.readdir(this.options.cacheDirectory);
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const key = file.replace('.cache', '');
          if (regex.test(key)) {
            const filePath = path.join(this.options.cacheDirectory, file);
            await fs.unlink(filePath).catch(() => {});
          }
        }
      }
    } catch (error) {
      this.logger.debug('File cache invalidation error', { error });
    }
  }

  private async clearFileCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.options.cacheDirectory);
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const filePath = path.join(this.options.cacheDirectory, file);
          await fs.unlink(filePath).catch(() => {});
        }
      }
    } catch (error) {
      this.logger.debug('File cache clear error', { error });
    }
  }
}

// Factory function
export function createCacheManager(options?: Partial<ICacheOptions>): ICacheManager {
  return new HybridCacheManager(options);
}