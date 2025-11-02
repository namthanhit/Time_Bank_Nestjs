import { IsOptional, IsInt, IsString } from 'class-validator';

export class UpdateRatingImageDto {
  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsString()
  caption?: string;
}
