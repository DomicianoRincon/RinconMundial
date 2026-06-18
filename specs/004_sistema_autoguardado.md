# Spec 004: Sistema de Autoguardado en Tiempo Real

## Propósito
Implementar un sistema de autoguardado en tiempo real (autosave) para las predicciones ingresadas por los usuarios de modo que no sea necesario un botón de "Guardar" y la información persista automáticamente en **Firebase Firestore**.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Digitan marcadores con la seguridad de que sus datos están respaldados de forma inmediata.

## Requisitos
1. **Autoguardado Automático (Autosave)**:
   - Cada vez que el usuario cambie un valor numérico en el marcador de un partido, el sistema debe guardar el cambio automáticamente en la colección `predictions` de **Firebase Firestore**.
   - Se debe usar un mecanismo de *debounce* de 1 segundo después del último cambio de entrada antes de hacer la petición de escritura en Firestore (utilizando `setDoc` u `updateDoc`).
   - Debe mostrarse un pequeño indicador visual de estado en la interfaz: "Guardando..." y luego "Guardado" para dar feedback al usuario.
2. **Edición Restringida**:
   - El sistema de autoguardado no debe procesar escrituras para partidos que ya hayan comenzado (según la hora oficial del partido en GMT-5).

## Casos de Borde
- **Pérdida de Conexión en Autoguardado**: Si el autosave falla por desconexión de red, el SDK de Firebase Firestore manejará la persistencia local automáticamente si está habilitada la opción de caché offline (`enableIndexedDbPersistence`). Si no, la aplicación almacenará la predicción en localStorage para sincronizarla al recuperar conexión.

## Criterios de Aceptación

### Escenario: Guardado automático exitoso
- **Dado** que el usuario ingresa un marcador "2" - "1" en la tarjeta de un partido
- **Cuando** deja de escribir por 1 segundo
- **Entonces** el sistema envía la información a Firebase Firestore, se muestra el indicador "Guardado" y los marcadores persisten al recargar la página

### Escenario: Guardado automático con desconexión temporal
- **Dado** que el usuario no tiene conexión a internet
- **Cuando** modifica un marcador en una tarjeta
- **Entonces** Firebase Firestore almacena el cambio en su caché local offline, actualiza la UI al instante, y sincroniza la base de datos en la nube en cuanto se restablece la red
