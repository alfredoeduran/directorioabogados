# Despliegue en Vercel - Solución de Errores

## Error Resuelto: `functions` vs `builds`

El error que estabas experimentando se debía a una incompatibilidad en el archivo `vercel.json`. Vercel no permite usar ambas propiedades `functions` y `builds` simultáneamente.

### ✅ Solución Aplicada

1. **Actualizado `vercel.json`**: Se eliminó la sección `builds` y se mantuvo solo `functions` con la sintaxis correcta para Vercel v2.

2. **Script de build mejorado**: Se creó un script de verificación personalizado (`scripts/vercel-build.js`) que:
   - Verifica que todos los archivos necesarios existan
   - Comprueba que el servidor pueda iniciar correctamente
   - Valida la base de datos y los archivos frontend
   - Asegura que la configuración de Vercel esté correcta

### 📋 Archivos Actualizados

- ✅ `vercel.json` - Configuración corregida para Vercel v2
- ✅ `package.json` - Scripts de build actualizados
- ✅ `scripts/vercel-build.js` - Script de verificación
- ✅ `fs-extra` - Dependencia añadida

## 🚀 Pasos para Desplegar en Vercel

### Opción 1: Desde la Web de Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en "New Project"
3. Importa tu repositorio de GitHub
4. Configura las variables de entorno:
   ```
   NODE_ENV=production
   PORT=3000
   ALLOWED_ORIGINS=*
   SCRAPING_ENABLED=false
   ```
5. Haz clic en "Deploy"

### Opción 2: Desde la CLI de Vercel

```bash
# Instala la CLI de Vercel (si no la tienes)
npm i -g vercel

# En la raíz del proyecto
vercel

# Sigue los prompts:
# - Selecciona tu proyecto
# - Configura las variables de entorno cuando se te pida
```

### Variables de Entorno Recomendadas para Producción

```bash
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://tudominio.vercel.app
SCRAPING_ENABLED=false
CACHE_TTL=3600
LOG_LEVEL=warn
```

## 📊 Verificación del Despliegue

Después del despliegue, verifica que:

1. **La página principal carga**: `https://tudominio.vercel.app`
2. **La API funciona**: `https://tudominio.vercel.app/api/search?query=abogado`
3. **Los archivos estáticos se sirven correctamente**

## 🔧 Solución de Problemas Comunes

### Si el build falla:
1. Verifica que `vercel.json` tenga la configuración correcta
2. Asegúrate de que `package.json` tenga el script `vercel-build`
3. Ejecuta localmente: `npm run build:vercel`

### Si la base de datos no se encuentra:
1. Verifica que `database.sqlite` esté en la raíz del proyecto
2. Asegúrate de que `vercel.json` incluya el archivo en `includeFiles`

### Si las rutas API no funcionan:
1. Verifica la configuración de rutas en `vercel.json`
2. Asegúrate de que el servidor Express esté configurado correctamente

## 📁 Estructura Final del Proyecto

```
hispaleman-express/
├── server.js                 # Servidor Express principal
├── database.sqlite         # Base de datos SQLite
├── vercel.json             # Configuración de Vercel (corregida)
├── package.json            # Dependencias y scripts
├── public/                 # Archivos estáticos
│   ├── abogados-actualizado.html
│   ├── styles-actualizado.css
│   ├── script-actualizado.js
│   └── abogados-completos.json
├── scripts/
│   └── vercel-build.js     # Script de verificación
└── src/                    # Código fuente del servidor
```

## 🎉 ¡Listo para Desplegar!

Tu proyecto ahora está correctamente configurado para desplegar en Vercel sin errores. El script de verificación asegurará que todo esté en orden antes del despliegue.