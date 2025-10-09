import { IsIn, IsInt, IsOptional, IsISO8601, Min } from "class-validator";

export class LedgerQueryDto {
    @IsOptional()
    @IsIn(['debit', 'credit']) // debit: trừ tiền, credit: cộng tiền
    direction?: 'debit' | 'credit';

    @IsOptional()
    @IsISO8601()
    from?: string;    

    @IsOptional()
    @IsISO8601()
    to?: string;    

    @IsOptional()
    @IsInt()
    @Min(1)
    take?: number = 20;  

    @IsOptional()
    @IsInt()
    @Min(0)
    skip?: number = 0;
}