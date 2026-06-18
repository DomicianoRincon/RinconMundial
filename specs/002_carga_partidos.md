# Spec 002: Carga de Partidos y Estructura del Calendario

## Propósito
Cargar la programación de los partidos del mundial a partir del repositorio oficial `openfootball/worldcup.json` como una plantilla estática de calendario, sirviendo como base de equipos, fechas y horarios para el sistema.

## Usuarios
- **Aplicación (Sistema)**: Consulta el archivo JSON estático para renderizar el calendario de partidos.

## Requisitos
1. **Consumo de worldcup.json**: El sistema consumirá el archivo JSON de la Copa del Mundo 2026 de la URL: `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`.
2. **Uso del JSON como Plantilla**:
   - El JSON de GitHub se utilizará exclusivamente para cargar el calendario (equipos, grupos, estadios, fechas y horas de inicio de los partidos).
   - Los marcadores oficiales reales no se leerán del JSON de GitHub, sino que se gestionarán y almacenarán en la colección `official_results` de **Firebase Firestore**.
3. **Mapeo de Datos**: Cada partido mapea:
   - Identificador único (`id` generado a partir de la fecha, grupo y equipos)
   - Grupo (ej. "Group A")
   - Fecha (`date`, ej. "2026-06-18") y Hora (`time`, ej. "12:00 UTC-7")
   - Equipo 1 y Equipo 2 (Nombre, código e icono/bandera)
4. **Respaldo Local (Offline)**: Copia estática del JSON integrada en el código para prevenir fallas de red del servidor externo de GitHub.

## Casos de Borde
- **Cambio de Horario**: Si se modifica un horario de partido en el JSON original, se actualizará el calendario sin alterar las predicciones ya guardadas.

## Criterios de Aceptación

### Escenario: Carga de partidos sin marcador desde el JSON
- **Dado** que la aplicación lee el JSON del mundial
- **Cuando** renderiza las tarjetas de partido
- **Entonces** se muestran los nombres, banderas y horarios oficiales, pero los marcadores reales se leen de la colección `official_results` de Firebase Firestore, ignorando cualquier clave `score` del JSON
