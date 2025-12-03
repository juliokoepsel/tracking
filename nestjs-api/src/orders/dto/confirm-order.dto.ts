import { IsString, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';

export class ConfirmOrderDto {
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  packageWeight: number; // in kg

  @IsNumber()
  @Min(1)
  @Max(500)
  packageLength: number; // in cm

  @IsNumber()
  @Min(1)
  @Max(500)
  packageWidth: number; // in cm

  @IsNumber()
  @Min(1)
  @Max(500)
  packageHeight: number; // in cm

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
}
