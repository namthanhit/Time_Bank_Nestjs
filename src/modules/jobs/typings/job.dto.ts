import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { JobVisibility } from './job.enum';
import { Type } from 'class-transformer';
import { TransferToEscrowDto } from 'src/modules/transfer/dtos/create-transfer.dto';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @IsString()
  @IsNotEmpty({ message: 'Region code is required' })
  region_code: string;

  @IsString()
  @IsNotEmpty({ message: 'Place is required' })
  place: string;

  @IsString()
  @IsNotEmpty({ message: 'Preferred start time is required' })
  preferred_start_time: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Time is required' })
  time: number;

  @IsNumber()
  @IsNotEmpty({ message: 'Slot is required' })
  slot: number;

  @IsString()
  @IsNotEmpty({ message: 'Visibility is required' })
  visibility: JobVisibility;

  @IsArray()
  @IsNotEmpty({ message: 'Skills are required' })
  @IsString({ each: true })
  skills: string[];

  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true, message: 'Mỗi URL trong imageUrls phải hợp lệ' })
  @IsOptional()
  imageUrls?: string[];
}

export class UpdateJobDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  region_code?: string;

  @IsString()
  @IsOptional()
  place?: string;

  @IsString()
  @IsOptional()
  preferred_start_time?: string;

  @IsNumber()
  @IsOptional()
  time?: number;

  @IsNumber()
  @IsOptional()
  slot?: number;

  @IsString()
  @IsOptional()
  visibility?: JobVisibility;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @IsArray()
  @IsString({ each: true })
  //@IsUrl({}, { each: true, message: 'URL không hợp lệ' })
  @IsOptional()
  imageUrls?: string[];
}

export class ConfirmUpdateJobDto {
  @ValidateNested()
  @Type(() => UpdateJobDto)
  updateJobDto: UpdateJobDto;

  @ValidateNested()
  @Type(() => TransferToEscrowDto)
  transferToEscrowDto: TransferToEscrowDto;
}
