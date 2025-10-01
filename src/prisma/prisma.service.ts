import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as apm from 'elastic-apm-node';

@Injectable()
export class PrismaService 
extends PrismaClient 
implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });
  }

  async onModuleInit(): Promise<void> {
    this.$use(async (params, next) => {
      let span;
      try {
        span = apm.startSpan(`prisma.${params.model}.${params.action}`);
      } catch {
        span = null;
      }
      if (!span) return await next(params);
 
      try {
        span.type = 'DB';
        span.subtype = 'prisma';
        span.action = 'query';
        span.setLabel('query', JSON.stringify(params.args));
        const result = await next(params);
        span.end();
        return result;
      } catch (e) {
        span.end();
        throw e;
      }
    });
 
    await this.$connect();
 
    this.$on('query' as never, async (e: { query: string; params: string }) => {
      if (process.env.NODE_ENV === 'local') {
        console.log(`${e.query} ${e.params}`);
      }
    });
  }
    $use(arg0: (params: any, next: any) => Promise<any>) {
        throw new Error("Method not implemented.");
    }
    $connect() {
        throw new Error("Method not implemented.");
    }
    $on(arg0: never, arg1: (e: { query: string; params: string; }) => Promise<void>) {
        throw new Error("Method not implemented.");
    }
 
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
    $disconnect() {
        throw new Error("Method not implemented.");
    }
}