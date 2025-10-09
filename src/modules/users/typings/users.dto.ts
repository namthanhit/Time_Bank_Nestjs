import { IsOptional, IsString, IsArray, IsDateString } from 'class-validator';

export class UpdateUserDto {
    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    email?: string;
    
    @IsOptional()
    @IsDateString()
    birth_date?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    work_address?: string;

    @IsString()
    @IsOptional()
    study_address?: string;

    @IsString()
    @IsOptional()
    social_network?: string;
}
