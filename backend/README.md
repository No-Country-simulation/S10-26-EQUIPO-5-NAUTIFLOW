# Backend —
**Propuesta técnica para el MVP de gestión de transporte fluvial**

## 1. Objetivo

Desarrollar una API REST para centralizar la gestión de lancheros, embarcaciones, documentación, viajes, reseñas y retornos vacíos en el Delta de Tigre.

El backend será responsable de implementar las reglas de negocio, validar los datos, gestionar los permisos de acceso y proporcionar los endpoints necesarios para que el equipo de frontend pueda construir el portal público y el panel administrativo.

La solución estará orientada a un MVP de cinco semanas, priorizando la seguridad, la trazabilidad y la entrega de funcionalidades esenciales.

## 2. Stack tecnológico propuesto

- **Node.js + TypeScript:** entorno de ejecución y lenguaje.
- **NestJS:** framework para desarrollar la API REST mediante módulos.
- **PostgreSQL:** base de datos relacional.
- **TypeORM:** mapeo objeto-relacional y gestión de entidades.
- **JWT:** autenticación y autorización basada en roles.
- **class-validator / class-transformer:** validación y transformación de datos de entrada.
- **Swagger / OpenAPI:** documentación de endpoints y contratos de la API.
- **Docker Compose:** entorno local reproducible para PostgreSQL.
- **Jest:** pruebas unitarias y de integración.
- **pnpm:** gestión de dependencias.

## Puesta en marcha local

Desde PowerShell, ejecutar:

```powershell
cd C:\Users\Fede\Desktop\No-Country\backend
Copy-Item .env.example .env
docker compose up -d --build
```

El comando anterior inicia:

| Servicio | URL |
| --- | --- |
| Backend | <http://localhost:3001> |
| Adminer | <http://localhost:8080> |

En Adminer, ingresar con estos datos:

- **Sistema:** PostgreSQL
- **Servidor:** `postgres`
- **Usuario:** `delta_user`
- **Contraseña:** `delta_password`
- **Base de datos:** `delta_db`

Las migraciones se montan en PostgreSQL y se ejecutan automáticamente cuando se
crea el volumen por primera vez. Si el volumen ya existía, Docker no vuelve a
ejecutar los scripts; en ese caso, aplicarlas manualmente:

```powershell
Get-Content -Raw .\migrations\000_initial_schema.sql | docker exec -i delta-postgres psql -v ON_ERROR_STOP=1 -U delta_user -d delta_db
Get-Content -Raw .\migrations\001_add_owner_credentials_and_password_reset.sql | docker exec -i delta-postgres psql -v ON_ERROR_STOP=1 -U delta_user -d delta_db
```

Para detener los contenedores:

```powershell
docker compose down
```

La API se puede verificar con `GET http://localhost:3001`.

Para registrar un lanchero desde Postman:

```text
POST http://localhost:3001/api/owners/register
Content-Type: application/json
```

```json
{
  "fullName": "Juan Perez",
  "email": "juan.perez@example.com",
  "password": "UnaClaveSegura123",
  "phone": "1123456789"
}
```

Usar el `id` de la respuesta como `ownerId` al crear una embarcación:

```text
POST http://localhost:3001/api/boats
Content-Type: application/json
```

```json
{
  "ownerId": "uuid-devuelto-por-el-registro",
  "registrationNumber": "NAU-001",
  "name": "La Delfina",
  "passengerCapacity": 8,
  "coverageZone": "Delta de Tigre"
}
```

### Cuerpos para Postman

En todos los requests que envían datos, seleccionar `Body > raw > JSON` y
agregar el header:

```text
Content-Type: application/json
```

#### Registrar un lanchero

```text
POST http://localhost:3001/api/owners/register
```

```json
{
  "fullName": "Juan Perez",
  "email": "juan.perez@example.com",
  "password": "UnaClaveSegura123",
  "phone": "1123456789"
}
```

La contraseña debe tener entre 12 y 128 caracteres. El endpoint devuelve el
`id` del lanchero, que se utiliza como `ownerId` al crear una embarcación.

#### Crear una embarcación

```text
POST http://localhost:3001/api/boats
```

```json
{
  "ownerId": "PEGAR-AQUI-EL-ID-DEL-LANCHERO",
  "registrationNumber": "NAU-002",
  "name": "La Delfina",
  "passengerCapacity": 8,
  "coverageZone": "Delta de Tigre"
}
```

