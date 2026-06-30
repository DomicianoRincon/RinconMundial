/**
 * set-penalty-winners.js
 *
 * Manually set penaltyWinner for matches that ended in a draw decided by penalties.
 * Run: node scripts/set-penalty-winners.js
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(readFileSync(join(__dirname, "serviceAccountKey.json"), "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Matches decided by penalties (score tied after 90/120 min)
// Format: { matchId, homeScore, awayScore, penaltyWinner }
const penaltyResults = [
  // Match 74: Germany vs Paraguay (Paraguay won on penalties) - match_73_Ger_Par
  { matchId: "match_73_Ger_Par", homeScore: 1, awayScore: 1, penaltyWinner: "Paraguay" },
  // Match 75: Netherlands vs Morocco (Morocco won on penalties) - match_74_Net_Mor
  { matchId: "match_74_Net_Mor", homeScore: 1, awayScore: 1, penaltyWinner: "Morocco" },
];

for (const result of penaltyResults) {
  await db.collection("official_results").doc(result.matchId).set({
    matchId: result.matchId,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    penaltyWinner: result.penaltyWinner,
    updatedBy: "manual-penalty",
  }, { merge: true });
  console.log(`Updated ${result.matchId} → penaltyWinner: ${result.penaltyWinner}`);
}

console.log("Done.");
