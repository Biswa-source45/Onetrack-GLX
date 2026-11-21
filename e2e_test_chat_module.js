import test from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_BASE = 'http://127.0.0.1:8081';
const TEST_BID_ID = '471a7d50-43b8-4bf3-ad57-af2571bcad5b';

test('E2E Chat Module Live Verification', async (t) => {
  let authToken = '';

  await t.test('1. Authenticate with backend', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'biswabhusans@globx.co.in',
        password: 'Admin@123',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    authToken = data.data.access_token;
  });

  await t.test('2. Query eligible members for @mentions', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${TEST_BID_ID}/chat/members`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 2, 'Should return at least @everyone and users');

    // Verify first entry is @everyone
    assert.equal(data.data[0].id, 'everyone');
    assert.equal(data.data[0].username, 'everyone');

    // Verify system users are returned with full_name and role
    const users = data.data.slice(1);
    assert.ok(users.every((u) => u.id && u.full_name && u.role));
  });

  await t.test('3. Post a tender question asking team with @everyone mention', async () => {
    const questionText = 'Can @everyone please review Section 4.2 compliance and confirm readiness?';
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${TEST_BID_ID}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        content: questionText,
        message_type: 'QUESTION',
        mentions: ['everyone'],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.message_type, 'QUESTION');
    assert.equal(body.data.content, questionText);
    assert.deepEqual(body.data.mentions, ['everyone']);
    assert.ok(body.data.sender_name);
    assert.ok(body.data.sender_role);
  });

  await t.test('4. Post a specific user mention message', async () => {
    const mentionText = 'Thanks @Biswabhusan Executive for updating the corrigendum closing date.';
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${TEST_BID_ID}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        content: mentionText,
        message_type: 'CHAT',
        mentions: ['Biswabhusan Executive'],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.message_type, 'CHAT');
    assert.equal(body.data.content, mentionText);
  });

  await t.test('5. List messages from PostgreSQL and verify chronological persistence', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${TEST_BID_ID}/chat`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2, 'Should contain all posted messages');

    // Confirm that messages have real sender info and timestamps
    for (const msg of body.data) {
      assert.ok(msg.id);
      assert.ok(msg.content);
      assert.ok(msg.sender_name);
      assert.ok(msg.sender_role);
      assert.ok(msg.created_at);
    }

    // Verify the question message is present
    const questionMsg = body.data.find((m) => m.message_type === 'QUESTION');
    assert.ok(questionMsg, 'Question message must be retrieved from database');
    assert.ok(questionMsg.content.includes('@everyone'));
  });
});
