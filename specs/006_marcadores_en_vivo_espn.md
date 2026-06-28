# Spec 006: Marcadores en Vivo (Integración ESPN)

## Propósito
Obtener marcadores en tiempo real de la API pública de ESPN durante partidos en curso y auto-escribirlos en Firestore, eliminando la necesidad de que los usuarios ingresen manualmente cada resultado.

## Usuarios
- **Sistema (automático)**: El polling corre client-side en el navegador de cualquier usuario autenticado que tenga la app abierta.
- **Juliana Rincon, Papa, Domiciano Rincon**: Se benefician al ver marcadores reales y puntos actualizados sin intervención manual.

## Requisitos

### Fuente de datos
1. **Endpoint ESPN**: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`
   - API pública, sin autenticación.
   - Responde con un array `events`, cada uno con `competitions[0].competitors` (home/away).
2. **Mapeo de nombres**: Los nombres de equipos de ESPN difieren del JSON local. El mapa `ESPN_TO_LOCAL_TEAM` en `App.jsx` resuelve las discrepancias (ej. `"United States"` → `"USA"`, `"Korea Republic"` → `"South Korea"`). Si el nombre no está en el mapa, se usa el nombre ESPN directamente.

### Estrategia de polling
3. **One-shot al montar**: Al cargar la app (cuando el usuario está autenticado y los partidos del JSON están cargados), se ejecuta un fetch inmediato a ESPN.
4. **Polling cada 60 segundos**: Un `setInterval` activo solo cuando `lockedMatchIds` no está vacío (hay al menos un partido cuyo `kickoff` ya pasó). El intervalo se limpia si todos los partidos desbloqueados desaparecen o el usuario cierra la app.
5. **Re-creación del intervalo**: El `useEffect` del polling tiene `[user, lockedMatchIds]` como dependencias, por lo que se reinicia cada vez que un nuevo partido pasa a estado bloqueado.

### Matching partido ESPN → partido local
6. El sistema busca en el array local `matches` un partido donde `(team1 === localHome && team2 === localAway) || (team1 === localAway && team2 === localHome)`.
7. Si el partido está "volteado" (home/away invertidos respecto al JSON local), se intercambian `homeScore` y `awayScore` al construir `liveData`.

### Estado en memoria (`liveScores`)
8. Por cada partido encontrado, se construye un objeto `liveData`:
   ```js
   {
     homeScore, awayScore,       // marcadores (strings de ESPN)
     statusName,                 // ej. "STATUS_IN_PROGRESS", "STATUS_FINAL"
     statusDesc,                 // ej. "In Progress", "Half Time", "Final"
     displayClock,               // ej. "32'"
     period                      // 1 = primer tiempo, 2 = segundo tiempo
   }
   ```
9. `liveScores` se actualiza con `{ ...prev, ...newLiveScores }` (merge, no reemplazo total), preservando datos de partidos no devueltos en el último fetch.

### Auto-escritura a Firestore
10. Solo se escribe a `official_results/{matchId}` si:
    - El partido fue encontrado en el JSON local, y
    - `statusName !== "STATUS_SCHEDULED"` y `statusName !== "SCHEDULED"`, y
    - `homeScore` y `awayScore` no son strings vacíos.
11. Estructura del documento escrito: `{ matchId, homeScore (int), awayScore (int), updatedBy: "espn-auto" }`.
12. Todas las escrituras de un mismo fetch se ejecutan en paralelo con `Promise.all`.
13. Si Firestore ya tiene un resultado manual (`updatedBy != "espn-auto"`), ESPN lo sobreescribe igual (no hay lógica de prioridad; quien escribe último gana). Ver Assumption #2.

### Puntos en vivo
14. En el leaderboard (`getLeaderboard`), si un partido no tiene resultado en `official_results` pero `liveScores[m.id]` está en estado `IN_PROGRESS` o `Half`, se calcula `livePoints` con el marcador ESPN actual.
15. `livePoints` se suma al total para el ordenamiento del ranking (`totalPoints + livePoints`), pero se expone separadamente en la UI con un badge diferenciador.

## Casos de Borde
- **ESPN no devuelve el partido**: Si un partido del JSON no aparece en la respuesta ESPN (porque aún no empezó o ESPN usa un nombre de equipo desconocido), `liveScores` no tiene entrada para ese `matchId`. El partido funciona normalmente: resultado manual o sin resultado.
- **Error de red en fetch**: El error se captura y se loguea a consola (`"ESPN auto-fetch error:"`). La app continúa funcionando; `liveScores` mantiene el último valor conocido.
- **Partido "volteado"**: ESPN puede reportar el local/visitante en orden inverso al JSON local. El flag `flipped` corrige esto al asignar scores.
- **Partido finalizado y ya en Firestore**: ESPN sigue escribiendo en cada poll el mismo marcador final. Al ser idempotente (mismo valor), no genera inconsistencias.

## Criterios de Aceptación

### Escenario: Auto-update de marcador en vivo
- **Dado** que un partido ha comenzado y ESPN reporta `3 - 1` con status `IN_PROGRESS`
- **Cuando** el poll de 60 segundos se ejecuta
- **Entonces** `liveScores[matchId]` se actualiza con ese marcador y el ranking muestra `livePoints` calculados con `3 - 1`

### Escenario: Auto-guardado en Firestore al finalizar
- **Dado** que ESPN reporta un partido con status `STATUS_FINAL` y marcador `2 - 0`
- **Cuando** el poll se ejecuta
- **Entonces** `official_results/{matchId}` contiene `{ homeScore: 2, awayScore: 0, updatedBy: "espn-auto" }` y todos los usuarios ven el resultado real en la tarjeta del partido

### Escenario: Polling inactivo sin partidos bloqueados
- **Dado** que todos los partidos del día seleccionado están en el futuro (`currentTime < kickoff` para todos)
- **Cuando** la app está montada
- **Entonces** no existe ningún `setInterval` activo para ESPN (solo el one-shot inicial al montar)

### Escenario: Partido con nombre de equipo desconocido en ESPN
- **Dado** que ESPN reporta un equipo con nombre `"Congo DR"` que no está en `ESPN_TO_LOCAL_TEAM`
- **Cuando** se intenta hacer matching con el JSON local
- **Entonces** se usa `"Congo DR"` como nombre local y si no matchea, el partido se ignora silenciosamente (no se escribe en Firestore)

---

## Assumptions to review

1. La API pública de ESPN no requiere autenticación ni tiene rate limiting observable a 1 req/min — Impact: HIGH
   Correct this if: ESPN agrega auth o empieza a bloquear el dominio de la app.

2. ESPN puede sobreescribir un marcador ingresado manualmente porque no hay lógica de prioridad entre `"espn-auto"` y edición manual — Impact: MEDIUM
   Correct this if: se decide que la edición manual debe tener prioridad permanente sobre ESPN.

3. `liveScores` se actualiza con merge, no con reemplazo, por lo que un partido que desaparece de la respuesta ESPN retiene su último marcador conocido en memoria hasta que la página se recarga — Impact: LOW
   Correct this if: se quiere limpiar marcadores de partidos finalizados que ESPN deja de reportar.
