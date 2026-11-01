import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import type { LoginRequest } from '@meetcall/shared';

export class LoginDto implements LoginRequest {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password!: string;
}
