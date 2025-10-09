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

    get(key: string) {
        return this.client.get(key);
    }

    setex(key: string, ttlSec: number, val: string) {
        return this.client.setex(key, ttlSec, val);
    }

    del(key: string) {
        return this.client.del(key);
    }
}
