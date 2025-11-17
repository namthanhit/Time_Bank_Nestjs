import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';

const raw = (process.env.ADMIN_IDS || process.env.ADMIN_ID || '').trim();
const ADMIN_IDS = new Set(
  raw.length === 0 ? [] : raw.split(',').map(s => s.trim()).filter(Boolean),
);

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException('Authentication required');

    const id = String(user.sub ?? user.id ?? '');
    if (ADMIN_IDS.size === 0) {
      // an toàn: chặn khi chưa cấu hình admin
      throw new ForbiddenException('Admin not configured on server');
    }

    if (!ADMIN_IDS.has(id)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}