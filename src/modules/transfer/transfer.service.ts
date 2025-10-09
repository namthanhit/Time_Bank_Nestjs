import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CheckDto } from './dtos/check.dto';
import { CreateTransferDto } from './dtos/create-transfer.dto';
import { AuthStatus, LedgerDirection, LedgerRefType, TransferStatus, WalletStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const PIN_MAX_FAILS = 5;
const PIN_LOCK_MINUTES = 10;

@Injectable()
export class TransferService {
  constructor(private prisma: PrismaService) {}

  // (1) Lookup: đảm bảo có người nhận & không phải chính mình
  async lookupRecipient(phone: string, fromUserId: string) {
    const to = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, full_name: true},
    });
    if (!to) throw new NotFoundException('Không tìm thấy người nhận');
    if (to.id === fromUserId) throw new BadRequestException('Không thể chuyển cho chính mình');

    return {
      oke: true, 
      recipient: to 
    };
  }

  // (2) Check: chỉ kiểm tra ví và số thời gian
  async checkWalletAndAmount(fromUserId: string, dto: CheckDto) {
    // upsert ví để có id
    const to = await this.prisma.user.findUnique({
      where: { phone: dto.to_phone },
      select: { id: true },
    });
    if (!to) throw new NotFoundException('Không tìm thấy người nhận'); // vẫn cần vì phải lấy ví đích

    const [fromWallet, toWallet] = await Promise.all([
      this.prisma.wallet.upsert({ where: { user_id: fromUserId }, update: {}, create: { user_id: fromUserId } }),
      this.prisma.wallet.upsert({ where: { user_id: to.id },       update: {}, create: { user_id: to.id } }),
    ]);

    if (fromWallet.status !== WalletStatus.active) throw new ForbiddenException('Ví của bạn không hoạt động');
    if (toWallet.status !== WalletStatus.active) throw new ForbiddenException('Ví người nhận không hoạt động');
    if (dto.secs <= 0) throw new BadRequestException('Số thời gian không hợp lệ');
    if (fromWallet.secs < dto.secs) throw new BadRequestException('Số dư không đủ');

    return {
      ok: true
    };
  }

  // (3) Execute: verify PIN, sau đó thực thi ngay 
  async executeNoRecheck(fromUserId: string, dto: CreateTransferDto) {
    // verify PIN
    const auth = await this.prisma.auth.findUnique({
      where: { user_id: fromUserId },
      select: { status: true, pin: true, pin_failed_attempts: true, pin_locked_until: true },
    });
    if (!auth) throw new ForbiddenException('Tài khoản chưa sẵn sàng');
    if (auth.status !== AuthStatus.active) throw new ForbiddenException('Tài khoản không hoạt động');
    if (!auth.pin) throw new ForbiddenException('Bạn chưa thiết lập PIN');

    const now = new Date();
    if (auth.pin_locked_until && auth.pin_locked_until > now) {
      throw new ForbiddenException('PIN đang bị khóa tạm thời, thử lại sau');
    }
    const okPin = await argon2.verify(auth.pin, dto.pin);
    if (!okPin) {
      const failed = (auth.pin_failed_attempts ?? 0) + 1;
      const lock = failed >= PIN_MAX_FAILS ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60 * 1000) : null;
      await this.prisma.auth.update({
        where: { user_id: fromUserId },
        data: { pin_failed_attempts: lock ? 0 : failed, pin_locked_until: lock },
      });
      if (lock) throw new ForbiddenException(`Sai PIN quá ${PIN_MAX_FAILS} lần. Khóa ${PIN_LOCK_MINUTES} phút.`);
      throw new ForbiddenException('PIN không đúng');
    }
    await this.prisma.auth.update({
      where: { user_id: fromUserId },
      data: { pin_failed_attempts: 0, pin_locked_until: null },
    });

  
    return this.prisma.$transaction(async (tx) => {
      const to = await tx.user.findUnique({ where: { phone: dto.to_phone }, select: { id: true } });
      if (!to) throw new NotFoundException('Không tìm thấy người nhận'); // tối thiểu để có ví đích

      const [fromWallet, toWallet] = await Promise.all([
        tx.wallet.findUniqueOrThrow({ where: { user_id: fromUserId } }),
        tx.wallet.findUniqueOrThrow({ where: { user_id: to.id } }),
      ]);

      // tạo transfer completed
      const transfer = await tx.transfer.create({
        data: {
          from_wallet_id: fromWallet.id,
          to_wallet_id: toWallet.id,
          secs: dto.secs,
          note: dto.note ?? null,
          status: TransferStatus.completed,
          completed_at: new Date(),
        },
      });

      // cập nhật số dư 
      const updatedFrom = await tx.wallet.update({
        where: { id: fromWallet.id },
        data: { secs: { decrement: dto.secs } },
      });
      const updatedTo = await tx.wallet.update({
        where: { id: toWallet.id },
        data: { secs: { increment: dto.secs } },
      });

      // ledger đôi
      await tx.ledgerEntry.createMany({
        data: [
          { wallet_id: fromWallet.id, direction: LedgerDirection.debit,  secs: dto.secs, ref_type: LedgerRefType.transfer, ref_id: transfer.id, memo: dto.note ?? null },
          { wallet_id: toWallet.id,   direction: LedgerDirection.credit, secs: dto.secs, ref_type: LedgerRefType.transfer, ref_id: transfer.id, memo: dto.note ?? null },
        ],
      });

      return {
        transfer: {
          id: transfer.id,
          status: transfer.status,
          secs: transfer.secs,
          note: transfer.note,
          created_at: transfer.created_at,
          completed_at: transfer.completed_at,
        },
        balances: {
          from_after: updatedFrom.secs,
          to_after: updatedTo.secs,
        },
      };
    });
  }
}
