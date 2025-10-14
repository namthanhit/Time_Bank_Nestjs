import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

const SECRET = process.env.PHONE_TOKEN_SECRET!;
const TTL = Number(process.env.PHONE_TOKEN_TTL_SEC || 600);

type PhoneTokenPayload = { phone: string };

@Injectable()
export class PhoneTokenService {
  sign(phone: string): string {
    const payload: PhoneTokenPayload = { phone };
    return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: TTL });
  }

  verify(token: string): PhoneTokenPayload {
    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as any;
    return { phone: decoded.phone as string };
  }
}
