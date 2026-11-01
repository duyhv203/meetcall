import type { ApiErrorPayload } from '@meetcall/shared';

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = (error as ApiErrorPayload).error;
    switch (apiError.code) {
      case 'UNDER_AGE':
        return 'Bạn phải đủ 18 tuổi trở lên để sử dụng MeetCall.';
      case 'EMAIL_TAKEN':
        return 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.';
      case 'INVALID_CREDENTIALS':
        return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
      case 'ACCOUNT_SUSPENDED':
        return 'Tài khoản của bạn hiện đang bị tạm khóa.';
      case 'TOO_MANY_ATTEMPTS':
        return 'Bạn đã thử sai quá 10 lần. Vui lòng đợi 15 phút trước khi thử lại.';
      case 'INVALID_TOKEN':
        return 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
      case 'TOKEN_EXPIRED':
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 'UNAUTHORIZED':
        return 'Bạn cần đăng nhập để tiếp tục.';
      default:
        return apiError.message || 'Đã xảy ra lỗi, vui lòng thử lại sau.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Đã xảy ra lỗi không xác định.';
}
