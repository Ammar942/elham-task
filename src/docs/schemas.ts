import { ApiProperty } from '@nestjs/swagger';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from '../common/validation';

const SLOT_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';

export class SlotDto {
  @ApiProperty({ format: 'uuid', example: SLOT_ID })
  id: string;

  @ApiProperty({ format: 'date-time', example: '2030-01-15T09:00:00.000Z', description: 'ISO 8601, UTC' })
  startsAt: string;

  @ApiProperty({ format: 'date-time', example: '2030-01-15T09:30:00.000Z', description: 'ISO 8601, UTC, always after startsAt' })
  endsAt: string;
}

export class SlotListResponse {
  @ApiProperty({ type: [SlotDto], description: 'Available slots only, sorted by startsAt then id (ascending). Empty array when none.' })
  slots: SlotDto[];
}

export class CreateBookingRequest {
  @ApiProperty({ format: 'uuid', example: SLOT_ID })
  slotId: string;

  @ApiProperty({
    example: 'Alex Morgan',
    minLength: 1,
    maxLength: NAME_MAX_LENGTH,
    description: 'Leading/trailing whitespace is trimmed before validation and storage. Must not be empty after trimming.',
  })
  customerName: string;

  @ApiProperty({
    format: 'email',
    example: 'alex@example.com',
    maxLength: EMAIL_MAX_LENGTH,
    description: 'Leading/trailing whitespace is trimmed before validation and storage.',
  })
  customerEmail: string;
}

export class BookingDto {
  @ApiProperty({ format: 'uuid', example: BOOKING_ID })
  id: string;

  @ApiProperty({ format: 'uuid', example: SLOT_ID })
  slotId: string;

  @ApiProperty({ example: 'Alex Morgan' })
  customerName: string;

  @ApiProperty({ format: 'email', example: 'alex@example.com' })
  customerEmail: string;

  @ApiProperty({ enum: ['active', 'cancelled'], example: 'active' })
  status: 'active' | 'cancelled';
}

export class BookingResponse {
  @ApiProperty({ type: BookingDto })
  booking: BookingDto;
}

export class ErrorBody {
  @ApiProperty({
    enum: ['VALIDATION_ERROR', 'SLOT_NOT_FOUND', 'SLOT_UNAVAILABLE', 'BOOKING_NOT_FOUND', 'INTERNAL_ERROR'],
    example: 'SLOT_UNAVAILABLE',
  })
  code: string;

  @ApiProperty({ example: 'This slot already has an active booking.' })
  message: string;
}

export class ErrorResponse {
  @ApiProperty({ type: ErrorBody })
  error: ErrorBody;
}

export const errorExample = (code: string, message: string) => ({
  schema: { $ref: '#/components/schemas/ErrorResponse' },
  example: { error: { code, message } },
});
