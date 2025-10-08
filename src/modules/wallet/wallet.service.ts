import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/infra/prisma/prisma.service";
import { Prisma, LedgerDirection } from "@prisma/client";

@Injectable()
export class WalletService {
    constructor(private readonly prisma: PrismaService) {}

    //đảm bảo user có ví, nếu chưa có thì tạo ví mới
    async ensureWallet(userId: string) {
        let wallet = await this.prisma.wallet.findUnique({ where: { user_id: userId } });
        if (!wallet) wallet = await this.prisma.wallet.create({ data: { user_id: userId} });
        return wallet;
    }  

    //lấy thông tin ví của user
    async getMyWallet(userId: string) {
        const wallet = await this.ensureWallet(userId);
        const secs = wallet.secs;
        const hh = Math.floor(secs / 3600);
        const mm = Math.floor((secs % 3600) / 60);
        const ss = secs % 60;
        
        return {
            wallet_id: wallet.id,
            user_id: wallet.user_id,
            balance: {
                secs,
                minutes: Math.floor(secs / 60),
                hours: Number((secs / 3600).toFixed(2)),
                pretty: `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`,
            },
            status: wallet.status,
            created_at: wallet.created_at,
            updated_at: wallet.updated_at,
        }
    }
}