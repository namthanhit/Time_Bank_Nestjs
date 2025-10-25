import { IsString, IsNotEmpty, IsInt, Min, Matches, Length, IsOptional, MaxLength } from 'class-validator';

export class CreateTransferDto {
    @IsString()
    @IsNotEmpty()
    to_phone!: string; // SĐT người nhận (chính là số tài khoản)

    @IsInt()
    @Min(1)
    secs!: number;     // số giây chuyển (gợi ý UI nhập giờ:phút -> quy ra giây)

    @IsOptional()
    @IsString()
    @MaxLength(200)
    note?: string;

    // PIN 6 số (obscured trên UI)
    @IsString()
    @Length(6, 6)
    @Matches(/^\d{6}$/)
    pin!: string;
}

export class TransferToEscrowDto {
    @IsString()
    @IsNotEmpty()
    jobId: string;

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    secs: number;

    @IsString()
    @IsNotEmpty()
    @Length(6, 6)
    @Matches(/^\d{6}$/)
    pin: string;
}