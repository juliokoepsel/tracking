import { IsString, IsInt, Min, MinLength, MaxLength } from 'class-validator';

export class CreateShopItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @IsInt()
  @Min(1)
  priceInCents: number;
}
