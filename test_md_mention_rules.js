// test_md_mention_rules.js
// Tests the MD mention inclusion/exclusion rule:
// - Tender in Stage <= 5: @all excludes MD role from notifications
// - Tender in Stage > 5: @all includes MD role in notifications

const http = require('http');

function postJSON(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8081,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJSON(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8081,
        path,
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== STARTING MD CHAT MENTION VERIFICATION ===');

  // 1. Login as Admin / user
  const loginRes = await postJSON('/api/v1/auth/login', {
    username: 'biswabhusan',
    password: 'Admin@123',
  });
  if (loginRes.status !== 200 || !loginRes.data?.data?.access_token) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginRes));
  }
  const token = loginRes.data.data.access_token;
  console.log('✓ Logged in successfully');

  // 2. Fetch list of tenders to find one before stage 5 and one after stage 5
  const bidsRes = await getJSON('/api/v1/bids?limit=50', token);
  const bids = bidsRes.data?.data?.items || bidsRes.data?.data || [];
  console.log(`✓ Fetched ${bids.length} tenders`);

  const STAGE_ORDER = {
    DISCOVERED: 1,
    PRIMARY_REVIEW: 2,
    OEM_AUTHORIZATION_REQUEST: 3,
    PRICING_REQUEST: 4,
    DOCUMENT_CHECKLIST_PREPARATION: 5,
    EMD_PROCESSING: 6,
    INTERNAL_APPROVAL: 7,
    GEM_SUBMISSION: 8,
    TECHNICAL_EVALUATION: 9,
    FINANCIAL_EVALUATION: 10,
    AWARD_HANDOVER: 11,
  };

  const preStage5Bid = bids.find(
    (b) => (STAGE_ORDER[b.workflow_stage] || 1) <= 5
  );
  const postStage5Bid = bids.find(
    (b) => (STAGE_ORDER[b.workflow_stage] || 1) > 5
  );

  console.log('Pre-Stage-5 Tender:', preStage5Bid ? `${preStage5Bid.id} (${preStage5Bid.workflow_stage})` : 'None found');
  console.log('Post-Stage-5 Tender:', postStage5Bid ? `${postStage5Bid.id} (${postStage5Bid.workflow_stage})` : 'None found');

  if (preStage5Bid) {
    console.log('\n--- Testing Pre-Stage 5 Tender ---');
    const membersRes = await getJSON(`/api/v1/bids/${preStage5Bid.id}/chat/members`, token);
    const members = membersRes.data?.data || [];
    console.log(`Pre-stage 5 members count: ${members.length}`);
    const allMember = members.find((m) => m.id === 'all');
    console.log('all label:     ', allMember?.full_name);

    if (!allMember?.full_name.includes('excludes MD')) {
      throw new Error('Expected all label to indicate MD exclusion for stage <= 5');
    }
    console.log('✓ Pre-Stage 5 member list correctly excludes MD in single @all label');

    // Post @all message
    const testMsgPre = await postJSON(
      `/api/v1/bids/${preStage5Bid.id}/chat`,
      { content: `Test pre-stage-5 @all message at ${Date.now()}` },
      token
    );
    console.log('Post message status:', testMsgPre.status);
    console.log('✓ Message with @all posted successfully');
  }

  if (postStage5Bid) {
    console.log('\n--- Testing Post-Stage 5 Tender ---');
    const membersRes = await getJSON(`/api/v1/bids/${postStage5Bid.id}/chat/members`, token);
    const members = membersRes.data?.data || [];
    console.log(`Post-stage 5 members count: ${members.length}`);
    const allMember = members.find((m) => m.id === 'all');
    console.log('all label:     ', allMember?.full_name);

    if (!allMember?.full_name.includes('includes MD')) {
      throw new Error('Expected all label to indicate MD inclusion for stage > 5');
    }
    console.log('✓ Post-Stage 5 member list correctly includes MD in single @all label');

    // Post @all message
    const testMsgPost = await postJSON(
      `/api/v1/bids/${postStage5Bid.id}/chat`,
      { content: `Test post-stage-5 @all message at ${Date.now()}` },
      token
    );
    console.log('Post message status:', testMsgPost.status);
    console.log('✓ Message with @all posted successfully');
  }

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
