import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateEscrowDto {
    @IsNotEmpty()
    @IsString()
    jobId: string;

    @IsNotEmpty()
    @IsNumber()
    secs: number;
}