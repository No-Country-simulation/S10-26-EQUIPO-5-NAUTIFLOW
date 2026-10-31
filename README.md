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

Al iniciar, Docker Compose espera a PostgreSQL y aplica las migraciones de
documentos y capacidad declarada incluso si la base ya existía. No hace falta
borrar el volumen de PostgreSQL para corregir el error
`relation "boat_documents" does not exist`.

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

Requiere JWT válido de un usuario con rol `admin`.

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
