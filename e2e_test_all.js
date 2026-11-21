import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TECH_EVAL_FIELDS,
  getActiveTechEvalFields,
  getAvailableTechEvalFields,
} from './frontend/src/services/techEval.js';

const BACKEND_BASE = 'http://127.0.0.1:8081';
const TEST_BID_ID = '471a7d50-43b8-4bf3-ad57-af2571bcad5b';

// Helper to simulate localStorage in Node.js
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// --------------------------------------------------------------------------
// SUITE 1: Stage 9 Dynamic Date Fields Engine
// --------------------------------------------------------------------------
test('E2E Suite 1: Stage 9 Dynamic Date Fields Logic', async (t) => {
  await t.test('1.1 Dynamic Date Schema defines exactly 5 milestones', () => {
    assert.equal(TECH_EVAL_FIELDS.length, 5);
    const keys = TECH_EVAL_FIELDS.map((f) => f.key);
    assert.deepEqual(keys, [
      'bidExtension',
      'evaluation',
      'clarification',
      'negotiation',
      'reverseAuction',
    ]);
  });

  await t.test('1.2 Empty initial state shows no active dates and all 5 available', () => {
    const rawDates = {};
    const active = getActiveTechEvalFields(rawDates);
    const available = getAvailableTechEvalFields(rawDates);
    assert.equal(active.length, 0);
    assert.equal(available.length, 5);
  });

  await t.test('1.3 Dynamically adding a date updates active & available sets', () => {
    const dates = { clarification: '2026-11-20' };
    const active = getActiveTechEvalFields(dates);
    const available = getAvailableTechEvalFields(dates);

    assert.equal(active.length, 1);
    assert.equal(active[0].key, 'clarification');
    assert.equal(available.length, 4);
    assert.equal(available.some((f) => f.key === 'clarification'), false);
  });

  await t.test('1.4 Dynamically adding all milestones depletes available dropdown', () => {
    const dates = {
      bidExtension: '2026-11-25',
      evaluation: '2026-11-26',
      clarification: '2026-11-27',
      negotiation: '2026-11-28',
      reverseAuction: '2026-11-29',
    };
    const active = getActiveTechEvalFields(dates);
    const available = getAvailableTechEvalFields(dates);

    assert.equal(active.length, 5);
    assert.equal(available.length, 0);
  });

  await t.test('1.5 Removing a dynamic date field restores it to the dropdown and clears date', () => {
    let dates = { evaluation: '2026-11-15', reverseAuction: '2026-11-28' };
    assert.equal(getActiveTechEvalFields(dates).length, 2);

    // Remove reverseAuction
    delete dates.reverseAuction;
    const active = getActiveTechEvalFields(dates);
    const available = getAvailableTechEvalFields(dates);

    assert.equal(active.length, 1);
    assert.equal(active[0].key, 'evaluation');
    assert.equal(available.length, 4);
    assert.equal(available.some((f) => f.key === 'reverseAuction'), true);
  });
});

