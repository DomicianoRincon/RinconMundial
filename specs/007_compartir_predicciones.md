# Spec 007: Compartir Predicciones del Día

## Propósito
Permitir a cada usuario exportar sus predicciones del día seleccionado como una imagen PNG de marca (`RinconMundial`) para compartirla por WhatsApp u otras apps.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Comparten sus predicciones en el chat familiar antes de que inicien los partidos.

## Requisitos

### Disparo
1. El botón de compartir (ícono `Share2` de Lucide) aparece en el header de la vista Predicciones.
2. Al pulsarlo, se ejecuta `handleShare`. Durante la generación de la imagen, el estado `isSharing` es `true` y el botón muestra un indicador de carga (`Loader` animado). Al terminar (éxito o error), vuelve al ícono `Share2`.

### Contenido de la imagen generada
3. Solo se incluyen los partidos del `selectedDate` que tienen predicción completa (`predictedHome !== ""` y `predictedAway !== ""`). Los partidos sin predicción se omiten.
4. Si no hay predicciones para el día, la imagen se genera igualmente pero sin filas de partidos (solo header + footer).
5. Los partidos se muestran en orden de kickoff (menor a mayor).

### Composición visual del canvas
6. **Dimensiones**: 480px de ancho, alto dinámico según número de filas. Se escala 2× para retina (`canvas.width = W * 2`, `ctx.scale(2, 2)`).
7. **Fondo**: `#0d1117` con borde verde neón redondeado (`rgba(0,255,135,0.35)`).
8. **Header** (80px): Título `RINCONMUNDIAL` en verde (`#00ff87`), fecha en español (ej. `JUNIO 24`), nombre corto del usuario (primer apellido) y etiqueta `MIS PREDICCIONES`.
9. **Watermark**: Logo del mundial centrado en el área de partidos con `globalAlpha = 0.07`.
10. **Filas de partido** (92px cada una):
    - Hora de inicio en Colombia (`formatKickoffColombia`) + abreviatura del grupo (ej. `G A`), centrado arriba.
    - Bandera del equipo local (izquierda) y visitante (derecha): PNG local de `public/flags/`, recortada con border-radius de 6px.
    - Nombre del equipo en español (truncado si excede el ancho disponible), centrado bajo cada bandera.
    - Marcador predicho centrado en grande (`bold 26px`): `predictedHome — predictedAway`.
    - Filas alternas con fondo ligeramente diferente (`rgba(255,255,255,0.025)`).
11. **Footer** (36px): Texto de marca `rinconmundial · mundial 2026` centrado.

### Pre-carga de imágenes
12. Antes de dibujar, se pre-cargan todas las banderas de los equipos del día y el logo watermark en paralelo (`Promise.all`). Si una imagen no carga (404 o error), se dibuja un rectángulo oscuro en su lugar (`#1f2937`).

### Exportación
13. El canvas se convierte a `Blob` PNG con `canvas.toBlob(res, 'image/png')`.
14. **Web Share API** (móvil preferido): Si `navigator.share` y `navigator.canShare({ files: [file] })` están disponibles, se invoca `navigator.share({ title, text, files: [file] })`.
15. **Fallback (descarga directa)**: Si el navegador no soporta compartir archivos (escritorio u otros), se crea un `<a>` con `href = URL.createObjectURL(blob)` y se hace click programático para descargar. El nombre del archivo es `rinconmundial-{selectedDate}.png`.
16. Si el usuario cancela el sheet de compartir del sistema (`err.name === 'AbortError'`), no se muestra ningún error.

## Casos de Borde
- **Día sin predicciones**: Se genera la imagen vacía (solo header y footer). Comportamiento aceptable; el usuario verá una imagen con su nombre pero sin filas.
- **Bandera no disponible en `public/flags/`**: `getFlagUrl` devuelve `null`; el pre-loader resuelve con `null`; `drawFlag` dibuja el rectángulo de fallback.
- **Nombre de equipo muy largo**: La función `truncate` lo corta y agrega `…` para no desbordar el ancho de la columna.
- **Partido con hora ambigua**: Si `parseMatchTime` falló y el `kickoff` es `00:00 UTC`, `formatKickoffColombia` muestra `07:00 p. m.` (GMT-5 de la medianoche UTC). El usuario lo verá como hora incorrecta.

## Criterios de Aceptación

### Escenario: Compartir con Web Share API
- **Dado** que el usuario tiene predicciones para el día seleccionado y está en un dispositivo móvil con soporte de Web Share con archivos
- **Cuando** toca el botón de compartir
- **Entonces** aparece el sheet nativo de compartir del sistema con un archivo `rinconmundial-2026-06-24.png` adjunto

### Escenario: Fallback en escritorio
- **Dado** que el usuario está en un navegador de escritorio que no soporta `navigator.canShare`
- **Cuando** hace clic en el botón de compartir
- **Entonces** el navegador descarga automáticamente el archivo `rinconmundial-2026-06-24.png`

### Escenario: Indicador de carga
- **Dado** que la generación de imagen tarda (pre-carga de banderas)
- **Cuando** el usuario pulsa el botón de compartir
- **Entonces** el ícono `Share2` se reemplaza por un spinner animado hasta que la operación termina o falla

### Escenario: Cancelación por el usuario
- **Dado** que el sheet de compartir se abre y el usuario lo cierra sin compartir
- **Cuando** el sistema captura `AbortError`
- **Entonces** no se muestra ningún mensaje de error y el botón vuelve a su estado normal

---

## Assumptions to review

1. Las banderas locales (`public/flags/`) existen para todos los 48 equipos del mundial 2026 en el mapa `FLAG_CODES` — Impact: MEDIUM
   Correct this if: se agrega algún equipo que no tiene su PNG correspondiente en el directorio.

2. El nombre del usuario (de Google `displayName`) tiene al menos una palabra; se toma solo la primera con `.split(" ")[0]` — Impact: LOW
   Correct this if: un usuario configura su cuenta de Google sin displayName (se usaría la primera parte del email en ese caso).

3. La generación del canvas es síncrona bloqueando el hilo principal; en dispositivos lentos puede causar un frame de retraso visible — Impact: LOW
   Correct this if: se quiere offloading a Web Worker u optimización de rendimiento.
