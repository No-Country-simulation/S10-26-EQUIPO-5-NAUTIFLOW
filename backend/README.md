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
# Editar .env y reemplazar JWT_SECRET por un valor aleatorio privado.
docker compose up -d --build
```

El comando anterior inicia:

| Servicio | URL                     |
| -------- | ----------------------- |
| Backend  | <http://localhost:3001> |
| Adminer  | <http://localhost:8080> |

En Adminer, ingresar con estos datos:

- **Sistema:** PostgreSQL
- **Servidor:** `postgres`
- **Usuario:** `delta_user`
- **Contraseña:** `delta_password`
- **Base de datos:** `delta_db`

Las migraciones iniciales se montan en PostgreSQL y se ejecutan automáticamente
cuando se crea el volumen por primera vez. Como PostgreSQL no repite esos scripts
en volúmenes existentes, el servicio `migrate-documents` aplica de forma segura la
migración `005_add_boat_documents.sql` y `006_add_documented_passenger_capacity.sql`
antes de iniciar el backend. Ambas son idempotentes y no requieren borrar el
volumen ni los datos existentes.

Para detener los contenedores:

```powershell
docker compose down
```

### Ejecución sin Docker

Con PostgreSQL instalado y ejecutándose localmente, crear la base y aplicar las
migraciones en orden:

```powershell
cd C:\Users\Fede\Desktop\No-Country\backend
Copy-Item .env.example .env
psql -U postgres -c "CREATE USER delta_user WITH PASSWORD 'delta_password';"
psql -U postgres -c "CREATE DATABASE delta_db OWNER delta_user;"
Get-ChildItem .\migrations\*.sql | Sort-Object Name | ForEach-Object {
  Get-Content -Raw $_.FullName | psql -v ON_ERROR_STOP=1 -U delta_user -d delta_db
}
pnpm install
pnpm start:dev
```

En `.env`, usar `FRONTEND_URL=http://localhost:4200` y completar las variables
de Cloudinary para habilitar la carga de documentación.

En otra terminal, iniciar Angular:

```powershell
cd C:\Users\Fede\Desktop\No-Country\frontend\front-noCountry
npm install
npm start
```

El frontend quedará en `http://localhost:4200` y el backend en
`http://localhost:3001`.

La API se puede verificar con `GET http://localhost:3001`.

Para registrar un lanchero desde Postman:

```text
POST http://localhost:3001/api/owners/register
Content-Type: application/json
```

