import { Transform } from 'class-transformer';
import { IsEmail, IsISO8601, IsNotEmpty, IsString, MinLength } from 'class-validator';
import type { RegisterRequest } from '@meetcall/shared';

export class RegisterDto implements RegisterRequest {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @IsString()
  @MinLength(10, { message: 'Mật khẩu phải có tối thiểu 10 ký tự' })
  password!: string;

  @IsNotEmpty({ message: 'Ngày sinh không được để trống' })
  @IsISO8601({ strict: true }, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  birthdate!: string;
}
