import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import type { ForgotPasswordRequest, ResetPasswordRequest } from '@meetcall/shared';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;
}

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @IsNotEmpty({ message: 'Token đặt lại mật khẩu không được để trống' })
  token!: string;

  @IsString()
  @MinLength(10, { message: 'Mật khẩu mới phải có tối thiểu 10 ký tự' })
  newPassword!: string;
}
