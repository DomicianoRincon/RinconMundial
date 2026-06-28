# PRD: RinconMundial — Polla Familiar Mundial 2026

> **Nota:** Este PRD se escribió post-hoc a partir del producto ya construido. Sirve como fuente de verdad retroactiva y como insumo para los specs técnicos que lo acompañan.

---

## 1. Problema

La familia Rincón (Domiciano, Juliana y Papa) quiere vivir el Mundial 2026 juntos aunque no estén en el mismo lugar. Necesitan un espacio compartido donde cada uno pueda pronosticar resultados de partidos, ver cuánto acertaron y competir en una tabla de posiciones en tiempo real, sin depender de una aplicación de terceros genérica que no los conoce ni tiene sus reglas propias.

---

## 2. Objetivo

Crear una web app privada, simple y de bajo mantenimiento que permita a los tres participantes:

1. Ingresar predicciones de marcadores antes de que inicie cada partido.
2. Ver los resultados reales y los puntos acumulados de forma automática.
3. Consultar una tabla de posiciones actualizada en tiempo real.
4. Compartir sus predicciones del día en formato imagen.

---

## 3. Usuarios

| Alias | Rol |
|-------|-----|
| `domi` | Participante (también despliega y mantiene la app) |
| `juliana` | Participante |
| `papa` | Participante |

Son exactamente tres usuarios. No hay registro abierto. No hay admin diferenciado en la app (cualquiera puede ingresar resultados reales).

---

## 4. Alcance del producto

### En scope

- Autenticación con Google (Firebase Auth) con doble barrera: passphrase familiar + email autorizado.
- Calendario de partidos del Mundial 2026 cargado desde JSON estático (openfootball).
- Predicción de marcador (home/away) por partido, con cierre automático al inicio del partido.
- Autoguardado en Firestore sin botón explícito de "guardar".
- Resultados oficiales alimentados automáticamente desde la API pública de ESPN, con posibilidad de corrección manual.
- Puntuación aditiva por partido (máx 7 puntos): marcador exacto (+3), ganador/empate (+2), goles local (+1), goles visitante (+1).
- Tabla de ranking con desempate por aciertos exactos y luego por aciertos de ganador.
- Visualización de predicciones rivales una vez cerrado el partido.
- Puntos en vivo (livePoints) mientras hay partidos en curso, reflejados en ranking con badge distintivo.
- Desglose de historial de predicciones por usuario expandible en la tabla de ranking.
- Compartir imagen de predicciones del día vía Web Share API (o descarga directa como fallback).
- Pantalla de bienvenida para primer ingreso vía link de invitación (`?invite`).
- Diseño oscuro premium con estética neón / glassmorphism.
- Responsive con sidebar en desktop y drawer deslizable en móvil.
- Deploy automático a GitHub Pages vía GitHub Actions.

### Fuera de scope

- Fases eliminatorias o bracket de playoff.
- Notificaciones push.
- Historial de ediciones de predicciones.
- Panel de administración separado.
- Soporte para más de tres usuarios.
- Predicciones de grupo o campeonato.

---

## 5. Reglas de negocio

### 5.1 Autenticación

- Se requiere passphrase `hkx213bp` antes de habilitar el botón de Google Sign-In.
- Solo emails que contengan `domi`, `juliana` o `papa` (case-insensitive) en la dirección completa son autorizados.
- Si el email no es válido, se hace `signOut` inmediato y se muestra error.

### 5.2 Cierre de predicciones

- Un partido se "bloquea" cuando `currentTime >= kickoff` (en UTC real; el `kickoff` se calcula con el offset del JSON).
- Una vez bloqueado, los inputs de predicción se deshabilitan permanentemente para ese partido en esa sesión.

### 5.3 Puntuación (aditiva)

```
Marcador exacto          → +3 pts
Ganador correcto / empate → +2 pts
Goles local exactos       → +1 pt
Goles visitante exactos   → +1 pt
─────────────────────────────────
Máximo por partido        →  7 pts
```

Los puntos se calculan solo si hay predicción completa (home y away ≠ `""`) y resultado real registrado.

### 5.4 Fuente de resultados

- La fuente primaria es la API pública de ESPN (`site.api.espn.com`), poliada cada 60 segundos cuando hay partidos bloqueados.
- ESPN auto-escribe en `official_results` de Firestore.
- Cualquier usuario puede corregir manualmente el marcador real desde la tarjeta (input de resultado oficial visible solo en partidos bloqueados).
- El marcador manual sobreescribe el de ESPN sin distinción.

### 5.5 Transparencia de predicciones

- Las predicciones de los rivales están **ocultas** mientras el partido no ha comenzado.
- Una vez bloqueado el partido, todos pueden ver las predicciones de los otros dos participantes y los puntos obtenidos (si ya hay resultado real).

### 5.6 Puntos en vivo

- Si un partido está en curso (ESPN reporta `IN_PROGRESS` o `Half`), el ranking muestra los puntos que el usuario obtendría con el marcador actual como `livePoints`, diferenciado visualmente del puntaje oficial.

---

## 6. Flujos principales

