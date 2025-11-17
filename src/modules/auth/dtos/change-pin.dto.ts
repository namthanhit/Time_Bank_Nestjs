import { IsOptional, IsString, Matches } from 'class-validator';

const PIN_REGEX = /^\d{6}$/;

export class ChangePinDto {
  @IsOptional()
  @IsString()
  @Matches(PIN_REGEX, { message: 'PIN phải gồm 6 chữ số' })
  current_pin?: string; 

  @IsString()
  @Matches(PIN_REGEX, { message: 'PIN phải gồm 6 chữ số' })
  new_pin!: string;
}
