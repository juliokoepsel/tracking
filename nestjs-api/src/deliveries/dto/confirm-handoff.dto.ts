import { IsString, IsNumber, Min, Max, MinLength, MaxLength, IsOptional } from 'class-validator';

export class ConfirmHandoffDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  country: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  packageWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  packageLength?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  packageWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  packageHeight?: number;
}
