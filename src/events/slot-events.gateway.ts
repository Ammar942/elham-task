import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface SlotEvent {
  slotId: string;
  bookingId: string;
  available: boolean;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SlotEventsGateway {
  @WebSocketServer()
  server: Server;

  slotBooked(slotId: string, bookingId: string) {
    this.emit('slot.booked', { slotId, bookingId, available: false });
  }

  slotReleased(slotId: string, bookingId: string) {
    this.emit('slot.released', { slotId, bookingId, available: true });
  }

  private emit(event: string, payload: SlotEvent) {
    this.server?.emit(event, payload);
  }
}
