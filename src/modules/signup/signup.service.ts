import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PhoneTokenService } from 'src/common/crypto/phone-token.service';
import { CreateFromPhoneTokenDto } from '../signup/dtos/signup.dto';
import { Gender, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneTokens: PhoneTokenService,
  ) {}


  async checkPhoneRaw(phone: string) {
    const exists = !!(await this.prisma.user.findUnique({ where: { phone } }));
    if (exists) return { exists: true as const };
    const phone_token = this.phoneTokens.sign(phone);
    return { exists: false as const, phone_token };
  }

  async createFromPhoneToken(dto: CreateFromPhoneTokenDto) {
    let phone = '';
    try {
      const payload = this.phoneTokens.verify(dto.phone_token);
      phone = payload.phone;
    } catch {
      throw new BadRequestException('Invalid or expired phone token');
    }

    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: Number(process.env.ARGON2_MEMORY || 65536),
      timeCost: Number(process.env.ARGON2_TIME || 3),
      parallelism: Number(process.env.ARGON2_PARALLELISM || 1),
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Nếu ai đó vừa tạo trước mặt → fail
        const existed = await tx.user.findUnique({ where: { phone } });
        if (existed) throw new ConflictException('Phone already in use');

        const user = await tx.user.create({
          data: {
            phone,
            full_name: dto.personal.full_name,
            email: dto.personal.email ?? null,
            citizen_id: dto.personal.citizen_id ?? null,
            status: UserStatus.active,           // kích hoạt luôn theo yêu cầu
          },
          select: { id: true },
        });

        const gender = dto.personal.gender ?? Gender.unknown;
        const birthDate = dto.personal.birth_date ? new Date(dto.personal.birth_date) : null;

        await tx.userDetail.create({
          data: {
            user_id: user.id,
            birth_date: birthDate,
            gender,
            address: dto.personal.address ?? null,
            description: dto.personal.specialization_or_description ?? null,
          },
        });

        await tx.auth.create({
          data: {
            user_id: user.id,
            pin: pinHash,
            pin_set_at: new Date(),
            password: passwordHash,
            password_changed_at: new Date(),
          },
        });

        await tx.wallet.create({
          data: { user_id: user.id, secs: 0 },
        });

        return { userId: user.id };
      });

      return { ok: true, ...result };
    } catch (e: any) {
      // Prisma unique constraint (email/citizen_id/phone)
      if (e.code === 'P2002') {
        throw new ConflictException('Unique constraint violated');
      }
      throw e;
    }
  }
}
