import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAvailable() {
    const slots = await this.prisma.slot.findMany({
      where: { bookings: { none: { status: 'active' } } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    return slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() }));
  }
}
