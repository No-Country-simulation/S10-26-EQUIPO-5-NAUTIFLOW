# S10-26-EQUIPO-5-NAUTIFLOW

## Ejecutar la aplicación con Docker Compose

Desde la raíz del repositorio:

```bash
docker compose up -d --build
```

La aplicación quedará disponible en:

- Frontend: http://localhost:4000
- Backend: http://localhost:3001
- PostgreSQL: localhost:5432

Al iniciar, Docker Compose espera a PostgreSQL y aplica las migraciones de
documentos, capacidad declarada, operaciones administrativas y viajes incluso
si la base ya existía. No hace falta
borrar el volumen de PostgreSQL para corregir el error
`relation "boat_documents" does not exist`.

Para detener los servicios:

```bash
docker compose down
```

### Probar y usar el panel de administración

Cada integrante puede probar el sistema en su propia computadora siguiendo los
pasos de [creación de administradores y acceso al panel](./backend/README.md#crear-tres-administradores).
La guía incluye comandos para Windows, macOS y Linux.

En una prueba local, cada integrante tiene su propia base de datos y debe crear sus cuentas admin localmente; no se comparten automáticamente usuarios ni datos
entre computadoras. Para que todos trabajen con los mismos datos, el equipo
necesita un backend y una base de datos compartidos, y las cuentas deben crearse
en ese entorno de pruebas.

Después de iniciar sesión en la web como **Administrador**, podrán revisar
lancheros y embarcaciones pendientes, inspeccionar documentos, aprobar o
rechazar embarcaciones, consultar usuarios, registrar disponibilidad y buscar
la flota, publicar retornos vacíos y gestionar viajes. Al completar un viaje,
el sistema genera un enlace de reseña para compartir.

No uses `docker compose down -v` para detener el entorno: también elimina la
base de datos local y las cuentas de prueba.

Para eliminar también los datos persistidos de PostgreSQL:

```bash
docker compose down -v
```

## Variables de entorno

El backend lee las variables de entorno desde `backend/.env` mediante `docker-compose.yml`.

Ejemplo:

```env
# PostgreSQL
DB_PASSWORD=delta_password

# JWT
JWT_SECRET=local-development-secret-change-before-use

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_FOLDER=nautiflow/boats

# Recuperación de contraseña (requerido para enviar enlaces)
RESEND_API_KEY=tu_clave_nueva_de_resend
MAIL_FROM=tu_dominio_verificado@ejemplo.com
FRONTEND_URL=http://localhost:4000
```

Nota: la configuración de Cloudinary debe ser compatible con la cuenta que genera el `API Key` y el `API Secret`.
Para ejecutar Angular fuera de Docker, configura `FRONTEND_URL=http://localhost:4200`.
Configura `RESEND_API_KEY` solo en `backend/.env`, verifica el dominio remitente
en Resend y define `MAIL_FROM` con una dirección de ese dominio. La clave que se
compartió en el chat debe revocarse y reemplazarse; no la copies al frontend ni
la publiques en Git. Las cuentas anteriores a la incorporación de contraseñas
deben restablecerla por correo. No elimines el volumen de PostgreSQL.

## Estado actual de la API

Se implementó soporte para subir archivos asociados a embarcaciones, tanto imagenes como PDFs.

### Operaciones administrativas MVP

El panel de administración permite registrar franjas de disponibilidad manuales
para lanchas activas y aprobadas, buscar por plazas libres, zona y horario, y
contactar al lanchero por WhatsApp. También permite publicar retornos vacíos,
guardarlos para el dashboard y copiar un mensaje para compartir con la flota.
Las calificaciones existentes siguen actualizando el promedio visible en el
catálogo y generan una notificación interna en la cuenta del lanchero.

El catálogo público (`GET /api/boats`) entrega para cada embarcación verificada
un enlace `owner.whatsappUrl` de WhatsApp con una consulta de disponibilidad
prellenada. El número se toma del teléfono registrado por el lanchero y no se
devuelve como dato independiente; el enlace aparece solo cuando el teléfono tiene
un formato utilizable. Es un enlace Click to Chat y no requiere credenciales de
WhatsApp Business.

Endpoints administrativos (requieren JWT de admin):

- `GET /api/admin/boats/active`: lanchas activas y aprobadas con contacto.
- `POST /api/admin/availability`: registra `boatId`, `startsAt` y `endsAt`.
- `GET /api/admin/fleet/search?minPassengers=5&availableAt=2026-11-02T14:00:00-03:00&zone=Primera%20Seccion`: busca lanchas disponibles en ese horario.
- `GET /api/admin/empty-legs`: lista los retornos publicados.
- `POST /api/admin/empty-legs`: registra `boatId`, `origin`, `destination` y `returnsAt`.

El servicio Docker aplica la migración `009_add_admin_operations.sql` también
en bases existentes; no es necesario borrar el volumen de PostgreSQL.

Tipos permitidos en la subida:

- `image/jpeg`
- `image/png`
- `image/webp`
- `application/pdf`

Tamaño máximo: 5 MB

Endpoint disponible:

```http
POST /api/boats/:id/image
```

En Postman usar:

- Método: `POST`
- URL: `http://localhost:3001/api/boats/{boatId}/image`
- Body: `form-data`
- Key: `image`
- Type: `File`
- Value: archivo.jpg / archivo.png / archivo.pdf

Ejemplo de `multipart/form-data`:

```text
image: [archivo.jpg]
```

## Endpoints y bodies para Postman

### 1) Registro de owner

```http
POST /api/owners/register
```

Body JSON:

```json
{
  "fullName": "Juan Perez",
  "email": "juan@gmail.com",
  "password": "PasswordSegura123",
  "phone": "+5491123456789"
}
```

El registro solo acepta direcciones `@gmail.com`, `@hotmail.com` y `@outlook.com`.

---

### 2) Login admin

```http
POST /api/auth/login
```

Body JSON:

```json
{
  "email": "admin1@tu-dominio.com",
  "password": "PasswordSegura123"
}
```

Importante: el login de auth está pensado para usuarios con rol `admin`.

---

### 3) Crear embarcación

```http
POST /api/boats
```

Body JSON:

```json
{
  "ownerId": "f3d3d4d8-5b4d-4a28-80d8-9d7be5d2d4f8",
  "registrationNumber": "ABC123",
  "name": "Luna Azul",
  "passengerCapacity": 10,
  "coverageZone": "Mar del Plata"
}
```

---

### 4) Buscar embarcaciones aprobadas

```http
GET /api/boats?minCapacity=6&zone=Delta&availability=available
```

La búsqueda es pública y solo devuelve embarcaciones activas y aprobadas.
Todos los filtros son opcionales:

- `minCapacity`: capacidad total mínima (de 1 a 200 pasajeros).
- `zone`: coincidencia parcial, sin distinguir mayúsculas.
- `availability`: `available` para embarcaciones con plazas libres o
  `unavailable` para las que no tienen plazas.

Sin filtros, el catálogo devuelve todas las embarcaciones activas y aprobadas.

---

### 5) Subir imagen o PDF a una embarcación

```http
POST /api/boats/:id/image
```

Body en Postman: `form-data`

```text
image: [archivo.jpg]
```

Ejemplo con PDF:

```text
image: [documento.pdf]
```

---

### 6) Solicitar recuperación de contraseña

```http
POST /api/owners/password/forgot
```

Body JSON:

```json
{
  "email": "juan@gmail.com"
}
```

---

### 7) Resetear contraseña

```http
POST /api/owners/password/reset
```

Body JSON:

```json
{
  "token": "token_recibido_por_email",
  "password": "NuevaPasswordSegura456"
}
```

---

### 8) Listar owners (solo admin)

```http
GET /api/admin/owners
```

Lista únicamente las cuentas de lancheros. Requiere JWT válido de un usuario
con rol `admin`.

### Usuarios registrados por tipo (solo admin)

```http
GET /api/admin/users
Authorization: Bearer <accessToken>
```

No requiere body. Devuelve las cuentas de administradores y lancheros, con `id`, `fullName`,
`email`, `phone`, `role` y `createdAt`. Nunca
incluye credenciales ni hashes de contraseña.

---

### 9) Crear embarcación como admin

```http
POST /api/admin/boats
```

Body JSON:

```json
{
  "ownerId": "f3d3d4d8-5b4d-4a28-80d8-9d7be5d2d4f8",
  "registrationNumber": "ABC123",
  "name": "Luna Azul",
  "passengerCapacity": 10,
  "coverageZone": "Mar del Plata"
}
```

---

### 10) Listar embarcaciones pendientes

```http
GET /api/admin/boats/pending
```

---

### 11) Verificar embarcación

```http
PATCH /api/admin/boats/:id/verification
```

Body JSON:

```json
{
  "status": "approved",
  "documentedPassengerCapacity": 10
}
```

Cuando la validación es rechazada:

```json
{
  "status": "rejected",
  "reason": "Faltan documentos o la información no coincide."
}
```

Valores válidos para `status`:

- `approved`
- `rejected`

### Otros endpoints disponibles

Los endpoints de lectura no reciben body. Salvo registro y login, las rutas
marcadas como autenticadas requieren `Authorization: Bearer <token>`.

#### Salud de la API

```http
GET /
```

#### Autenticación de administrador y lanchero

```http
POST /api/auth/login
POST /api/auth/owner-login
```

Ambos reciben el mismo body:

```json
{
  "email": "usuario@ejemplo.com",
  "password": "PasswordSegura123"
}
```

Usar `login` para administradores y `owner-login` para lancheros.

#### Consultar mis embarcaciones (lanchero autenticado)

```http
GET /api/boats/mine
```

#### Cargar documentos de una embarcación

```http
POST /api/boats/:id/documents
```

Body `form-data` (archivo, máximo 5 MB por campo):

```text
license: [licencia.pdf]
insurance: [seguro.pdf]
criminalRecord: [antecedentes.pdf]
```

Los campos son opcionales individualmente; se aceptan PDF, JPG y PNG.

#### Consultar viajes y enviar una reseña (público)

Los turistas no crean cuentas, no inician sesión y no reservan dentro de la
plataforma. Pueden consultar los viajes y contactar directamente al lanchero:

```http
GET /api/trips
```

Al completar el viaje, el sistema emite un enlace de reseña de un solo uso,
válido durante 30 días. Abrirlo para consultar el viaje y enviar la calificación:

```http
GET /api/reviews/:token
POST /api/reviews/:token
```

El envío recibe `rating` (entero de 1 a 5) y un `comment` opcional.

#### Consultar notificaciones del lanchero autenticado

```http
GET /api/owners/notifications
```

#### Operaciones administrativas

Las siguientes rutas requieren un token Bearer de administrador:

```http
GET /api/admin/owners
GET /api/admin/users
GET /api/admin/boats/pending
GET /api/admin/boats/active
GET /api/admin/empty-legs
```

Registrar una franja horaria:

```http
POST /api/admin/availability
```

```json
{
  "boatId": "UUID-DE-LA-EMBARCACION",
  "startsAt": "2026-11-20T13:00:00-03:00",
  "endsAt": "2026-11-20T16:00:00-03:00"
}
```

Buscar la flota disponible (sin body; filtros por query string):

```http
GET /api/admin/fleet/search?minPassengers=5&availableAt=2026-11-20T14%3A00%3A00-03%3A00&zone=Delta
```

Publicar un retorno vacío:

```http
POST /api/admin/empty-legs
```

```json
{
  "boatId": "UUID-DE-LA-EMBARCACION",
  "origin": "Primera Sección",
  "destination": "Tigre",
  "returnsAt": "2026-11-20T15:00:00-03:00"
}
```

Programar un viaje (solo admin):

```http
POST /api/admin/trips
```

```json
{
  "boatId": "UUID-DE-LA-EMBARCACION-APROBADA",
  "origin": "Tigre",
  "destination": "Primera Sección",
  "startsAt": "2026-11-20T14:00:00-03:00",
  "endsAt": "2026-11-20T15:30:00-03:00"
}
```

La lancha debe estar activa y aprobada; `startsAt` debe ser futuro y `endsAt`
posterior. El viaje aparece en el catálogo público y los turistas coordinan
directamente con el lanchero.

Listar viajes desde el panel y completar uno cuando haya terminado:

```http
GET /api/admin/trips
POST /api/admin/trips/:id/complete
```

Completar un viaje también genera el enlace de reseña. Publicar un retorno
vacío con `POST /api/admin/empty-legs` genera su viaje público asociado.

Verificar una embarcación pendiente:

```http
PATCH /api/admin/boats/:id/verification
```

El body de aprobación o rechazo se muestra en el endpoint 11.

## Crear tres admins

Para crear tres administradores, con PostgreSQL levantado:

1. Crea `backend/admin-seed.json` con tres objetos que incluyan `name`, `email`,
   `phone` y una contraseña única de 12 a 128 caracteres. Ese archivo está
   excluido de Git; no lo compartas ni lo subas al repositorio.
2. Desde PowerShell ejecuta:

```powershell
cd C:\Users\Fede\Desktop\No-Country\backend
pnpm seed:admins
```

El script crea las cuentas de forma atómica y guarda contraseñas con el mismo
hash que utiliza el login. En la web, abre **Iniciar sesión**, selecciona
**Administrador** e ingresa uno de los correos y su contraseña.

## Observaciones importantes

- La subida de archivos no requiere JWT para el endpoint de la embarcación.
- Cloudinary se usa con `resource_type` diferencial:
  - imagenes: `image`
  - PDF: `raw`
- Los nombres de las claves importan en Postman: el archivo debe enviarse como `image`.
- No se debe enviar el archivo como JSON; debe usarse `form-data`.
- El backend acepta imagenes `jpeg`, `png`, `webp` y PDFs.
- El tamaño máximo es 5 MB por archivo.

## Resumen rápido para probar en Postman

### Registro owner

```json
{
  "fullName": "Juan Perez",
  "email": "juan@gmail.com",
  "password": "PasswordSegura123",
  "phone": "+5491123456789"
}
```

### Login admin

```json
{
  "email": "admin1@tu-dominio.com",
  "password": "LA_CLAVE_CONFIGURADA_EN_EL_ARCHIVO_LOCAL"
}
```

### Crear lancha

```json
{
  "ownerId": "f3d3d4d8-5b4d-4a28-80d8-9d7be5d2d4f8",
  "registrationNumber": "ABC123",
  "name": "Luna Azul",
  "passengerCapacity": 10,
  "coverageZone": "Mar del Plata"
}
```

### Subir archivo

```text
Key: image
Type: File
Value: archivo.jpg o archivo.pdf
```

## Troubleshooting

Si al subir el archivo aparece un `500`, revisar en los logs del backend que Cloudinary no esté rechazando la request por credenciales, cloud name, API secret, cuenta o formato de archivo.

El backend debe registrar el error original para diagnosticar el problema; la respuesta HTTP no debe exponer secretos.
