# Spec 005: Tabla de Ranking y Ecuación Aditiva de Puntos

## Propósito
Calcular el puntaje de cada usuario comparando sus predicciones contra los resultados reales (registrados por los usuarios en la colección `official_results` de **Firebase Firestore**) de acuerdo a la ecuación aditiva de puntuación, y presentar una tabla de posiciones (Ranking) actualizada en tiempo real.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Consultan la pestaña "Ranking" para ver la tabla de posiciones y las predicciones de sus rivales en partidos cerrados.

## Requisitos
1. **Origen de Resultados Reales**:
   - Los resultados oficiales reales de los partidos se obtienen de la colección `official_results` en Firestore, la cual es completada de forma colaborativa por cualquiera de los 3 usuarios una vez que el partido inicia.
2. **Ecuación de Puntuación (Aditiva y Acumulativa)**:
   Los puntos ganados en cada partido se calculan sumando individualmente los siguientes aciertos (máximo 7 puntos por partido):
   - **Resultado Exacto (+3 Puntos)**: Si se acierta el marcador exacto (goles de ambos equipos).
   - **Ganador o Empate (+2 Puntos)**: Si se acierta quién gana el partido o si el partido resulta en un empate, independientemente de los goles.
   - **Goles del Equipo Local (+1 Punto)**: Si el número de goles predichos para el equipo local coincide exactamente con los goles reales del equipo local.
   - **Goles del Equipo Visitante (+1 Punto)**: Si el número de goles predichos para el equipo visitante coincide exactamente con los goles reales del equipo visitante.

### Ejemplos de Cálculo:
- **Caso A (Acierto Perfecto)**:
  - Predicción: 2 - 1 | Resultado Real: 2 - 1
  - Cálculo: Acierto Exacto (+3) + Acierto Ganador (+2) + Goles Local (+1) + Goles Visitante (+1) = **7 puntos**.
- **Caso B (Ganador y Goles Local)**:
  - Predicción: 2 - 1 | Resultado Real: 2 - 0
  - Cálculo: Acierto Exacto (0) + Acierto Ganador (+2) + Goles Local (+1) + Goles Visitante (0) = **3 puntos**.
- **Caso C (Solo Goles Visitante)**:
  - Predicción: 2 - 1 | Resultado Real: 0 - 1
  - Cálculo: Acierto Exacto (0) + Acierto Ganador (0) + Goles Local (0) + Goles Visitante (+1) = **1 punto**.
- **Caso D (Solo Acierto de Empate)**:
  - Predicción: 1 - 1 | Resultado Real: 2 - 2
  - Cálculo: Acierto Exacto (0) + Acierto Ganador/Empate (+2) + Goles Local (0) + Goles Visitante (0) = **2 puntos**.
- **Caso E (Sin Acierto)**:
  - Predicción: 2 - 1 | Resultado Real: 0 - 2
  - Cálculo: Acierto Exacto (0) + Acierto Ganador (0) + Goles Local (0) + Goles Visitante (0) = **0 puntos**.

2. **Tabla de Ranking (Leaderboard)**:
   - Muestra a los 3 competidores (Juliana Rincon, Papa y Domiciano Rincon) ordenados de mayor a menor según su puntaje acumulado total.
   - Listado en pantalla: Posición, Nombre, Aciertos Exactos, Aciertos Ganador, Goles Acertados y Puntaje Total.
3. **Transparencia en Predicciones**:
   - Una vez que un partido ha comenzado (según la hora oficial GMT-5), se considera cerrado. A partir de ese momento, cualquier usuario puede ver las predicciones de sus rivales para ese partido.
   - Si el partido no ha comenzado, las predicciones de los demás se mantienen ocultas.

## Casos de Borde
- **Empate en Puntos**: Si dos usuarios empatan en puntos totales, el criterio de desempate en la tabla de ranking será:
  1. Mayor número de aciertos de "Resultado Exacto" (+3).
  2. Mayor número de aciertos de "Ganador o Empate" (+2).
  3. Mayor cantidad de aciertos en goles individuales (Local o Visitante).

## Criterios de Aceptación

### Escenario: Cálculo acumulativo de predicción perfecta
- **Dado** que un partido finaliza 2 - 1 en los resultados reales registrados en Firestore
- **Cuando** el usuario predijo 2 - 1
- **Entonces** el sistema suma 7 puntos al usuario (3 exacto + 2 ganador + 1 local + 1 visitante)

### Escenario: Cálculo de empate parcial
- **Dado** que un partido finaliza 2 - 2
- **Cuando** el usuario predijo 1 - 1
- **Entonces** el sistema calcula 2 puntos por el empate, 0 por goles, 0 por marcador exacto para dar un total de 2 puntos
