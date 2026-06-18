# Spec 001: Sistema de Autenticación con Google

## Propósito
Permitir el acceso exclusivo a la aplicación utilizando cuentas de Google (Google Sign-In) a los tres únicos usuarios definidos (Juliana Rincon, Papa y Domiciano Rincon), asegurando una experiencia de login moderna, segura y sin necesidad de recordar contraseñas tradicionales.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Los tres participantes únicos de la polla. Inician sesión usando su cuenta personal de Google.

## Requisitos
1. **Acceso Exclusivo con Google**: El sistema restringe el acceso a toda la aplicación mediante una pantalla de inicio de sesión que usa Firebase Auth con `GoogleAuthProvider` y `signInWithPopup`.
2. **Filtro de Usuarios Autorizados**:
   - Una vez autenticado el usuario con Google, el sistema valida si el correo electrónico contiene alguno de los prefijos autorizados: `domi`, `juliana` o `papa` (comparación en minúsculas sobre la dirección completa de email).
   - Si el email no contiene ninguno de esos prefijos, se llama a `signOut(auth)` inmediatamente y se muestra el error en pantalla.
3. **Persistencia de Sesión**: La persistencia de sesión la gestiona Firebase Auth por defecto (almacenamiento local del navegador). No se configura explícitamente `enableIndexedDbPersistence`.
4. **Identificación y Avatar**:
   - El nombre visible se resuelve a partir de un mapa estático `USER_PROFILES` indexado por prefijo de email (`domi` → "Domiciano Rincon", `juliana` → "Juliana Rincon", `papa` → "Papa").
   - El avatar es la imagen `photoURL` de Google; si no está disponible, se muestran las iniciales del perfil mapeado.
5. **Seguridad de Datos**: Solo los usuarios autenticados y validados acceden a la vista principal y a los datos de Firestore (predicciones y resultados).

## Casos de Borde
- **Cuenta de Google no Autorizada**: Si el email autenticado no contiene ningún prefijo válido, el sistema muestra *"Acceso denegado: Tu cuenta de Google no está autorizada."*, llama a `signOut` y mantiene al usuario en la pantalla de login.
- **Cancelación del Pop-up**: Si el usuario cierra el pop-up antes de completar la autenticación (`auth/popup-closed-by-user`), la aplicación no muestra error y la UI no queda bloqueada.
- **Error genérico de Google**: Cualquier otro error de Firebase Auth muestra el mensaje del error al usuario en pantalla.

## Criterios de Aceptación

### Escenario: Login exitoso con cuenta de Google válida
- **Dado** que un usuario está en la pantalla de login
- **Cuando** hace clic en "INICIAR SESIÓN CON GOOGLE" y selecciona su cuenta autorizada (ej. `domicianorincon@gmail.com`)
- **Entonces** Firebase completa el login, el sistema valida el email, desaparece la pantalla de login, aparece el layout principal con la tab "Predicciones" activa por defecto, y muestra el nombre e imagen de Google del usuario en el encabezado

### Escenario: Denegación de acceso para cuenta de Google no válida
- **Dado** que un usuario está en la pantalla de login
- **Cuando** hace clic en "INICIAR SESIÓN CON GOOGLE" y selecciona una cuenta de correo externa (ej. `desconocido@gmail.com`)
- **Entonces** Firebase completa la sesión temporal, el sistema identifica que no es una cuenta autorizada, llama a `signOut`, muestra el mensaje de error debajo del botón y el usuario permanece en la pantalla de login

### Escenario: Cancelación del pop-up de Google
- **Dado** que un usuario cierra el pop-up de Google sin seleccionar una cuenta
- **Cuando** el pop-up se cierra (`auth/popup-closed-by-user`)
- **Entonces** la aplicación no muestra ningún mensaje de error y el botón de login permanece disponible

---

## Assumptions to review

1. El prefijo se compara sobre el email completo (no solo el local-part antes del @), lo que significa que un email como `something_domi_test@company.com` también sería válido — Impact: MEDIUM
   Correct this if: se quiere restringir la comparación solo al local-part del email.

2. No hay cierre de sesión automático por inactividad — Impact: LOW
   Correct this if: se requiere expiración de sesión por tiempo.