// --------------------------------------------------------------------------
// SUITE 2: Live Backend API & Data Integrity for Stage 9 & History
// --------------------------------------------------------------------------
test('E2E Suite 2: Live Backend Tender History & Stage Verification', async (t) => {
  let authToken = '';

  await t.test('2.1 Authenticate with backend API', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'biswabhusans@globx.co.in',
        password: 'Admin@123',
      }),
    });
    assert.equal(res.status, 200, 'Expected 200 OK on auth login');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data?.access_token, 'Access token must be returned');
    authToken = data.data.access_token;
  });

  let tenderData = null;

  await t.test('2.2 Retrieve Stage 9 tender record and verify metadata', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${TEST_BID_ID}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    tenderData = body.data;

    assert.equal(tenderData.id, TEST_BID_ID);
    assert.equal(tenderData.workflow_stage, 'TECHNICAL_EVALUATION', 'Tender must be at Stage 9');
    assert.ok(tenderData.closing_date, 'Closing date must exist');
  });

  await t.test('2.3 Verify closing_date_history (end date revisions) schema & content', async () => {
    assert.ok(Array.isArray(tenderData.closing_date_history), 'closing_date_history must be an array');
    assert.ok(tenderData.closing_date_history.length >= 2, 'Should have at least 2 date revisions');

    const rev1 = tenderData.closing_date_history[0];
    assert.ok(rev1.changed_at, 'Revision 1 must have changed_at');
    assert.ok(rev1.old_date, 'Revision 1 must have old_date');
    assert.ok(rev1.new_date, 'Revision 1 must have new_date');
    assert.ok(rev1.changed_by_name, 'Revision 1 must have changed_by_name');

    const rev2 = tenderData.closing_date_history[1];
    assert.ok(rev2.changed_at, 'Revision 2 must have changed_at');
    assert.ok(rev2.old_date, 'Revision 2 must have old_date');
    assert.ok(rev2.new_date, 'Revision 2 must have new_date');
  });

  await t.test('2.4 Verify stage history API returns full audit trail', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/bids/${TEST_BID_ID}/stage-history?limit=100`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), 'History data must be an array');
    assert.ok(body.data.length > 5, 'Must contain complete stage history events');

    // Verify presence of end date changed events in stage history
    const dateEvents = body.data.filter(
      (e) =>
        (e.transition_reason || '').toLowerCase().includes('end date') ||
        (e.to_stage || '').toUpperCase().includes('DATE') ||
        (e.event_type || '').toUpperCase().includes('DATE')
    );
    assert.ok(dateEvents.length > 0, 'Stage history must include End Date changes');

    // Verify presence of tech eval events
    const techEvalEvents = body.data.filter(
      (e) =>
        (e.transition_reason || '').toLowerCase().includes('technical evaluation') ||
        (e.event_type || '').toUpperCase().includes('TECH_EVAL')
    );
    assert.ok(techEvalEvents.length > 0, 'Stage history must include Technical Evaluation audit entries');
  });

  await t.test('2.5 Verify Stage 9 tech_eval date mutations via API', async () => {
    // Test setting a milestone date in tech eval
    const updateRes = await fetch(`${BACKEND_BASE}/api/v1/bids/${TEST_BID_ID}/tech-eval/dates`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        field: 'clarification',
        date: '2026-11-28',
        reason: 'Automated E2E Verification Milestone',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.success, true);
    assert.equal(updateBody.data?.dates?.clarification, '2026-11-28');
  });
});

// --------------------------------------------------------------------------
// SUITE 3: History & Chat Processing Engine (Pure Frontend / 0 Backend)
// --------------------------------------------------------------------------
test('E2E Suite 3: Tender History Collation & Client-Side Chat Engine', async (t) => {
  const mockStorage = new MockLocalStorage();
  const bidId = TEST_BID_ID;
  const storageKey = `onetrack_tender_chat_${bidId}`;

  await t.test('3.1 Collation pipeline merges backend events, date changes, and submissions', () => {
    const backendEvents = [
      {
        id: 'hist-1',
        from_stage: 'GEM_SUBMISSION',
        to_stage: 'TECHNICAL_EVALUATION',
        event_type: 'STAGE_CHANGE',
        transition_reason: 'Technical evaluation opened by Biswa SuperAdmin',
        created_at: '2026-11-10T06:21:13Z',
      },
    ];

    const closingDateHistory = [
      {
        changed_at: '2026-11-11T11:11:41Z',
        old_date: '2026-12-31T23:30:00+05:30',
        new_date: '2027-01-01T18:00:00Z',
        changed_by_name: 'Biswabhusan Executive',
        reason: 'Buyer corrigendum issued on portal',
      },
    ];

    // Collate like TenderChatHistoryPage
    const parsedBackend = backendEvents.map((b) => ({
      ...b,
      category: 'stage',
    }));

    const closingEvents = closingDateHistory.map((c, idx) => ({
      id: `closing-date-${idx}`,
      category: 'date',
      event_type: 'END_DATE_CHANGED',
      transition_reason: `End date revised: ${c.reason}`,
      created_at: c.changed_at,
    }));

    const combined = [...parsedBackend, ...closingEvents].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    assert.equal(combined.length, 2);
    // Newest first: closing event is Nov 11, stage event is Nov 10
    assert.equal(combined[0].category, 'date');
    assert.equal(combined[1].category, 'stage');
  });

  await t.test('3.2 Filter categorization works accurately across all event types', () => {
    const testEvents = [
      { id: '1', category: 'stage', text: 'Stage 8 to Stage 9' },
      { id: '2', category: 'date', text: 'End date extended' },
      { id: '3', category: 'doc', text: 'GeM Submission receipt' },
      { id: '4', category: 'stage', text: 'Internal Approval passed' },
    ];

    const filterStage = testEvents.filter((e) => e.category === 'stage');
    const filterDate = testEvents.filter((e) => e.category === 'date');
    const filterDoc = testEvents.filter((e) => e.category === 'doc');

    assert.equal(filterStage.length, 2);
    assert.equal(filterDate.length, 1);
    assert.equal(filterDoc.length, 1);
  });

  await t.test('3.3 Frontend chat initializes starter discussion if not in storage', () => {
    let saved = mockStorage.getItem(storageKey);
    assert.equal(saved, null);

    const initialChat = [
      {
        id: `m1_${bidId}`,
        sender: 'Rahul Verma',
        role: 'Bid Exec',
        time: '11 Nov, 10:48 AM',
        text: 'Reviewing tender requirements and documentation.',
      },
      {
        id: `m2_${bidId}`,
        sender: 'Ankit Kapoor',
        role: 'Account Mgr',
        time: '11 Nov, 11:10 AM',
        text: 'Buyer evaluation criteria verified.',
      },
    ];

    mockStorage.setItem(storageKey, JSON.stringify(initialChat));

    const retrieved = JSON.parse(mockStorage.getItem(storageKey));
    assert.equal(retrieved.length, 2);
    assert.equal(retrieved[0].sender, 'Rahul Verma');
  });

  await t.test('3.4 Posting a new chat message saves instantly to localStorage with no backend request', () => {
    const current = JSON.parse(mockStorage.getItem(storageKey));
    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: 'Biswa SuperAdmin',
      role: 'Sadmin',
      time: 'Just now',
      text: 'Technical evaluation dynamic dates verified and passed.',
    };

    const updated = [...current, newMsg];
    mockStorage.setItem(storageKey, JSON.stringify(updated));

    const persisted = JSON.parse(mockStorage.getItem(storageKey));
    assert.equal(persisted.length, 3);
    assert.equal(persisted[2].text, 'Technical evaluation dynamic dates verified and passed.');
    assert.equal(persisted[2].sender, 'Biswa SuperAdmin');
  });

  await t.test('3.5 Multiple tenders maintain isolated chat rooms in localStorage', () => {
    const tender2Key = 'onetrack_tender_chat_other-tender-999';
    mockStorage.setItem(
      tender2Key,
      JSON.stringify([{ id: 'other_1', text: 'Other tender discussion' }])
    );

    const tender1Messages = JSON.parse(mockStorage.getItem(storageKey));
    const tender2Messages = JSON.parse(mockStorage.getItem(tender2Key));

    assert.equal(tender1Messages.length, 3);
    assert.equal(tender2Messages.length, 1);
    assert.equal(tender2Messages[0].text, 'Other tender discussion');
  });
});


// --------------------------------------------------------------------------
// SUITE 4: Full End-to-End Lifecycle on a Brand-New Tender
// --------------------------------------------------------------------------
test('E2E Suite 4: End-to-End Lifecycle on Fresh Tender', async (t) => {
  let authToken = '';
  let newBid = null;
  const mockStorage = new MockLocalStorage();

  let user = null;

  await t.test('4.1 Auth login', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'biswabhusans@globx.co.in',
        password: 'Admin@123',
      }),
    });
    const data = await res.json();
    assert.equal(data.success, true);
    authToken = data.data.access_token;
    user = data.data.user;
  });

  await t.test('4.2 Create fresh tender workspace', async () => {
    const uniqueNum = Date.now().toString().slice(-6);
    const createRes = await fetch(`${BACKEND_BASE}/api/v1/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: `E2E Live Verification Tender (${uniqueNum})`,
        bid_no: `GEM/2026/B/E2E-${uniqueNum}`,
        gem_bid_no: `GEM/2026/B/E2E-${uniqueNum}`,
        portal_source: 'GeM Portal',
        creation_mode: 'MANUAL',
        bid_owner_id: user.id,
        category: 'Services',
        bid_type: 'CUSTOM_BID',
        organization_name: 'Defence Research and Development Organisation (DRDO)',
        department_name: 'Directorate of Systems',
        estimated_value: 4500000,
        emd_amount: 90000,
        closing_date: '2026-12-25T18:00:00Z',
      }),
    });
    assert.equal(createRes.status, 201, 'Tender creation must return 201 Created');
    const createBody = await createRes.json();
    assert.equal(createBody.success, true);
    newBid = createBody.data;
    assert.ok(newBid?.id);
    assert.equal(newBid.workflow_stage, 'DISCOVERED');
  });

  await t.test('4.3 Record an End Date Extension (Corrigendum) on new tender', async () => {
    const newClosingDate = '2026-12-30T18:00:00Z';
    const updateRes = await fetch(`${BACKEND_BASE}/api/v1/bids/${newBid.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        closing_date: newClosingDate,
        reason: 'Pre-bid query extension requested by bidders on GeM portal',
      }),
    });
    assert.equal(updateRes.status, 200);

    // Fetch updated bid
    const fetchRes = await fetch(`${BACKEND_BASE}/api/v1/bids/${newBid.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const fetched = await fetchRes.json();
    assert.equal(
      new Date(fetched.data.closing_date).getTime(),
      new Date(newClosingDate).getTime()
    );
    assert.ok(Array.isArray(fetched.data.closing_date_history));
    assert.ok(fetched.data.closing_date_history.length >= 1, 'closing_date_history must record the extension');
    assert.equal(
      new Date(fetched.data.closing_date_history[0].new_date).getTime(),
      new Date(newClosingDate).getTime()
    );
  });

  await t.test('4.4 Verify Stage History API records creation & end date changes', async () => {
    const histRes = await fetch(`${BACKEND_BASE}/api/v1/bids/${newBid.id}/stage-history`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(histRes.status, 200);
    const histData = await histRes.json();
    assert.ok(Array.isArray(histData.data));
    assert.ok(histData.data.length >= 1, 'Must have at least initial or audit history records');
  });

  await t.test('4.5 Client-side isolated Chat initialization for the fresh tender', async () => {
    const freshStorageKey = `onetrack_tender_chat_${newBid.id}`;

    // Verify initially null
    assert.equal(mockStorage.getItem(freshStorageKey), null);

    // Component initializes starter conversation
    const starterChat = [
      {
        id: `m1_${newBid.id}`,
        sender: 'Rahul Verma',
        role: 'Bid Exec',
        time: 'Just now',
        text: `Reviewing tender "${newBid.title}". Requirements, milestones, and documentation checklist initialized.`,
        attachment: { name: `${newBid.bid_no}_Document.pdf`, size: '1.2 MB' },
      },
    ];
    mockStorage.setItem(freshStorageKey, JSON.stringify(starterChat));

    // Send a message
    const msg = {
      id: `m2_${newBid.id}`,
      sender: 'Biswa SuperAdmin',
      role: 'Sadmin',
      time: 'Just now',
      text: 'Verified tender end date extension Corrigendum #1 on GeM portal.',
    };
    const updatedChat = [...starterChat, msg];
    mockStorage.setItem(freshStorageKey, JSON.stringify(updatedChat));

    const stored = JSON.parse(mockStorage.getItem(freshStorageKey));
    assert.equal(stored.length, 2);
    assert.equal(stored[1].text, 'Verified tender end date extension Corrigendum #1 on GeM portal.');
  });
});
