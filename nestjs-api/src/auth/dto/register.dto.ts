import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional, IsObject, ValidateNested } from 'class-validator';
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

  // Company/Affiliation fields for flexible identity model
  @IsString()
  @IsOptional()
  @MaxLength(100)
  companyId?: string; // UUID or identifier for the company

  @IsString()
  @IsOptional()
  @MaxLength(100)
  companyName?: string; // Human-readable company name (e.g., "FedEx", "Amazon")

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
