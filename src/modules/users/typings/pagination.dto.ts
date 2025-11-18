import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
export function ApiProperty(_opts?: any): PropertyDecorator {
  return () => {};
}
export function ApiPropertyOptional(_opts?: any): PropertyDecorator {
  return () => {};
}
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { SortOrder } from 'src/typings/enums/common.enum';

export class PaginationRequestDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'banned'] })
  @IsEnum(['active', 'suspended', 'banned'])
  @IsOptional()
  status?: 'active' | 'suspended' | 'banned';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  type?: string[];
}

export class PaginationResponseDto extends PaginationRequestDto {
  @ApiProperty()
  @IsNumber()
  total: number;
}

@Injectable()
export class PaginationTransformPipe implements PipeTransform {
  async transform(dto: PaginationRequestDto, { metatype }: ArgumentMetadata) {
    if (!metatype) return dto;

    return plainToInstance(metatype, dto);
  }
}