`passengerCapacity` debe ser un número entre 1 y 200. El `ownerId` debe ser
un UUID existente en la tabla `users`.

#### Solicitar recuperación de contraseña

```text
POST http://localhost:3001/api/owners/password/forgot
```

```json
{
  "email": "juan.perez@example.com"
}
```

La respuesta es siempre un mensaje genérico para no revelar si el correo está
registrado. Cuando `RESEND_API_KEY`, `MAIL_FROM` y `FRONTEND_URL` están
configurados, el token se envía mediante un enlace al correo.

#### Restablecer contraseña

```text
POST http://localhost:3001/api/owners/password/reset
```

```json
{
  "token": "TOKEN_RECIBIDO_EN_EL_ENLACE_DEL_EMAIL",
  "password": "NuevaClaveSegura123"
}
```

El token es el valor incluido en el enlace recibido por correo, no el
`token_hash` almacenado en la base de datos. La nueva contraseña debe tener
entre 12 y 128 caracteres.

### Consultas para Adminer

Abrir <http://localhost:8080> e ingresar con:

- **Sistema:** `PostgreSQL`
- **Servidor:** `postgres`
- **Usuario:** `delta_user`
- **Contraseña:** `delta_password`
- **Base de datos:** `delta_db`

Después de iniciar sesión, seleccionar la base `delta_db` y entrar en
**SQL command**. Estas consultas sirven para inspeccionar los datos creados
desde Postman.

#### Ver tablas y columnas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

#### Ver lancheros

No se muestra `password_hash`, porque contiene credenciales almacenadas y no
debe exponerse innecesariamente.

```sql
SELECT
  id,
  name AS full_name,
  email,
  phone,
  role,
  created_at
FROM users
ORDER BY created_at DESC;
```

#### Buscar el UUID de un lanchero

```sql
SELECT id, name AS full_name, email, phone
FROM users
WHERE email = 'juan.perez@example.com';
```

Copiar el valor de `id` de esta consulta para usarlo como `ownerId` en
Postman.

#### Ver embarcaciones con su propietario

```sql
SELECT
  b.id,
  b.registration_number,
  b.name,
  b.passenger_capacity,
  b.coverage_zone,
  b.status,
  b.verification_status,
  b.created_at,
  u.id AS owner_id,
  u.name AS owner_name,
  u.email AS owner_email
FROM boats AS b
INNER JOIN users AS u ON u.id = b.owner_id
ORDER BY b.created_at DESC;
```

#### Buscar una embarcación por matrícula

```sql
SELECT
  b.registration_number,
  b.name,
  b.passenger_capacity,
  b.coverage_zone,
  b.status,
  b.verification_status,
  u.name AS owner_name,
  u.email AS owner_email
FROM boats AS b
INNER JOIN users AS u ON u.id = b.owner_id
WHERE b.registration_number = 'NAU-002';
```

#### Filtrar embarcaciones disponibles y aprobadas

```sql
SELECT
  b.registration_number,
  b.name,
  b.passenger_capacity,
  b.coverage_zone,
  u.name AS owner_name,
  u.phone AS owner_phone
FROM boats AS b
INNER JOIN users AS u ON u.id = b.owner_id
WHERE b.status = 'active'
  AND b.verification_status = 'approved'
ORDER BY b.coverage_zone, b.name;
```

#### Aprobar o desactivar una embarcación

Estas consultas son para tareas administrativas manuales en Adminer:

```sql
UPDATE boats
SET verification_status = 'approved'
WHERE registration_number = 'NAU-002';
```

```sql
UPDATE boats
SET status = 'inactive'
WHERE registration_number = 'NAU-002';
```

Verificar el resultado:

```sql
SELECT registration_number, status, verification_status
FROM boats
WHERE registration_number = 'NAU-002';
```

#### Ver tokens de recuperación

El `token_hash` no permite reconstruir el token que debe enviarse en Postman.
Esta consulta solo sirve para comprobar que existe un token pendiente y cuándo
vence:

```sql
SELECT
  id,
  owner_id,
  expires_at,
  created_at
FROM password_reset_tokens
ORDER BY created_at DESC;
```

No editar manualmente `password_hash` ni `token_hash`. El backend genera ambos
valores de forma segura.

## 3. Arquitectura propuesta

Se utilizará una arquitectura de monolito modular con NestJS, organizada por dominios funcionales.

Esta decisión busca mantener el código organizado y facilitar el desarrollo, las pruebas y el mantenimiento, sin incorporar la complejidad operativa de una arquitectura de microservicios.

