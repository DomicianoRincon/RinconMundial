# Spec 004: Sistema de Autoguardado en Tiempo Real

## Propósito
Persistir automáticamente las predicciones ingresadas por los usuarios en Firebase Firestore sin necesidad de un botón de "Guardar", con feedback visual inmediato del estado de guardado.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Digitan marcadores con la certeza de que sus datos se respaldan automáticamente.

## Requisitos
1. **Autoguardado con Debounce**:
   - Cada cambio en un input de predicción actualiza el estado local (`predictions`) de forma inmediata.
   - Se inicia un timer de debounce de 1 segundo por `matchId`. Si el usuario sigue escribiendo, el timer se reinicia.
   - Tras 1 segundo de inactividad en ese campo, se ejecuta `setDoc` sobre el documento `predictions/{userEmail}_{matchId}` en Firestore.
   - Estructura del documento: `{ userId, userEmail, matchId, predictedHome, predictedAway, updatedAt }`.
2. **Feedback Visual de Estado**: Mientras dura el debounce y el request de escritura se muestra `"Guardando..."`. Al confirmar éxito: `"Guardado ✓"` (visible 1.5 segundos, luego desaparece). En error: `"Error!"`.
3. **Prevención de Escrituras en Partidos Bloqueados**: Los inputs de predicción se deshabilitan cuando `currentTime >= kickoff`, por lo que físicamente no es posible disparar `savePrediction` en partidos ya iniciados.
4. **Guardado de Resultados Oficiales (sin debounce)**: El resultado real (`official_results/{matchId}`) se guarda inmediatamente con `setDoc` al cambiar cualquier input de marcador real, sin debounce. Estructura: `{ matchId, homeScore, awayScore, updatedBy }`.
5. **Sincronización en Tiempo Real**: Las predicciones y resultados oficiales se escuchan con `onSnapshot` sobre las colecciones `predictions` y `official_results` respectivamente. Cualquier cambio en Firestore se refleja inmediatamente en la UI de todos los usuarios conectados.

## Casos de Borde
- **Valor vacío**: Si el usuario borra el contenido de un input, `predictedHome` o `predictedAway` se guarda como `""` (string vacío), lo que el sistema de puntuación interpreta como 0 puntos para ese partido.
- **Pérdida de conexión**: No hay configuración explícita de persistencia offline de Firestore (`enableIndexedDbPersistence` no está habilitada). Si hay desconexión, el request de `setDoc` fallará y se mostrará `"Error!"` en el indicador de estado.
- **Múltiples partidos editados en paralelo**: El mapa de timers `debounceTimers.current` es independiente por `matchId`, por lo que editar varios partidos simultáneamente genera debounces paralelos sin interferencia.

## Criterios de Aceptación

### Escenario: Guardado automático exitoso
- **Dado** que el usuario ingresa "2" en el input de goles local de un partido no bloqueado
- **Cuando** deja de escribir por 1 segundo
- **Entonces** el sistema ejecuta `setDoc` en Firestore, muestra "Guardado ✓" durante 1.5 segundos, y el valor persiste al recargar la página

### Escenario: Feedback visual durante guardado
- **Dado** que el usuario está escribiendo en un input de predicción
- **Cuando** cambia el valor
- **Entonces** aparece el indicador "Guardando..." de inmediato y no desaparece hasta que Firestore confirma la escritura

### Escenario: Escritura cancelada al seguir escribiendo
- **Dado** que el usuario cambia el valor de un input
- **Cuando** cambia el valor nuevamente dentro del segundo de debounce
- **Entonces** el timer anterior se cancela, el indicador sigue en "Guardando..." y solo se ejecuta una sola escritura en Firestore al finalizar el nuevo debounce

### Escenario: Sincronización entre usuarios
- **Dado** que Papa guarda el marcador real "2" - "0" en un partido
- **Cuando** Firestore confirma la escritura
- **Entonces** Juliana y Domiciano ven el marcador real actualizado en sus interfaces sin necesidad de recargar la página

---

## Assumptions to review

1. No hay persistencia offline de Firestore habilitada; ante desconexión, las predicciones se pierden si el usuario no tiene conexión al momento de guardar — Impact: HIGH
   Correct this if: se quiere garantizar que las predicciones no se pierdan ante fallos de red.

2. El documento de predicción usa el email del usuario como parte de la clave (`{userEmail}_{matchId}`), lo que expone el email en los IDs de documentos Firestore — Impact: MEDIUM
   Correct this if: se quiere usar `uid` en lugar de email para mayor privacidad.

3. El resultado oficial se guarda sin debounce (escritura inmediata por cada tecla), lo que puede generar muchas escrituras en Firestore al teclear — Impact: LOW
   Correct this if: el volumen de escrituras genera costos o errores de rate limit en Firestore.
