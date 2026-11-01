/**
 * Netlify function: fixnames
 * ---------------------------------------------------------------------------
 * Deployed version of the one-time name fix. Reads Firebase Auth users and
 * writes their real displayName + photoURL into Firestore `players/{uid}`.
 *
 * Trigger (admin only):
 *   POST https://<site>/.netlify/functions/fixnames
 *   Body: { "adminEmail": "fasahatalhasan@gmail.com", "token": "<firebase-id-token>" }
 *
 * Requires env var FIREBASE_SERVICE_ACCOUNT (the JSON service account key).
 * ---------------------------------------------------------------------------
 */
const admin = require('firebase-admin');

let initialized = false;
function ensureInit() {
  if (initialized) return;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env var');
  const cred = JSON.parse(sa);
  admin.initializeApp({ credential: admin.credential.cert(cred) });
  initialized = true;
}

exports.handler = async (event, context) => {
  try {
    ensureInit();
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const body = JSON.parse(event.body || '{}');
    if (body.adminEmail !== 'fasahatalhasan@gmail.com') {
      return { statusCode: 403, body: 'Forbidden' };
    }

    let updated = 0, skipped = 0, total = 0;
    let nextPageToken;
    const BATCH_SIZE = 1000;

    do {
      const result = await admin.auth().listUsers(BATCH_SIZE, nextPageToken);
      const batch = admin.firestore().batch();
      let bc = 0;
      for (const user of result.users) {
        total++;
        const name = (user.displayName || '').trim();
        const photo = user.photoURL || '';
        const email = user.email || '';
        const patch = {};
        if (name) patch.displayName = name;
        if (photo) patch.photoURL = photo;
        if (email) patch.email = email;
        patch.authSyncedAt = admin.firestore.FieldValue.serverTimestamp();
        if (Object.keys(patch).length > 1) {
          batch.set(admin.firestore().collection('players').doc(user.uid), patch, { merge: true });
          bc++; updated++;
        } else { skipped++; }
      }
      if (bc > 0) await batch.commit();
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, total, updated, skipped }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
