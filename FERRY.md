# Ferry: navegación de inventario según permisos del servidor

Rama: `ferry/roles-sidebar-snapshot`.

- Repositorio destino: CarlosSoles/Fronted-sistema-mype-sunat.
- Base del front: `e01f9ade8758b0ef0a3bccfa18155c488d4a5bd8` (main verificado).
- Base del transporte back: `5b37083a1ee7671854a372f4256caa3a4db418d6`.

## Contenido y aplicación

Copiar únicamente `frontend/src/components/layout/Sidebar.tsx` a
`src/components/layout/Sidebar.tsx` del front. El archivo está construido contra
la base indicada; conservar cambios posteriores mediante revisión del diff.

Se retiran las listas locales ADMIN de `/inventory/adjustments` y
`/inventory/opening`, junto con la propiedad y el filtro local que las aplicaban.
Ambos ítems siguen `canNavigate` del snapshot del servidor, igual que el resto
de la navegación. No cambia el contrato de API ni se añade enforcement al back.

El inventario `frontend/` de esta rama contiene exclusivamente el archivo de
esta comisión. Los archivos de ferries anteriores se retiran del transporte;
esto no indica que deban eliminarse del repositorio del front.

No se modifica código del back, datos, flags ni despliegues. No se crean ni
fusionan PRs.

## Validación

- Suite completa del front: 216 archivos, 1585 pruebas aprobadas,
  0 fallidas y 0 omitidas.
- `npm run build`: aprobado (TypeScript y Vite).
- ESLint de Sidebar: cero errores y una advertencia de Fast Refresh
  preexistente asociada a la exportación de NAV_ITEMS.
- `git diff --check`: aprobado.
- `SHA256SUMS` cubre este manifiesto y el único archivo del ferry.
