# NautiFlow - Sistema de Gestión de Flota y Viajes (MVP)

## Introducción
**NautiFlow** es una solución digital integral desarrollada durante la simulación de NoCountry para la gestión de transporte marítimo. La plataforma conecta de forma eficiente a administradores, lancheros y turistas, facilitando la verificación de documentación de embarcaciones, la asignación de viajes, la publicación de retornos vacíos con botones de contacto directo por WhatsApp y la recolección de reseñas de usuarios.

---

## Objetivos del Proyecto
* **Optimizar la operación marítima:** Gestionar el registro de lancheros, la carga y verificación de documentos (licencia, seguro y antecedentes), y la habilitación de embarcaciones activas de forma centralizada.
* **Reducir trayectos ineficientes:** Implementar una bolsa de tramos vacíos y un buscador de flota para maximizar la ocupación de las lanchas.
* **Facilitar la comunicación directa:** Integrar enlaces *Click to Chat* de WhatsApp precargados con los datos de la lancha seleccionada y el trayecto.
* **Garantizar la calidad del servicio:** Incorporar un sistema de calificaciones de 1 a 5 estrellas mediante enlaces de reseña de un solo uso vinculados a cada viaje completado.
* **Asegurar el control administrativo:** Proveer credenciales de administrador y endpoints seguros bajo autenticación JWT.

---

## Arquitectura y Tecnologías
El sistema se encuentra integrado en la rama principal de desarrollo (`develop`) bajo una arquitectura desacoplada:

* **Backend:** [NestJS](https://nestjs.com/) para el desarrollo de REST APIs, autenticación basada en JWT, gestión de roles y migraciones automatizadas de bases de datos.
* **Frontend:** [Angular](https://angular.io/) para la interfaz de usuario tipo SPA (catálogo público, buscador de flota, panel de control de administrador y gestión de tramos vacíos).
* **Base de Datos y Contenedores:** PostgreSQL ejecutándose mediante [Docker Compose](https://www.docker.com/), asegurando la persistencia y la aplicación automática de migraciones (incluyendo operaciones administrativas y control de documentos).
* **Gestión de Archivos:** [Cloudinary](https://cloudinary.com/) para el almacenamiento seguro de imágenes (JPG, PNG, WEBP) y documentos oficiales en PDF (con soporte de tipo `resource_type` diferencial para PDFs y archivos multimedia de hasta 5 MB).
* **Pruebas de API:** [Postman](https://www.postman.com/) para la validación exhaustiva de endpoints públicos y protegidos por token Bearer.
* **Gestión del Proyecto:** [Jira](https://www.atlassian.com/software/jira) para la metodología ágil (Scrum) y la trazabilidad de los Casos de Prueba (QA).

---

## Configuración y Ejecución del Entorno (Setup)

### Ejecución con Docker Compose
Para levantar el entorno completo de forma local desde la raíz del repositorio:
```bash
docker compose up -d --build
