import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CheckDto } from './dtos/check.dto';
import {
  CreateTransferDto,
  TransferToEscrowDto,
} from './dtos/create-transfer.dto';
import {
  UserStatus,
  LedgerDirection,
  LedgerRefType,
  TransferStatus,
  WalletStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JobStatus } from '../jobs/typings/job.enum';
import { QueueService } from 'src/infra/queue/queue.service';

const PIN_MAX_FAILS = 5;
const PIN_LOCK_MINUTES = 5;

@Injectable()
export class TransferService {
  constructor(
    private prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  // (1) Lookup: đảm bảo có người nhận & không phải chính mình
  async lookupRecipient(phone: string, fromUserId: string) {
    const to = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, full_name: true },
    });
    if (!to) throw new NotFoundException('Không tìm thấy người nhận');
    if (to.id === fromUserId)
      throw new BadRequestException('Không thể chuyển cho chính mình');

    return {
      oke: true,
      recipient: to,
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
      this.prisma.wallet.upsert({
        where: { user_id: fromUserId },
        update: {},
        create: { user_id: fromUserId },
      }),
      this.prisma.wallet.upsert({
        where: { user_id: to.id },
        update: {},
        create: { user_id: to.id },
      }),
    ]);

    if (fromWallet.status !== WalletStatus.active)
      throw new ForbiddenException('Ví của bạn không hoạt động');
    if (toWallet.status !== WalletStatus.active)
      throw new ForbiddenException('Ví người nhận không hoạt động');
    if (dto.secs <= 0)
      throw new BadRequestException('Số thời gian không hợp lệ');
    if (fromWallet.secs < dto.secs)
      throw new BadRequestException('Số dư không đủ');

    return {
      ok: true,
    };
  }

  private async validateSenderPrerequisites(fromUserId: string, pin: string) {
    const [auth, user] = await Promise.all([
      this.prisma.auth.findUnique({
        where: { user_id: fromUserId },
        select: {
          pin: true,
          pin_failed_attempts: true,
          pin_locked_until: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: fromUserId },
        select: { status: true },
      }),
    ]);

    if (!auth) throw new ForbiddenException('Tài khoản chưa sẵn sàng');
    if (user?.status !== UserStatus.active)
      throw new ForbiddenException('Tài khoản không hoạt động');
    if (!auth.pin) throw new ForbiddenException('Bạn chưa thiết lập PIN');

    const now = new Date();
    if (auth.pin_locked_until && auth.pin_locked_until > now) {
      throw new ForbiddenException('PIN đang bị khóa tạm thời, thử lại sau');
    }

    const okPin = await bcrypt.compare(pin, auth.pin);

    if (!okPin) {
      const failed = (auth.pin_failed_attempts ?? 0) + 1;
      const lock =
        failed >= PIN_MAX_FAILS
          ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60 * 1000)
          : null;

      await this.prisma.auth.update({
        where: { user_id: fromUserId },
        data: {
          pin_failed_attempts: lock ? 0 : failed,
          pin_locked_until: lock,
        },
      });

      if (lock)
        throw new ForbiddenException(
          `Sai PIN quá ${PIN_MAX_FAILS} lần. Khóa ${PIN_LOCK_MINUTES} phút.`,
        );
      throw new ForbiddenException('PIN không đúng');
    }

    if (auth.pin_failed_attempts > 0 || auth.pin_locked_until) {
      await this.prisma.auth.update({
        where: { user_id: fromUserId },
        data: { pin_failed_attempts: 0, pin_locked_until: null },
      });
    }
  }

  private async validateDtoTransferToEscrowDto(
    userId: string,
    dto: TransferToEscrowDto,
  ) {
    const escrow = await this.prisma.escrowWallet.findUnique({
      where: { job_id: dto.jobId },
    });
    if (!escrow) throw new NotFoundException('Escrow không tồn tại');

    const fromWallet = await this.prisma.wallet.findUniqueOrThrow({
      where: { user_id: userId },
    });
    if (fromWallet.status !== WalletStatus.active)
      throw new ForbiddenException('Ví của bạn không hoạt động');
    if (fromWallet.secs < dto.secs)
      throw new BadRequestException('Số dư không đủ');

    return [escrow, fromWallet];
  }

  // (3) Execute: verify PIN, sau đó thực thi ngay
  async executeNoRecheck(fromUserId: string, dto: CreateTransferDto) {
    await this.validateSenderPrerequisites(fromUserId, dto.pin);
    return this.prisma.$transaction(async (tx) => {
      const to = await tx.user.findUnique({
        where: { phone: dto.to_phone },
        select: { id: true },
      });
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
          {
            wallet_id: fromWallet.id,
            direction: LedgerDirection.debit,
            secs: dto.secs,
            ref_type: LedgerRefType.transfer,
            ref_id: transfer.id,
            memo: dto.note ?? null,
          },
          {
            wallet_id: toWallet.id,
            direction: LedgerDirection.credit,
            secs: dto.secs,
            ref_type: LedgerRefType.transfer,
            ref_id: transfer.id,
            memo: dto.note ?? null,
          },
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
      };
    });
  }

  async transferToEscrow(fromUserId: string, dto: TransferToEscrowDto) {
    await this.validateSenderPrerequisites(fromUserId, dto.pin);

    const [escrow, fromWallet] = await this.validateDtoTransferToEscrowDto(
      fromUserId,
      dto,
    );
    const job = await this.prisma.service.findUnique({
      where: { id: dto.jobId },
    });
    if (!job) throw new NotFoundException('Job không tồn tại');

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          from_wallet_id: fromWallet.id,
          to_escrow_id: escrow.id,
          secs: dto.secs,
          status: TransferStatus.completed,
          completed_at: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: fromWallet.id },
        data: { secs: { decrement: dto.secs } },
      });

      await tx.escrowWallet.update({
        where: { id: escrow.id },
        data: { secs: { increment: dto.secs } },
      });

      await tx.ledgerEntry.create({
        data: {
          wallet_id: fromWallet.id,
          direction: LedgerDirection.debit,
          secs: dto.secs,
          ref_type: LedgerRefType.transfer,
          ref_id: transfer.id,
        },
      });

      await tx.service.update({
        where: {
          id: dto.jobId,
          user_id: fromUserId,
        },
        data: {
          status: JobStatus.OPEN,
        },
      });

      return {
        transfer: {
          id: transfer.id,
          status: transfer.status,
          secs: transfer.secs,
          created_at: transfer.created_at,
          completed_at: transfer.completed_at,
        },
      };
    });

    await this.queueService.removeJob(`delete-pending-job-${dto.jobId}`);

    const preferred_start_time = job.preferred_start!;
    const delay = preferred_start_time.getTime() - Date.now();

    if (delay > 0) {
      await this.queueService.scheduleJob(
        'update-job-to-matched',
        { jobId: dto.jobId },
        delay,
      );
    }

    return {
      success: true,
    };
  }

  async transferFromEscrowToProvider(
    escrowId: string,
    providerId: string,
    amount: number,
  ) {
    const escrow = await this.prisma.escrowWallet.findUnique({
      where: { id: escrowId },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');

    const providerWallet = await this.prisma.wallet.findUnique({
      where: { user_id: providerId },
    });
    if (!providerWallet)
      throw new NotFoundException('Provider wallet not found');

    if (escrow.secs > amount) {
      throw new BadRequestException('Amount exceeds escrow secs');
    }

    await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          from_escrow_id: escrow.id,
          to_wallet_id: providerWallet.id,
          secs: escrow.secs,
          status: TransferStatus.completed,
          completed_at: new Date(),
        },
      });

      await tx.escrowWallet.update({
        where: { id: escrow.id },
        data: { secs: 0 },
      });

      await tx.wallet.update({
        where: { id: providerWallet.id },
        data: { secs: { increment: escrow.secs } },
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            wallet_id: providerWallet.id,
            direction: LedgerDirection.credit,
            secs: escrow.secs,
            ref_type: LedgerRefType.transfer,
            ref_id: transfer.id,
          },
        ],
      }); 
    });
    return { success: true };
  }
}
