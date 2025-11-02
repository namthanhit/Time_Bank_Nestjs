import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsArray, ValidateNested, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRatingImageInlineDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class CreateRatingDto {
  @IsString()
  @IsNotEmpty()
  booking_id!: string;

  // ratee là người nhận đánh giá (không phải bạn)
  @IsString()
  @IsNotEmpty()
  ratee_id!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  // Cho phép tạo ảnh inline cùng lúc tạo rating (tuỳ chọn)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRatingImageInlineDto)
  images?: CreateRatingImageInlineDto[];
}
