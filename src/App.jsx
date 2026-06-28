import React, { useState, useEffect, useRef } from "react";
import { 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot 
} from "firebase/firestore";
import { auth, db } from "./firebase";
import worldCupData from "./worldcup.json";
import worldcupLogo from "./assets/worldcup.png";
import {
  Trophy,
  Calendar,
  LogOut,
  Loader,
  Clock,
  Home,
  CheckSquare,
  Share2,
  Menu,
  X
} from "lucide-react";

const ESPN_TO_LOCAL_TEAM = {
  "Czechia": "Czech Republic",
  "Bosnia-Herzegovina": "Bosnia & Herzegovina",
  "United States": "USA",
  "Korea Republic": "South Korea",
  "IR Iran": "Iran",
  "Côte d'Ivoire": "Ivory Coast",
  "Türkiye": "Turkey",
  "Congo DR": "DR Congo",
};

const SANTO_Y_SENA = "hkx213bp";

const getInitials = (name = "") =>
  name.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2) || "?";

const isLiveStatus = (live) =>
  live?.statusName?.includes("IN_PROGRESS") ||
  live?.statusDesc?.includes("Half") ||
  live?.statusDesc === "In Progress";

const isFinalStatus = (live) =>
  live?.statusName?.includes("FINAL") ||
  live?.statusDesc === "Final" ||
  live?.statusDesc === "Full Time";

// Simple date translator
const MONTHS = {
  "01": "ENERO", "02": "FEBRERO", "03": "MARZO", "04": "ABRIL",
  "05": "MAYO", "06": "JUNIO", "07": "JULIO", "08": "AGOSTO",
  "09": "SEPTIEMBRE", "10": "OCTUBRE", "11": "NOVIEMBRE", "12": "DICIEMBRE"
};

const formatDateToSpanish = (dateStr) => {
  const [year, month, day] = dateStr.split("-");
  return `${MONTHS[month]} ${parseInt(day, 10)}`;
};

const formatKickoffColombia = (kickoff) =>
  kickoff.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

// Time parser for "2026-06-18" and "12:00 UTC-7"
const parseMatchTime = (dateStr, timeStr) => {
  try {
    const timePart = timeStr.replace("UTC", "").trim(); // e.g. "12:00 -7" or "12:00 +3"
    let offset = "";
    if (timePart.includes("-")) {
      const [h, off] = timePart.split("-");
      const formattedOffset = off.trim().padStart(2, '0') + ":00";
      offset = `-${formattedOffset}`;
      return new Date(`${dateStr}T${h.trim()}:00${offset}`);
    } else if (timePart.includes("+")) {
      const [h, off] = timePart.split("+");
      const formattedOffset = off.trim().padStart(2, '0') + ":00";
      offset = `+${formattedOffset}`;
      return new Date(`${dateStr}T${h.trim()}:00${offset}`);
    } else {
      return new Date(`${dateStr}T${timePart}:00Z`);
    }
  } catch (err) {
    console.error("Error parsing date/time: ", dateStr, timeStr, err);
    return new Date(`${dateStr}T00:00:00Z`);
  }
};

