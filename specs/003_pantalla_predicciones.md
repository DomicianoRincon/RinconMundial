# Spec 003: Pantalla e Interfaz de Predicciones y Resultados

## Propósito
Proporcionar una interfaz web de página única (SPA) con tres vistas navegables (Inicio, Predicciones, Ranking) para que los tres participantes ingresen sus predicciones, registren resultados reales y consulten posiciones, con un diseño oscuro premium con estilo neón y glassmorphism.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Participantes de la polla.

## Requisitos

### Layout General
1. **SPA sin Router**: La aplicación no usa React Router. La navegación entre vistas se gestiona con estado local (`currentTab`: `"inicio"` | `"predicciones"` | `"ranking"`). No hay URLs separadas por vista.
2. **Sidebar de Navegación (desktop)**: Barra lateral izquierda fija con logo del mundial, tres ítems de navegación: "INICIO" (ícono Home), "PREDICCIONES" (ícono CheckSquare) y "RANKING" (ícono Trophy), y botón "CERRAR SESIÓN" al fondo. La tab activa al iniciar sesión es siempre "predicciones".
3. **Drawer móvil**: En móvil, la sidebar se oculta y se reemplaza por un botón hamburguesa (ícono `Menu`) en el header. Al pulsarlo, se desliza un panel desde la izquierda (`drawer-panel`) con el mismo contenido que la sidebar. Un overlay oscuro detrás permite cerrar el drawer al tocarlo. El botón `X` en el drawer también lo cierra.
4. **Encabezado**: Contiene (izq→der): botón hamburguesa (solo móvil), título "RINCON MUNDIAL" con logo, nombre del usuario logueado (de `firebaseUser.displayName`), rol "Participante" y avatar (foto de Google `photoURL` si existe, o iniciales en caso contrario). También incluye el botón de compartir predicciones (`Share2`) visible en la vista Predicciones (ver Spec 007).
5. **Pantalla de bienvenida (`?invite`)**: Si la URL tiene el parámetro `?invite` y el usuario completa el login, se muestra una pantalla de bienvenida personalizada (nombre, foto de Google, mensaje de confirmación) antes de entrar al panel principal. El botón "Entrar al panel →" limpia el query param y redirige a la vista de predicciones.

### Vista: Inicio
4. **Tarjeta de bienvenida**: Saludo personalizado con el nombre del usuario y descripción breve del funcionamiento de la polla.
5. **Mini tabla de posiciones**: Muestra los 3 participantes ordenados por puntos (calculado en tiempo real a partir de predicciones y resultados en Firestore), con puesto, nombre, puntos totales y número de marcadores exactos.

### Vista: Predicciones
6. **Selector de fecha (ribbon)**: Barra horizontal desplazable con un botón por cada fecha que tiene partidos. La fecha activa se resalta. Las fechas se muestran en español (ej. "JUNIO 18").
7. **Tarjetas de partido (Match Cards)**: Una tarjeta por partido de la fecha seleccionada, con:
   - Header: grupo del partido y contador regresivo (countdown).
   - Cuerpo: bandera (PNG local de `public/flags/` vía `getFlagUrl`), abreviatura del equipo (3 letras de `TEAM_ABBR`) y nombre en español del equipo local (de `TEAM_ES`), inputs de predicción, equipo visitante.
   - Footer: nombre del estadio (`ground`) e indicador de estado del autoguardado.
   - Si hay marcador ESPN en vivo (`liveScores[matchId]`), se muestra el marcador en tiempo real y el reloj/período del partido dentro de la tarjeta.
8. **Countdown por tarjeta**: Mientras el partido no haya comenzado, muestra `CIERRA EN Xh Ym Zs` (o `Ym Zs` si faltan menos de 60 minutos). Una vez iniciado, muestra `CERRADO`. El contador se actualiza cada segundo.
9. **Bloqueo de Inputs por Tiempo**:
   - Antes del inicio del partido (`currentTime < kickoff`): inputs de predicción habilitados.
   - Desde el inicio del partido (`currentTime >= kickoff`): inputs de predicción deshabilitados (solo lectura).
   - La comparación usa los objetos `Date` generados al parsear el JSON con sus offsets UTC.
10. **Sección de Marcador Real** (solo cuando partido bloqueado): Dos inputs numéricos para ingresar el resultado oficial. Cualquier usuario puede editar y guardar. Se persiste en Firestore (`official_results/{matchId}`) sin debounce (guardado inmediato).
11. **Panel de Predicciones Rivales** (solo cuando partido bloqueado): Muestra las predicciones de los otros dos participantes. Para cada rival se muestra su nombre, su pronóstico (`predictedHome - predictedAway`) o "Sin pronóstico", y los puntos obtenidos (badge `+N PTS`) si ya hay marcador real registrado. El usuario actual no aparece en la lista de rivales.

