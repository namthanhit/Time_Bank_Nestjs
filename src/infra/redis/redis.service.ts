import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient() {
    return this.client;
  }

  async get(key: string) {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    const data = JSON.stringify(value);
    if (ttlSeconds) await this.client.set(key, data, 'EX', ttlSeconds);
    else await this.client.set(key, data);
  }

  async del(key: string) {
    await this.client.del(key);
  }
}
