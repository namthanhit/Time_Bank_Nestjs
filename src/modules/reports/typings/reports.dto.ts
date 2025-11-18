import { ReportStatus, ReportTarget } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { PaginationRequestDto } from 'src/typings/dtos/pagination.dto';

class ReportAttachmentsDto {
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  image_urls: string[];
}

export class CreateReportDto {
  @IsEnum(ReportTarget)
  @IsNotEmpty()
  target_type: ReportTarget;

  @IsString()
  @IsNotEmpty()
  target_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportAttachmentsDto)
  attachments?: ReportAttachmentsDto;
}

export class GetReportsAdminDto extends PaginationRequestDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTarget)
  target_type?: ReportTarget;

}

export class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  status: ReportStatus; // 'pending' | 'reviewing' | 'resolved' | 'rejected'

  @IsOptional()
  @IsString()
  admin_note?: string;
}
