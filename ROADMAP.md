# Hoja de ruta

Desarrollo por entregas, de menor a mayor complejidad estimada. Las fases 2–6
quedan pendientes para próximas sesiones; no se inician como parte del cierre
actual.

## 1. Anotaciones — completada

- [x] Añadir, editar y eliminar anotaciones desde el formulario de tarea.
- [x] Confirmar el borrado mostrando el texto de la anotación.
- [x] Conservar su fecha original; cancelar y restablecer descartan borradores.
- [x] Proteger el guardado frente a cambios de otros clientes.
- [x] Validar español, inglés, catalán y móvil.

Commit de implementación: `5c1985c`.

## 2. Iniciar y detener tareas — pendiente

- [ ] Botones de inicio y parada mediante las operaciones nativas de Taskwarrior.
- [ ] Indicador de tarea activa y vista «En curso».
- [ ] Conservar los hooks y el control de conflictos.
- [ ] Mantener el comportamiento de otras tareas activas salvo acción explícita.

Alcance: marcar actividad. El seguimiento completo de tiempo con Timewarrior
sería una integración posterior.

## 3. Búsqueda y filtros combinados — pendiente

- [ ] Búsqueda por texto.
- [ ] Combinar proyecto, etiquetas, prioridad y fechas.
- [ ] Vistas «Hoy», «Esta semana» y «Atrasadas».
- [ ] Indicador de filtros activos y botón para limpiarlos.
- [ ] Mantener comprensibles los árboles de subtareas al filtrar.

## 4. Dependencias — pendiente

- [ ] Elegir tareas que deben terminar antes de otra.
- [ ] Distinguir tareas bloqueadas y disponibles.
- [ ] Evitar referencias inválidas y ciclos.
- [ ] Mantener separadas las dependencias nativas (`depends`) y la jerarquía de
      subtareas (`webparent`).

## 5. Contextos e informes — pendiente

- [ ] Consultar contextos e informes existentes.
- [ ] Seleccionarlos desde la web y presentar sus resultados.
- [ ] Definir cómo afectan a la vista web y a otros clientes antes de permitir
      cambios en la configuración compartida.

## 6. Deshacer cambios — pendiente

- [ ] Identificar las acciones realizadas desde la web.
- [ ] Comprobar modificaciones posteriores antes de revertir una acción.
- [ ] Proteger los cambios de la CLI y de otros clientes que comparten almacén.
- [ ] Definir un registro de acciones y el alcance de las operaciones reversibles.

No basta con ejecutar el `undo` global: el último cambio puede proceder de otro
cliente.

## Criterios de cada entrega

1. Implementar y probar con tareas ficticias en un almacén aislado.
2. Comprobar español, inglés, catalán y escritorio/móvil.
3. Verificar cancelación, metadatos y conflictos cuando corresponda.
4. Crear copia de seguridad antes del despliegue y verificar los datos después.
5. Guardar un commit independiente y documentar la reversión.

## Mantenimiento pendiente

- [ ] Retirar o adaptar los controles heredados de sincronización con taskserver:
      la ruta `/api/sync` está desactivada en esta versión. La recarga del almacén
      local sí funciona.