export default function App() {
  // Detect invite mode from URL: ?invite
  const isInviteMode = new URLSearchParams(window.location.search).has("invite");

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [currentTab, setCurrentTab] = useState("predicciones");
  const [registeredUsers, setRegisteredUsers] = useState([]);

  // Today's date in GMT-5 (Bogota)
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

  // Ref for the dates scroll container
  const datesScrollRef = useRef(null);

  // Matches schedules and formatting
  const [matches, setMatches] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");

  // Firestore sync state
  const [predictions, setPredictions] = useState({}); // Key: userEmail_matchId -> { home, away }
  const [officialResults, setOfficialResults] = useState({}); // Key: matchId -> { home, away }
  const [saveStatus, setSaveStatus] = useState({}); // Key: matchId -> 'saving' | 'saved' | 'error'

  // ESPN live scores state
  const [liveScores, setLiveScores] = useState({});

  // Ranking row expanded user
  const [expandedRankingUser, setExpandedRankingUser] = useState(null);

  // Show welcome screen after fresh login (not on page reload)
  const [showWelcome, setShowWelcome] = useState(false);

  // Share image generation state
  const [isSharing, setIsSharing] = useState(false);

  // Mobile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Time tracking
  const [currentTime, setCurrentTime] = useState(new Date());

  // Listen to current time to update counts & locks every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check Auth State and register user in Firestore on login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          await setDoc(doc(db, "users", firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email,
            photoURL: firebaseUser.photoURL || null,
            lastLogin: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Error registering user:", err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Setup matches and dates from static JSON
  useEffect(() => {
    if (worldCupData && worldCupData.matches) {
      const parsedMatches = worldCupData.matches.map((m, idx) => {
        const matchId = `match_${idx}_${m.team1.substring(0,3)}_${m.team2.substring(0,3)}`;
        const kickoff = parseMatchTime(m.date, m.time);
        return {
          ...m,
          id: matchId,
          kickoff
        };
      });
      setMatches(parsedMatches);

      // Unique dates
      const uniqueDates = [...new Set(parsedMatches.map(m => m.date))].sort();
      setDates(uniqueDates);

      // Select date by default — use Intl to get today in Bogotá timezone directly
      const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

      if (uniqueDates.includes(todayStr)) {
        setSelectedDate(todayStr);
      } else {
        // Fallback to the closest upcoming matchday or first matchday
        const upcoming = uniqueDates.find(d => d >= todayStr);
        setSelectedDate(upcoming || uniqueDates[0] || "");
      }
    }
  }, []);

  // Listen to predictions from Firestore
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "predictions"), (snapshot) => {
      const predData = {};
      snapshot.forEach((doc) => {
        predData[doc.id] = doc.data();
      });
      setPredictions(predData);
    });
    return unsubscribe;
  }, [user]);

  // Listen to official results from Firestore
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "official_results"), (snapshot) => {
      const resultsData = {};
      snapshot.forEach((doc) => {
        resultsData[doc.id] = doc.data();
      });
      setOfficialResults(resultsData);
    });
    return unsubscribe;
  }, [user]);

  // Listen to registered users from Firestore
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = [];
      snapshot.forEach((doc) => usersData.push(doc.data()));
      setRegisteredUsers(usersData);
    });
    return unsubscribe;
  }, [user]);

  // When entering predicciones, reset selection to today (or closest upcoming day)
  useEffect(() => {
    if (currentTab !== "predicciones" || !dates.length) return;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
    const target = dates.includes(today) ? today : (dates.find(d => d >= today) || dates[0]);
    setSelectedDate(target);
  }, [currentTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll selected date button to center of ribbon
  useEffect(() => {
    if (currentTab !== "predicciones" || !selectedDate) return;
    const doScroll = () => {
      const container = datesScrollRef.current;
      if (!container) return;
      // Query the active button directly — avoids ref timing issues on mobile
      const btn = container.querySelector('.date-btn.active');
      if (!btn) return;
      container.scrollLeft = Math.max(
        0,
        btn.offsetLeft - container.clientWidth / 2 + btn.offsetWidth / 2
      );
    };
    // Two attempts: right after paint and after a longer delay for slow devices
    const t1 = setTimeout(doScroll, 0);
    const t2 = setTimeout(doScroll, 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [currentTab, selectedDate, dates.length]);

  // One-shot fetch when user enters the app (matches already loaded)
  useEffect(() => {
    if (!user || matches.length === 0) return;
    fetchAllLiveScores();
  }, [user?.uid, matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-poll ESPN every 60s when there are locked matches
  const lockedMatchIds = matches.filter(m => currentTime >= m.kickoff).map(m => m.id).join(",");
  useEffect(() => {
    if (!user || !lockedMatchIds) return;
    const interval = setInterval(fetchAllLiveScores, 60_000);
    return () => clearInterval(interval);
  }, [user, lockedMatchIds]); // re-runs only when a new match becomes locked

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setAuthError("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      if (isInviteMode) setShowWelcome(true);
    } catch (err) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        setAuthError("Error al iniciar sesión con Google: " + err.message);
      }
    }
  };

  // Handle Log Out
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error: ", err);
    }
  };

  // Profile resolution from Firebase user
  const getUserProfile = (firebaseUser) => {
    if (!firebaseUser) return { name: "Invitado", avatar: "?", photoURL: null };
    const name = firebaseUser.displayName || firebaseUser.email || "Usuario";
    return { name, avatar: getInitials(name), photoURL: firebaseUser.photoURL };
  };

  const currentUserProfile = getUserProfile(user);

  // Autosave prediction with debounce helper
  const debounceTimers = useRef({});
  const savePrediction = (matchId, team, value) => {
    const userId = user.uid;
    const userEmail = user.email;
    const predictionDocId = `${userEmail}_${matchId}`;

    // Update state immediately
    const existing = predictions[predictionDocId] || { userId, userEmail, matchId, predictedHome: "", predictedAway: "" };
    const parsedVal = value === "" ? "" : parseInt(value, 10);
    const updated = {
      ...existing,
      predictedHome: team === "home" ? parsedVal : existing.predictedHome,
      predictedAway: team === "away" ? parsedVal : existing.predictedAway,
      updatedAt: new Date().toISOString()
    };

    setPredictions(prev => ({
      ...prev,
      [predictionDocId]: updated
    }));

    setSaveStatus(prev => ({ ...prev, [matchId]: "saving" }));

    // Clear previous timer and trigger new setDoc after 1 second
    if (debounceTimers.current[matchId]) {
      clearTimeout(debounceTimers.current[matchId]);
    }

    debounceTimers.current[matchId] = setTimeout(async () => {
      try {
        await setDoc(doc(db, "predictions", predictionDocId), updated);
        setSaveStatus(prev => ({ ...prev, [matchId]: "saved" }));
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [matchId]: null }));
        }, 1500);
      } catch (err) {
        console.error("Autosave error: ", err);
        setSaveStatus(prev => ({ ...prev, [matchId]: "error" }));
      }
    }, 1000);
  };

  // Fetch all live scores from ESPN and auto-save to Firestore
  const fetchAllLiveScores = async () => {
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard");
      const data = await res.json();
      const events = data.events || [];

      const newLiveScores = {};
      const writes = [];

      events.forEach(event => {
        const comp = event.competitions?.[0];
        if (!comp) return;
        const espnHome = comp.competitors?.find(c => c.homeAway === "home");
        const espnAway = comp.competitors?.find(c => c.homeAway === "away");
        if (!espnHome || !espnAway) return;

        const localHome = ESPN_TO_LOCAL_TEAM[espnHome.team.displayName] || espnHome.team.displayName;
        const localAway = ESPN_TO_LOCAL_TEAM[espnAway.team.displayName] || espnAway.team.displayName;

        const matched = matches.find(m =>
          (m.team1 === localHome && m.team2 === localAway) ||
          (m.team1 === localAway && m.team2 === localHome)
        );
        if (!matched) return;

        const flipped = matched.team1 === localAway;
        const status = comp.status;
        const statusName = status?.type?.name || "";

        const liveData = {
          homeScore: flipped ? espnAway.score : espnHome.score,
          awayScore: flipped ? espnHome.score : espnAway.score,
          statusName,
          statusDesc: status?.type?.description || "",
          displayClock: status?.displayClock || "",
          period: status?.period || 0,
        };

        newLiveScores[matched.id] = liveData;

        const notScheduled = statusName !== "STATUS_SCHEDULED" && statusName !== "SCHEDULED";
        if (notScheduled && liveData.homeScore !== "" && liveData.awayScore !== "") {
          writes.push(setDoc(doc(db, "official_results", matched.id), {
            matchId: matched.id,
            homeScore: parseInt(liveData.homeScore, 10),
            awayScore: parseInt(liveData.awayScore, 10),
            updatedBy: "espn-auto"
          }));
        }
      });

      setLiveScores(prev => ({ ...prev, ...newLiveScores }));
      await Promise.all(writes);
    } catch (err) {
      console.error("ESPN auto-fetch error:", err);
    }
  };

  // Calculate points helper
  const calculatePoints = (predHome, predAway, realHome, realAway) => {
    if (predHome === "" || predHome === undefined || predAway === "" || predAway === undefined) return 0;
    if (realHome === "" || realHome === undefined || realAway === "" || realAway === undefined) return 0;

    const pHome = parseInt(predHome, 10);
    const pAway = parseInt(predAway, 10);
    const rHome = parseInt(realHome, 10);
    const rAway = parseInt(realAway, 10);

    let points = 0;

    // 1. Exact score (+3)
    if (pHome === rHome && pAway === rAway) {
      points += 3;
    }
    // 2. Winner or Draw (+2)
    if (Math.sign(pHome - pAway) === Math.sign(rHome - rAway)) {
      points += 2;
    }
    // 3. Home goals (+1)
    if (pHome === rHome) {
      points += 1;
    }
    // 4. Away goals (+1)
    if (pAway === rAway) {
      points += 1;
    }

    return points;
  };

  // Calculate Leaderboard from registered users
  const getLeaderboard = () => {
    return registeredUsers.map((u) => {
      let totalPoints = 0, exactHits = 0, winnerHits = 0, predictedCount = 0, livePoints = 0;

      matches.forEach((m) => {
        const pred = predictions[`${u.email}_${m.id}`];
        const real = officialResults[m.id];
        const live = liveScores[m.id];
        if (pred && pred.predictedHome !== "" && pred.predictedAway !== "") {
          predictedCount++;
          if (real && real.homeScore !== "" && real.homeScore !== undefined) {
            const pts = calculatePoints(pred.predictedHome, pred.predictedAway, real.homeScore, real.awayScore);
            totalPoints += pts;
            const pH = parseInt(pred.predictedHome, 10), pA = parseInt(pred.predictedAway, 10);
            const rH = parseInt(real.homeScore, 10), rA = parseInt(real.awayScore, 10);
            if (pH === rH && pA === rA) exactHits++;
            if (Math.sign(pH - pA) === Math.sign(rH - rA)) winnerHits++;
          } else if (isLiveStatus(live) && live.homeScore !== "" && live.homeScore !== undefined) {
            livePoints += calculatePoints(pred.predictedHome, pred.predictedAway, live.homeScore, live.awayScore);
          }
        }
      });

      const name = u.displayName || u.email;
      return {
        name,
        avatar: getInitials(name),
        photoURL: u.photoURL,
        email: u.email,
        uid: u.uid,
        totalPoints,
        exactHits,
        winnerHits,
        predictedCount,
        livePoints,
        hasLivePoints: livePoints > 0,
      };
    }).sort((a, b) => {
      const aTotal = a.totalPoints + a.livePoints;
      const bTotal = b.totalPoints + b.livePoints;
      if (bTotal !== aTotal) return bTotal - aTotal;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      return b.winnerHits - a.winnerHits;
    });
  };

  const leaderboard = getLeaderboard();
  const hasAnyLiveMatch = matches.some(m => isLiveStatus(liveScores[m.id]));

  const MONTH_ABBR = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const getUserMatchBreakdown = (userEmail) => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
    return matches
      .filter(m => {
        if (m.date > today) return false;
        const pred = predictions[`${userEmail}_${m.id}`];
        return pred && pred.predictedHome !== "" && pred.predictedAway !== "";
      })
      .map(m => {
        const pred = predictions[`${userEmail}_${m.id}`];
        const firestoreResult = officialResults[m.id];
        const live = liveScores[m.id];
        const isLive = isLiveStatus(live);
        const isFinalLive = isFinalStatus(live);

        // Best available result: Firestore first, then ESPN live data
        let real = null;
        let hasReal = false;
        if (firestoreResult && firestoreResult.homeScore !== "" && firestoreResult.homeScore !== undefined) {
          real = firestoreResult;
          hasReal = true;
        } else if (live && (isLive || isFinalLive) && live.homeScore !== "" && live.homeScore !== undefined) {
          real = { homeScore: live.homeScore, awayScore: live.awayScore };
          hasReal = true;
        }

        let pts = null, exactHit = false, winnerHit = false, homeGoal = false, awayGoal = false;
        if (hasReal) {
          const pH = parseInt(pred.predictedHome, 10), pA = parseInt(pred.predictedAway, 10);
          const rH = parseInt(real.homeScore, 10), rA = parseInt(real.awayScore, 10);
          exactHit = pH === rH && pA === rA;
          winnerHit = Math.sign(pH - pA) === Math.sign(rH - rA);
          homeGoal = pH === rH;
          awayGoal = pA === rA;
          pts = (exactHit ? 3 : 0) + (winnerHit ? 2 : 0) + (homeGoal ? 1 : 0) + (awayGoal ? 1 : 0);
        }

        const [, month, day] = m.date.split('-').map(Number);
        const dateLabel = `${day} ${MONTH_ABBR[month]}`;

        return { m, pred, real, hasReal, pts, exactHit, winnerHit, homeGoal, awayGoal, isLive, isFinalLive, live, dateLabel };
      })
      .sort((a, b) => b.m.kickoff - a.m.kickoff);
  };

  // Local flag assets (public/flags/)
  const FLAG_CODES = {
    "Algeria": "dz", "Argentina": "ar", "Australia": "au", "Austria": "at",
    "Belgium": "be", "Bosnia & Herzegovina": "ba", "Brazil": "br", "Canada": "ca",
    "Cape Verde": "cv", "Colombia": "co", "Croatia": "hr", "Curaçao": "cw",
    "Czech Republic": "cz", "DR Congo": "cd", "Ecuador": "ec", "Egypt": "eg",
    "England": "gb-eng", "France": "fr", "Germany": "de", "Ghana": "gh",
    "Haiti": "ht", "Iran": "ir", "Iraq": "iq", "Ivory Coast": "ci",
    "Japan": "jp", "Jordan": "jo", "Mexico": "mx", "Morocco": "ma",
    "Netherlands": "nl", "New Zealand": "nz", "Norway": "no", "Panama": "pa",
    "Paraguay": "py", "Portugal": "pt", "Qatar": "qa", "Saudi Arabia": "sa",
    "Scotland": "gb-sct", "Senegal": "sn", "South Africa": "za", "South Korea": "kr",
    "Spain": "es", "Sweden": "se", "Switzerland": "ch", "Tunisia": "tn",
    "Turkey": "tr", "USA": "us", "Uruguay": "uy", "Uzbekistan": "uz",
  };

  const getFlagUrl = (teamName) => {
    const code = FLAG_CODES[teamName];
    if (!code) return null;
    return `${import.meta.env.BASE_URL}flags/${code}.png`;
  };

  const TEAM_ABBR = {
    "Algeria": "ALG", "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT",
    "Belgium": "BEL", "Bosnia & Herzegovina": "BIH", "Brazil": "BRA", "Canada": "CAN",
    "Cape Verde": "CPV", "Colombia": "COL", "Croatia": "CRO", "Curaçao": "CUW",
    "Czech Republic": "CZE", "DR Congo": "COD", "Ecuador": "ECU", "Egypt": "EGY",
    "England": "ENG", "France": "FRA", "Germany": "GER", "Ghana": "GHA",
    "Haiti": "HAI", "Iran": "IRN", "Iraq": "IRQ", "Ivory Coast": "CIV",
    "Japan": "JPN", "Jordan": "JOR", "Mexico": "MEX", "Morocco": "MAR",
    "Netherlands": "NED", "New Zealand": "NZL", "Norway": "NOR", "Panama": "PAN",
    "Paraguay": "PAR", "Portugal": "POR", "Qatar": "QAT", "Saudi Arabia": "KSA",
    "Scotland": "SCO", "Senegal": "SEN", "South Africa": "RSA", "South Korea": "KOR",
    "Spain": "ESP", "Sweden": "SWE", "Switzerland": "SUI", "Tunisia": "TUN",
    "Turkey": "TUR", "USA": "USA", "Uruguay": "URU", "Uzbekistan": "UZB",
  };

  const getTeamAbbreviation = (teamName) =>
    TEAM_ABBR[teamName] || teamName.substring(0, 3).toUpperCase();

  const TEAM_ES = {
    "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia",
    "Austria": "Austria", "Belgium": "Bélgica", "Bosnia & Herzegovina": "Bosnia",
    "Brazil": "Brasil", "Canada": "Canadá", "Cape Verde": "Cabo Verde",
    "Colombia": "Colombia", "Croatia": "Croacia", "Curaçao": "Curazao",
    "Czech Republic": "Rep. Checa", "DR Congo": "RD Congo", "Ecuador": "Ecuador",
    "Egypt": "Egipto", "England": "Inglaterra", "France": "Francia",
    "Germany": "Alemania", "Ghana": "Ghana", "Haiti": "Haití", "Iran": "Irán",
    "Iraq": "Iraq", "Ivory Coast": "Costa de Marfil", "Japan": "Japón",
    "Jordan": "Jordania", "Mexico": "México", "Morocco": "Marruecos",
    "Netherlands": "Países Bajos", "New Zealand": "Nueva Zelanda", "Norway": "Noruega",
    "Panama": "Panamá", "Paraguay": "Paraguay", "Portugal": "Portugal",
    "Qatar": "Catar", "Saudi Arabia": "Arabia Saudita", "Scotland": "Escocia",
    "Senegal": "Senegal", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur",
    "Spain": "España", "Sweden": "Suecia", "Switzerland": "Suiza",
    "Tunisia": "Túnez", "Turkey": "Turquía", "USA": "EE.UU.", "Uruguay": "Uruguay",
    "Uzbekistan": "Uzbekistán",
  };

  const translateTeamToSpanish = (teamName) => TEAM_ES[teamName] || teamName;

  // ── Knockout bracket helpers ──────────────────────────────
  const getMatchByNum = (num) => matches.find(m => m.num === num);

  const resolveWinnerOrLoser = (matchNum, wantWinner) => {
    const m = getMatchByNum(matchNum);
    if (!m) return null;
    const r = officialResults[m.id];
    if (r && r.homeScore !== "" && r.homeScore !== undefined) {
      const h = parseInt(r.homeScore, 10), a = parseInt(r.awayScore, 10);
      if (h !== a) return wantWinner ? (h > a ? m.team1 : m.team2) : (h > a ? m.team2 : m.team1);
    }
    const live = liveScores[m.id];
    if (live && isFinalStatus(live) && live.homeScore !== "") {
      const h = parseInt(live.homeScore, 10), a = parseInt(live.awayScore, 10);
      if (h !== a) return wantWinner ? (h > a ? m.team1 : m.team2) : (h > a ? m.team2 : m.team1);
    }
    return null;
  };

  const resolveBracketTeam = (placeholder) => {
    if (!placeholder) return null;
    if (placeholder.startsWith('W')) return resolveWinnerOrLoser(parseInt(placeholder.slice(1), 10), true);
    if (placeholder.startsWith('L')) return resolveWinnerOrLoser(parseInt(placeholder.slice(1), 10), false);
    return placeholder;
  };

  const renderBracketCard = (matchNum) => {
    const m = getMatchByNum(matchNum);
    if (!m) return null;
    const t1 = resolveBracketTeam(m.team1);
    const t2 = resolveBracketTeam(m.team2);
    const r = officialResults[m.id];
    const live = liveScores[m.id];
    const hasResult = r && r.homeScore !== "" && r.homeScore !== undefined;
    const isLive = isLiveStatus(live);
    const [, mo, dy] = m.date.split('-').map(Number);
    const dateStr = `${dy}/${mo}, ${formatKickoffColombia(m.kickoff)}`;
    const rH = hasResult ? parseInt(r.homeScore, 10) : null;
    const rA = hasResult ? parseInt(r.awayScore, 10) : null;
    return (
      <div className="bk-card" key={matchNum}>
        <span className="bk-date">{dateStr}</span>
        <div className={`bk-team${hasResult && rH > rA ? ' bk-team-winner' : ''}`}>
          {t1 ? <img className="bk-flag" src={getFlagUrl(t1)} alt={t1} onError={e => { e.target.style.opacity = '0'; }} /> : <span className="bk-tbd-dot" />}
          <span className={`bk-name${!t1 ? ' bk-name-tbd' : ''}`}>{t1 ? translateTeamToSpanish(t1) : 'A definir'}</span>
          {hasResult && <span className={`bk-score${rH > rA ? ' bk-score-win' : ''}`}>{rH}</span>}
          {!hasResult && isLive && live.homeScore !== '' && <span className="bk-score bk-score-live">{live.homeScore}</span>}
        </div>
        <div className={`bk-team${hasResult && rA > rH ? ' bk-team-winner' : ''}`}>
          {t2 ? <img className="bk-flag" src={getFlagUrl(t2)} alt={t2} onError={e => { e.target.style.opacity = '0'; }} /> : <span className="bk-tbd-dot" />}
          <span className={`bk-name${!t2 ? ' bk-name-tbd' : ''}`}>{t2 ? translateTeamToSpanish(t2) : 'A definir'}</span>
          {hasResult && <span className={`bk-score${rA > rH ? ' bk-score-win' : ''}`}>{rA}</span>}
          {!hasResult && isLive && live.awayScore !== '' && <span className="bk-score bk-score-live">{live.awayScore}</span>}
        </div>
      </div>
    );
  };

  // ── Share image ────────────────────────────────────────
  const generateShareImage = async () => {
    const W = 480;
    const PADDING = 20;
    const HEADER_H = 80;
    const SEP = 6;
    const ROW_H = 92;
    const FOOTER_H = 36;
    const FLAG_W = 46;
    const FLAG_H = 32;
    const FLAG_R = 6;

    const dayMatches = matches
      .filter(m => m.date === selectedDate)
      .sort((a, b) => a.kickoff - b.kickoff);

    // Only include matches where the user has a prediction
    const rows = dayMatches
      .map(m => {
        const pred = predictions[`${user.email}_${m.id}`];
        const hasPred = pred && pred.predictedHome !== "" && pred.predictedAway !== "";
        return hasPred ? { m, pred } : null;
      })
      .filter(Boolean);

    // Pre-load flag images + watermark logo
    const loadImg = url => new Promise(res => {
      if (!url) return res(null);
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    });
    const uniqueTeams = [...new Set(dayMatches.flatMap(m => [m.team1, m.team2]))];
    const [flagImgs, watermarkImg] = await Promise.all([
      Promise.all(uniqueTeams.map(async t => [t, await loadImg(getFlagUrl(t))])).then(Object.fromEntries),
      loadImg(worldcupLogo),
    ]);

    const H = HEADER_H + SEP + rows.length * ROW_H + SEP + FOOTER_H;
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // ── Helpers ──────────────────────────────────────────
    const rrPath = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const drawFlag = (img, x, y) => {
      ctx.save();
      rrPath(x, y, FLAG_W, FLAG_H, FLAG_R);
      ctx.clip();
      if (img) { ctx.drawImage(img, x, y, FLAG_W, FLAG_H); }
      else { ctx.fillStyle = '#1f2937'; ctx.fill(); }
      ctx.restore();
      ctx.save();
      rrPath(x, y, FLAG_W, FLAG_H, FLAG_R);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };

    const truncate = (text, maxW) => {
      if (ctx.measureText(text).width <= maxW) return text;
      let t = text;
      while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
      return t + '…';
    };

    // ── Background ───────────────────────────────────────
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0, 255, 135, 0.35)';
    ctx.lineWidth = 2;
    rrPath(3, 3, W - 6, H - 6, 18);
    ctx.stroke();

    // ── Watermark ────────────────────────────────────────
    if (watermarkImg) {
      const wmSize = 220;
      const contentH = rows.length * ROW_H;
      const wmX = (W - wmSize) / 2;
      const wmY = HEADER_H + SEP + (contentH - wmSize) / 2;
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.drawImage(watermarkImg, wmX, wmY, wmSize, wmSize);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Header ───────────────────────────────────────────
    ctx.fillStyle = '#00ff87';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RINCONMUNDIAL', PADDING, 30);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText(formatDateToSpanish(selectedDate).toUpperCase(), PADDING, 50);

    const shortName = currentUserProfile.name.split(' ')[0].toUpperCase();
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(shortName, W - PADDING, 30);
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('MIS PREDICCIONES', W - PADDING, 50);

    ctx.strokeStyle = 'rgba(0, 255, 135, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, HEADER_H - 6);
    ctx.lineTo(W - PADDING, HEADER_H - 6);
    ctx.stroke();

    // ── Match rows (predictions only) ────────────────────
    const LEFT_FLAG_X  = PADDING;
    const RIGHT_FLAG_X = W - PADDING - FLAG_W;
    const LEFT_CENTER  = LEFT_FLAG_X  + FLAG_W / 2;
    const RIGHT_CENTER = RIGHT_FLAG_X + FLAG_W / 2;
    const NAME_MAX_W   = W / 2 - LEFT_CENTER - 14;

    rows.forEach(({ m, pred }, idx) => {
      const rowY  = HEADER_H + SEP + idx * ROW_H;
      const timeY = rowY + 14;
      const flagY = rowY + 22;
      const nameY = flagY + FLAG_H + 12;
      const predY = flagY + FLAG_H / 2 + 7;

      if (idx % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(PADDING - 8, rowY + 2, W - (PADDING - 8) * 2, ROW_H - 4);
      }

      // Time + group (small, centered at top of row)
      const groupShort = m.group ? m.group.replace('Group ', 'G') : '';
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${formatKickoffColombia(m.kickoff)}  ·  ${groupShort}`, W / 2, timeY);

      // Left team: flag + name
      drawFlag(flagImgs[m.team1], LEFT_FLAG_X, flagY);
      ctx.fillStyle = '#d1d5db';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(truncate(translateTeamToSpanish(m.team1).toUpperCase(), NAME_MAX_W * 2), LEFT_CENTER, nameY);

      // Right team: flag + name
      drawFlag(flagImgs[m.team2], RIGHT_FLAG_X, flagY);
      ctx.fillStyle = '#d1d5db';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(truncate(translateTeamToSpanish(m.team2).toUpperCase(), NAME_MAX_W * 2), RIGHT_CENTER, nameY);

      // Center: prediction score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pred.predictedHome}  —  ${pred.predictedAway}`, W / 2, predY);
    });

    // ── Footer branding ──────────────────────────────────
    const footerY = HEADER_H + SEP + rows.length * ROW_H + SEP;
    ctx.fillStyle = '#374151';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('rinconmundial · mundial 2026', W / 2, footerY + 22);

    return new Promise(res => canvas.toBlob(res, 'image/png'));
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const blob = await generateShareImage();
      const dateLabel = formatDateToSpanish(selectedDate);
      const fileName = `rinconmundial-${selectedDate}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `RinconMundial · ${dateLabel}`,
          text: `Mis predicciones del ${dateLabel} ⚽`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Share error:', err);
    } finally {
      setIsSharing(false);
    }
  };
  // ── End share ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="login-container">
        <Loader className="logo-icon" style={{ animation: "spin 2s linear infinite" }} />
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    const passphraseOk = passphrase === SANTO_Y_SENA;
    return (
      <div className="login-container">
        <div className="login-card">
          {/* Header */}
          <div className="login-logo">
            <div className="login-trophy-wrap">
              <Trophy className="logo-icon" />
            </div>
            <h1 className="logo-text">RinconMundial</h1>
            <p className="login-subtitle">Polla familiar · Mundial 2026</p>
          </div>

          <div className="login-divider" />

          <p className="login-invite-text">
            Ingresa el santo y seña para unirte
          </p>

          {/* Passphrase input */}
          <div className="input-group">
            <div className="passphrase-input-wrap">
              <svg className="passphrase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                className={`input-field passphrase-input${passphraseOk ? " passphrase-ok" : ""}`}
                type="password"
                placeholder="Ingresa el santo y seña"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && passphraseOk && handleGoogleLogin()}
                autoComplete="off"
              />
              {passphraseOk && (
                <svg className="passphrase-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          </div>

          {/* Google Sign-in button */}
          <button
            className={`btn-google${passphraseOk ? "" : " btn-google-disabled"}`}
            onClick={handleGoogleLogin}
            disabled={!passphraseOk}
          >
            <svg className="google-logo" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continuar con Google
          </button>

          {authError && (
            <div className="login-error">
              {authError}
            </div>
          )}

          <p className="login-footer-note">
            Solo participantes de la familia Rincón
          </p>
        </div>
      </div>
    );
  }

  // WELCOME SCREEN (after fresh login)
  if (showWelcome) {
    const profile = getUserProfile(user);
    return (
      <div className="login-container">
        <div className="login-card welcome-card-screen">
          <div className="welcome-confetti">🏆</div>
          {profile.photoURL ? (
            <img src={profile.photoURL} alt={profile.name} className="welcome-avatar" />
          ) : (
            <div className="welcome-avatar welcome-avatar-initials">{profile.avatar}</div>
          )}
          <h2 className="welcome-name">¡Bienvenido, {profile.name.split(" ")[0]}!</h2>
          <p className="welcome-registered">Ya quedaste registrado en la polla familiar.</p>
          <p className="welcome-hint">
            Cuando todos ingresen, podrán empezar a hacer sus predicciones para el Mundial 2026.
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              setShowWelcome(false);
              window.history.replaceState({}, "", window.location.pathname);
            }}
          >
            Entrar al panel →
          </button>
        </div>
      </div>
    );
  }

  // MAIN LAYOUT
  const filteredMatches = matches
    .filter(m => m.date === selectedDate)
    .sort((a, b) => a.kickoff - b.kickoff);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container" style={{ justifyContent: "center" }}>
          <img src={worldcupLogo} alt="RinconMundial" style={{ width: 72, height: 72, objectFit: "contain" }} />
        </div>
        <ul className="nav-menu">
          <li 
            className={`nav-item ${currentTab === "inicio" ? "active" : ""}`}
            onClick={() => setCurrentTab("inicio")}
          >
            <Home /> INICIO
          </li>
          <li 
            className={`nav-item ${currentTab === "predicciones" ? "active" : ""}`}
            onClick={() => setCurrentTab("predicciones")}
          >
            <CheckSquare /> PREDICCIONES
          </li>
          <li 
            className={`nav-item ${currentTab === "ranking" ? "active" : ""}`}
            onClick={() => setCurrentTab("ranking")}
          >
            <Trophy /> RANKING
          </li>
        </ul>
        <div className="logout-container">
          <div className="nav-item" onClick={handleLogout}>
            <LogOut /> CERRAR SESIÓN
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        className={`drawer-overlay${drawerOpen ? " drawer-overlay-visible" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Mobile Drawer Panel */}
      <nav className={`drawer-panel${drawerOpen ? " drawer-open" : ""}`}>
        <div className="drawer-header" style={{ position: "relative", justifyContent: "center" }}>
          <div className="logo-container" style={{ padding: 0, paddingBottom: 0, justifyContent: "center" }}>
            <img src={worldcupLogo} alt="RinconMundial" style={{ width: 72, height: 72, objectFit: "contain" }} />
          </div>
          <button className="drawer-close-btn" style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }} onClick={() => setDrawerOpen(false)}>
            <X size={22} />
          </button>
        </div>
        <ul className="nav-menu">
          <li className={`nav-item ${currentTab === "inicio" ? "active" : ""}`}
              onClick={() => { setCurrentTab("inicio"); setDrawerOpen(false); }}>
            <Home /> INICIO
          </li>
          <li className={`nav-item ${currentTab === "predicciones" ? "active" : ""}`}
              onClick={() => { setCurrentTab("predicciones"); setDrawerOpen(false); }}>
            <CheckSquare /> PREDICCIONES
          </li>
          <li className={`nav-item ${currentTab === "ranking" ? "active" : ""}`}
              onClick={() => { setCurrentTab("ranking"); setDrawerOpen(false); }}>
            <Trophy /> RANKING
          </li>
        </ul>
        <div className="logout-container">
          <div className="nav-item" onClick={handleLogout}>
            <LogOut /> CERRAR SESIÓN
          </div>
        </div>
      </nav>

      {/* Main Panel */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
            <Menu size={24} />
          </button>
          <div className="header-title-section">
            <span className="header-subtitle">POLLA MUNDIALISTA</span>
            <h1 className="header-title">
              <span className="header-title-text">RINCON MUNDIAL </span><img src={worldcupLogo} alt="" style={{ width: 22, height: 22, objectFit: "contain", verticalAlign: "middle" }} />
            </h1>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{currentUserProfile.name}</span>
              <span className="user-role">Participante</span>
            </div>
            {currentUserProfile.photoURL ? (
              <img 
                src={currentUserProfile.photoURL} 
                alt={currentUserProfile.name} 
                className="user-avatar" 
                style={{ objectFit: "cover" }} 
              />
            ) : (
              <div className="user-avatar">{currentUserProfile.avatar}</div>
            )}
          </div>
        </header>

        {/* Content View */}
        <div className="page-container">
          
          {/* 1. INICIO VIEW */}
          {currentTab === "inicio" && (
            <>
              <div className="welcome-card">
                <div className="welcome-text">
                  <h1>¡Hola, {currentUserProfile.name}! ⚽</h1>
                  <p>
                    Bienvenido a la polla familiar RinconMundial. Digita tus predicciones antes de cada partido. 
                    El sistema guardará todo automáticamente. Una vez empiece un encuentro, podrás ver 
                    qué predijeron tus rivales y completar cooperativamente el marcador real del juego.
                  </p>
                </div>
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "800", marginTop: "12px" }}>Posiciones Actuales</h2>
              <div className="ranking-summary-grid">
                {leaderboard.map((u, i) => (
                  <div className={`summary-card summary-card-${i+1}`} key={u.email}>
                    <span className="summary-card-label">PUESTO {i+1}</span>
                    <span className="summary-card-value" style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : "#b45309" }}>
                      {u.name}
                    </span>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      {u.totalPoints + u.livePoints} PTS | {u.exactHits} Marcadores Exactos
                    </span>
                    {u.hasLivePoints && (
                      <span className="summary-live-tag"><span className="summary-live-dot" /> +{u.livePoints} en vivo</span>
                    )}
                  </div>
                ))}
              </div>

              <h2 style={{ fontSize: "20px", fontWeight: "800", marginTop: "24px", marginBottom: "4px" }}>Eliminatoria</h2>
              {matches.length > 0 && (
                <div className="bracket-scroll">
                  <div className="bracket-inner">
                    <div className="bracket-col">
                      <div className="bracket-col-header">Eliminatoria de 32</div>
                      <div className="bracket-slots">
                        {[73,75,74,77,82,81,84,83,76,78,79,80,85,87,88,86].map(num => (
                          <div key={num} className="bracket-slot bracket-slot-1">{renderBracketCard(num)}</div>
                        ))}
                      </div>
                    </div>
                    <div className="bracket-col">
                      <div className="bracket-col-header">Octavos de Final</div>
                      <div className="bracket-slots">
                        {[90,89,94,93,91,92,96,95].map(num => (
                          <div key={num} className="bracket-slot bracket-slot-2">{renderBracketCard(num)}</div>
                        ))}
                      </div>
                    </div>
                    <div className="bracket-col">
                      <div className="bracket-col-header">Cuartos de Final</div>
                      <div className="bracket-slots">
                        {[97,98,99,100].map(num => (
                          <div key={num} className="bracket-slot bracket-slot-4">{renderBracketCard(num)}</div>
                        ))}
                      </div>
                    </div>
                    <div className="bracket-col">
                      <div className="bracket-col-header">Semifinales</div>
                      <div className="bracket-slots">
                        {[101,102].map(num => (
                          <div key={num} className="bracket-slot bracket-slot-8">{renderBracketCard(num)}</div>
                        ))}
                      </div>
                    </div>
                    <div className="bracket-col">
                      <div className="bracket-col-header">Final</div>
                      <div className="bracket-slots">
                        <div className="bracket-slot bracket-slot-16">{renderBracketCard(104)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 2. PREDICCIONES VIEW */}
          {currentTab === "predicciones" && (
            <>
              {/* Date Selection Ribbon */}
              <div className="date-selector-ribbon">
                <div className="dates-scroll-container" ref={datesScrollRef}>
                  {dates.map((d) => (
                    <button
                      key={d}
                      className={`date-btn ${selectedDate === d ? "active" : ""} ${d === todayStr && selectedDate !== d ? "today" : ""}`}
                      onClick={() => setSelectedDate(d)}
                    >
                      {formatDateToSpanish(d)}
                      {d === todayStr && <span className="today-dot" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Match Cards */}
              <div className="matches-grid">
                {filteredMatches.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                    <Calendar className="empty-icon" />
                    <span className="empty-title">Sin partidos</span>
                    <span className="empty-desc">No hay encuentros del mundial programados para este día.</span>
                  </div>
                ) : (
                  filteredMatches.map((m) => {
                    const isLocked = currentTime >= m.kickoff;
                    const predictionDocId = `${user.email}_${m.id}`;
                    const userPred = predictions[predictionDocId] || { predictedHome: "", predictedAway: "" };
                    const realResult = officialResults[m.id] || { homeScore: "", awayScore: "" };

                    // Calculate countdown string
                    let countdownText = "";
                    let isMatchLive = false;
                    if (!isLocked) {
                      const diffMs = m.kickoff.getTime() - currentTime.getTime();
                      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
                      if (diffHrs > 0) {
                        countdownText = `CIERRA EN ${diffHrs}h ${diffMins}m ${diffSecs}s`;
                      } else {
                        countdownText = `CIERRA EN ${diffMins}m ${diffSecs}s`;
                      }
                    } else {
                      const live = liveScores[m.id];
                      isMatchLive = isLiveStatus(live);
                      if (isMatchLive) countdownText = `EN VIVO · ${live.displayClock}`;
                      else if (isFinalStatus(live)) countdownText = "FINALIZADO";
                      else countdownText = "CERRADO";
                    }

                    // --- FINALIZED CARD (new scoreboard style) ---
                    const live = liveScores[m.id];
                    const isInProgress = isLiveStatus(live);
                    const hasResult = realResult.homeScore !== "" && realResult.homeScore !== undefined;
                    const isFinalized = isLocked && hasResult && !isInProgress;

                    if (isFinalized) {
                      const myPred = predictions[`${user.email}_${m.id}`];
                      const myHasPred = myPred && myPred.predictedHome !== "" && myPred.predictedAway !== "";
                      const rH = parseInt(realResult.homeScore, 10);
                      const rA = parseInt(realResult.awayScore, 10);
                      let myPts = null, isExact = false, isWinner = false, homeGoal = false, awayGoal = false;
                      if (myHasPred) {
                        const pH = parseInt(myPred.predictedHome, 10);
                        const pA = parseInt(myPred.predictedAway, 10);
                        isExact  = pH === rH && pA === rA;
                        isWinner = Math.sign(pH - pA) === Math.sign(rH - rA);
                        homeGoal = pH === rH;
                        awayGoal = pA === rA;
                        myPts = calculatePoints(myPred.predictedHome, myPred.predictedAway, rH, rA);
                      }
                      const ptsCat = myPts === 7 ? "ACIERTO EXACTO" : myPts > 0 ? "ACIERTO PARCIAL" : "SIN PUNTOS";
                      const breakdown = [];
                      if (isExact)   breakdown.push("Exacto +3");
                      if (isWinner)  breakdown.push("Resultado +2");
                      if (homeGoal)  breakdown.push("Gol L +1");
                      if (awayGoal)  breakdown.push("Gol V +1");
                      const groupLabel = m.group ? m.group.replace("Group ", "GRUPO ") : "";

                      return (
                        <div className="match-card match-card-final" key={m.id}>
                          {/* Meta */}
                          <div className="final-card-meta">
                            <span className="final-group-tag">{groupLabel}</span>
                            <span className="final-venue-tag">{m.ground}</span>
                            <span className="final-venue-tag">{formatKickoffColombia(m.kickoff)}</span>
                          </div>

                          <div className="final-status-label">FINALIZADO</div>

                          {/* Teams + Scores */}
                          <div className="final-card-body">
                            <div className="final-team-col">
                              <span className="final-abbr">{getTeamAbbreviation(m.team1)}</span>
                              <div className="final-flag-wrap">
                                <img className="team-flag" src={getFlagUrl(m.team1)} alt={m.team1} onError={(e) => { e.target.style.opacity='0'; }} />
                              </div>
                              <span className="final-team-name-label">{translateTeamToSpanish(m.team1).toUpperCase()}</span>
                            </div>

                            <div className="final-center-col">
                              <div className="final-score-box">
                                <span className="final-box-label">RESULTADO</span>
                                <span className="final-box-score">{rH} - {rA}</span>
                              </div>
                              <div className="final-score-box final-pred-box">
                                <span className="final-box-label">TU PRONÓSTICO</span>
                                {myHasPred
                                  ? <span className="final-box-score final-box-pred-score">{myPred.predictedHome} - {myPred.predictedAway}</span>
                                  : <span className="final-box-no-pred">Sin pronóstico</span>
                                }
                              </div>
                            </div>

                            <div className="final-team-col">
                              <span className="final-abbr">{getTeamAbbreviation(m.team2)}</span>
                              <div className="final-flag-wrap">
                                <img className="team-flag" src={getFlagUrl(m.team2)} alt={m.team2} onError={(e) => { e.target.style.opacity='0'; }} />
                              </div>
                              <span className="final-team-name-label">{translateTeamToSpanish(m.team2).toUpperCase()}</span>
                            </div>
                          </div>

                          {/* Rival predictions */}
                          {registeredUsers.filter(ru => ru.email !== user.email).length > 0 && (
                            <div className="rival-predictions-container">
                              <span className="rival-predictions-title">Predicciones Rivales</span>
                              {registeredUsers.filter(ru => ru.email !== user.email).map((ru) => {
                                const rPred = predictions[`${ru.email}_${m.id}`];
                                const rHasPred = rPred && rPred.predictedHome !== "" && rPred.predictedAway !== "";
                                const rPts = rHasPred ? calculatePoints(rPred.predictedHome, rPred.predictedAway, rH, rA) : null;
                                return (
                                  <div className="rival-row" key={ru.uid}>
                                    <span className="rival-name">{ru.displayName || ru.email}</span>
                                    <div>
                                      <span className="rival-score">{rHasPred ? `${rPred.predictedHome} - ${rPred.predictedAway}` : "Sin pronóstico"}</span>
                                      {rPts !== null && <span className="rival-points-badge">+{rPts} PTS</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Points footer — must be last child so it's flush with card bottom */}
                          {myHasPred && myPts !== null && (
                            <div className={`final-pts-footer ${myPts === 0 ? "final-pts-footer-zero" : ""}`}>
                              <span className="final-pts-number">+{myPts} PTS</span>
                              <span className="final-pts-category">{ptsCat}</span>
                              {breakdown.length > 0 && (
                                <span className="final-pts-breakdown">({breakdown.join(", ")})</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className={`match-card ${!isLocked ? "active-today" : ""} ${isMatchLive ? "match-card-live" : ""}`} key={m.id}>
                        <div className="match-card-header">
                          <span className="match-group">{m.group}</span>
                          <span className={`match-countdown ${isMatchLive ? "live" : isLocked ? "locked" : ""}`}>
                            <Clock size={14} /> {countdownText}
                          </span>
                        </div>

                        {/* Match Teams and Inputs */}
                        <div className="match-card-body">
                          {/* Team Local */}
                          <div className="team-section">
                            <div className="team-flag-container">
                              <img className="team-flag" src={getFlagUrl(m.team1)} alt={m.team1} onError={(e) => { e.target.style.opacity='0'; }} />
                            </div>
                            <span className="team-name-abbr">{getTeamAbbreviation(m.team1)}</span>
                            <span className="team-name-full">{translateTeamToSpanish(m.team1)}</span>
                          </div>

                          {/* VS label — hidden on desktop, visible on mobile between teams */}
                          <span className="teams-vs">VS</span>

                          {/* Prediction inputs */}
                          <div className="scores-input-section">
                          <span className="prediction-label">Tu predicción</span>
                          <div className="scores-input-area">
                            <input 
                              className="score-input"
                              type="number"
                              min="0"
                              max="99"
                              value={userPred.predictedHome === undefined ? "" : userPred.predictedHome}
                              onChange={(e) => savePrediction(m.id, "home", e.target.value)}
                              disabled={isLocked}
                              placeholder="-"
                            />
                            <span className="score-divider">-</span>
                            <input 
                              className="score-input"
                              type="number"
                              min="0"
                              max="99"
                              value={userPred.predictedAway === undefined ? "" : userPred.predictedAway}
                              onChange={(e) => savePrediction(m.id, "away", e.target.value)}
                              disabled={isLocked}
                              placeholder="-"
                            />
                          </div>
                          </div>

                          {/* Team Visitor */}
                          <div className="team-section">
                            <div className="team-flag-container">
                              <img className="team-flag" src={getFlagUrl(m.team2)} alt={m.team2} onError={(e) => { e.target.style.opacity='0'; }} />
                            </div>
                            <span className="team-name-abbr">{getTeamAbbreviation(m.team2)}</span>
                            <span className="team-name-full">{translateTeamToSpanish(m.team2)}</span>
                          </div>
                        </div>

                        {/* Footer: status and info */}
                        <div className="match-card-footer">
                          <span className="match-venue">{m.ground}</span>
                          <span className="match-venue">{formatKickoffColombia(m.kickoff)}</span>
                          {saveStatus[m.id] && (
                            <div className="autosave-status">
                              {saveStatus[m.id] === "saving" && <span className="status-saving">Guardando...</span>}
                              {saveStatus[m.id] === "saved" && <span className="status-saved">Guardado ✓</span>}
                              {saveStatus[m.id] === "error" && <span style={{ color: "#ef4444" }}>Error!</span>}
                            </div>
                          )}
                        </div>

                        {/* Live score section: auto-updated from ESPN polling */}
                        {isLocked && (() => {
                          const live = liveScores[m.id];
                          const hasFirestore = realResult.homeScore !== "" && realResult.homeScore !== undefined;
                          const isInProgress = isLiveStatus(live);
                          const isFinal = isFinalStatus(live);

                          if (live) return (
                            <div className="live-score-banner">
                              <div className="live-banner-left">
                                {isInProgress && <span className="live-badge">EN VIVO</span>}
                                {isFinal && <span className="final-badge">FINALIZADO</span>}
                                {!isInProgress && !isFinal && <span className="final-badge">{live.statusDesc}</span>}
                              </div>
                              <div className="live-score-display">
                                <span className="live-score-number">{live.homeScore}</span>
                                <span className="live-score-dash">-</span>
                                <span className="live-score-number">{live.awayScore}</span>
                              </div>
                              <div className="live-minute-block">
                                {isInProgress
                                  ? <span className="live-minute">{live.displayClock}</span>
                                  : <span className="live-minute-empty">—</span>
                                }
                              </div>
                            </div>
                          );

                          if (hasFirestore) return (
                            <div className="live-score-banner">
                              <div className="live-banner-left">
                                <span className="final-badge">GUARDADO</span>
                              </div>
                              <div className="live-score-display">
                                <span className="live-score-number">{realResult.homeScore}</span>
                                <span className="live-score-dash">-</span>
                                <span className="live-score-number">{realResult.awayScore}</span>
                              </div>
                            </div>
                          );

                          return null;
                        })()}

                        {/* Own points badge when match has result */}
                        {isLocked && (() => {
                          const myPred = predictions[`${user.email}_${m.id}`];
                          const myHasPred = myPred && myPred.predictedHome !== "" && myPred.predictedAway !== "";
                          const hasResult = realResult.homeScore !== "" && realResult.homeScore !== undefined;
                          if (!myHasPred || !hasResult) return null;
                          const myPts = calculatePoints(myPred.predictedHome, myPred.predictedAway, realResult.homeScore, realResult.awayScore);
                          const pH = parseInt(myPred.predictedHome, 10), pA = parseInt(myPred.predictedAway, 10);
                          const rH = parseInt(realResult.homeScore, 10), rA = parseInt(realResult.awayScore, 10);
                          const isExact = pH === rH && pA === rA;
                          const isWinner = Math.sign(pH - pA) === Math.sign(rH - rA);
                          const homeGoal = pH === rH;
                          const awayGoal = pA === rA;
                          return (
                            <div className="own-points-row">
                              <span className="own-points-label">Tu puntuación:</span>
                              <div className="own-points-tags">
                                {isExact && <span className="bp-tag bp-exact">+3 Exacto</span>}
                                {isWinner && <span className="bp-tag bp-winner">+2 Ganador</span>}
                                {homeGoal && <span className="bp-tag bp-goal">+1 Local</span>}
                                {awayGoal && <span className="bp-tag bp-goal">+1 Visitante</span>}
                                {myPts === 0 && <span className="bp-tag bp-zero">0 pts</span>}
                                <span className="own-points-total">{myPts} PTS</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Rival predictions (only visible when match is locked) */}
                        {isLocked && registeredUsers.filter(u => u.email !== user.email).length > 0 && (
                          <div className="rival-predictions-container">
                            <span className="rival-predictions-title">Predicciones Rivales</span>
                            {registeredUsers
                              .filter(ru => ru.email !== user.email)
                              .map((ru) => {
                                const rivalPred = predictions[`${ru.email}_${m.id}`];
                                const rivalName = ru.displayName || ru.email;
                                const rivalHasPred = rivalPred && rivalPred.predictedHome !== "" && rivalPred.predictedAway !== "";
                                const rPoints = rivalHasPred && realResult.homeScore !== "" && realResult.awayScore !== ""
                                  ? calculatePoints(rivalPred.predictedHome, rivalPred.predictedAway, realResult.homeScore, realResult.awayScore)
                                  : null;
                                return (
                                  <div className="rival-row" key={ru.uid}>
                                    <span className="rival-name">{rivalName}</span>
                                    <div>
                                      <span className="rival-score">
                                        {rivalHasPred ? `${rivalPred.predictedHome} - ${rivalPred.predictedAway}` : "Sin pronóstico"}
                                      </span>
                                      {rPoints !== null && (
                                        <span className="rival-points-badge">+{rPoints} PTS</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Share FAB — visible when there are matches for this day */}
              {filteredMatches.length > 0 && (
                <button
                  className={`share-fab${isSharing ? " share-fab-loading" : ""}`}
                  onClick={handleShare}
                  disabled={isSharing}
                  title={`Compartir marcadores del ${formatDateToSpanish(selectedDate)}`}
                >
                  {isSharing
                    ? <Loader size={22} style={{ animation: "spin 1s linear infinite" }} />
                    : <Share2 size={22} />}
                </button>
              )}
            </>
          )}

          {/* 3. RANKING VIEW */}
          {currentTab === "ranking" && (
            <>
              {hasAnyLiveMatch && (
                <div className="live-ranking-banner">
                  <span className="live-ranking-dot" />
                  <span className="live-ranking-title">EN VIVO · RESULTADOS PARCIALES</span>
                  <span className="live-ranking-sub">Los puntos se actualizan con el marcador actual</span>
                </div>
              )}
              <div className="ranking-table-card">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th className="th-puesto">PUESTO</th>
                      <th className="th-competidor">COMPETIDOR</th>
                      <th style={{ textAlign: "right" }}>PUNTOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((u, index) => {
                      const isExpanded = expandedRankingUser === u.email;
                      const breakdown = isExpanded ? getUserMatchBreakdown(u.email) : [];
                      return (
                        <React.Fragment key={u.email}>
                          <tr
                            className={`ranking-row ranking-row-clickable${isExpanded ? " ranking-row-expanded" : ""}`}
                            onClick={() => setExpandedRankingUser(isExpanded ? null : u.email)}
                          >
                            <td className={`rank-position rank-position-${index+1}`}>
                              #{index + 1}
                            </td>
                            <td>
                              <div className="rank-user-cell">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.name} className="user-avatar" style={{ width: "36px", height: "36px", objectFit: "cover" }} />
                                ) : (
                                  <div className="user-avatar" style={{ width: "36px", height: "36px", fontSize: "13px" }}>{u.avatar}</div>
                                )}
                                <div className="rank-user-info">
                                  <span className="rank-user-name">{u.name}</span>
                                  <span className="rank-user-stats">
                                    {u.exactHits > 0 && <span className="stat-exact">⬡ {u.exactHits} exactos</span>}
                                    {u.winnerHits > 0 && <span className="stat-winner">◈ {u.winnerHits} ganador</span>}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
                                {hasAnyLiveMatch && u.hasLivePoints && (
                                  <span className="rank-live-pts-tag">+{u.livePoints} en vivo</span>
                                )}
                                <span className="rank-score-total">{u.totalPoints + u.livePoints} PTS</span>
                                <span className="rank-expand-hint">{isExpanded ? "▲" : "▼"}</span>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="ranking-breakdown-row">
                              <td colSpan={3}>
                                <div className="ranking-breakdown">
                                  {breakdown.length === 0 ? (
                                    <p className="breakdown-empty">Sin predicciones registradas.</p>
                                  ) : (() => {
                                    // Group by date preserving newest-first order from breakdown
                                    const groups = new Map();
                                    breakdown.forEach(item => {
                                      if (!groups.has(item.dateLabel)) groups.set(item.dateLabel, []);
                                      groups.get(item.dateLabel).push(item);
                                    });
                                    return [...groups.entries()].map(([dateLabel, items]) => (
                                      <div className="breakdown-date-group" key={dateLabel}>
                                        <div className="breakdown-date-label">{dateLabel}</div>
                                        {items.map(({ m, pred, hasReal, real, pts, exactHit, winnerHit, homeGoal, awayGoal, isLive, live }) => (
                                          <div className={`breakdown-match${isLive ? " breakdown-match-live" : ""}`} key={m.id}>
                                            {/* Teams row with flags */}
                                            <div className="breakdown-teams">
                                              <div className="breakdown-team">
                                                <div className="breakdown-flag">
                                                  <img src={getFlagUrl(m.team1)} alt={m.team1} onError={(e) => { e.target.style.opacity='0'; }} />
                                                </div>
                                                <span className="breakdown-team-name">{translateTeamToSpanish(m.team1).toUpperCase()}</span>
                                              </div>
                                              <div className="breakdown-vs-sep">
                                                {isLive && <span className="breakdown-live-badge">EN VIVO {live?.displayClock}</span>}
                                                {!isLive && <span className="breakdown-vs-label">VS</span>}
                                                <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                                  {formatKickoffColombia(m.kickoff)}
                                                </span>
                                              </div>
                                              <div className="breakdown-team breakdown-team-right">
                                                <div className="breakdown-flag">
                                                  <img src={getFlagUrl(m.team2)} alt={m.team2} onError={(e) => { e.target.style.opacity='0'; }} />
                                                </div>
                                                <span className="breakdown-team-name">{translateTeamToSpanish(m.team2).toUpperCase()}</span>
                                              </div>
                                            </div>
                                            {/* Scores row: prediction → real */}
                                            <div className="breakdown-scores">
                                              <span className="breakdown-scores-label">Pronóstico</span>
                                              <span className="breakdown-pred">{pred.predictedHome} - {pred.predictedAway}</span>
                                              {hasReal && (
                                                <>
                                                  <span className="breakdown-sep">→</span>
                                                  <span className="breakdown-scores-label">Real</span>
                                                  <span className={`breakdown-real${isLive ? " breakdown-real-live" : ""}`}>{real.homeScore} - {real.awayScore}</span>
                                                </>
                                              )}
                                              {!hasReal && <span className="breakdown-pending">Pendiente</span>}
                                            </div>
                                            {/* Points row */}
                                            {hasReal && (
                                              <div className="breakdown-points">
                                                {exactHit && <span className="bp-tag bp-exact">+3 Exacto</span>}
                                                {winnerHit && <span className="bp-tag bp-winner">+2 Ganador</span>}
                                                {homeGoal && <span className="bp-tag bp-goal">+1 Local</span>}
                                                {awayGoal && <span className="bp-tag bp-goal">+1 Visitante</span>}
                                                {pts === 0 && <span className="bp-tag bp-zero">0 pts</span>}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Live scoreboard strip — only when matches are in progress */}
              {(() => {
                const liveMatches = matches.filter(m => isLiveStatus(liveScores[m.id]));
                if (!liveMatches.length) return null;
                return (
                  <div className="live-score-strip">
                    <div className="live-strip-header">
                      <span className="live-chip-dot" />
                      <span className="live-chip-label">EN VIVO</span>
                    </div>
                    <div className="live-strip-chips">
                      {liveMatches.map(m => {
                        const live = liveScores[m.id];
                        return (
                          <div className="live-score-chip" key={m.id}>
                            <div className="live-chip-body">
                              <img className="live-chip-flag" src={getFlagUrl(m.team1)} alt={m.team1} onError={e => { e.target.style.opacity = '0'; }} />
                              <span className="live-chip-score">{live.homeScore}</span>
                              <div className="live-chip-center">
                                <img className="live-chip-logo" src={worldcupLogo} alt="" />
                                <span className="live-chip-clock">{live.displayClock}</span>
                              </div>
                              <span className="live-chip-score">{live.awayScore}</span>
                              <img className="live-chip-flag" src={getFlagUrl(m.team2)} alt={m.team2} onError={e => { e.target.style.opacity = '0'; }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
