# Spec 001: Sistema de Autenticación con Google

## Propósito
Permitir el acceso exclusivo a la aplicación utilizando cuentas de Google (Google Sign-In) a los tres únicos usuarios definidos (Juliana Rincon, Papa y Domiciano Rincon), asegurando una experiencia de login moderna, segura y sin necesidad de recordar contraseñas tradicionales.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Los tres participantes únicos de la polla. Inician sesión usando su cuenta personal de Google.

## Requisitos
1. **Acceso Exclusivo con Google**: El sistema debe restringir el acceso a toda la aplicación mediante una pantalla de inicio de sesión (Login) utilizando el SDK de **Firebase Auth** con el proveedor de **GoogleAuthProvider** (método `signInWithPopup`).
2. **Filtro de Usuarios Autorizados**:
   - Una vez autenticado el usuario con Google, el sistema debe validar si el correo electrónico de la cuenta de Google pertenece a alguno de los 3 usuarios válidos.
   - [ASSUMPTION: Se considerará correo válido si contiene los términos clave: `domi`, `juliana` o `papa`. De lo contrario, se deniega el acceso e inmediatamente se cierra la sesión de Firebase (`signOut`)].
3. **Persistencia de Sesión**: La sesión de Google Auth debe persistir localmente en el navegador para evitar volver a autenticar en cada visita.
4. **Identificación y Avatar**: El sistema debe recuperar el `displayName` de la cuenta de Google para mostrar el nombre en el encabezado (ej. "Domiciano Rincon") junto a su foto de perfil de Google (`photoURL`), o sus iniciales si la foto no está disponible.
5. **Seguridad de Datos**: Solo los usuarios autenticados y validados en el filtro de correo pueden consultar predicciones cerradas y guardar marcadores.

## Casos de Borde
- **Cuenta de Google no Autorizada**: Si un usuario externo inicia sesión con una cuenta de Google como `externo@gmail.com`, el sistema debe mostrar el mensaje: *"Acceso denegado: Tu cuenta de Google no está autorizada."*, cerrar la sesión de Firebase de inmediato y mantener al usuario en la pantalla de login.
- **Cancelación del Pop-up**: Si el usuario cierra el pop-up de Google antes de completar la autenticación, la aplicación muestra una notificación amigable de cancelación sin bloquear la UI.

## Criterios de Aceptación

### Escenario: Login exitoso con cuenta de Google válida
- **Dado** que un usuario está en `/login`
- **When** hace clic en "Iniciar sesión con Google" y selecciona su cuenta autorizada (ej. `domicianorincon@gmail.com`)
- **Entonces** Firebase completa el login, el sistema valida el correo, lo redirige a `/predicciones` y muestra su nombre e imagen de Google en la barra superior

### Escenario: Denegación de acceso para cuenta de Google no válida
- **Dado** que un usuario está en `/login`
- **When** hace clic en "Iniciar sesión con Google" y selecciona una cuenta de correo externa (ej. `desconocido@gmail.com`)
- **Entonces** Firebase completa la sesión temporal, el sistema identifica que no es una cuenta autorizada, llama a `signOut`, muestra un error visual y el usuario permanece en la pantalla de `/login`
