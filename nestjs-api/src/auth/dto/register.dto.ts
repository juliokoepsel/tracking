import { IsEmail, IsString, MinLength, IsEnum, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../common/enums';

export class AddressInfoDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;

  @IsString()
  postalCode: string;
}

export class VehicleInfoDto {
  @IsString()
  type: string;

  @IsString()
  licensePlate: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressInfoDto)
  @IsOptional()
  address?: AddressInfoDto;

  @IsObject()
  @ValidateNested()
  @Type(() => VehicleInfoDto)
  @IsOptional()
  vehicleInfo?: VehicleInfoDto;
}
