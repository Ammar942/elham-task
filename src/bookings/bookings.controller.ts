import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { assertUuid, parseCreateBooking } from '../common/validation';
import { BookingResponse, CreateBookingRequest, errorExample } from '../docs/schemas';
import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Book a slot',
    description:
      'Creates an active booking for an available slot. Each slot accepts only one active booking: ' +
      'when two valid requests race for the same slot, exactly one gets 201 and the other gets 409, ' +
      'regardless of customer data. Emits the Socket.IO event slot.booked after commit.',
  })
  @ApiBody({ type: CreateBookingRequest })
  @ApiCreatedResponse({ type: BookingResponse })
  @ApiBadRequestResponse({
    description: 'VALIDATION_ERROR: missing/invalid fields or malformed JSON',
    content: { 'application/json': errorExample('VALIDATION_ERROR', 'customerEmail must be a valid email address.') },
  })
  @ApiNotFoundResponse({
    description: 'SLOT_NOT_FOUND: slotId is a valid UUID but no such slot exists',
    content: { 'application/json': errorExample('SLOT_NOT_FOUND', 'Slot not found.') },
  })
  @ApiConflictResponse({
    description: 'SLOT_UNAVAILABLE: the slot already has an active booking',
    content: { 'application/json': errorExample('SLOT_UNAVAILABLE', 'This slot already has an active booking.') },
  })
  @ApiInternalServerErrorResponse({
    description: 'INTERNAL_ERROR',
    content: { 'application/json': errorExample('INTERNAL_ERROR', 'An unexpected error occurred.') },
  })
  async create(@Body() body: unknown) {
    return { booking: await this.bookings.create(parseCreateBooking(body)) };
  }

  @Delete(':bookingId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel a booking',
    description:
      'Sets an active booking to cancelled and makes its slot available again (emits slot.released). ' +
      'Cancelling an already cancelled booking is idempotent: returns 200 with the unchanged booking and emits no event. ' +
      'Cancelling an old cancelled booking never affects a newer active booking on the same slot. No request body.',
  })
  @ApiParam({
    name: 'bookingId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    example: '22222222-2222-4222-8222-222222222222',
  })
  @ApiOkResponse({ type: BookingResponse, description: 'Booking with status cancelled' })
  @ApiBadRequestResponse({
    description: 'VALIDATION_ERROR: bookingId is not a valid UUID',
    content: { 'application/json': errorExample('VALIDATION_ERROR', 'bookingId must be a valid UUID.') },
  })
  @ApiNotFoundResponse({
    description: 'BOOKING_NOT_FOUND: valid UUID but no such booking',
    content: { 'application/json': errorExample('BOOKING_NOT_FOUND', 'Booking not found.') },
  })
  @ApiInternalServerErrorResponse({
    description: 'INTERNAL_ERROR',
    content: { 'application/json': errorExample('INTERNAL_ERROR', 'An unexpected error occurred.') },
  })
  async cancel(@Param('bookingId') bookingId: string) {
    return { booking: await this.bookings.cancel(assertUuid(bookingId, 'bookingId')) };
  }
}
