import { IsIn, IsOptional, IsISO8601} from "class-validator";

export class LedgerQueryDto {
    @IsOptional()
    @IsISO8601()
    from?: string;  

    @IsOptional()
    @IsISO8601()
    to?: string;

    @IsOptional()
    @IsIn(['debit', 'credit'])  //debit la tru vi, credit la cong vi
    type?: 'debit' | 'credit';
}