### Flujo: Ingresar predicción

1. Usuario abre la app → pantalla de login.
2. Ingresa passphrase → botón de Google se habilita.
3. Login con Google → validación de email → pantalla de predicciones.
4. Selecciona fecha en el ribbon → ve tarjetas de partidos.
5. Ingresa marcador en inputs → autoguardado en 1 segundo.
6. Indicador "Guardando..." → "Guardado ✓" al confirmar Firestore.

### Flujo: Ver resultado y puntos

1. Partido inicia → inputs se deshabilitan, aparece sección de resultado real.
2. ESPN polling escribe marcador en `official_results`.
3. Panel de rivales aparece mostrando predicciones de los otros dos con badge de puntos.
4. Tabla de ranking se actualiza en tiempo real vía `onSnapshot`.

### Flujo: Compartir predicciones del día

1. Usuario está en la vista Predicciones.
2. Toca el ícono de compartir en el header.
3. Se genera imagen en canvas (480px, 2× para retina): header con nombre, filas de partidos con banderas y marcadores predichos, footer de marca.
4. Si el navegador soporta Web Share API con archivos → sheet nativo de compartir.
5. Si no → descarga automática como PNG.

### Flujo: Invitación

1. Admin comparte URL con `?invite` appended.
2. Nuevo usuario completa login → pantalla de bienvenida personalizada.
3. Toca "Entrar al panel" → se borra el query param, entra a predicciones.

---

## 7. Estructura de datos (Firestore)

### Colección `users`
```
{uid} → { uid, email, displayName, photoURL, lastLogin }
```

### Colección `predictions`
```
{userEmail}_{matchId} → { userId, userEmail, matchId, predictedHome, predictedAway, updatedAt }
```

### Colección `official_results`
```
{matchId} → { matchId, homeScore, awayScore, updatedBy }
```
`updatedBy` puede ser `"espn-auto"` (escritura automática) o el email del usuario que corrigió manualmente.

---

## 8. IDs de partidos

Formato: `match_{índice}_{3letrasEquipo1}_{3letrasEquipo2}`

Ejemplo: `match_0_Mex_Can`

**Restricción crítica:** El índice es posicional en el array de `worldcup.json`. Reordenar o insertar partidos en el JSON rompe todos los IDs existentes en Firestore.

---

## 9. Integración ESPN

- Endpoint: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`
- Sin autenticación (API pública).
- Polling cada 60 segundos, activo solo cuando existen partidos bloqueados (`lockedMatchIds` no vacío).
- Primer fetch al montar la app (one-shot) y luego por intervalo.
- Nombres de equipos ESPN → nombres locales vía mapa `ESPN_TO_LOCAL_TEAM`.
- Solo escribe en Firestore si el partido no está en estado `STATUS_SCHEDULED`.

---

## 10. Zona horaria y fechas

- Referencia: `America/Bogota` (GMT-5, sin cambio de horario estacional).
- La fecha "hoy" para selección default usa `Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" })`.
- Los horarios de kickoff del JSON incluyen offset UTC explícito (ej. `"20:00 UTC-7"`); se parsean a objetos `Date` absolutos en JavaScript.
- Los horarios se muestran al usuario convertidos a hora Colombia.

---

## 11. Diseño

- **Tema:** oscuro (`#0d1117` fondo base), acentos neón verde (`#00ff87`).
- **Glassmorphism** en cards y sidebar.
- **Responsive:**
  - Desktop: sidebar fija a la izquierda + área de contenido a la derecha.
  - Móvil: sidebar oculta, botón hamburguesa abre drawer deslizable desde la izquierda con overlay de fondo.
- **Banderas:** PNGs locales en `public/flags/` (no CDN externo). Fallback: ocultar imagen.
- **Nombres de equipos:** mostrados en español vía mapa estático `TEAM_ES`.

---

## 12. Deploy e infraestructura

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite |
| Auth + DB | Firebase (Auth + Firestore) |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions (`deploy.yml`) |
| Base path | `/RinconMundial/` |

No hay backend propio. No hay funciones de Cloud Functions. Todo el processing es client-side.

---

## 13. Métricas de éxito

Por tratarse de un proyecto familiar privado, el éxito se define cualitativamente:

- Los tres usuarios pueden ingresar sus predicciones sin fricción técnica.
- El ranking refleja los puntos correctos en tiempo real.
- La app funciona correctamente en móvil (los tres usuarios la usan principalmente desde celular).
- No se pierden predicciones por errores de red o de guardado.

---

## 14. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| ESPN cambia la estructura de su API | Alto | El auto-save de ESPN falla silenciosamente; los usuarios pueden ingresar el marcador manual | 
| Reordenamiento del JSON de openfootball | Alto | No actualizar el JSON durante el torneo; si hay correcciones, re-seedear Firestore |
| Firestore sin persistencia offline | Medio | Las predicciones ingresadas sin conexión se pierden; los usuarios deben tener conexión al momento de predecir |
| Colisión de prefijos de email | Bajo | Actualmente los tres emails son únicos en su prefijo |

---

*Última actualización: junio 2026*
