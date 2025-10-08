import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class FakeAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const raw = req.header('X-User-Id') || req.header('x-user-id');
    if (!raw) throw new UnauthorizedException('Missing X-User-Id header');
    // Với String id, không ép kiểu số nữa
    (req as any).user = { userId: String(raw) };
    next();
  }
}