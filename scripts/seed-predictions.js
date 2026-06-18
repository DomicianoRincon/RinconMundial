/**
 * seed-predictions.js
 *
 * Populate Firestore predictions collection from dataini.md data.
 * Covers all matches up to Jun 18, 2026.
 *
 * Prerequisites:
 *   1. Download a Firebase service account key from:
 *      Firebase Console → Project Settings → Service accounts → Generate new private key
 *   2. Save it as:  scripts/serviceAccountKey.json
 *   3. Run:  node scripts/seed-predictions.js
 *
 * To seed only one user, pass their key as an argument:
 *   node scripts/seed-predictions.js dom
 *   node scripts/seed-predictions.js juliana
 *   node scripts/seed-predictions.js father
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Service account ────────────────────────────────────────────────────────
const keyPath = path.join(__dirname, "serviceAccountKey.json");
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
} catch {
  console.error("❌  serviceAccountKey.json not found at scripts/serviceAccountKey.json");
  console.error("   Download it from Firebase Console → Project Settings → Service accounts");
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  projectId: "mundial-f212c",
});

const db = getFirestore();

// ── Users ──────────────────────────────────────────────────────────────────
const USERS = {
  dom:     { email: "domic.rincon@gmail.com",       displayName: "Domiciano Rincon" },
  juliana: { email: "julianadigital29@gmail.com",   displayName: "Juliana Rincon"   },
  father:  { email: "drc12041960@gmail.com",        displayName: "Father"            },
};

// ── Predictions (home - away, using match order from worldcup.json) ────────
//
// Match ID formula:  match_${idx}_${team1[0..2]}_${team2[0..2]}
// "Colombia vs Uzbekistán" appears reversed in the app (Uzbekistan is home/team1),
// so those scores are flipped: family said "Colombia X - Uzbekistán Y"
//                               → predictedHome(Uzb)=Y, predictedAway(Col)=X
//
// ⚠️ Juliana's 15-jun night predictions were posted after the matches ended.
// ⚠️ DOM's 18-jun predictions were possibly posted during the matches.
// They are included here as-is since they reflect what was said in chat.

const PREDICTIONS = [
  // ── 11 de junio ──────────────────────────────────────────────────────────
  {
    matchId: "match_0_Mex_Sou",   // Mexico vs South Africa
    dom:     [1, 1],
    father:  [2, 1],
    juliana: [3, 1],
  },
  {
    matchId: "match_1_Sou_Cze",   // South Korea vs Czech Republic
    dom:     [2, 1],
    father:  [0, 3],
    juliana: [1, 1],
  },
  {
    matchId: "match_6_Can_Bos",   // Canada vs Bosnia & Herzegovina
    dom:     [2, 1],
    father:  [0, 2],
    juliana: [3, 1],
  },
  {
    matchId: "match_18_USA_Par",  // USA vs Paraguay
    dom:     [1, 2],
    father:  [0, 1],
    juliana: [1, 1],
  },

  // ── 13 de junio ──────────────────────────────────────────────────────────
  {
    matchId: "match_7_Qat_Swi",   // Qatar vs Switzerland
    dom:     [0, 3],
    father:  [2, 1],
    juliana: [1, 1],
  },
  {
    matchId: "match_12_Bra_Mor",  // Brazil vs Morocco
    dom:     [2, 1],
    father:  [4, 0],
    juliana: [5, 0],
  },
  {
    matchId: "match_13_Hai_Sco",  // Haiti vs Scotland
    dom:     [0, 2],
    father:  [0, 5],
    juliana: [1, 3],
  },
  {
    matchId: "match_19_Aus_Tur",  // Australia vs Turkey
    dom:     [0, 3],
    father:  [2, 0],
    juliana: [1, 2],
  },

  // ── 14 de junio ──────────────────────────────────────────────────────────
  {
    matchId: "match_24_Ger_Cur",  // Germany vs Curaçao
    dom:     [3, 0],
    father:  [6, 0],
    juliana: [0, 1],
  },
  {
    matchId: "match_30_Net_Jap",  // Netherlands vs Japan
    dom:     [1, 2],
    father:  [3, 2],
    juliana: [1, 2],
  },
  {
    matchId: "match_25_Ivo_Ecu",  // Ivory Coast vs Ecuador
    dom:     [0, 1],
    father:  [1, 3],
    juliana: [3, 1],
  },
  {
    matchId: "match_31_Swe_Tun",  // Sweden vs Tunisia
    dom:     [2, 0],
    father:  [4, 1],
    juliana: [0, 0],
  },

  // ── 15 de junio — Mañana ─────────────────────────────────────────────────
  {
    matchId: "match_42_Spa_Cap",  // Spain vs Cape Verde
    dom:     [5, 0],
    father:  [5, 0],
    juliana: [2, 1],
  },
  {
    matchId: "match_36_Bel_Egy",  // Belgium vs Egypt
    dom:     [2, 1],
    father:  [3, 0],
    juliana: [3, 0],
  },
  {
    matchId: "match_43_Sau_Uru",  // Saudi Arabia vs Uruguay
    dom:     [1, 2],
    father:  [0, 4],
    juliana: [0, 4],
  },
  {
    matchId: "match_37_Ira_New",  // Iran vs New Zealand
    dom:     [1, 1],
    father:  [0, 2],
    juliana: [1, 2],
  },

  // ── 15 de junio — Noche (⚠️ Juliana posted after matches ended) ──────────
  {
    matchId: "match_48_Fra_Sen",  // France vs Senegal
    dom:     [3, 1],
    father:  [2, 1],
    juliana: [3, 1],
  },
  {
    matchId: "match_49_Ira_Nor",  // Iraq vs Norway
    dom:     [0, 5],
    father:  [0, 1],
    juliana: [1, 2],
  },
  {
    matchId: "match_54_Arg_Alg",  // Argentina vs Algeria
    dom:     [2, 1],
    father:  [1, 1],
    juliana: [3, 0],
  },
  {
    matchId: "match_55_Aus_Jor",  // Austria vs Jordan
    dom:     [2, 1],
    father:  [3, 0],
    juliana: [4, 2],
  },

  // ── 17 de junio ──────────────────────────────────────────────────────────
  {
    // "DR Congo" → first 3 chars = "DR " (with space)
    matchId: "match_60_Por_DR ",  // Portugal vs DR Congo
    dom:     [3, 1],
    father:  [4, 0],
    juliana: [5, 0],
  },
  {
    matchId: "match_66_Eng_Cro",  // England vs Croatia
    dom:     [1, 1],
    father:  [1, 0],
    juliana: [2, 1],
  },
  {
    matchId: "match_67_Gha_Pan",  // Ghana vs Panama
    dom:     [3, 0],
    father:  [3, 0],
    juliana: [1, 2],
  },
  {
    // Match is "Uzbekistan vs Colombia" in worldcup.json (Uzbekistan = home/team1)
    // Family listed as "Colombia vs Uzbekistán" — scores are flipped accordingly
    // "Colombia X - Uzbekistán Y" → predictedHome(Uzb)=Y, predictedAway(Col)=X
    matchId: "match_61_Uzb_Col",
    dom:     [0, 2],  // family said Colombia 2 - Uzbekistán 0
    father:  [1, 3],  // family said Colombia 3 - Uzbekistán 1
    juliana: [1, 1],  // family said Colombia 1 - Uzbekistán 1
  },

  // ── 18 de junio (⚠️ DOM's predictions posted ~4pm, possibly during matches) ─
  {
    matchId: "match_2_Cze_Sou",   // Czech Republic vs South Africa
    dom:     [2, 0],
    father:  [1, 0],
    juliana: [1, 2],
  },
  {
    matchId: "match_8_Swi_Bos",   // Switzerland vs Bosnia & Herzegovina
    dom:     [2, 1],
    father:  [1, 2],
    juliana: [1, 1],
  },
  {
    matchId: "match_9_Can_Qat",   // Canada vs Qatar
    dom:     [1, 1],
    father:  [1, 2],
    juliana: [2, 0],
  },
  {
    matchId: "match_3_Mex_Sou",   // Mexico vs South Korea
    dom:     [2, 1],
    father:  [1, 3],
    juliana: [2, 1],
  },
];

// ── Seed function ──────────────────────────────────────────────────────────
async function seed(userFilter) {
  const batch = db.batch();
  let count = 0;

  const usersToSeed = userFilter
    ? Object.entries(USERS).filter(([key]) => key === userFilter)
    : Object.entries(USERS);

  if (usersToSeed.length === 0) {
    console.error(`❌  Unknown user filter "${userFilter}". Use: dom | juliana | father`);
    process.exit(1);
  }

  for (const [userKey, { email }] of usersToSeed) {
    for (const row of PREDICTIONS) {
      const scores = row[userKey];
      if (!scores) continue;

      const docId = `${email}_${row.matchId}`;
      const ref = db.collection("predictions").doc(docId);
      batch.set(ref, {
        userEmail: email,
        matchId: row.matchId,
        predictedHome: scores[0],
        predictedAway: scores[1],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
  }

  await batch.commit();
  return count;
}

// ── Main ───────────────────────────────────────────────────────────────────
const userArg = process.argv[2] ?? null;
console.log(userArg
  ? `Seeding predictions for: ${userArg}`
  : "Seeding predictions for all users (dom, juliana, father)");

seed(userArg)
  .then((n) => {
    console.log(`✅  Done — ${n} prediction documents written to Firestore.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌  Error:", err);
    process.exit(1);
  });
