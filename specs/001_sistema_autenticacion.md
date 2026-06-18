# Spec 001: Sistema de Autenticación de Usuarios

## Propósito
Permitir el acceso exclusivo a la aplicación mediante contraseña a los tres únicos usuarios definidos (Juliana Rincon, Papa y Domiciano Rincon), asegurando que cada uno visualice y edite únicamente sus propias predicciones mediante la integración de **Firebase Authentication**.

## Usuarios
- **Juliana Rincon, Papa, Domiciano Rincon**: Los tres participantes únicos de la polla. Todos tienen el mismo nivel de acceso y privilegios (autenticados a través de Firebase).

## Requisitos
1. **Acceso Exclusivo**: El sistema debe restringir el acceso a toda la aplicación mediante una pantalla de inicio de sesión (Login) utilizando el SDK de **Firebase Auth** (método de inicio de sesión con Email y Contraseña).
2. **Cuentas Preconfiguradas**: Solo existirán 3 cuentas de usuario creadas previamente en la consola de Firebase:
   - Juliana Rincon (ej. `juliana@mundial.com`)
   - Papa (ej. `papa@mundial.com`)
   - Domiciano Rincon (ej. `domi@mundial.com`)
   No se permitirá el registro público en la interfaz (signup deshabilitado).
3. **Persistencia de Sesión**: La sesión debe mantenerse activa utilizando la persistencia por defecto de Firebase Auth (`local`), para evitar tener que iniciar sesión cada vez que se abra la aplicación.
4. **Identificación del Usuario**: El sistema debe recuperar el `displayName` de Firebase del usuario logueado para mostrarlo en el encabezado (ej. "Domiciano Rincon") junto a su avatar.
5. **Seguridad de Datos**: Un usuario no puede modificar las predicciones guardadas de otro. Las predicciones ajenas se mantienen ocultas hasta que el partido inicie.

## Casos de Borde
- **Credenciales Incorrectas**: Si el inicio de sesión falla en Firebase Auth, la aplicación muestra una alerta clara indicando error de autenticación.
- **Acceso Directo por URL**: Si un usuario no autenticado intenta entrar a `/predicciones` o `/ranking`, el estado de Firebase Auth (`onAuthStateChanged`) detectará la falta de sesión y lo redirigirá inmediatamente a `/login`.

## Criterios de Aceptación

### Escenario: Acceso bloqueado sin autenticación
- **Dado** que un usuario no ha iniciado sesión en Firebase
- **Cuando** intenta cargar la ruta `/predicciones`
- **Entonces** el listener de Firebase detecta que no hay sesión activa y lo redirige a `/login`

### Escenario: Login exitoso
- **Dado** que el usuario está en `/login`
- **Cuando** ingresa su correo y contraseña de Firebase y hace clic en ingresar
- **Entonces** Firebase Auth valida las credenciales y el usuario es redirigido a `/predicciones` mostrando su nombre de perfil en el encabezado