Cada módulo será responsable de sus entidades, servicios, controladores y reglas de negocio.

## 4. Módulos del backend

### 4.1. Autenticación y usuarios

- Implementar el inicio de sesión del administrador.
- Gestionar contraseñas mediante hash seguro.
- Proteger endpoints mediante JWT y guards.
- Aplicar autorización basada en roles.
- Separar los permisos administrativos de las operaciones públicas permitidas.

### 4.2. Lancheros y embarcaciones

- Registrar lancheros y sus datos de contacto.
- Registrar embarcaciones y asociarlas con sus propietarios.
- Gestionar capacidad de pasajeros y zonas de cobertura.
- Administrar el estado operativo de las embarcaciones.
- Permitir consultar la información necesaria para la gestión de la flota.

### 4.3. Documentación y verificación

- Registrar los documentos requeridos: licencia, seguro y antecedentes penales.
- Permitir la carga de archivos PDF e imágenes.
- Gestionar los estados de revisión documental.
- Permitir al administrador aprobar o rechazar una embarcación, registrando la decisión.
- Restringir el acceso a los documentos sensibles.

La verificación será exclusivamente manual. No se integrarán APIs gubernamentales para validar identidades o antecedentes.

### 4.4. Búsqueda y gestión de viajes

- Buscar embarcaciones por capacidad, zona, horario y estado de verificación.
- Excluir de los resultados las embarcaciones inactivas o no aprobadas.
- Registrar solicitudes y asignaciones manuales de viajes.
- Gestionar los estados del viaje.
- Registrar la finalización del servicio.
- Evitar asignaciones incompatibles en horarios superpuestos.

La selección y el contacto con el lanchero estarán a cargo del administrador. No se implementará asignación automática mediante GPS.

### 4.5. Reseñas y reputación

- Generar enlaces de reseña con tokens únicos asociados a viajes reales.
- Permitir que el turista califique un viaje completado sin registrarse ni iniciar sesión.
- Validar que el enlace sea válido y que la reseña no haya sido enviada previamente.
- Aceptar puntuaciones de 1 a 5 estrellas y comentarios.
- Calcular el promedio de calificaciones de cada embarcación.
- Exponer las reseñas aprobadas para su visualización en la landing pública.
- Preparar el mecanismo de notificación al lanchero.

El acceso al formulario de reseñas estará limitado mediante tokens impredecibles, de un solo uso y con vigencia definida.

### 4.6. Retornos vacíos

- Registrar tramos de retorno asociados a viajes.
- Guardar origen, destino, horario y estado del tramo.
- Implementar la operación para publicar un retorno vacío.
- Permitir consultar los retornos disponibles desde el panel administrativo.
- Facilitar la comunicación manual de oportunidades a la flota.

No se desarrollarán subastas en tiempo real, seguimiento GPS ni notificaciones push geolocalizadas.

## 5. Modelo de datos inicial

Se propone trabajar con las siguientes entidades principales:

| Entidad | Responsabilidad |
|---|---|
| `User` | Usuarios, credenciales y roles. |
| `BoatOwner` | Información del lanchero y sus datos de contacto. |
| `Boat` | Embarcaciones, capacidad, zonas y estados. |
| `BoatDocument` | Documentación, archivos y revisión administrativa. |
| `Trip` | Solicitudes, asignaciones y ejecución de viajes. |
| `Review` | Calificaciones y comentarios asociados a viajes. |
| `EmptyLeg` | Registro de tramos de retorno vacíos. |

El esquema definitivo, las cardinalidades y las restricciones se validarán antes de implementar las migraciones de base de datos.

## 6. Seguridad y reglas de negocio

Se tendrán en cuenta las siguientes medidas:

- Validación de datos mediante DTO.
- Configuración global de `ValidationPipe`.
- Protección de rutas administrativas.
- Autorización explícita para cada operación sensible.
- Almacenamiento seguro de contraseñas.
- Acceso controlado a documentos privados.
- Tokens de reseña aleatorios, de un solo uso y con vencimiento.
- Restricción de reseñas a viajes completados.
- Prevención de reseñas duplicadas mediante restricciones de base de datos.
- Validación de capacidad, cobertura y compatibilidad horaria.
- Manejo centralizado de errores.
- Variables de entorno para la configuración sensible.

La configuración de producción utilizará migraciones de TypeORM, con `synchronize: false`.

## 7. Contrato de API

