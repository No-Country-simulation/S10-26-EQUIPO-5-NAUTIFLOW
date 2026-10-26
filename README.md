# S10-26-EQUIPO-5-NAUTIFLOW

## Ejecutar la aplicación con Docker Compose

Desde la raíz del repositorio:

```bash
docker compose up --build
```

La aplicación quedará disponible en:

- Frontend: http://localhost:4000
- Backend: http://localhost:3001
- PostgreSQL: localhost:5432

El formulario del frontend registra primero el lanchero mediante
`POST /api/owners/register` y luego registra su lancha mediante
`POST /api/boats`, usando el identificador devuelto por el primer endpoint.

Para detener los servicios:

```bash
docker compose down
```

Para eliminar también los datos persistidos de PostgreSQL:

```bash
docker compose down -v
```