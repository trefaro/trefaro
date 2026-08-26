import { io } from 'socket.io-client';

const BASE = process.env.SOCKET_BASE ?? 'http://127.0.0.1:3000';
const LABEL = process.env.SOCKET_LABEL ?? 'direct to the server';
let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

console.log(`--- socket.io ${LABEL}: ${BASE} ---`);

const socket = io(BASE, {
  // No polling fallback on purpose: if the upgrade does not survive the path
  // under test, this must fail rather than quietly degrade.
  transports: ['websocket'],
  reconnection: false,
  timeout: 8000,
});

const connected = await new Promise((resolve) => {
  socket.once('connect', () => resolve(true));
  socket.once('connect_error', (error) => {
    console.log(`      connect_error: ${error.message}`);
    resolve(false);
  });
  setTimeout(() => resolve(false), 9000);
});

check('the WebSocket handshake succeeds', connected);

if (connected) {
  check(
    'the connection uses the websocket transport, not long-polling',
    socket.io.engine.transport.name === 'websocket',
    socket.io.engine.transport.name,
  );

  const reply = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    socket.emit('chat:echo', 'hello from the verification script', (answer) => {
      clearTimeout(timer);
      resolve(answer);
    });
  });

  check(
    'the server answers on the same socket',
    reply !== null,
    reply ? JSON.stringify(reply) : 'no reply within 8s',
  );
  check(
    'the echo carries the text back',
    reply?.text === 'hello from the verification script',
  );
  check(
    'the server reports a websocket transport too',
    reply?.transport === 'websocket',
    reply?.transport,
  );
  check(
    'the reply carries a server timestamp',
    Boolean(reply?.serverTime) && !Number.isNaN(Date.parse(reply.serverTime)),
  );
}

socket.disconnect();
console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
