import React, { useState, useEffect, useRef } from "react";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot 
} from "firebase/firestore";
import { auth, db } from "./firebase";
import worldCupData from "./worldcup.json";
import { 
  Trophy, 
  Calendar, 
  LogOut, 
  User, 
  LogIn, 
  ShieldAlert,
  Loader,
  Clock,
  CheckCircle,
  AlertCircle,
  Home,
  CheckSquare
} from "lucide-react";
import confetti from "canvas-confetti";

// Preconfigured user mapping by email keyword
const USER_PROFILES = {
  "domi": { name: "Domiciano Rincon", avatar: "DR" },
  "juliana": { name: "Juliana Rincon", avatar: "JR" },
  "papa": { name: "Papa", avatar: "P" }
};

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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [currentTab, setCurrentTab] = useState("predicciones");

  // Matches schedules and formatting
  const [matches, setMatches] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");

  // Firestore sync state
  const [predictions, setPredictions] = useState({}); // Key: userEmail_matchId -> { home, away }
  const [officialResults, setOfficialResults] = useState({}); // Key: matchId -> { home, away }
  const [saveStatus, setSaveStatus] = useState({}); // Key: matchId -> 'saving' | 'saved' | 'error'

  // Time tracking
  const [currentTime, setCurrentTime] = useState(new Date());

  // Listen to current time to update counts & locks every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
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

      // Select date by default: check current date in GMT-5
      const nowGMT5 = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      const todayStr = nowGMT5.toISOString().split("T")[0];

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

  // Handle Log In
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const emailLower = authEmail.toLowerCase().trim();

    // Verification: limit to the 3 users
    const matchedProfile = Object.keys(USER_PROFILES).find(key => emailLower.includes(key));
    if (!matchedProfile) {
      setAuthError("Acceso restringido: Solo Juliana Rincon, Papa y Domiciano Rincon pueden ingresar.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, emailLower, authPassword);
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setAuthError("Usuario no registrado en la base de datos.");
      } else if (err.code === "auth/wrong-password") {
        setAuthError("Contraseña incorrecta.");
      } else {
        setAuthError("Error al iniciar sesión: " + err.message);
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

  // Profile resolution for user email
  const getUserProfile = (email) => {
    if (!email) return { name: "Invitado", avatar: "?" };
    const prefix = email.split("@")[0].toLowerCase();
    const matched = Object.keys(USER_PROFILES).find(key => prefix.includes(key));
    return USER_PROFILES[matched] || { name: email, avatar: email.substring(0,2).toUpperCase() };
  };

  const currentUserProfile = getUserProfile(user?.email);

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

  // Save official score by any user
  const saveOfficialScore = async (matchId, team, value) => {
    const existing = officialResults[matchId] || { matchId, homeScore: "", awayScore: "", updatedBy: user.email };
    const parsedVal = value === "" ? "" : parseInt(value, 10);
    const updated = {
      ...existing,
      homeScore: team === "home" ? parsedVal : existing.homeScore,
      awayScore: team === "away" ? parsedVal : existing.awayScore,
      updatedBy: user.email
    };

    setOfficialResults(prev => ({
      ...prev,
      [matchId]: updated
    }));

    try {
      await setDoc(doc(db, "official_results", matchId), updated);
    } catch (err) {
      console.error("Error saving official score: ", err);
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

  // Calculate Leaderboard
  const getLeaderboard = () => {
    const userKeys = ["domi", "juliana", "papa"];
    const board = userKeys.map((key) => {
      let email = "";
      if (key === "domi") email = "domi@mundial.com";
      if (key === "juliana") email = "juliana@mundial.com";
      if (key === "papa") email = "papa@mundial.com";

      const profile = USER_PROFILES[key];
      let totalPoints = 0;
      let exactHits = 0;
      let winnerHits = 0;
      let goalsHits = 0;
      let predictedCount = 0;

      matches.forEach((m) => {
        const predictionKey = `${email}_${m.id}`;
        const pred = predictions[predictionKey];
        const real = officialResults[m.id];

        if (pred && pred.predictedHome !== "" && pred.predictedAway !== "") {
          predictedCount++;
          if (real && real.homeScore !== "" && real.awayScore !== "") {
            const pHome = parseInt(pred.predictedHome, 10);
            const pAway = parseInt(pred.predictedAway, 10);
            const rHome = parseInt(real.homeScore, 10);
            const rAway = parseInt(real.awayScore, 10);

            const matchPoints = calculatePoints(pHome, pAway, rHome, rAway);
            totalPoints += matchPoints;

            if (pHome === rHome && pAway === rAway) exactHits++;
            if (Math.sign(pHome - pAway) === Math.sign(rHome - rAway)) winnerHits++;
            if (pHome === rHome) goalsHits++;
            if (pAway === rAway) goalsHits++;
          }
        }
      });

      return {
        name: profile.name,
        avatar: profile.avatar,
        email,
        totalPoints,
        exactHits,
        winnerHits,
        goalsHits,
        predictedCount
      };
    });

    // Sort by points, then exact score hits, then winner/draw hits
    return board.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      return b.winnerHits - a.winnerHits;
    });
  };

  const leaderboard = getLeaderboard();

  // Flag icon CDN resolver (ISO code or prefix)
  const getFlagUrl = (teamName) => {
    const nameMap = {
      "Mexico": "mx", "South Africa": "za", "South Korea": "kr", "Czech Republic": "cz",
      "Canada": "ca", "Bosnia & Herzegovina": "ba", "Qatar": "qa", "Switzerland": "ch",
      "Argentina": "ar", "Brazil": "br", "Colombia": "co", "France": "fr", "Germany": "de",
      "Spain": "es", "England": "gb", "Italy": "it", "Portugal": "pt", "Uruguay": "uy",
      "USA": "us", "Japan": "jp", "Morocco": "ma", "Croatia": "hr", "Belgium": "be",
      "Netherlands": "nl", "Ecuador": "ec", "Senegal": "sn", "Wales": "gb-wls", "Iran": "ir",
      "Poland": "pl", "Saudi Arabia": "sa", "Australia": "au", "Denmark": "dk", "Tunisia": "tn",
      "Costa Rica": "cr", "Germany": "de", "Spain": "es", "Japan": "jp", "Costa Rica": "cr"
    };
    const code = nameMap[teamName] || "un";
    return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
  };

  const getTeamAbbreviation = (teamName) => {
    const abbrMap = {
      "Mexico": "MEX", "South Africa": "SUD", "South Korea": "KOR", "Czech Republic": "CZE",
      "Canada": "CAN", "Bosnia & Herzegovina": "BIH", "Qatar": "QAT", "Switzerland": "SUI",
      "Argentina": "ARG", "Brazil": "BRA", "Colombia": "COL", "France": "FRA", "Germany": "GER",
      "Spain": "ESP", "England": "ENG", "Italy": "ITA", "Portugal": "POR", "Uruguay": "URU"
    };
    return abbrMap[teamName] || teamName.substring(0, 3).toUpperCase();
  };

  const translateTeamToSpanish = (teamName) => {
    const translationMap = {
      "Mexico": "México", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur", "Czech Republic": "República Checa",
      "Canada": "Canadá", "Bosnia & Herzegovina": "Bosnia", "Qatar": "Catar", "Switzerland": "Suiza",
      "Argentina": "Argentina", "Brazil": "Brasil", "Colombia": "Colombia", "France": "Francia",
      "Germany": "Alemania", "Spain": "España", "England": "Inglaterra", "Italy": "Italia"
    };
    return translationMap[teamName] || teamName;
  };

  if (loading) {
    return (
      <div className="login-container">
        <Loader className="logo-icon" style={{ animation: "spin 2s linear infinite" }} />
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <Trophy className="logo-icon" />
            <h1 className="logo-text">RinconMundial</h1>
          </div>
          <h2 className="login-title">Ingresar a la Polla</h2>
          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">CORREO ELECTRÓNICO</label>
              <input 
                className="input-field" 
                type="email" 
                placeholder="ej: juliana@mundial.com"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">CONTRASEÑA</label>
              <input 
                className="input-field" 
                type="password" 
                placeholder="Ingresa tu contraseña"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
              />
            </div>
            {authError && <div className="login-error">{authError}</div>}
            <button className="btn-primary" type="submit">INGRESAR</button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN LAYOUT
  const filteredMatches = matches.filter(m => m.date === selectedDate);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Trophy className="logo-icon" />
          <h1 className="logo-text">RinconMundial</h1>
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

      {/* Main Panel */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="header-title-section">
            <span className="header-subtitle">POLLETA MUNDIALISTA</span>
            <h1 className="header-title">
              FIFA WORLD CUP <Trophy size={22} />
            </h1>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{currentUserProfile.name}</span>
              <span className="user-role">Participante</span>
            </div>
            <div className="user-avatar">{currentUserProfile.avatar}</div>
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
                      {u.totalPoints} PTS | {u.exactHits} Marcadores Exactos
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 2. PREDICCIONES VIEW */}
          {currentTab === "predicciones" && (
            <>
              {/* Date Selection Ribbon */}
              <div className="date-selector-ribbon">
                <div className="dates-scroll-container">
                  {dates.map((d) => (
                    <button 
                      key={d} 
                      className={`date-btn ${selectedDate === d ? "active" : ""}`}
                      onClick={() => setSelectedDate(d)}
                    >
                      {formatDateToSpanish(d)}
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
                    const predictionKey = `${user.email}_${m.id}`;
                    const userPred = predictions[predictionKey] || { predictedHome: "", predictedAway: "" };
                    const realResult = officialResults[m.id] || { homeScore: "", awayScore: "" };

                    // Calculate countdown string
                    let countdownText = "";
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
                      countdownText = "CERRADO";
                    }

                    return (
                      <div className={`match-card ${!isLocked ? "active-today" : ""}`} key={m.id}>
                        <div className="match-card-header">
                          <span className="match-group">{m.group}</span>
                          <span className={`match-countdown ${isLocked ? "locked" : ""}`}>
                            <Clock size={14} /> {countdownText}
                          </span>
                        </div>

                        {/* Match Teams and Inputs */}
                        <div className="match-card-body">
                          {/* Team Local */}
                          <div className="team-section">
                            <div className="team-flag-container">
                              <img className="team-flag" src={getFlagUrl(m.team1)} alt={m.team1} onError={(e) => { e.target.style.display='none'; }} />
                            </div>
                            <span className="team-name-abbr">{getTeamAbbreviation(m.team1)}</span>
                            <span className="team-name-full">{translateTeamToSpanish(m.team1)}</span>
                          </div>

                          {/* Prediction inputs */}
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

                          {/* Team Visitor */}
                          <div className="team-section">
                            <div className="team-flag-container">
                              <img className="team-flag" src={getFlagUrl(m.team2)} alt={m.team2} onError={(e) => { e.target.style.display='none'; }} />
                            </div>
                            <span className="team-name-abbr">{getTeamAbbreviation(m.team2)}</span>
                            <span className="team-name-full">{translateTeamToSpanish(m.team2)}</span>
                          </div>
                        </div>

                        {/* Footer: status and info */}
                        <div className="match-card-footer">
                          <span className="match-venue">{m.ground}</span>
                          {saveStatus[m.id] && (
                            <div className="autosave-status">
                              {saveStatus[m.id] === "saving" && <span className="status-saving">Guardando...</span>}
                              {saveStatus[m.id] === "saved" && <span className="status-saved">Guardado ✓</span>}
                              {saveStatus[m.id] === "error" && <span style={{ color: "#ef4444" }}>Error!</span>}
                            </div>
                          )}
                        </div>

                        {/* Collaborative actual result entry (only after match start) */}
                        {isLocked && (
                          <div className="real-score-section">
                            <span className="real-score-label">Marcador Real (Resultado Oficial)</span>
                            <div className="real-score-inputs">
                              <input 
                                className="real-score-input"
                                type="number"
                                min="0"
                                max="99"
                                value={realResult.homeScore === undefined ? "" : realResult.homeScore}
                                onChange={(e) => saveOfficialScore(m.id, "home", e.target.value)}
                                placeholder="-"
                              />
                              <span style={{ fontWeight: "800", color: "#f59e0b" }}>-</span>
                              <input 
                                className="real-score-input"
                                type="number"
                                min="0"
                                max="99"
                                value={realResult.awayScore === undefined ? "" : realResult.awayScore}
                                onChange={(e) => saveOfficialScore(m.id, "away", e.target.value)}
                                placeholder="-"
                              />
                            </div>
                          </div>
                        )}

                        {/* Rival predictions (only visible when match is locked) */}
                        {isLocked && (
                          <div className="rival-predictions-container">
                            <span className="rival-predictions-title">Predicciones Rivales</span>
                            {["domi", "juliana", "papa"].map((rivalKey) => {
                              let rivalEmail = "";
                              if (rivalKey === "domi") rivalEmail = "domi@mundial.com";
                              if (rivalKey === "juliana") rivalEmail = "juliana@mundial.com";
                              if (rivalKey === "papa") rivalEmail = "papa@mundial.com";

                              if (rivalEmail === user.email) return null; // Skip current user
                              
                              const rivalProfile = USER_PROFILES[rivalKey];
                              const rivalPred = predictions[`${rivalEmail}_${m.id}`];

                              const rivalHasPred = rivalPred && rivalPred.predictedHome !== "" && rivalPred.predictedAway !== "";
                              const rPoints = rivalHasPred && realResult.homeScore !== "" && realResult.awayScore !== ""
                                ? calculatePoints(rivalPred.predictedHome, rivalPred.predictedAway, realResult.homeScore, realResult.awayScore)
                                : null;

                              return (
                                <div className="rival-row" key={rivalEmail}>
                                  <span className="rival-name">{rivalProfile.name}</span>
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
            </>
          )}

          {/* 3. RANKING VIEW */}
          {currentTab === "ranking" && (
            <>
              <div className="ranking-table-card">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>PUESTO</th>
                      <th>COMPETIDOR</th>
                      <th style={{ textAlign: "center" }}>PRONÓSTICOS</th>
                      <th style={{ textAlign: "center" }}>ACIERTO EXACTO (+3)</th>
                      <th style={{ textAlign: "center" }}>ACIERTO GANADOR (+2)</th>
                      <th style={{ textAlign: "center" }}>PUNTOS TOTALES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((u, index) => (
                      <tr className="ranking-row" key={u.email}>
                        <td className={`rank-position rank-position-${index+1}`}>
                          #{index + 1}
                        </td>
                        <td>
                          <div className="rank-user-cell">
                            <div className="user-avatar" style={{ width: "36px", height: "36px", fontSize: "13px" }}>
                              {u.avatar}
                            </div>
                            <span className="rank-user-name">{u.name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {u.predictedCount}
                        </td>
                        <td style={{ textAlign: "center" }} style={{ color: "#fbbf24", fontWeight: "700" }}>
                          {u.exactHits}
                        </td>
                        <td style={{ textAlign: "center" }} style={{ color: "#60efff", fontWeight: "700" }}>
                          {u.winnerHits}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="rank-score-total">{u.totalPoints} PTS</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
