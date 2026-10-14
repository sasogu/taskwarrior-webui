# Subtareas en la WebUI

Cada fila admite **Añadir subtarea**. En el formulario, **Tarea principal**
permite elegir otra tarea o quitar la relación para volver a una tarea
independiente. Una subtarea nueva hereda el proyecto de su principal;
después se puede editar como cualquier otra tarea.

La flecha de la fila despliega el árbol. Cada subtarea admite más subtareas,
edición, completar, restaurar y eliminar. Los niveles se pueden plegar por
separado. Las terminadas siguen visibles dentro de la principal, con su
estado y el texto tachado. El contador `completadas/total` incluye todos
los niveles, excepto tareas eliminadas y plantillas recurrentes.

Los filtros de proyecto y estado siguen funcionando. Una subtarea se
muestra como fila propia si su principal no aparece en el filtro; se indica
el nombre de la principal para conservar el contexto. La paginación y la
ordenación se aplican a las filas principales y el árbol viaja con ellas.

Completar una tarea pide confirmación con su descripción exacta. Si quedan
subtareas pendientes, lo advierte; no completa ninguna otra tarea. La API
rechaza eliminar una principal mientras conserve subtareas, salvo que se
haya seleccionado toda la rama en la misma petición. Desde la interfaz se
pueden mover las subtareas o eliminarlas antes de eliminar su principal.

## Almacenamiento e interoperabilidad

La relación se guarda en el atributo UDA `webparent`, cuyo valor es el UUID
de la tarea principal. La aplicación declara este atributo mediante opciones
`rc.uda.webparent` en cada ejecución de Taskwarrior 2.6.2, sin modificar el
fichero `.taskrc` del usuario. No utiliza `parent`, que Taskwarrior reserva
para recurrencias, ni cambia el campo `depends`.

Taskwarrior conserva los UDA sin definir en otros clientes. Para usar el
campo desde la CLI se puede declarar por invocación:

```sh
task rc.uda.webparent.type=string UUID_HIJA modify webparent:UUID_PRINCIPAL
task rc.uda.webparent.type=string UUID_HIJA modify webparent:
```

La WebUI valida existencia de la principal, autorreferencias y ciclos antes
de importar. No admite subtareas recurrentes ni añadir subtareas a plantillas
recurrentes o tareas eliminadas. Los árboles corruptos importados desde otros
clientes se recorren con límites para no ocultar toda la rama ni bloquear la
interfaz. Se mantiene el rechazo 409 de ediciones basadas en copias antiguas.

## Pruebas

Con las dependencias de desarrollo del frontend instaladas:

```sh
node --test tests/hierarchy.test.cjs
docker build -t taskwarrior-webui-local:subtasks .
```

`tests/api-subtasks.py` requiere un contenedor desechable con almacén vacío,
configuración propia y `ALLOWED_LOGINS=subtasks@example.invalid`; aborta si
encuentra tareas existentes. `tests/browser-subtasks.mjs` requiere Playwright
y Chromium, y acepta únicamente datos de prueba. No ejecutarlos sobre el
almacén personal. Se pueden indicar `TASKWEB_TEST_URL`, `TASKWEB_PLAYWRIGHT`
y `TASKWEB_CHROMIUM`; la suite unitaria acepta `TASKWEB_TYPESCRIPT`.

Las pruebas cubren estructura de varios niveles, filtros, ciclos,
conservación de metadatos, conflictos, separación de subtareas y eliminación.
La prueba de navegador crea tareas, completa una subtarea mediante
confirmación, comprueba progreso, plegado, el selector de principal y móvil.
