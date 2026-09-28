export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (msg = 'Oturum açmanız gerekiyor.') =>
  new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Bu işlem için yetkiniz yok.') =>
  new AppError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Kayıt bulunamadı.') => new AppError(404, 'NOT_FOUND', msg);
export const badRequest = (msg: string, code = 'VALIDATION') => new AppError(400, code, msg);
export const conflict = (msg: string) => new AppError(409, 'CONFLICT', msg);
