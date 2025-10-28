import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { add } from 'date-fns';
import { FirebaseService } from 'src/infra/firebase/firebase.service';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';
const JWT_SECRET = process.env.JWT_SECRET!;

const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);

function parseExpiryToDate(ttl: string): Date {
  // Hỗ trợ s/m/h/d, mặc định 15 phút
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  // ------------------- helpers -------------------

  private signAccessToken(user: { id: string; phone: string }) {
    const payload = { sub: user.id, phone: user.phone };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL } as jwt.SignOptions);
  }

  private signRefreshToken(user: { id: string; phone: string }) {
    const payload = { sub: user.id, phone: user.phone, typ: 'refresh' };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL } as jwt.SignOptions);
  }

  private maskDeviceInfo(raw?: string) {
    if (!raw) return undefined;
    return raw.length > 255 ? raw.slice(0, 255) : raw;
  }

  private async issueFirebaseToken(user: { id: string; phone: string }) {
    // UID Firebase = user.id hệ thống để đồng bộ 1-1
    const claims = { phone: user.phone };
    return this.firebase.issueCustomToken(user.id, claims);
  }

  // ------------------- public APIs -------------------

  async login(opts: { phone: string; password: string; ip?: string; deviceInfo?: string }) {
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

    // verify password
    const pwOk = await argon2.verify(user.auth.password, opts.password);
    if (!pwOk) {
      const attempts = (user.auth.failed_attempts || 0) + 1;
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

    // cấp token hệ thống
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

    // cấp Firebase custom token cho client đăng nhập Firebase
    const firebase_token = await this.issueFirebaseToken({ id: user.id, phone: user.phone });

    return {
      user: { id: user.id, phone: user.phone, full_name: user.full_name, status: user.status },
      access_token,
      refresh_token,
      expires_in: ACCESS_TTL,
      firebase_token,
    };
  }

  async refresh(opts: { refresh_token: string; ip?: string; deviceInfo?: string }) {
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
      take: 20,
    });

    // tìm token khớp hash
    let matchedId: bigint | null = null;
    for (const t of tokens) {
      const ok = await argon2.verify(t.token_hash, opts.refresh_token);
      if (ok) {
        matchedId = t.id as unknown as bigint;
        break;
      }
    }
    if (!matchedId) throw new UnauthorizedException('Refresh token not found or revoked');

    // rotate: revoke cái cũ, tạo cái mới
    const { access_token, refresh_token } = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: matchedId! },
        data: { revoked_at: new Date() },
      });

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedException('User not found');

      const new_access = this.signAccessToken({ id: user.id, phone: user.phone });
      const new_refresh = this.signRefreshToken({ id: user.id, phone: user.phone });

      const token_hash = await argon2.hash(new_refresh);
      const expires_at = parseExpiryToDate(REFRESH_TTL);

      await tx.refreshToken.create({
        data: {
          user_id: user.id,
          token_hash,
          device_info: this.maskDeviceInfo(opts.deviceInfo),
          ip: opts.ip,
          expires_at,
        },
      });

      return { access_token: new_access, refresh_token: new_refresh };
    });

    // cấp lại firebase token (optional nhưng nên đồng bộ)
    const firebase_token = await this.issueFirebaseToken({ id: userId, phone: payload.phone });

    return {
      access_token,
      refresh_token,
      expires_in: ACCESS_TTL,
      firebase_token,
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
    // idempotent
    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    // đồng bộ Firebase: revoke tất cả refresh tokens của UID này
    await this.firebase.revokeUserTokens(userId);

    return { success: true };
  }
}
