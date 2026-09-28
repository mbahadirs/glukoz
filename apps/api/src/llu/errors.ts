export type LluErrorCode =
  | 'LLU_BAD_CREDENTIALS'
  | 'LLU_ACTION_REQUIRED'
  | 'LLU_VERSION_TOO_OLD'
  | 'LLU_RATE_LIMITED'
  | 'LLU_UNAUTHORIZED'
  | 'LLU_NETWORK'
  | 'LLU_BAD_RESPONSE'
  | 'LLU_HTTP';

/** LibreLinkUp hataları — tipli, sınıflandırılmış. Mesajlar kimlik bilgisi içermez. */
export class LluError extends Error {
  constructor(
    public readonly code: LluErrorCode,
    message: string,
    public readonly details: {
      httpStatus?: number;
      minimumVersion?: string;
      step?: string;
      retryAfterSec?: number;
    } = {},
  ) {
    super(message);
    this.name = 'LluError';
  }

  /** Aynı döngüde tekrar denenmemesi gereken hatalar. */
  get isFatalForAccount(): boolean {
    return this.code === 'LLU_BAD_CREDENTIALS' || this.code === 'LLU_ACTION_REQUIRED';
  }
}
