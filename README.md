# B2B Control

App estática para `GitHub Pages` con:

- calendario mensual como vista principal
- sesiones por sala
- reparto `ambos / solo uno`
- cálculo neto con `IVA` e `IRPF`
- facturas PDF
- persistencia local o compartida con `Supabase`

## Archivos principales

- [index.html](/Users/gonzalodelvalle/Documents/webB2B/index.html)
- [styles.css](/Users/gonzalodelvalle/Documents/webB2B/styles.css)
- [app.js](/Users/gonzalodelvalle/Documents/webB2B/app.js)
- [config.js](/Users/gonzalodelvalle/Documents/webB2B/config.js)
- [supabase/schema.sql](/Users/gonzalodelvalle/Documents/webB2B/supabase/schema.sql)

## Cómo hacer que guarde datos para todos

`GitHub Pages` no puede guardar datos por sí solo. Para que cualquiera con la URL pueda crear sesiones y que queden guardadas, usa `Supabase`:

1. Crea un proyecto en Supabase.
2. Ejecuta el SQL de [supabase/schema.sql](/Users/gonzalodelvalle/Documents/webB2B/supabase/schema.sql).
3. Copia la `Project URL` y la `anon public key`.
4. Pon esos datos en [config.js](/Users/gonzalodelvalle/Documents/webB2B/config.js) antes de desplegar.

También puedes introducir esos datos desde la propia pantalla `Configuración > Backend`.

## Despliegue en GitHub Pages

1. Sube esta carpeta a un repositorio.
2. Activa `Settings > Pages`.
3. Elige `Deploy from a branch`.
4. Publica desde la rama principal y la carpeta `/root`.

## Nota importante

La configuración actual de Supabase está pensada para edición pública: cualquiera con la URL podrá leer y escribir datos usando la clave pública del frontend.

Si más adelante queréis permisos reales por usuario, habrá que añadir autenticación y políticas más estrictas.
