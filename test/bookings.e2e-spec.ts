import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { seedSlots } from '../prisma/seed';
import { SEED_SLOTS } from '../prisma/slots.data';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const SLOT_ID = SEED_SLOTS[0].id;
const customer = (n: number) => ({ customerName: `Customer ${n}`, customerEmail: `customer${n}@example.com` });

describe('Booking API (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "bookings"');
    await seedSlots(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const availableIds = async () =>
    (await request(baseUrl).get('/slots').expect(200)).body.slots.map((s: { id: string }) => s.id);

  it('books a slot (201) and removes it from the available list', async () => {
    const res = await request(baseUrl)
      .post('/bookings')
      .send({ slotId: SLOT_ID, customerName: '  Alex Morgan ', customerEmail: ' alex@example.com ' })
      .expect(201);

    expect(res.body.booking).toEqual({
      id: expect.any(String),
      slotId: SLOT_ID,
      customerName: 'Alex Morgan',
      customerEmail: 'alex@example.com',
      status: 'active',
    });
    expect(await availableIds()).not.toContain(SLOT_ID);
  });

  it('two concurrent bookings for the same slot: one 201, one 409, one active booking stored', async () => {
    const [a, b] = await Promise.all([
      request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(1) }),
      request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(2) }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const conflict = a.status === 409 ? a : b;
    expect(conflict.body.error.code).toBe('SLOT_UNAVAILABLE');

    const active = await prisma.booking.count({ where: { slotId: SLOT_ID, status: 'active' } });
    expect(active).toBe(1);
  });

  it('cancels a booking (200), makes the slot available again and allows a new booking', async () => {
    const created = await request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(1) }).expect(201);
    const bookingId = created.body.booking.id;

    const cancelled = await request(baseUrl).delete(`/bookings/${bookingId}`).expect(200);
    expect(cancelled.body.booking).toMatchObject({ id: bookingId, slotId: SLOT_ID, status: 'cancelled' });
    expect(await availableIds()).toContain(SLOT_ID);

    await request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(2) }).expect(201);
    expect(await availableIds()).not.toContain(SLOT_ID);
  });

  it('repeating a cancel is idempotent and does not affect a newer active booking', async () => {
    const first = await request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(1) }).expect(201);
    const firstId = first.body.booking.id;
    await request(baseUrl).delete(`/bookings/${firstId}`).expect(200);
    const second = await request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(2) }).expect(201);

    const again = await request(baseUrl).delete(`/bookings/${firstId}`).expect(200);
    expect(again.body.booking.status).toBe('cancelled');

    const newer = await prisma.booking.findUniqueOrThrow({ where: { id: second.body.booking.id } });
    expect(newer.status).toBe('active');
  });

  it('lists available slots sorted by startsAt then id', async () => {
    const res = await request(baseUrl).get('/slots').expect(200);
    const expected = [...SEED_SLOTS].sort((x, y) => x.startsAt.localeCompare(y.startsAt) || x.id.localeCompare(y.id));
    expect(res.body.slots).toEqual(expected);
  });

  it('returns the documented error codes', async () => {
    const cases: Array<[request.Test, number, string]> = [
      [request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, customerName: '   ', customerEmail: 'a@b.co' }), 400, 'VALIDATION_ERROR'],
      [request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, customerName: 'A', customerEmail: 'not-an-email' }), 400, 'VALIDATION_ERROR'],
      [request(baseUrl).post('/bookings').send({ slotId: 'nope', ...customer(1) }), 400, 'VALIDATION_ERROR'],
      [request(baseUrl).post('/bookings').set('Content-Type', 'application/json').send('{"slotId":'), 400, 'VALIDATION_ERROR'],
      [request(baseUrl).post('/bookings').send({ slotId: '99999999-9999-4999-8999-999999999999', ...customer(1) }), 404, 'SLOT_NOT_FOUND'],
      [request(baseUrl).delete('/bookings/not-a-uuid'), 400, 'VALIDATION_ERROR'],
      [request(baseUrl).delete('/bookings/99999999-9999-4999-8999-999999999999'), 404, 'BOOKING_NOT_FOUND'],
    ];
    for (const [req, status, code] of cases) {
      const res = await req;
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
      expect(res.body.error.message).toEqual(expect.any(String));
    }
  });

  it('emits slot.booked and slot.released over Socket.IO after commit', async () => {
    const socket: Socket = io(baseUrl, { transports: ['websocket'], forceNew: true });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const events: Array<[string, unknown]> = [];
    socket.onAny((event, payload) => events.push([event, payload]));

    const created = await request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(1) }).expect(201);
    const bookingId = created.body.booking.id;
    await request(baseUrl).post('/bookings').send({ slotId: SLOT_ID, ...customer(2) }).expect(409);
    await request(baseUrl).delete(`/bookings/${bookingId}`).expect(200);
    await request(baseUrl).delete(`/bookings/${bookingId}`).expect(200);
    await new Promise((r) => setTimeout(r, 300));
    socket.close();

    expect(events).toEqual([
      ['slot.booked', { slotId: SLOT_ID, bookingId, available: false }],
      ['slot.released', { slotId: SLOT_ID, bookingId, available: true }],
    ]);
  });
});
