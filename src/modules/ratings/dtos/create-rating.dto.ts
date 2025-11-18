import { IsNotEmpty, IsString, IsInt, Min, Max, IsOptional, IsUUID, IsArray } from 'class-validator';

export class CreateRatingDto {
  @IsString()
  @IsNotEmpty()
  booking_id: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  image_urls?: string[];
}