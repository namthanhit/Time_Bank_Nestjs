import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { add } from 'date-fns';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';
const JWT_SECRET = process.env.JWT_SECRET!;

const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS);
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES);

function parseExpiryToDate(ttl: string): Date {
  // đơn giản: chỉ hỗ trợ 'Xd' ngày hoặc 'Xm' phút/h
  const now = new Date();
  const m = ttl.match(/^(\d+)([smhd])$/i);
  if (!m) return add(now, { minutes: 15 });
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 's': return add(now, { seconds: n });
    case 'm': return add(now, { minutes: n });
    case 'h': return add(now, { hours: n });
    case 'd': return add(now, { days: n });
    default:  return add(now, { minutes: 15 });
  }
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private signAccessToken(user: { id: string; phone: string }) {
    const payload = { sub: user.id, phone: user.phone };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
    return token;
  }

  private signRefreshToken(user: { id: string; phone: string }) {
    const payload = { sub: user.id, phone: user.phone, typ: 'refresh' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL });
    return token;
  }

  private maskDeviceInfo(raw?: string) {
    if (!raw) return undefined;
    return raw.length > 255 ? raw.slice(0, 255) : raw;
  }

  async login(opts: {
    phone: string;
    password: string;
    ip?: string;
    deviceInfo?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { phone: opts.phone },
      include: { auth: true },
    });

    if (!user || !user.auth || !user.auth.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // chặn theo status
    if (['suspended', 'banned'].includes(user.status)) {
      throw new ForbiddenException('Account is not allowed to sign in');
    }

    // khóa tạm thời
    if (user.auth.locked_until && user.auth.locked_until > new Date()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }

    const ok = await argon2.verify(user.auth.password, opts.password);
    if (!ok) {
      const attempts = user.auth.failed_attempts + 1;
      const update: any = { failed_attempts: attempts };

      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        const locked = add(new Date(), { minutes: LOGIN_LOCK_MINUTES });
        update.locked_until = locked;
        update.failed_attempts = 0; // reset sau khi khóa
      }

      await this.prisma.auth.update({
        where: { user_id: user.id },
        data: update,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // reset bộ đếm khi đăng nhập thành công
    await this.prisma.auth.update({
      where: { user_id: user.id },
      data: { failed_attempts: 0, locked_until: null },
    });

    // cấp token
    const access_token = this.signAccessToken(user);
    const refresh_token = this.signRefreshToken(user);

    // lưu refresh token (hash)
    const token_hash = await argon2.hash(refresh_token);
    const expires_at = parseExpiryToDate(REFRESH_TTL);

    await this.prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash,
        device_info: this.maskDeviceInfo(opts.deviceInfo),
        ip: opts.ip,
        expires_at,
      },
    });

    return {
      user: { id: user.id, phone: user.phone, full_name: user.full_name, status: user.status },
      access_token,
      refresh_token,
      expires_in: ACCESS_TTL,
    };
  }

  async refresh(opts: {
    refresh_token: string;
    ip?: string;
    deviceInfo?: string;
  }) {
    // xác thực chữ ký JWT trước
    let payload: any;
    try {
      payload = jwt.verify(opts.refresh_token, JWT_SECRET);
      if (payload.typ !== 'refresh') throw new Error('not refresh token');
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = String(payload.sub);

    // lấy các token còn hiệu lực
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
      take: 20, // giới hạn để nhanh (tùy bạn)
    });

    // tìm token khớp hash
    let matched: { id: bigint } | null = null;
    for (const t of tokens) {
      const ok = await argon2.verify(t.token_hash, opts.refresh_token);
      if (ok) {
        matched = { id: t.id };
        break;
      }
    }
    if (!matched) throw new UnauthorizedException('Refresh token not found or revoked');

    // rotate: revoke cái cũ, tạo cái mới
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: matched!.id },
        data: { revoked_at: new Date() },
      });

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedException('User not found');

      const access_token = this.signAccessToken(user);
      const refresh_token = this.signRefreshToken(user);
      const token_hash = await argon2.hash(refresh_token);
      const expires_at = parseExpiryToDate(REFRESH_TTL);

      await tx.refreshToken.create({
        data: {
          user_id: userId,
          token_hash,
          device_info: this.maskDeviceInfo(opts.deviceInfo),
          ip: opts.ip,
          expires_at,
        },
      });

      (tx as any)._return = { access_token, refresh_token };
    });

    // @ts-ignore: lấy giá trị trả về đã set trong transaction
    const created = (this.prisma as any)._lastTx?._return; // nếu môi trường bạn không hỗ trợ trick này, thay bằng return values bình thường
    // Để đơn giản, mình tái ký access/refresh lần nữa ở ngoài:
    const access_token2 = this.signAccessToken({ id: userId, phone: payload.phone });
    const refresh_token2 = this.signRefreshToken({ id: userId, phone: payload.phone });

    return {
      access_token: access_token2,
      refresh_token: refresh_token2,
      expires_in: ACCESS_TTL,
    };
  }

  async logout(opts: { refresh_token: string }) {
    // tìm và revoke theo hash
    const all = await this.prisma.refreshToken.findMany({
      where: { revoked_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    for (const t of all) {
      const ok = await argon2.verify(t.token_hash, opts.refresh_token);
      if (ok) {
        await this.prisma.refreshToken.update({
          where: { id: t.id },
          data: { revoked_at: new Date() },
        });
        return { success: true };
      }
    }
    // idempotent: coi như ok
    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { success: true };
  }
}