Se documentarán los endpoints mediante Swagger/OpenAPI para permitir el trabajo paralelo con el equipo de frontend.

Se definirán métodos HTTP, rutas, parámetros, DTO, respuestas, errores y requisitos de autenticación.

Entre los endpoints previstos se encuentran:

| Método | Endpoint propuesto | Función |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión. |
| POST | `/api/owners/register` | Registrar un lanchero. |
| POST | `/api/boats` | Registrar una embarcación. |
| POST | `/api/boats/:id/documents` | Cargar documentación. |
| GET | `/api/admin/boats/pending` | Consultar embarcaciones pendientes. |
| PATCH | `/api/admin/boats/:id/verification` | Aprobar o rechazar. |
| GET | `/api/admin/boats/search` | Buscar embarcaciones. |
| POST | `/api/admin/trips` | Registrar y asignar un viaje. |
| PATCH | `/api/admin/trips/:id/complete` | Completar un viaje. |
| POST | `/api/admin/trips/:id/review-link` | Generar un enlace de reseña. |
| POST | `/api/public/reviews/:token` | Registrar una reseña. |
| POST | `/api/admin/trips/:id/empty-leg` | Publicar un retorno vacío. |
| GET | `/api/admin/empty-legs` | Consultar retornos disponibles. |

Las rutas definitivas se acordarán con el equipo de frontend y se ajustarán durante la implementación.

### Endpoints implementados

El primer flujo implementado incluye:

- `POST /api/owners/register`: recibe `fullName`, `email` y `phone`; todos son obligatorios y el email no puede repetirse.
- `POST /api/boats`: recibe `ownerId`, `registrationNumber`, `name`, `passengerCapacity` y `coverageZone`.
- La capacidad declarada debe ser un entero entre 1 y 200.
- Una matrícula se normaliza a mayúsculas y no puede registrarse más de una vez, incluso si cambia el uso de mayúsculas o minúsculas.
- Un lanchero puede registrar varias embarcaciones; cada embarcación queda pendiente de verificación.

La aplicación habilita `ValidationPipe` global con whitelist y rechazo de propiedades desconocidas. En el entorno local, PostgreSQL se publica en el puerto `5432`, que coincide con el puerto interno del contenedor.

## Recuperación de contraseña

El registro requiere una contraseña de al menos 12 caracteres y la almacena derivada con `scrypt`; el hash no se devuelve en la respuesta. `POST /api/owners/password/forgot` recibe `{ "email": "..." }` y responde igual tanto si la cuenta existe como si no. Para una cuenta existente se genera un token aleatorio de un solo uso, se guarda únicamente su hash y se envía un enlace válido durante 30 minutos. `POST /api/owners/password/reset` recibe `{ "token": "...", "password": "..." }`, actualiza la contraseña y consume el token dentro de una transacción.

Configurar `RESEND_API_KEY`, `MAIL_FROM` y `FRONTEND_URL` en el entorno. El frontend debe implementar `/reset-password`, leer el parámetro `token` y enviar la nueva contraseña al endpoint de reset. La migración `migrations/001_add_owner_credentials_and_password_reset.sql` se debe aplicar antes de desplegar esta versión. El registro actual sigue siendo público; antes de producción debe limitarse o protegerse contra altas no autorizadas.

## Reglas operativas recomendadas

El diagrama define entidades y relaciones, pero no todas las reglas operativas. Para el MVP recomiendo:

- El lanchero puede marcar su embarcación inactiva; solo el administrador puede reactivarla o cambiar la verificación. Una embarcación inactiva conserva sus viajes ya asignados: no se cancelan en silencio, y el administrador los revisa/reasigna.
- Una modificación de matrícula, capacidad, seguro o cobertura queda como solicitud pendiente. El administrador la acepta o rechaza antes de aplicarla; si afecta seguridad o elegibilidad, la embarcación vuelve a pendiente de revisión.
- La búsqueda excluye embarcaciones inactivas, no aprobadas o con viaje que se solape con el horario solicitado. La asignación de un viaje a una embarcación inactiva/no aprobada o que incumpla el intervalo mínimo entre viajes se bloquea en backend.
- Un retorno solo figura como vacío/disponible mientras no tenga pasajeros ni carga y no esté asignado. Si se ocupa, el administrador lo marca como no disponible y deja de aparecer en el dashboard público. Las ediciones permitidas mientras siga disponible son origen, destino y horario; los cambios se reflejan inmediatamente.
- Al completar un viaje se genera un enlace de reseña único y vencible. El administrador lo comparte manualmente con el turista. Al abrir WhatsApp se prepara un mensaje con origen, destino, fecha/hora, capacidad disponible y contacto; una persona confirma el envío. El teléfono no se publica en listados abiertos.
- Las solicitudes de modificación deben aparecer en una cola administrativa con aviso en el dashboard; al resolverlas, el lanchero recibe el resultado en su panel y por correo.

