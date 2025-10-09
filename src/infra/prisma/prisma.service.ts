import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await this.$connect();
        // Ép session DB dùng UTC để ghi/đọc DATETIME
        await this.$executeRawUnsafe(`SET time_zone = '+07:00'`);
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}