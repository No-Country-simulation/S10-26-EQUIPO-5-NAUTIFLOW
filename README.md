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

Para detener los servicios:

```bash
docker compose down
```

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
```

Nota: la configuración de Cloudinary debe ser compatible con la cuenta que genera el `API Key` y el `API Secret`.

## Estado actual de la API

Se implementó soporte para subir archivos asociados a embarcaciones, tanto imagenes como PDFs.

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
  "email": "juan@correo.com",
  "password": "PasswordSegura123",
  "phone": "+5491123456789"
}
```

---

### 2) Login admin

```http
POST /api/auth/login
```

Body JSON:

```json
{
  "email": "admin@nautiflow.com",
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

### 4) Subir imagen o PDF a una embarcación

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

### 5) Solicitar recuperación de contraseña

```http
POST /api/owners/password/forgot
```

Body JSON:

```json
{
  "email": "juan@correo.com"
}
```

---

### 6) Resetear contraseña

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

### 7) Listar owners (solo admin)

```http
GET /api/admin/owners
```

Requiere JWT válido de un usuario con rol `admin`.

---

### 8) Crear embarcación como admin

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

### 9) Listar embarcaciones pendientes

```http
GET /api/admin/boats/pending
```

---

### 10) Verificar embarcación

```http
PATCH /api/admin/boats/:id/verification
```

Body JSON:

```json
{
  "status": "approved",
  "reason": "Documentación correcta y embarcación validada."
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

## Crear el primer admin

Si no existe un usuario administrador, se puede hacer este flujo:

1. Registrar un owner con `POST /api/owners/register`
2. Cambiar su rol a `admin` desde la base de datos
3. Luego hacer login con `POST /api/auth/login`

Ejemplo SQL:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'admin@nautiflow.com';
```

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
  "email": "juan@correo.com",
  "password": "PasswordSegura123",
  "phone": "+5491123456789"
}
```

### Login admin

```json
{
  "email": "admin@nautiflow.com",
  "password": "PasswordSegura123"
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