```json
{
  "fullName": "Juan Perez",
  "email": "juan.perez@gmail.com",
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
  "email": "juan.perez@gmail.com",
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
  "email": "juan.perez@gmail.com"
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
WHERE email = 'juan.perez@gmail.com';
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

#### Desactivar una embarcación

La aprobación debe realizarse desde el endpoint autenticado para que se
comprueben la licencia y la capacidad declarada. No aprobar directamente desde
Adminer, porque eso omite las reglas de verificación.

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

| Entidad        | Responsabilidad                                    |
| -------------- | -------------------------------------------------- |
| `User`         | Usuarios, credenciales y roles.                    |
| `BoatOwner`    | Información del lanchero y sus datos de contacto.  |
| `Boat`         | Embarcaciones, capacidad, zonas y estados.         |
| `BoatDocument` | Documentación, archivos y revisión administrativa. |
| `Trip`         | Solicitudes, asignaciones y ejecución de viajes.   |
| `Review`       | Calificaciones y comentarios asociados a viajes.   |
| `EmptyLeg`     | Registro de tramos de retorno vacíos.              |

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

| Método | Endpoint propuesto                  | Función                             |
| ------ | ----------------------------------- | ----------------------------------- |
| POST   | `/api/auth/login`                   | Iniciar sesión.                     |
| POST   | `/api/owners/register`              | Registrar un lanchero.              |
| POST   | `/api/boats`                        | Registrar una embarcación.          |
| POST   | `/api/boats/:id/documents`          | Cargar documentación.               |
| GET    | `/api/admin/boats/pending`          | Consultar embarcaciones pendientes. |
| PATCH  | `/api/admin/boats/:id/verification` | Aprobar o rechazar.                 |
| GET    | `/api/admin/boats/search`           | Buscar embarcaciones.               |
| POST   | `/api/admin/trips`                  | Registrar y asignar un viaje.       |
| PATCH  | `/api/admin/trips/:id/complete`     | Completar un viaje.                 |
| POST   | `/api/admin/trips/:id/review-link`  | Generar un enlace de reseña.        |
| POST   | `/api/public/reviews/:token`        | Registrar una reseña.               |
| POST   | `/api/admin/trips/:id/empty-leg`    | Publicar un retorno vacío.          |
| GET    | `/api/admin/empty-legs`             | Consultar retornos disponibles.     |

Las rutas definitivas se acordarán con el equipo de frontend y se ajustarán durante la implementación.

### Endpoints implementados

El primer flujo implementado incluye:

- `POST /api/owners/register`: recibe `fullName`, `email` y `phone`; todos son obligatorios y el email no puede repetirse.
- `POST /api/boats`: recibe `ownerId`, `registrationNumber`, `name`, `passengerCapacity` y `coverageZone`.
- La capacidad declarada debe ser un entero entre 1 y 200.
- Una matrícula se normaliza a mayúsculas y no puede registrarse más de una vez, incluso si cambia el uso de mayúsculas o minúsculas.
- Un lanchero puede registrar varias embarcaciones; cada embarcación queda pendiente de verificación.

La aplicación habilita `ValidationPipe` global con whitelist y rechazo de propiedades desconocidas. En el entorno local, PostgreSQL se publica en el puerto `5432`, que coincide con el puerto interno del contenedor.

## Panel administrativo: lancheros y embarcaciones

El alta de la cuenta del lanchero sigue siendo su propio registro en
`POST /api/owners/register`. El administrador puede consultar las cuentas ya
registradas, dar de alta embarcaciones vinculadas a esos lancheros y revisar la
verificación de cada embarcación. Las nuevas embarcaciones quedan pendientes
hasta que un administrador las apruebe.

### Crear tres administradores

1. Configurar `JWT_SECRET` en `.env` con al menos 32 bytes aleatorios. Por
   ejemplo, en PowerShell:

   ```powershell
   $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $bytes = New-Object byte[] 32
   $rng.GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   $rng.Dispose()
   ```

   Copiar el resultado a `JWT_SECRET` sin publicarlo ni reutilizarlo en otros
   entornos. El backend firma tokens HS256 con emisor `nautiflow-api`; acepta
   solo esa firma y valida la expiración. El access token dura una hora.

2. Crear `admin-seed.json` en la carpeta `backend`. El archivo está excluido
   de Git. Completarlo con tres personas, correos distintos y contraseñas
   únicas de al menos 12 caracteres:

```json
[
  {
    "name": "Admin Uno",
    "email": "admin1@tu-dominio.com",
    "phone": "1111111111",
    "password": "REEMPLAZAR_POR_UNA_CLAVE_UNICA"
  },
  {
    "name": "Admin Dos",
    "email": "admin2@tu-dominio.com",
    "phone": "2222222222",
    "password": "REEMPLAZAR_POR_OTRA_CLAVE_UNICA"
  },
  {
    "name": "Admin Tres",
    "email": "admin3@tu-dominio.com",
    "phone": "3333333333",
    "password": "REEMPLAZAR_POR_OTRA_CLAVE_UNICA"
  }
]
```

3. Con la base de datos levantada, desde PowerShell ejecutar:

```powershell
cd C:\Users\Fede\Desktop\No-Country\backend
$env:ALLOW_ADMIN_SEED = "true"
pnpm seed:admins
Remove-Item Env:\ALLOW_ADMIN_SEED
```

El script crea las tres cuentas dentro de una transacción, genera hashes
compatibles con el login actual y no imprime las contraseñas. Si una dirección
ya está registrada, revierte toda la operación. Requiere confirmación explícita
y se niega a ejecutarse cuando `NODE_ENV=production`. Después de ejecutarlo,
elimina el archivo local si ya no lo necesitas; nunca lo subas al repositorio.

### Iniciar sesión

En el frontend, abre **Iniciar sesión**, selecciona **Administrador** e ingresa
uno de los tres correos y su contraseña. El acceso entrega un JWT de una hora;
la API protege las operaciones administrativas y las cuentas `owner` no pueden
usar estos endpoints.

También se puede probar con Postman:

```json
{
  "email": "admin1@tu-dominio.com",
  "password": "LA_CLAVE_CONFIGURADA_EN_EL_ARCHIVO_LOCAL"
}
```

Enviar el `accessToken` de la respuesta en `Authorization: Bearer <token>` al
usar directamente los endpoints administrativos.

### Operaciones disponibles

| Método | Endpoint                            | Uso                                                             |
| ------ | ----------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/admin/owners`                 | Listar lancheros registrados, sin incluir hashes de contraseña. |
| POST   | `/api/admin/boats`                  | Dar de alta una embarcación asociada a un `ownerId` existente.  |
| GET    | `/api/admin/boats/pending`          | Listar embarcaciones pendientes junto con su propietario.       |
| PATCH  | `/api/admin/boats/:id/verification` | Aprobar o rechazar y guardar quién tomó la decisión y cuándo.   |

