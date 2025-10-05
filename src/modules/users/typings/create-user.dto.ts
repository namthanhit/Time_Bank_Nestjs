import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsString()
  full_name: string;

  @IsString()
  citizen_id: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  qr_code?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;
}
