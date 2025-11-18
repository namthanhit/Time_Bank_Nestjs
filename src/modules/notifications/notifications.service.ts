import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { FirebaseService } from '../../infra/firebase/firebase.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  /** format giây -> HH:mm:ss (HH là tổng giờ, có thể > 24) */
  private hms(secs: number): string {
    const s = Math.max(0, Math.floor(secs));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${hh}:${pad(mm)}:${pad(ss)}`;
  }

  /**
   * Tạo 1 thông báo (idempotent theo (user_id, dedupe_key)):
   */
  async createOnceAndPush(params: {
    userId: string;
    title: string;
    body: string;
    type: NotificationType;
    data?: Record<string, any>;
    dedupeKey: string;
  }) {
    // 1) Tạo (idempotent)
    let notif: { id: string; created_at: Date } | null = null;
    try {
      notif = await this.prisma.notification.create({
        data: {
          user_id: params.userId,
          title: params.title,
          body: params.body,
          type: params.type,
          data: (params.data ?? {}) as any,
          dedupe_key: params.dedupeKey,
        },
        select: { id: true, created_at: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        notif = await this.prisma.notification.findFirst({
          where: { user_id: params.userId, dedupe_key: params.dedupeKey },
          select: { id: true, created_at: true },
        });
      } else {
        throw e;
      }
    }
    if (!notif) return;

    // 2) Lấy token FCM gần nhất (is_active = true)
    const tokenRow = await this.prisma.fcmToken.findFirst({
      where: { user_id: params.userId, is_active: true },
      orderBy: { last_seen: 'desc' },
      select: { token: true },
    });
    if (!tokenRow?.token) return;

    // 3) Gửi FCM (best-effort)
    const isTransfer = params.type === NotificationType.TRANSFER_OUT || params.type === NotificationType.TRANSFER_IN;
    
    try {
      await this.firebase.messaging().send({
        token: tokenRow.token,
        notification: { title: params.title, body: params.body },
        data: {
    
          kind: isTransfer ? 'TRANSFER' : 'GENERAL', 
   
          subtype: isTransfer 
            ? (params.type === NotificationType.TRANSFER_OUT ? 'OUT' : 'IN')
            : params.type.toString(), 
            
          notificationId: notif.id,
    
          ...(Object.fromEntries(
            Object.entries(params.data ?? {}).map(([k, v]) => [k, String(v)]),
          )),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Send FCM failed for user=${params.userId}: ${String(err)}`,
      );
    }
  }

  /**
   * Gửi cặp thông báo chuyển khoản:
   */
  async pushTransferPair(transfer: {
    id: string;
    senderUserId: string;
    receiverUserId: string;
    secs: number;
    note?: string | null;
    completedAt: Date;
  }) {
    const amountHms = this.hms(transfer.secs);
    const [senderUser, receiverUser] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id: transfer.senderUserId },
        select: { full_name: true, phone: true },
      }),
      this.prisma.user.findUnique({
        where: { id: transfer.receiverUserId },
        select: { full_name: true, phone: true },
      }),
    ]);
    const [senderWallet, receiverWallet] = await this.prisma.$transaction([
      this.prisma.wallet.findUnique({
        where: { user_id: transfer.senderUserId },
        select: { secs: true },
      }),
      this.prisma.wallet.findUnique({
        where: { user_id: transfer.receiverUserId },
        select: { secs: true },
      }),
    ]);
    const ledgerMemoRow = await this.prisma.ledgerEntry.findFirst({
      where: { ref_type: 'transfer', ref_id: transfer.id, memo: { not: null } },
      select: { memo: true },
      orderBy: { created_at: 'asc' },
    });
    const memo = ledgerMemoRow?.memo ?? transfer.note ?? '';
    const senderName = senderUser?.full_name ?? '';
    const receiverName = receiverUser?.full_name ?? '';
    const senderPhone = senderUser?.phone ?? '';
    const receiverPhone = receiverUser?.phone ?? '';
    const senderPostBalanceSecs = senderWallet?.secs ?? 0;
    const receiverPostBalanceSecs = receiverWallet?.secs ?? 0;
    const senderPostBalanceHms = this.hms(senderPostBalanceSecs);
    const receiverPostBalanceHms = this.hms(receiverPostBalanceSecs);
    await this.createOnceAndPush({
      userId: transfer.senderUserId,
      title: 'Chuyển giờ thành công',
      body: `-${amountHms} cho ${receiverName || 'Người nhận'} • Số dư: ${senderPostBalanceHms}`,
      type: NotificationType.TRANSFER_OUT,
      data: {
        transferId: transfer.id,
        direction: 'OUT',
        secs: transfer.secs,
        amountHms,
        memo,
        counterpartyName: receiverName,
        accountPhone: senderPhone,
        postBalanceSecs: senderPostBalanceSecs,
        postBalanceHms: senderPostBalanceHms,
        createdAt: transfer.completedAt.toISOString(),
      },
      dedupeKey: `transfer:${transfer.id}:OUT`,
    });
    await this.createOnceAndPush({
      userId: transfer.receiverUserId,
      title: 'Nhận giờ thành công',
      body: `+${amountHms} từ ${senderName || 'Người gửi'} • Số dư: ${receiverPostBalanceHms}`,
      type: NotificationType.TRANSFER_IN,
      data: {
        transferId: transfer.id,
        direction: 'IN',
        secs: transfer.secs,
        amountHms,
        memo,
        counterpartyName: senderName,
        accountPhone: receiverPhone,
        postBalanceSecs: receiverPostBalanceSecs,
        postBalanceHms: receiverPostBalanceHms,
        createdAt: transfer.completedAt.toISOString(),
      },
      dedupeKey: `transfer:${transfer.id}:IN`,
    });
  }

  /** Danh sách “Biến động” (transfer in/out) */
  async listActivity(userId: string, cursor?: string, take = 20) {
    return this.prisma.notification.findMany({
      where: {
        user_id: userId,
        type: {
          in: [NotificationType.TRANSFER_OUT, NotificationType.TRANSFER_IN],
        },
      },
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  /** Đánh dấu đã đọc */
  async markRead(userId: string, ids: string[]) {
    // ... (Giữ nguyên logic markRead của bạn)
    if (!ids?.length) return { ok: true };
    await this.prisma.notification.updateMany({
      where: { id: { in: ids }, user_id: userId },
      data: { read: true },
    });
    return { ok: true };
  }


  /** Lưu/ cập nhật token FCM từ client sau đăng nhập */
  async setFcmToken(userId: string, token: string) {
    if (!token) return { ok: true };
    
    await this.prisma.$transaction([
      this.prisma.fcmToken.updateMany({
        where: {
          token: token,             
          user_id: { not: userId } 
        },
        data: { is_active: false }, 
      }),

      this.prisma.fcmToken.upsert({
        where: { user_id_token: { user_id: userId, token } },
        update: { is_active: true, last_seen: new Date() },
        create: { user_id: userId, token, is_active: true },
      }),
    ]);
    return { ok: true };
  }
  

  async deactivateFcmToken(userId: string, token: string) {
    if (!token) return { ok: true };
    await this.prisma.fcmToken.updateMany({
      where: { user_id: userId, token: token },
      data: { is_active: false },
    });
    return { ok: true };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { user_id: userId, read: false },
    });
    return { count };
  }

  async listGeneralNotifications(userId: string, cursor?: string, take = 20) {
    return this.prisma.notification.findMany({
      where: {
        user_id: userId,
        type: {
          notIn: [NotificationType.TRANSFER_OUT, NotificationType.TRANSFER_IN],
        },
      },
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }
}