Para dar de alta una embarcación, enviar el mismo cuerpo que a
`POST /api/boats`, junto con el token administrativo:

```json
{
  "ownerId": "UUID-DE-UN-LANCHERO-REGISTRADO",
  "registrationNumber": "NAU-003",
  "name": "La Delfina",
  "passengerCapacity": 8,
  "coverageZone": "Delta de Tigre"
}
```

Aprobar:

```json
{
  "status": "approved",
  "documentedPassengerCapacity": 8
}
```

Antes de aprobar, el administrador debe abrir y revisar la licencia presentada
e ingresar la capacidad que figura en ella. La API exige que exista una licencia
y toma la capacidad indicada en ella como valor definitivo, actualizando tanto
la capacidad total como las plazas disponibles de la embarcación. Solo se puede
decidir una vez sobre cada embarcación pendiente.

Rechazar requiere un motivo:

```json
{
  "status": "rejected",
  "reason": "La documentación presentada está vencida."
}
```

La migración `002_add_boat_verification_audit.sql` agrega el administrador
responsable, el motivo y la fecha de revisión. Si la base ya existía, aplicarla
una sola vez antes de usar los nuevos endpoints.

## Recuperación de contraseña

1. En Resend, revocar cualquier clave que se haya compartido en un chat y
   generar una nueva. Verificar el dominio remitente en Resend antes de usarlo.
2. Guardar la nueva clave solo en `backend/.env` como `RESEND_API_KEY`; completar
   `MAIL_FROM` con un remitente verificado y `FRONTEND_URL` con la URL del
   frontend (`http://localhost:4200` en desarrollo local o `http://localhost:4000`
   con Docker). No incluir la clave en Angular, en Git ni en capturas.
3. El usuario abre el modal **Iniciar sesión > ¿Olvidaste tu contraseña?** e
   ingresa su correo. El endpoint `POST /api/owners/password/forgot` devuelve
   un texto genérico, exista o no la cuenta. Para una cuenta existente, genera
   un token impredecible, guarda solo su hash y envía el enlace con Resend.
4. El enlace vence a los 30 minutos. Un segundo pedido invalida el anterior.
   `POST /api/owners/password/reset` valida el vencimiento y consume el token
   en la misma transacción que cambia la contraseña; no puede usarse de nuevo.
5. Si el enlace venció o ya se usó, el formulario lo rechaza y ofrece solicitar
   otro. La contraseña nueva debe tener entre 12 y 128 caracteres.

El registro requiere correo y acepta únicamente `@gmail.com`, `@hotmail.com`
o `@outlook.com`;
el servidor repite la validación para que no pueda eludirse desde otro cliente.
El hash de la contraseña se deriva con `scrypt` y nunca se devuelve en la
respuesta. Las migraciones iniciales incluyen la tabla de tokens de recuperación.

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
