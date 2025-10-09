import { IsString, IsNotEmpty } from 'class-validator';

export class LookupDto {
    @IsString()
    @IsNotEmpty()
    phone!: string;
}