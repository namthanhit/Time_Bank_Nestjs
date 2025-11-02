import { IsArray, IsOptional, IsString, IsInt, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddRatingImageItemDto {
  // Cho phép: truyền image_id (đã có) HOẶC tạo mới bằng url (+alt_text)
  @IsOptional()
  @IsString()
  image_id?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

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

export class AddRatingImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddRatingImageItemDto)
  items!: AddRatingImageItemDto[];
}
