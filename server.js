const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar módulos refactorizados
const logger = require('./src/config/logger');
const database = require('./src/config/database');
const cacheService = require('./src/services/cacheService');
const { applySecurityMiddlewares } = require('./src/middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar servicios
cacheService.setDatabase(database);

// Middleware básico
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Aplicar middlewares de seguridad
applySecurityMiddlewares(app);

// Servir archivos estáticos
app.use(express.static('public'));

// Rutas API refactorizadas
app.use('/api', require('./src/api/search'));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta de resultados
app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

// Ruta para la página de detalle
app.get('/detail', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'detail.html'));
});

// API endpoint para obtener detalles de una propiedad específica
app.get('/api/property/:id', async (req, res) => {
  try {
    const propertyId = req.params.id;

    const property = await new Promise((resolve, reject) => {
      database.db.get(
        'SELECT * FROM properties WHERE id = ?',
        [propertyId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    res.json(property);
  } catch (error) {
    logger.error('Error obteniendo detalles de propiedad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  logger.warn('Ruta no encontrada:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    timestamp: new Date().toISOString()
  });
});

// Inicializar servicios
async function initializeServices() {
  try {
    logger.info('🔧 Inicializando servicios...');

    // Verificar conexión a base de datos
    await database.healthCheck();
    logger.info('✅ Base de datos operativa');

    // Verificar servicios de caché
    const cacheHealth = await cacheService.healthCheck();
    if (cacheHealth.status === 'healthy') {
      logger.info('✅ Servicio de caché operativo');
    } else {
      logger.warn('⚠️ Servicio de caché con problemas:', cacheHealth);
    }

    // Verificar conectores (sin scraping inicial)
    logger.info('✅ Servicios inicializados correctamente');

  } catch (error) {
    logger.error('❌ Error inicializando servicios:', error);
    process.exit(1);
  }
}

// Función de limpieza graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Recibida señal SIGINT, cerrando servicios...');

  try {
    database.close();
    await cacheService.close();
    logger.info('✅ Servicios cerrados correctamente');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error cerrando servicios:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Recibida señal SIGTERM, cerrando servicios...');
  // Reutilizar la lógica de SIGINT
  process.emit('SIGINT');
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`🚀 Servidor HispaleMan corriendo en http://localhost:${PORT}`);
  logger.info(`🌐 Servidor también accesible desde red local en: http://${getLocalIp()}:${PORT}`);
  logger.info(`📊 Modo: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔍 Scraping: ${process.env.SCRAPING_ENABLED === 'true' ? 'Habilitado' : 'Deshabilitado'}`);
  logger.info(`🔒 API Key requerida: ${process.env.API_SECRET_KEY ? 'Configurada' : 'NO CONFIGURADA'}`);

  // Inicializar servicios después de que el servidor esté corriendo
  await initializeServices();
});

// Función para obtener IP local
function getLocalIp() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  
  return 'localhost';
}
module.exports = app;