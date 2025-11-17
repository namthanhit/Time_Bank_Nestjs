import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service'; 
import { PhoneTokenService } from 'src/common/crypto/phone-token.service'; 
import { ResetPasswordDto } from './dtos/forgot-password.dto';
import * as argon2 from 'argon2';

@Injectable()
export class ForgotPasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneTokens: PhoneTokenService,
  ) {}

  async checkPhone(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      throw new NotFoundException('Số điện thoại này chưa được đăng ký.');
    }

    const phone_token = this.phoneTokens.sign(phone);

    return {
      exists: true,
      phone_token,
    };
  }


  async resetPassword(dto: ResetPasswordDto) {
    let phone = '';

    try {
      const payload = this.phoneTokens.verify(dto.phone_token);
      phone = payload.phone;
    } catch (error) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn.');
    }

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await argon2.hash(dto.new_password, {
      type: argon2.argon2id,
      memoryCost: Number(process.env.ARGON2_MEMORY || 65536),
      timeCost: Number(process.env.ARGON2_TIME || 3),
      parallelism: Number(process.env.ARGON2_PARALLELISM || 1),
    });

    await this.prisma.auth.update({
      where: { user_id: user.id },
      data: {
        password: passwordHash,
        password_changed_at: new Date(),
      },
    });

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }
}