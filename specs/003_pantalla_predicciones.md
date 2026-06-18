# Spec 003: Pantalla e Interfaz de Predicciones y Resultados

## Propósito
Proporcionar una interfaz web responsiva, estéticamente premium (tema oscuro, estilo neón, glassmorphism) para que Juliana Rincon, Papa y Domiciano Rincon ingresen sus marcadores predichos y registren de forma colaborativa los resultados reales una vez iniciados los partidos, utilizando el SDK de **Firebase** y las credenciales de su cuenta de **Google**.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Participantes de la polla.

## Requisitos
1. **Diseño Visual de Alta Calidad**:
   - Barra lateral (Sidebar) izquierda para navegar entre "Inicio", "Predicciones" (seleccionado por defecto) y "Ranking".
   - Estilo oscuro premium con sombras y bordes brillantes de color verde neón / cian (estilo `image.png`).
   - Encabezado con el nombre del usuario logueado en Firebase y su avatar (imagen de perfil de Google `photoURL`).
2. **Selección de Fecha por Defecto**:
   - Al abrir la página, el sistema identifica la fecha actual del usuario en la zona horaria GMT-5 y selecciona esa fecha por defecto, mostrando los partidos programados para ese día.
   - Una barra horizontal deslizable permite cambiar de fecha manualmente.
3. **Tarjetas de Partido (Match Cards) y Bloqueo**:
   - Cada tarjeta representa un partido con los datos de equipos, banderas, hora y estadio.
   - **Lógica de Bloqueo Temporal**:
     - **Antes del inicio del partido**: Los inputs de la predicción del usuario son editables.
     - **Durante o después del partido (Inicio ya ocurrido)**: Los inputs de predicción se deshabilitan inmediatamente (solo lectura).
     - La comparación de tiempos se realiza convirtiendo la hora programada del partido y la hora actual del sistema a la zona horaria GMT-5.
4. **Registro de Resultados Reales (Colaborativo)**:
   - Una vez que la hora actual del sistema supera la hora de inicio de un partido, aparece en la tarjeta del partido un campo adicional visible para los 3 usuarios: **"Marcador Real (Resultado Oficial)"**.
   - Cualquier usuario puede ingresar el resultado final real del partido en este campo.
   - Al guardar el marcador real, este se sincroniza en la colección `official_results` de **Firebase Firestore** para calcular el ranking.
5. **Botón Limpiar Todo**:
   - Botón "LIMPIAR TODO" que borra temporalmente los marcadores no guardados de la predicción en la fecha seleccionada.

## Casos de Borde
- **Inputs Vacíos al Iniciar**: Si un usuario no ingresó predicción antes de que iniciara el partido, su campo de predicción se bloquea vacío (interpretado como 0 puntos obtenidos).
- **Corrección de Marcador Real**: Si algún participante ingresa mal el marcador real, cualquiera de los 3 usuarios puede corregir el valor en la tarjeta correspondiente y guardar de nuevo, actualizando Firestore y recalculando el ranking.

## Criterios de Aceptación

### Escenario: Bloqueo de edición al iniciar el partido
- **Dado** que un partido inicia a las 11:00 A.M. GMT-5
- **Cuando** la hora actual del sistema llega a las 11:00 A.M. o más tarde
- **Entonces** los inputs de predicción de goles se bloquean (read-only) y se despliega el campo para ingresar el "Marcador Real"

### Escenario: Registro colaborativo del resultado oficial
- **Dado** que un partido ya inició (está bloqueado para predicciones)
- **Cuando** Papa ingresa el marcador real "3" - "1" y guarda
- **Entonces** el resultado se almacena en la colección `official_results` de Firebase Firestore y es visible inmediatamente para Juliana Rincon y Domiciano Rincon
