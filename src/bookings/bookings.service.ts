import { Injectable } from '@nestjs/common';
import { Booking, Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { CreateBookingInput } from '../common/validation';
import { SlotEventsGateway } from '../events/slot-events.gateway';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: SlotEventsGateway,
  ) {}

  async create(input: CreateBookingInput) {
    const slot = await this.prisma.slot.findUnique({ where: { id: input.slotId }, select: { id: true } });
    if (!slot) throw new ApiError(404, 'SLOT_NOT_FOUND', 'Slot not found.');

    let booking: Booking;
    try {
      booking = await this.prisma.booking.create({ data: { ...input, status: 'active' } });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ApiError(409, 'SLOT_UNAVAILABLE', 'This slot already has an active booking.');
      }
      throw err;
    }

    this.events.slotBooked(booking.slotId, booking.id);
    return toDto(booking);
  }

  async cancel(bookingId: string) {
    const existing = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    if (existing.status === 'cancelled') return toDto(existing);

    const { count } = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'active' },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    if (count === 1) this.events.slotReleased(booking.slotId, booking.id);
    return toDto(booking);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function toDto(b: Booking) {
  return {
    id: b.id,
    slotId: b.slotId,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    status: b.status,
  };
}
