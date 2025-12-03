import { PartialType } from '@nestjs/mapped-types';
import { CreateShopItemDto } from './create-shop-item.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateShopItemDto extends PartialType(CreateShopItemDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
