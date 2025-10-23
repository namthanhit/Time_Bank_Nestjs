import {BadRequestException,ConflictException,Injectable,Logger} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PhoneTokenService } from 'src/common/crypto/phone-token.service';
import { CreateFromPhoneTokenDto } from '../signup/dtos/signup.dto';
import { Gender, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';
import * as QRCode from 'qrcode';
import { FirebaseService } from 'src/infra/firebase/firebase.service';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneTokens: PhoneTokenService,
    private readonly firebase: FirebaseService, // <-- inject Firebase admin (Storage)
  ) {}

  // -------- PHONE CHECK ----------
  async checkPhoneRaw(phone: string) {
    const exists = !!(await this.prisma.user.findUnique({ where: { phone } }));
    if (exists) return { exists: true as const };
    const phone_token = this.phoneTokens.sign(phone);
    return { exists: false as const, phone_token };
  }

  // -------- UNIQUENESS CHECK ----------
  async checkUnique(email?: string, citizenId?: string) {
    const [emailDup, cccdDup] = await Promise.all([
      email ? this.prisma.user.findUnique({ where: { email } }) : null,
      citizenId
        ? this.prisma.user.findUnique({ where: { citizen_id: citizenId } })
        : null,
    ]);
    return {
      email_taken: !!emailDup,
      citizen_id_taken: !!cccdDup,
    };
  }

  // -------- SIGNUP (from phone_token) ----------
  async createFromPhoneToken(dto: CreateFromPhoneTokenDto) {
    // 1) verify phone token
    let phone = '';
    try {
      const payload = this.phoneTokens.verify(dto.phone_token);
      phone = payload.phone;
    } catch {
      throw new BadRequestException('Invalid or expired phone token');
    }

    // 2) hash secrets
    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: Number(process.env.ARGON2_MEMORY || 65536),
      timeCost: Number(process.env.ARGON2_TIME || 3),
      parallelism: Number(process.env.ARGON2_PARALLELISM || 1),
    });

    // 3) create user (transaction)
    let newUserId = '';
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // phone race-guard
        const existed = await tx.user.findUnique({ where: { phone } });
        if (existed) throw new ConflictException('Phone already in use');

        // uniqueness checks for email/CCCD
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
          if (cccdDup)
            throw new ConflictException('Citizen ID already in use');
        }

        // create user
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
        const birthDate = dto.personal.birth_date
          ? new Date(dto.personal.birth_date)
          : null;

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

        // userSkill (1 skill)
        if (dto.skill_id) {
          const skill = await tx.skill.findUnique({
            where: { id: dto.skill_id },
          });
          if (!skill) throw new BadRequestException('Invalid skill_id');

          await tx.userSkill.create({
            data: { user_id: user.id, skill_id: dto.skill_id },
          });
        }

        return { userId: user.id };
      });

      newUserId = result.userId;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Unique constraint violated');
      }
      throw e;
    }

    // 4) Generate QR (phone) -> upload Firebase Storage -> update user.qr_code
    await this.generateAndUploadQrToFirebase(newUserId, phone);

    return { ok: true, userId: newUserId };
  }

  // -------- Helper: QR -> Firebase Storage ----------
  private async generateAndUploadQrToFirebase(userId: string, phone: string) {
    try {
      // 4.1 generate PNG buffer
      const pngBuffer = await QRCode.toBuffer(phone, {
        type: 'png',
        width: 600,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      // 4.2 upload to Firebase Storage
      const bucket = this.firebase.bucket; // default bucket from env
      const objectPath = `users/${userId}/qr.png`;
      const file = bucket.file(objectPath);

      await file.save(pngBuffer, {
        contentType: 'image/png',
        resumable: false,
        public: false, // dùng signed URL để đọc
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // 4.3 get signed URL (or makePublic then publicUrl)
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 10); // 10 năm
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires,
      });

      // 4.4 update user.qr_code
      await this.prisma.user.update({
        where: { id: userId },
        data: { qr_code: signedUrl },
      });
    } catch (err) {
      this.logger.warn(
        `Upload QR to Firebase failed for user ${userId}: ${String(err)}`,
      );
      // Không chặn signup nếu QR lỗi
    }
  }
}