### Vista: Ranking
12. **Tabla de posiciones completa**: Columnas: Puesto, Competidor (avatar + nombre), Pronósticos (número de partidos predichos), Acierto Exacto (+3), Acierto Ganador (+2), Puntos Totales. Ordenada de mayor a menor puntos, con desempate por aciertos exactos y luego por aciertos ganador.
13. **Fila expandible por usuario**: Al hacer clic en una fila del ranking, se expande un panel con el historial de todos los partidos pasados donde ese usuario tiene predicción. Por cada partido se muestra: fecha (ej. `14 jun`), banderas y nombres de equipos, predicción del usuario, resultado real (o marcador en vivo), puntos obtenidos y badges de tipo de acierto (Exacto / Ganador / Gol Local / Gol Visitante). Los partidos se ordenan de más reciente a más antiguo. Solo un usuario puede estar expandido a la vez.
14. **Puntos en vivo (livePoints)**: Si hay partidos en curso, el ranking muestra los puntos que el usuario obtendría con el marcador ESPN actual (`livePoints`) con un badge visual diferenciador. El ordenamiento del ranking usa `totalPoints + livePoints` pero los muestra separados.

## Casos de Borde
- **Fecha sin partidos**: Si la fecha seleccionada no tiene partidos, se muestra un estado vacío con ícono de calendario y mensaje descriptivo.
- **Partido sin predicción**: Si el partido ya inició y el usuario no tenía predicción guardada, sus inputs quedan vacíos y bloqueados (equivale a 0 puntos).
- **Marcador real no ingresado**: El panel de rivales muestra las predicciones pero no el badge de puntos hasta que haya un marcador real en Firestore.
- **Bandera no encontrada**: Si `flagcdn.com` no puede cargar la imagen de un equipo, el elemento imagen se oculta (`onError: e.target.style.display='none'`).

## Criterios de Aceptación

### Escenario: Bloqueo de edición al iniciar el partido
- **Dado** que un partido tiene `kickoff` a las 11:00 A.M. UTC-5
- **Cuando** la hora actual del sistema llega a las 11:00 A.M. UTC o supera ese instante
- **Entonces** los inputs de predicción se deshabilitan, el countdown muestra "CERRADO", y aparecen la sección de marcador real y el panel de predicciones rivales

### Escenario: Countdown visible antes del partido
- **Dado** que un partido está a 2 horas 15 minutos 30 segundos de iniciar
- **Cuando** el usuario ve la tarjeta
- **Entonces** el countdown muestra "CIERRA EN 2h 15m 30s" y se actualiza cada segundo

### Escenario: Registro colaborativo del resultado oficial
- **Dado** que un partido ya inició (bloqueado)
- **Cuando** Papa ingresa el marcador real "3" - "1"
- **Entonces** el resultado se guarda inmediatamente en `official_results` de Firestore y Juliana y Domiciano ven el badge con los puntos obtenidos en el panel de rivales

### Escenario: Panel de rivales oculto antes del partido
- **Dado** que un partido aún no ha iniciado
- **Cuando** el usuario ve la tarjeta de ese partido
- **Entonces** el panel de predicciones rivales no es visible

### Escenario: Vista de Inicio con mini tabla
- **Dado** que hay predicciones y resultados en Firestore
- **Cuando** el usuario navega a la tab "INICIO"
- **Entonces** se muestra la tabla de posiciones con los 3 participantes ordenados por puntos totales

---

## Assumptions to review

1. La lógica de rivalidad filtra al usuario actual comparando `matchedEmailKey.split("_")[0] === user.email`, lo que asume que el email del usuario logueado comienza con el mismo prefijo que la clave en Firestore — Impact: HIGH
   Correct this if: el email de un usuario contiene múltiples prefijos (ej. `papa_domi@...`).

2. No existe "Botón Limpiar Todo" en la implementación actual — Impact: MEDIUM
   Correct this if: se decide implementar limpieza de predicciones no guardadas por fecha.

3. Las banderas se obtienen de `flagcdn.com` con código de país resuelto desde un mapa estático — Impact: LOW
   Correct this if: se agregan equipos que no están en el mapa o se quiere un proveedor de banderas distinto.

4. La traducción de nombres de equipos al español usa un mapa estático parcial; equipos no incluidos se muestran en inglés — Impact: LOW
   Correct this if: se quiere traducción completa de todos los 48 equipos del mundial 2026.
