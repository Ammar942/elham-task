import { Module } from '@nestjs/common';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsService } from './bookings/bookings.service';
import { SlotEventsGateway } from './events/slot-events.gateway';
import { PrismaService } from './prisma/prisma.service';
import { SlotsController } from './slots/slots.controller';
import { SlotsService } from './slots/slots.service';

@Module({
  controllers: [SlotsController, BookingsController],
  providers: [PrismaService, SlotsService, BookingsService, SlotEventsGateway],
})
export class AppModule {}
