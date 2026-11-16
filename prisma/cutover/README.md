# Candidato para el corte — no activo

`auth.prisma` sustituirá únicamente `prisma/schema/auth.prisma` durante la parte 5 aprobada, después de convertir las tres columnas existentes a texto y verificar preflight/FKs/índices. Se combina con los demás archivos del esquema activo y se valida en un directorio temporal. No se usa para generar el cliente del paquete 3B: este debe seguir escribiendo las columnas enum existentes.

Diferencias del candidato: retiro de enum Role; User.role y los dos permisos pasan a String; el default se conserva como texto; tres relaciones compuestas (company_id, role) → CompanyRole(company_id, code), onDelete/onUpdate Restrict. No hay SQL de conversión ejecutable en este paquete. La migración de corte, lock/backup, despliegue de todos los clientes y activación del flag requieren las partes 5–6. No copiar este archivo al esquema activo ni ejecutar db push/migrate deploy antes de ese corte.