Estas reglas son decisiones recomendadas para validar con producto. Las entidades `TRIP`, `EMPTY_LEG`, `BOAT_DOCUMENT` y `REVIEW`, sus endpoints, notificaciones y estas validaciones aún no están implementadas en el backend actual.

## 8. Plan de trabajo — 5 semanas

### Semana 1: Fundamentos

- Configuración del proyecto y del entorno local.
- Diseño inicial del modelo de datos.
- Configuración de PostgreSQL y TypeORM.
- Migraciones iniciales.
- Validaciones globales y documentación Swagger.
- Diseño del contrato inicial de API.

**Entregable:** backend inicial operativo, base de datos conectada y contratos técnicos definidos.

### Semana 2: Registro y verificación

- Implementación del registro de lancheros.
- Gestión de embarcaciones.
- Carga y almacenamiento de documentos.
- Panel administrativo mediante endpoints de revisión.
- Aprobación, rechazo y control de permisos.

**Entregable:** flujo de registro y verificación funcional.

### Semana 3: Búsqueda y viajes

- Filtros de búsqueda de embarcaciones.
- Validación de capacidad, cobertura y disponibilidad.
- Registro y asignación manual de viajes.
- Gestión de estados y finalización de servicios.

**Entregable:** flujo de búsqueda, selección y gestión de viajes funcional.

### Semana 4: Reputación y retornos

- Generación y validación de tokens de reseña.
- Registro de calificaciones y comentarios.
- Cálculo de reputación.
- Publicación de información para la landing.
- Registro y consulta de retornos vacíos.
- Implementación del mecanismo de notificación previsto.

**Entregable:** circuitos de reseñas y retornos vacíos integrados.

### Semana 5: Integración y entrega

- Integración con frontend.
- Pruebas unitarias y de integración.
- Pruebas de permisos y reglas de negocio.
- Corrección de errores prioritarios.
- Revisión de seguridad.
- Documentación final y preparación del despliegue.

**Entregable:** MVP integrado, probado y listo para demostración.

## 9. Estrategia de pruebas

Se priorizarán pruebas para los flujos críticos:

- Registro y autenticación.
- Permisos administrativos.
- Aprobación y rechazo de embarcaciones.
- Filtros de búsqueda.
- Capacidad y compatibilidad horaria.
- Asignación y finalización de viajes.
- Uso único y vencimiento de tokens de reseña.
- Prevención de reseñas duplicadas.
- Registro y consulta de retornos vacíos.

Las pruebas deberán acompañar la implementación de cada módulo, sin concentrarse exclusivamente en la última semana.

## 10. Alcance excluido del MVP

Para cumplir el plazo establecido, quedan fuera de la primera versión:

- Verificación automática mediante organismos gubernamentales.
- Reservas autónomas por parte del turista.
- Matching automático basado en GPS.
- Subastas de retornos vacíos.
- Notificaciones push geolocalizadas.
- Chat interno en tiempo real.
- Integraciones complejas con WhatsApp.

## 11. Criterios de finalización

El backend se considerará listo para la entrega cuando:

- La API esté desplegada y conectada a la base de datos.
- Los flujos principales estén implementados y probados.
- Los permisos y las validaciones estén funcionando.
- El frontend pueda consumir los endpoints documentados.
- Las reseñas estén protegidas mediante tokens y asociadas a viajes completados.
- Los retornos vacíos puedan registrarse y consultarse desde el panel.
- La documentación técnica y las variables de entorno estén preparadas.

## 12. Próximos pasos

1. Validar el alcance con el equipo y el responsable del producto.
2. Acordar el modelo de datos y los contratos de API con frontend.
3. Configurar el repositorio, PostgreSQL y TypeORM.
4. Crear las migraciones iniciales.
5. Implementar el primer flujo funcional y entregar avances incrementales.

---

**Responsable:** Backend Development  
**Tecnologías principales:** NestJS, TypeScript, PostgreSQL y TypeORM  
**Plazo estimado:** 5 semanas  
**Estado del documento:** Propuesta técnica inicial, pendiente de validación con el equipo.
