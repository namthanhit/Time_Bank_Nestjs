import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CheckPhoneForgotDto {
  @IsNotEmpty()
  @IsString()
  phone: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  phone_token: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  new_password: string;
}