# Spec 005: Tabla de Ranking y Ecuación Aditiva de Puntos

## Propósito
Calcular el puntaje de cada usuario comparando sus predicciones contra los resultados reales (colección `official_results` de Firestore) según la ecuación aditiva de puntuación, y presentar una tabla de posiciones actualizada en tiempo real tanto en la vista "Ranking" como en la vista "Inicio".

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Consultan el ranking para ver posiciones y predicciones de rivales en partidos cerrados.

## Requisitos

### Resolución de Usuarios en el Leaderboard
1. **Usuarios de Firestore**: El leaderboard itera sobre `registeredUsers`, que es la colección `users` de Firestore escuchada con `onSnapshot`. Cada objeto tiene `email`, `displayName`, `photoURL` y `uid`. La búsqueda de predicciones para cada usuario usa la clave `${u.email}_${m.id}` directamente (lookup exacto por email, no por prefijo). Esto requiere que el email del usuario en Firestore coincida exactamente con el email usado al crear la predicción.

### Ecuación de Puntuación (Aditiva, máximo 7 puntos por partido)
2. **Puntos por partido**:
   - **Resultado Exacto (+3 puntos)**: `predictedHome === realHome && predictedAway === realAway`.
   - **Ganador o Empate (+2 puntos)**: `Math.sign(predictedHome - predictedAway) === Math.sign(realHome - realAway)`.
   - **Goles del Equipo Local (+1 punto)**: `predictedHome === realHome`.
   - **Goles del Equipo Visitante (+1 punto)**: `predictedAway === realAway`.
3. **Condición para calcular**: Solo se calculan puntos si tanto la predicción como el resultado real tienen valores distintos de `""` y `undefined`. En caso contrario, el partido aporta 0 puntos.

### Ejemplos de Cálculo
- Pred 2-1, Real 2-1 → Exacto(3) + Ganador(2) + Local(1) + Visitante(1) = **7 pts**
- Pred 2-1, Real 2-0 → Ganador(2) + Local(1) = **3 pts**
- Pred 2-1, Real 0-1 → Visitante(1) = **1 pt**
- Pred 1-1, Real 2-2 → Ganador/Empate(2) = **2 pts**
- Pred 2-1, Real 0-2 → **0 pts**

### Tabla de Ranking
4. **Columnas mostradas**: Puesto (#1, #2, #3), Competidor (avatar de iniciales + nombre), Pronósticos (número de partidos con predicción guardada), Acierto Exacto (+3) (número de aciertos exactos), Acierto Ganador (+2) (número de aciertos de ganador/empate), Puntos Totales.
   - Nota: `goalsHits` (aciertos de goles individuales) se calcula internamente pero no se muestra en la tabla.
5. **livePoints**: Si hay partidos en curso con marcador ESPN disponible, el leaderboard calcula `livePoints` adicionales (puntos que el usuario obtendría si el marcador en vivo fuera el resultado final). El ordenamiento usa `totalPoints + livePoints`; la UI los diferencia visualmente con un badge.
6. **Ordenamiento**: Mayor a menor por `totalPoints + livePoints`. En empate: mayor `exactHits`. En segundo empate: mayor `winnerHits`.
7. **Colores de posición**: Primer puesto en dorado (`#fbbf24`), segundo en plateado (`#94a3b8`), tercero en bronce (`#b45309`).

### Transparencia de Predicciones
7. **Predicciones rivales en tarjeta de partido**: Una vez que un partido inicia (bloqueado), cualquier usuario puede ver en la tarjeta del partido las predicciones de los otros dos participantes, junto con los puntos obtenidos si ya hay marcador real. (Implementado en la vista Predicciones, ver Spec 003.)
8. **Predicciones antes del inicio**: No se muestran las predicciones de rivales mientras el partido no haya comenzado.

### Historial expandible por usuario
8. **Desglose de partidos**: Al hacer clic en una fila del ranking, se expande un panel con todos los partidos pasados donde ese usuario tiene predicción. Por cada partido se muestran: fecha abreviada (ej. `14 jun`), banderas, predicción, resultado real o en vivo, puntos obtenidos y badges de acierto (Exacto / Ganador / Gol Local / Gol Visitante). Ordenados de más reciente a más antiguo. Ver Spec 003 §13.

### Mini Tabla en Vista Inicio
9. **Resumen de posiciones**: La vista "Inicio" muestra una versión condensada del leaderboard con puesto, nombre y puntos totales + marcadores exactos para cada participante.

## Casos de Borde
- **Sin resultados reales**: Si ningún partido tiene resultado en `official_results`, todos los usuarios tienen 0 puntos y el orden puede ser cualquiera entre ellos (determinístico por el orden del array `["domi", "juliana", "papa"]`).
- **Empate en los tres criterios**: Si dos usuarios empatan en puntos, exactHits y winnerHits, el orden relativo entre ellos no cambia (sort estable de JavaScript).
- **Usuario sin predicciones**: Aparece en la tabla con 0 en todas las columnas.

## Criterios de Aceptación

### Escenario: Cálculo acumulativo de predicción perfecta
- **Dado** que un partido finaliza 2-1 en `official_results` de Firestore
- **Cuando** el usuario predijo 2-1
- **Entonces** el sistema suma 7 puntos al usuario (3 exacto + 2 ganador + 1 local + 1 visitante)

### Escenario: Cálculo de empate parcial
- **Dado** que un partido finaliza 2-2 en `official_results`
- **Cuando** el usuario predijo 1-1
- **Entonces** el sistema calcula 2 puntos (empate) y no suma por goles ni por marcador exacto

### Escenario: Ordenamiento con desempate
- **Dado** que Domiciano y Juliana tienen 10 puntos totales pero Domiciano tiene 2 exactHits y Juliana tiene 1
- **Cuando** se renderiza la tabla de ranking
- **Entonces** Domiciano aparece en el primer puesto y Juliana en el segundo

### Escenario: Actualización en tiempo real
- **Dado** que Papa ingresa el marcador real de un partido
- **Cuando** Firestore confirma la escritura
- **Entonces** la tabla de ranking se actualiza automáticamente en la UI de todos los usuarios sin recargar la página (gracias a `onSnapshot`)

---

## Assumptions to review

1. La búsqueda de predicciones usa el email exacto del usuario (`${u.email}_${m.id}`), por lo que depende de que el email en Firestore (`users` collection) sea idéntico al usado al guardar la predicción. Siempre es así en la implementación actual porque ambos vienen del mismo `user.email` de Firebase Auth — Impact: LOW
   Correct this if: se migra a un sistema de aliases o se permite cambio de email de Google.

2. `goalsHits` se calcula (suma de aciertos de goles local + visitante por partido) pero no se expone en la tabla de ranking — Impact: LOW
   Correct this if: se decide mostrar una columna adicional de goles acertados o usar goalsHits como tercer criterio de desempate visible.

3. El avatar en la tabla de ranking siempre muestra las iniciales del perfil (nunca la foto de Google), independientemente de si el usuario tiene `photoURL` — Impact: LOW
   Correct this if: se quiere mostrar la foto de perfil de Google en la tabla de ranking.
