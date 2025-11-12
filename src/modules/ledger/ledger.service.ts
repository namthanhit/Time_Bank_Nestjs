import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma, LedgerDirection } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Ho_Chi_Minh';

function isDateOnly(s?: string) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function startOfDayTzToUtc(dateStr: string) {
  return fromZonedTime(`${dateStr}T00:00:00`, TZ);
}
function plusDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyLedger(
    userId: string,
    q: { direction?: 'credit'|'debit'; from?: string; to?: string; take?: number; skip?: number },
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { user_id: userId } });
    if (!wallet) return { items: [], total: 0 };

    const where: Prisma.LedgerEntryWhereInput = { wallet_id: wallet.id };

    if (q.direction) {
      where.direction = q.direction === 'credit' ? LedgerDirection.credit : LedgerDirection.debit;
    }

    if (q.from || q.to) {
      where.created_at = {};
      if (q.from) {
        (where.created_at as any).gte = isDateOnly(q.from)
          ? startOfDayTzToUtc(q.from)
          : new Date(q.from);
      }
      if (q.to) {
        if (isDateOnly(q.to)) {
          const endUtc = startOfDayTzToUtc(q.to);
          (where.created_at as any).lt = plusDays(endUtc, 1);
        } else {
          (where.created_at as any).lte = new Date(q.to);
        }
      }
    }

    const take = q.take ?? 20;
    const skip = q.skip ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take, 
        skip,
        
        include: {
          transfer: {
            include: {
              fromWallet: {
                include: {
                  user: {
                    select: { full_name: true, phone: true },
                  },
                },
              },
              toWallet: {
                include: {
                  user: {
                    select: { full_name: true, phone: true },
                  },
                },
              },
            },
          },
        },

      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return { items, total, take, skip, hasMore: skip + items.length < total };
  }
}