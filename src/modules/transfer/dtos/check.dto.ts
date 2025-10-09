import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
export class CheckDto {
    @IsString() @IsNotEmpty()
    to_phone!: string;

    @IsInt() @Min(1)
    secs!: number;
}
