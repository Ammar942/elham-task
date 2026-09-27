export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'SLOT_NOT_FOUND'
  | 'SLOT_UNAVAILABLE'
  | 'BOOKING_NOT_FOUND'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }

  static validation(message: string) {
    return new ApiError(400, 'VALIDATION_ERROR', message);
  }
}
