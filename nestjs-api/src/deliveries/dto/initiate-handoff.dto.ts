import { IsString, IsEnum, MinLength } from 'class-validator';
import { UserRole } from '../../common/enums';

export class InitiateHandoffDto {
  @IsString()
  @MinLength(1)
  toUserId: string;

  @IsEnum(UserRole)
  toRole: UserRole;
}
