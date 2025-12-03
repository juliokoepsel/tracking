import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateLocationDto {
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
