import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(8, 32) // tuỳ DB bạn lưu, ở đây đặt sample
  phone!: string;

  @IsString()
  @Length(6, 100)
  password!: string;

  // tùy chọn: client có thể gửi rõ device_name, còn không sẽ dùng User-Agent
  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class LoginAdminDto {
  @IsString()
  fullname!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  ip?: string;
}
