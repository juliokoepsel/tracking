import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../common/enums';

export class AddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street: string;

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

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode: string;
}

export class VehicleInfoDto {
  @IsString()
  type: string;

  @IsString()
  licensePlate: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fullName: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleInfoDto)
  vehicleInfo?: VehicleInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  /**
   * Company identifier for multi-tenant affiliation
   * Embedded in Fabric CA certificate for chaincode access control
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyId?: string;

  /**
   * Human-readable company name
   * Embedded in Fabric CA certificate for display purposes
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;
}
