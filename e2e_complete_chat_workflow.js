import test from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_BASE = 'http://127.0.0.1:8081';

test('E2E Complete Chat Module & Multi-User Collaboration Workflow', async (t) => {
  let tokenUser1 = ''; // Biswa SuperAdmin
  let user1Info = null;
  let tokenUser2 = ''; // Biswabhusan Executive
  let user2Info = null;
  let testBid = null;

  // ------------------------------------------------------------------------
  // STEP 1: Authenticate Both Users
  // ------------------------------------------------------------------------
  await t.test('1.1 Authenticate User 1 (Biswa SuperAdmin)', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'biswabhusans@globx.co.in',
        password: 'Admin@123',
      }),
    });
    assert.equal(res.status, 200, 'User 1 login must succeed');
    const data = await res.json();
    assert.equal(data.success, true);
    tokenUser1 = data.data.access_token;
    user1Info = data.data.user;
    assert.ok(tokenUser1);
    assert.ok(user1Info.id);
  });

  await t.test('1.2 Authenticate User 2 (Biswabhusan Executive)', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'biswabhusan',
        password: 'Admin@123',
      }),
    });
    assert.equal(res.status, 200, 'User 2 login must succeed');
    const data = await res.json();
    assert.equal(data.success, true);
    tokenUser2 = data.data.access_token;
    user2Info = data.data.user;
    assert.ok(tokenUser2);
    assert.ok(user2Info.id);
  });

  // ------------------------------------------------------------------------
  // STEP 2: Create a Brand-New Tender Workspace
  // ------------------------------------------------------------------------
  await t.test('2.1 Create fresh tender workspace for live collaboration', async () => {
    const randSuffix = Math.floor(100000 + Math.random() * 900000);
    const bidNo = `GEM/2026/B/COLLAB-${randSuffix}`;
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser1}`,
      },
      body: JSON.stringify({
        title: `Enterprise Cloud & Data Center Setup (${randSuffix})`,
        bid_no: bidNo,
        gem_bid_no: bidNo,
        portal_source: 'GeM Portal',
        creation_mode: 'MANUAL',
        bid_owner_id: user1Info.id,
        category: 'Services',
        bid_type: 'CUSTOM_BID',
        organization_name: 'National Informatics Centre (NIC)',
        department_name: 'Cloud Services Division',
        estimated_value: 7500000,
        closing_date: '2026-12-31T18:00:00Z',
      }),
    });
    assert.equal(res.status, 201, 'Bid creation must return 201 Created');
    const body = await res.json();
    assert.equal(body.success, true);
    testBid = body.data;
    assert.ok(testBid?.id);
    assert.equal(testBid.workflow_stage, 'DISCOVERED');
  });

  // ------------------------------------------------------------------------
  // STEP 3: Auto-Initialization of Chat Room (Zero Hardcoding)
  // ------------------------------------------------------------------------
  await t.test('3.1 Verify chat room auto-initializes tender announcement on first access', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 1, 'Brand-new tender must have exactly 1 initial welcome message');

    const initMsg = body.data[0];
    assert.equal(initMsg.message_type, 'ANNOUNCEMENT');
    assert.ok(initMsg.content.includes(testBid.title), 'Announcement must mention real tender title');
    assert.ok(initMsg.content.includes(testBid.bid_no), 'Announcement must mention real bid number');
    assert.deepEqual(initMsg.mentions, ['everyone']);
    assert.ok(initMsg.sender_name);
    assert.ok(initMsg.sender_role);
  });

  // ------------------------------------------------------------------------
  // STEP 4: Query Mentionable Members
  // ------------------------------------------------------------------------
  await t.test('4.1 Verify mentionable members list includes @everyone, owner, and colleagues', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat/members`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const members = body.data;
    assert.ok(Array.isArray(members));
    assert.ok(members.length >= 2);

    // First entry must be group mention @all
    assert.ok(members[0].id === 'all' || members[0].id === 'everyone');
    assert.equal(members[0].role, 'ALL');

    // User 2 (biswabhusan) must be available in members list
    const foundUser2 = members.find((m) => m.id === user2Info.id || m.username === 'biswabhusan');
    assert.ok(foundUser2, 'User 2 (biswabhusan) must be in mentionable members list');
  });

  // ------------------------------------------------------------------------
  // STEP 5: User 1 Posts a Question Asking the Team with @everyone & @biswabhusan
  // ------------------------------------------------------------------------
  await t.test('5.1 User 1 posts an explicit QUESTION mentioning @everyone and @biswabhusan', async () => {
    const questionText =
      'Can @everyone please review the tender technical specifications? @biswabhusan is our compliance matrix ready?';
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser1}`,
      },
      body: JSON.stringify({
        content: questionText,
        message_type: 'QUESTION',
        mentions: ['everyone', 'biswabhusan'],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.message_type, 'QUESTION');
    assert.equal(body.data.content, questionText);
    assert.deepEqual(body.data.mentions, ['everyone', 'biswabhusan']);
    assert.equal(body.data.sender_id, user1Info.id);
  });

  // ------------------------------------------------------------------------
  // STEP 6: Multi-User Collaboration: User 2 Reads and Replies with Mention
  // ------------------------------------------------------------------------
  await t.test('6.1 User 2 (Biswabhusan) reads chat and posts reply mentioning User 1', async () => {
    // User 2 reads messages
    const readRes = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat`, {
      headers: { Authorization: `Bearer ${tokenUser2}` },
    });
    assert.equal(readRes.status, 200);
    const readBody = await readRes.json();
    assert.equal(readBody.data.length, 2, 'Should have announcement + question');

    // User 2 posts reply
    const replyText =
      'Confirmed @Biswa SuperAdmin, the compliance matrix and OEM certifications are 100% prepared.';
    const replyRes = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser2}`,
      },
      body: JSON.stringify({
        content: replyText,
        message_type: 'CHAT',
        mentions: ['Biswa SuperAdmin'],
      }),
    });
    assert.equal(replyRes.status, 201);
    const replyBody = await replyRes.json();
    assert.equal(replyBody.success, true);
    assert.equal(replyBody.data.sender_id, user2Info.id);
    assert.equal(replyBody.data.sender_name, user2Info.full_name);
    assert.equal(replyBody.data.message_type, 'CHAT');
    assert.equal(replyBody.data.content, replyText);
  });

  // ------------------------------------------------------------------------
  // STEP 7: Verify Mentions Dispatch In-App Alerts in Notification System
  // ------------------------------------------------------------------------
  await t.test('7.1 Verify User 2 received an in-app alert for the mention question', async () => {
    // Wait for background goroutine to record alert
    await new Promise((r) => setTimeout(r, 200));

    const alertsRes = await fetch(`${BACKEND_BASE}/api/v1/alerts`, {
      headers: { Authorization: `Bearer ${tokenUser2}` },
    });
    assert.equal(alertsRes.status, 200);
    const alertsBody = await alertsRes.json();
    assert.ok(Array.isArray(alertsBody.data));

    // Find alert related to this tender
    const mentionAlert = alertsBody.data.find(
      (a) => a.bid_id === testBid.id && a.type === 'TENDER_CHAT_MENTION'
    );
    assert.ok(mentionAlert, 'User 2 must receive TENDER_CHAT_MENTION alert');
    assert.ok(mentionAlert.title.includes('question'));
    assert.equal(mentionAlert.link, `/dashboard/tenders/${testBid.id}?tab=chat-history`);
  });

  // ------------------------------------------------------------------------
  // STEP 8: Verify Complete Chronological Message Chain in PostgreSQL
  // ------------------------------------------------------------------------
  await t.test('8.1 Verify complete conversation chain in database', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const messages = body.data;

    assert.equal(messages.length, 3, 'Must contain announcement + question + reply');

    // Message 1: ANNOUNCEMENT
    assert.equal(messages[0].message_type, 'ANNOUNCEMENT');

    // Message 2: QUESTION from User 1
    assert.equal(messages[1].message_type, 'QUESTION');
    assert.equal(messages[1].sender_id, user1Info.id);

    // Message 3: CHAT reply from User 2
    assert.equal(messages[2].message_type, 'CHAT');
    assert.equal(messages[2].sender_id, user2Info.id);
    assert.equal(messages[2].sender_name, user2Info.full_name);

    // Timestamps must be non-decreasing
    assert.ok(
      new Date(messages[2].created_at).getTime() >= new Date(messages[1].created_at).getTime()
    );
  });

  // ------------------------------------------------------------------------
  // STEP 9: Negative Testing & Edge Cases
  // ------------------------------------------------------------------------
  await t.test('9.1 Empty message content returns 400 Bad Request', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser1}`,
      },
      body: JSON.stringify({ content: '   ' }),
    });
    assert.equal(res.status, 400);
  });

  await t.test('9.2 Unauthenticated request returns 401 Unauthorized', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${testBid.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Should fail' }),
    });
    assert.equal(res.status, 401);
  });
});
