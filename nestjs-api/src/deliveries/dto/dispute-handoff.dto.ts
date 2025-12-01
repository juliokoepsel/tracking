import { IsString, MinLength, MaxLength } from 'class-validator';

export class DisputeHandoffDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
