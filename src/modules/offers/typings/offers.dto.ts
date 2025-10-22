import { OfferStatus } from "@prisma/client";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class OfferDto {
    @IsString()
    @IsNotEmpty()
    job_id: string;

    @IsString()
    @IsOptional()
    note?: string;
}

export class UpdateOfferDto{
    @IsString()
    @IsNotEmpty()
    status: OfferStatus;
}
