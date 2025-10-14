import {
  IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString,
  Length, MaxLength, MinLength, ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '@prisma/client';

export class SignupPersonalDto {
  @IsString() @MaxLength(150)
  full_name!: string;

  @IsOptional() @IsString() @MaxLength(64)
  citizen_id?: string;

  @IsOptional() @IsString() @MaxLength(320)
  email?: string;

  @IsOptional() @IsDateString()
  birth_date?: string;

  @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @IsOptional() @IsString() @MaxLength(512)
  specialization_or_description?: string; // map vào UserDetail.description
}

export class CreateFromPhoneTokenDto {
  @IsString() @IsNotEmpty()
  phone_token!: string;

  @ValidateNested() @Type(() => SignupPersonalDto)
  personal!: SignupPersonalDto;

  @IsString() @Length(4, 6)
  pin!: string;

  @IsString() @MinLength(8)
  password!: string;
}
