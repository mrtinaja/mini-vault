# Mini Vault: proyecto único

El proyecto activo está en `C:\Users\Usuario\Documents\mini-vault`.
El acceso directo del escritorio apunta a `src-tauri\target\release\mini-vault.exe`.
La copia antigua bajo `Documents\Codex\2026-08-12` se retira; no trabajar allí.

## Revisar y compilar

- `git log --oneline` y `git show` permiten revisar el estado inicial y los cambios.
- `node --check src/main.js` valida la sintaxis del frontend.
- En PowerShell: `& .\node_modules\.bin\tauri.cmd build --bundles nsis`.
- Los cambios del frontend requieren recompilar el ejecutable del acceso directo.

## Comportamiento acordado

- Botones con texto visible Copiar en los campos y accesos de la lista.
- Copia nativa mediante `copiar_texto`; limpieza a los 60 segundos si el portapapeles todavía contiene el valor copiado.
- Los campos al editar se buscan dentro del tipo activo (contraseña, nota o VPN).

## Datos locales

La versión activa conserva el identificador `com.usuario.mini-vault` y lee `items.json` de su carpeta de datos de Tauri. No subir, registrar ni imprimir su contenido. La implementación existente guarda JSON sin cifrar; esta tarea no cambia su formato.
La carpeta `com.local.minivault` corresponde a la versión antigua: sus datos se conservan, no se borran ni se migran automáticamente.
`backups/`, bases de datos, archivos de entorno y artefactos de compilación están excluidos de Git.

Git es local; no se configuró un remoto ni un servicio de monitoreo automático.
