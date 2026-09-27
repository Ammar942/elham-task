import { io } from 'socket.io-client';

const url = process.argv[2] ?? 'http://localhost:3000';
const socket = io(url, { path: '/socket.io' });

socket.on('connect', () => console.log(`connected to ${url} (id ${socket.id}), waiting for events...`));
socket.on('slot.booked', (payload) => console.log('slot.booked', JSON.stringify(payload)));
socket.on('slot.released', (payload) => console.log('slot.released', JSON.stringify(payload)));
socket.on('disconnect', (reason) => console.log('disconnected:', reason));
