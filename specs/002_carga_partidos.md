# Spec 002: Carga de Partidos y Estructura del Calendario

## Propósito
Proporcionar la programación estática de partidos del mundial como base de equipos, fechas y horarios para el sistema de predicciones.

## Usuarios
- **Aplicación (Sistema)**: Consume el archivo JSON estático al arrancar para construir el calendario de partidos.

## Requisitos
1. **JSON Bundleado Localmente**: El calendario se carga desde el archivo `src/worldcup.json` importado directamente en el bundle (no se hace fetch a ninguna URL externa en tiempo de ejecución). Este archivo es una copia local del dataset `openfootball/worldcup.json` para el mundial 2026.
2. **Uso del JSON como Plantilla**:
   - El JSON provee exclusivamente la estructura del calendario: equipos, grupos, estadios (`ground`), fechas (`date` en formato `YYYY-MM-DD`) y hora de inicio (`time` en formato `HH:MM UTC±X`).
   - Los marcadores reales no se leen del JSON; se gestionan en la colección `official_results` de Firebase Firestore.
3. **Mapeo de Datos**: Al parsear el JSON, cada partido se transforma en un objeto con:
   - `id`: identificador generado como `match_<índice>_<3letrasEquipo1>_<3letrasEquipo2>` (ej. `match_0_Mex_Can`).
   - `group`: grupo del partido (ej. `"Group A"`).
   - `date`: fecha en formato `YYYY-MM-DD`.
   - `time`: hora original del JSON (ej. `"12:00 UTC-7"`).
   - `kickoff`: objeto `Date` de JavaScript construido a partir de `date` y `time`, respetando el offset UTC del JSON.
   - `team1`, `team2`: nombres de equipos tal como vienen en el JSON (en inglés).
   - `ground`: nombre del estadio.
4. **Parsing de Hora**: La función `parseMatchTime` convierte la cadena de tiempo del JSON (ej. `"12:00 UTC-7"`) a un objeto `Date` de JavaScript con el offset correcto.
5. **Selección Automática de Fecha Inicial**: Al cargar, el sistema identifica la fecha actual en la zona horaria `America/Bogota` (GMT-5) y selecciona esa fecha por defecto. Si no hay partidos ese día, selecciona el próximo día con partidos; si ya pasaron todos, selecciona el primero disponible.

## Casos de Borde
- **Fecha sin partidos**: Si la fecha actual no tiene partidos en el JSON, se muestra un estado vacío en la pantalla de predicciones y se selecciona la fecha siguiente con partidos.
- **Error de parsing de hora**: Si el formato de `time` en el JSON no puede parsearse, se devuelve un `Date` con hora `00:00:00Z` como fallback para ese partido.

## Criterios de Aceptación

### Escenario: Carga inicial de partidos desde JSON local
- **Dado** que la aplicación arranca con `worldcup.json` presente en el bundle
- **Cuando** se monta el componente principal
- **Entonces** `matches` contiene todos los partidos del JSON, cada uno con un `id`, `kickoff` (objeto Date válido), `team1`, `team2`, `group`, `date`, `ground`, y la fecha seleccionada por defecto corresponde al día actual en GMT-5

### Escenario: Carga de partidos sin marcador
- **Dado** que la aplicación lee el JSON del mundial
- **Cuando** renderiza las tarjetas de partido
- **Entonces** se muestran los nombres de equipos, banderas (vía flagcdn.com) y la hora de inicio, sin ningún marcador proveniente del JSON (los marcadores reales vienen de Firestore)

### Escenario: ID único por partido
- **Dado** que dos partidos distintos tienen el mismo par de equipos pero diferente índice
- **Cuando** se genera su `id`
- **Entonces** cada `id` es único porque incluye el índice posicional del array

---

## Assumptions to review

1. El `id` del partido usa el índice del array JSON más las 3 primeras letras de cada equipo, lo que significa que si el JSON se reordena o se inserta un partido, todos los IDs subsiguientes cambian — Impact: HIGH
   Correct this if: se tiene datos previos en Firestore y se actualiza el JSON (los IDs de Firestore quedarán huérfanos).

2. El JSON de worldcup 2026 está completo y no será reemplazado durante la competencia — Impact: MEDIUM
   Correct this if: openfootball actualiza el JSON con marcadores o corrige fechas.

3. Se usa `America/Bogota` como zona horaria de referencia para la selección de fecha inicial (equivalente a GMT-5) — Impact: LOW
   Correct this if: los usuarios están en otra zona horaria y quieren ver partidos de su hoy local.
