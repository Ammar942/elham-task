import { ApiError } from './api-error';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_MAX_LENGTH = 200;
export const EMAIL_MAX_LENGTH = 254;

export function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw ApiError.validation(`${field} must be a valid UUID.`);
  }
  return value.toLowerCase();
}

export interface CreateBookingInput {
  slotId: string;
  customerName: string;
  customerEmail: string;
}

export function parseCreateBooking(body: unknown): CreateBookingInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw ApiError.validation('Request body must be a JSON object.');
  }
  const { slotId, customerName, customerEmail } = body as Record<string, unknown>;

  const id = assertUuid(slotId, 'slotId');

  if (typeof customerName !== 'string' || customerName.trim() === '') {
    throw ApiError.validation('customerName is required and must be a non-empty string.');
  }
  const name = customerName.trim();
  if (name.length > NAME_MAX_LENGTH) {
    throw ApiError.validation(`customerName must be at most ${NAME_MAX_LENGTH} characters.`);
  }

  if (typeof customerEmail !== 'string') {
    throw ApiError.validation('customerEmail is required and must be a string.');
  }
  const email = customerEmail.trim();
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) {
    throw ApiError.validation('customerEmail must be a valid email address.');
  }

  return { slotId: id, customerName: name, customerEmail: email };
}
