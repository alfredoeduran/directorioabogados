# Hispaleman - Directorio de Abogados

Aplicación web para la búsqueda y visualización de abogados en España, con especial enfoque en la comunidad hispanohablante.

## 🚀 Características

- **Búsqueda avanzada**: Encuentra abogados por especialidad, ubicación y nombre
- **Interfaz responsive**: Diseño adaptable a dispositivos móviles y desktop
- **Datos completos**: Información detallada de cada abogado incluyendo contacto y especialidades
- **Rendimiento optimizado**: Caché integrado para búsquedas rápidas
- **API RESTful**: Endpoints para búsqueda y detalles de abogados

## 📋 Requisitos

- Node.js 16+ 
- npm o yarn

## 🔧 Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/hispaleman-express.git
cd hispaleman-express
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
Crea un archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

4. **Iniciar la aplicación**
```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

## 🌐 Variables de Entorno

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=*
DB_PATH=./database.sqlite
SCRAPING_ENABLED=false
```

## 📡 API Endpoints

### Búsqueda de abogados
```http
GET /api/search?q=palabra&specialty=especialidad&location=ubicacion
```

### Detalles de abogado
```http
GET /api/abogado/:id
```

## 🏗️ Estructura del Proyecto

```
hispaleman-express/
├── public/                 # Archivos estáticos (frontend)
│   ├── abogados-actualizado.html
│   ├── styles-actualizado.css
│   ├── script-actualizado.js
│   └── abogados-completos.json
├── src/
│   ├── api/               # Rutas de la API
│   ├── config/            # Configuración
│   ├── middleware/        # Middleware
│   └── services/          # Servicios
├── logs/                  # Archivos de log
├── server.js              # Servidor principal
└── package.json
```

## 🚀 Despliegue en Vercel

1. **Conectar repositorio en GitHub**
2. **Configurar en Vercel**:
   - Framework: Node.js
   - Build Command: `npm install`
   - Output Directory: `./`
   - Install Command: `npm install`

3. **Variables de entorno en Vercel**:
   ```
   NODE_ENV=production
   ALLOWED_ORIGINS=*
   SCRAPING_ENABLED=false
   ```

## 📝 Scripts Disponibles

```bash
npm start          # Iniciar servidor producción
npm run dev        # Iniciar servidor desarrollo
npm test           # Ejecutar tests
npm run build      # Construir proyecto
npm run lint       # Ejecutar linter
```

## 📊 Datos de Abogados

La aplicación incluye datos de 186 abogados con información de:
- Nombre y especialidad
- Ubicación y contacto
- Información adicional

## 🔒 Seguridad

- Validación de entrada de datos
- CORS configurado
- Manejo de errores centralizado
- Logs de seguridad

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 👥 Autor

- **Tu Nombre** - Trabajo inicial - [TuUsuario](https://github.com/TuUsuario)

## 🙏 Agradecimientos

- Comunidad hispanohablante
- Contribuyentes del proyecto
- Tecnologías open source utilizadas