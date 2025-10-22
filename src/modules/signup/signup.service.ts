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

  async checkUnique(email?: string, citizenId?: string) {
    const [emailDup, cccdDup] = await Promise.all([
      email ? this.prisma.user.findUnique({ where: { email } }) : null,
      citizenId ? this.prisma.user.findUnique({ where: { citizen_id: citizenId } }) : null,
    ]);
    return {
      email_taken: !!emailDup,
      citizen_id_taken: !!cccdDup,
    };
  }

  async createFromPhoneToken(dto: CreateFromPhoneTokenDto) {
    // 1) verify phone token
    let phone = '';
    try {
      const payload = this.phoneTokens.verify(dto.phone_token);
      phone = payload.phone;
    } catch {
      throw new BadRequestException('Invalid or expired phone token');
    }

    // 2) hash
    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: Number(process.env.ARGON2_MEMORY || 65536),
      timeCost: Number(process.env.ARGON2_TIME || 3),
      parallelism: Number(process.env.ARGON2_PARALLELISM || 1),
    });

    // 3) tạo user trong transaction
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // phone đã check trước, nhưng chặn race condition
        const existed = await tx.user.findUnique({ where: { phone } });
        if (existed) throw new ConflictException('Phone already in use');

        //check trùng email/CCCD trước khi create (trả lỗi rõ ràng)
        if (dto.personal.email) {
          const emailDup = await tx.user.findUnique({
            where: { email: dto.personal.email },
          });
          if (emailDup) throw new ConflictException('Email already in use');
        }
        if (dto.personal.citizen_id) {
          const cccdDup = await tx.user.findUnique({
            where: { citizen_id: dto.personal.citizen_id },
          });
          if (cccdDup) throw new ConflictException('Citizen ID already in use');
        }

        // tạo user
        const user = await tx.user.create({
          data: {
            phone,
            full_name: dto.personal.full_name,
            email: dto.personal.email ?? null,
            citizen_id: dto.personal.citizen_id ?? null,
            status: UserStatus.active,
          },
          select: { id: true },
        });

        // user_details
        const gender = dto.personal.gender ?? Gender.unknown;
        const birthDate = dto.personal.birth_date ? new Date(dto.personal.birth_date) : null;

        await tx.userDetail.create({
          data: {
            user_id: user.id,
            birth_date: birthDate,
            gender,
            region_id: dto.personal.region_id ?? null,
            description: dto.personal.specialization_or_description ?? null,
          },
        });

        // auth
        await tx.auth.create({
          data: {
            user_id: user.id,
            pin: pinHash,
            pin_set_at: new Date(),
            password: passwordHash,
            password_changed_at: new Date(),
          },
        });

        // wallet
        await tx.wallet.create({
          data: { user_id: user.id, secs: 0 },
        });

        // ghi UserSkill (1 skill từ dropdown)
        if (dto.skill_id) {
          // validate skill tồn tại
          const skill = await tx.skill.findUnique({ where: { id: dto.skill_id } });
          if (!skill) throw new BadRequestException('Invalid skill_id');

          await tx.userSkill.create({
            data: { user_id: user.id, skill_id: dto.skill_id },
          });
        }

        return { userId: user.id };
      });

      return { ok: true, ...result };
    } catch (e: any) {
      // Prisma unique constraint fallback
      if (e.code === 'P2002') {
        // có thể đọc e.meta.target để biết field nào vi phạm
        throw new ConflictException('Unique constraint violated');
      }
      throw e;
    }
  }
}
