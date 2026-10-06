# Margen · horario y faltas de 2º MyP A

Web app de Google Apps Script. La interfaz es React + Vite compilada en un único HTML (`gas/Index.html`). El servidor es `gas/Code.js` y guarda los datos en una Hoja de cálculo de Google («Margen · datos»).

## Probar en local

```bash
npm install
npm run dev
```

Fuera de Google se abre en **modo de prueba**: guarda todo en el navegador. Para entrar, usuario `lucia` y contraseña `1234`; para crear cuentas, el código `SALINAS2A`. Añadiendo `?ahora=2026-11-23T11:05` a la dirección se simula otra fecha y hora.

## Publicar (primera vez)

1. Activa la API de Apps Script en https://script.google.com/home/usersettings.
2. Inicia sesión con tu cuenta de Google: `npx clasp login` (se abre el navegador).
3. Crea el proyecto: `npx clasp create --type webapp --title "Margen" --rootDir gas`.
4. Sube el código: `npm run push`.
5. Abre el editor con `npx clasp open-script`, elige la función `setup` y pulsa **Ejecutar**. Te pedirá permisos para crear la hoja de datos; acéptalos. En el registro aparecerá el enlace a la hoja.
6. Publica: **Implementar → Nueva implementación → Aplicación web**, con «Ejecutar como: Yo» y «Quién tiene acceso: Cualquier usuario». La URL que termina en `/exec` es la que compartes con la clase.

## Actualizar

- **Cambiar el horario:** se edita `WEEK` en `src/data.js` (y `MODS` si cambia algún profesor) y se ejecuta `npm run push`.
- **Que el cambio llegue a la URL pública:** `npm run deploy`. Compila, sube el código y crea una nueva versión de la misma implementación, así que la URL no cambia.

**URL pública:** https://script.google.com/macros/s/AKfycbxcPjcjmq1N6O2UriM5cz8vWM-6nEj4Aokx3wdtqz7d0z7SqcbUcnwGH0XeUsJywXilJw/exec
**Editor:** https://script.google.com/d/1ynC5BYmVv5pmNCcpJeh5BTh-ohIh-le9dOkeQB03dQAUzBSrYts-rOhB/edit
- **Código de clase y máximo de cuentas:** se cambian directamente en la pestaña `Config` de la hoja de datos.

## Seguridad
- **Acceso a los datos:** la hoja de datos es privada (solo tú la ves). La web solo puede llamar a `api()`, que comprueba la sesión en cada petición, así que nadie puede ver las faltas de otra persona.
- **Contraseñas:** se guardan cifradas, con HMAC-SHA256 iterado y una sal distinta por usuario. Tras 8 intentos fallidos, la cuenta se bloquea 15 minutos.
- **«Recordarme»:** con la casilla marcada, la sesión dura 180 días en ese dispositivo; sin marcar, se cierra al cerrar la pestaña (y como mucho a las 12 horas).

## Límites de Apps Script
- Google muestra arriba una franja con «Esta aplicación la ha creado un usuario de Google Apps Script». Con una cuenta personal de Gmail no se puede quitar.
- Cada acción tarda alrededor de un segundo, porque lee y escribe en la hoja.
- En iPhone (Safari), «Recordarme» puede durar menos: Safari limita lo que guardan las webs incrustadas, y Apps Script siempre sirve la app incrustada.
