// End-to-end smoke test of the API with the mock AI provider.
// Boots the server against DATABASE_URL, walks a full interview over HTTP, and
// checks auth, session ownership and history. No Groq key needed.
//
//   DATABASE_URL=postgresql://… JWT_SECRET=… npm run smoke
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.SMOKE_PORT || '5099';
const BASE = `http://localhost:${PORT}/api`;

let failures = 0;
function check(condition, label) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`);
  if (!condition) failures += 1;
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Server did not become healthy in time.');
}

// Minimal cookie-jar client per user
function client() {
  let cookie = '';
  return async (method, route, body) => {
    const res = await fetch(`${BASE}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };
}

async function run() {
  const stamp = Date.now();
  const alice = client();
  const bob = client();

  let r = await alice('POST', '/auth/register', { fullName: 'Alice', email: `alice${stamp}@smoke.test`, password: 'secret123' });
  check(r.status === 201 && r.json.data.user._id, 'register returns 201 with a user id');

  r = await alice('POST', '/auth/register', { fullName: 'Alice', email: `alice${stamp}@smoke.test`, password: 'secret123' });
  check(r.status === 409, 'duplicate email is rejected (409)');

  r = await alice('POST', '/auth/login', { email: `ALICE${stamp}@smoke.test`, password: 'wrong-password' });
  check(r.status === 401, 'wrong password is rejected (401)');

  r = await alice('POST', '/auth/login', { email: `ALICE${stamp}@smoke.test`, password: 'secret123' });
  check(r.status === 200, 'login is case-insensitive on email');

  r = await alice('GET', '/auth/me');
  check(r.status === 200 && r.json.data.user.fullName === 'Alice', '/auth/me returns the logged-in user');

  r = await alice('POST', '/interview/start', { name: 'Alice', role: 'Backend', experience: 'Fresher', difficulty: 'Easy', questionCount: 2 });
  check(r.status === 201 && r.json.data.firstQuestion.id === 1, 'interview starts with question 1');
  const sessionId = r.json.data.sessionId;

  const answer = (who, questionId) =>
    who('POST', '/interview/answer', { sessionId, questionId, question: 'ignored', answer: 'An index on the foreign key, verified with EXPLAIN ANALYZE.' });

  r = await answer(alice, 1);
  check(r.status === 200 && r.json.data.nextQuestion?.id === 2, 'answer 1 is evaluated and question 2 follows');

  r = await answer(alice, 1);
  check(r.status === 409, 'answering the same question twice is rejected (409)');

  await bob('POST', '/auth/register', { fullName: 'Bob', email: `bob${stamp}@smoke.test`, password: 'secret123' });
  r = await answer(bob, 2);
  check(r.status === 404, "another user cannot answer someone else's interview (404)");

  r = await answer(alice, 2);
  check(r.status === 200 && r.json.data.isLastQuestion === true, 'answer 2 is the last question');

  r = await alice('POST', '/interview/finish', { sessionId });
  check(r.status === 200 && r.json.data.report.questionsAnswered === 2, 'finish returns a report covering both answers');

  r = await alice('POST', '/interview/finish', { sessionId });
  check(r.status === 404, 'a finished interview cannot be finished again (404)');

  r = await alice('GET', '/interview/history');
  const entry = r.json?.data?.history?.[0];
  check(r.status === 200 && r.json.data.history.length === 1 && entry._id === sessionId && entry.date, 'history has the interview with _id and date');

  r = await bob('GET', '/interview/history');
  check(r.status === 200 && r.json.data.history.length === 0, "history is private to each user");

  r = await alice('POST', '/voice/speak', { text: 'Hello there.' });
  check(r.status === 501, 'server TTS is off with TTS_PROVIDER=browser (501 → client uses the browser voice)');

  r = await alice('POST', '/nope');
  check(r.status === 404 && r.json?.success === false, 'unknown API route returns JSON 404');

  r = await alice('POST', '/auth/logout');
  r = await alice('GET', '/auth/me');
  check(r.status === 401, 'logout clears the session');
}

(async () => {
  const server = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT, AI_PROVIDER: 'mock', TTS_PROVIDER: 'browser', NODE_ENV: 'test' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const exited = new Promise((resolve) => server.on('exit', resolve));

  try {
    await Promise.race([waitForHealth(), exited.then((code) => { throw new Error(`Server exited early (${code}).`); })]);
    await run();
  } catch (err) {
    console.error('ERROR', err.message);
    failures += 1;
  } finally {
    server.kill();
    await exited;
  }

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
})();
