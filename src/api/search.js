const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { validateSearchRequest, validateRefreshRequest } = require('../validators/searchValidators');
const { validateApiKey, searchLimiter, adminLimiter } = require('../middleware/security');
const logger = require('../config/logger');

// Middleware de logging para todas las rutas de API
router.use(logger.expressMiddleware);

// Endpoint principal de búsqueda con validación y rate limiting
router.get('/search',
  validateApiKey,  // Requiere API key para búsquedas
  searchLimiter,    // Rate limiting específico para búsquedas
  validateSearchRequest, // Validación de parámetros
  async (req, res) => {
    try {
      await searchController.search(req, res);
    } catch (error) {
      logger.error('Error en endpoint /search:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
);

// Endpoint para forzar actualización de datos (solo admin)
router.post('/refresh/:city',
  validateApiKey,
  adminLimiter,
  validateRefreshRequest,
  async (req, res) => {
    try {
      await searchController.refresh(req, res);
    } catch (error) {
      logger.error('Error en endpoint /refresh:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
);

// Endpoint de estadísticas (requiere API key)
router.get('/stats',
  validateApiKey,
  adminLimiter,
  async (req, res) => {
    try {
      await searchController.stats(req, res);
    } catch (error) {
      logger.error('Error en endpoint /stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
);

// Endpoint de health check (sin autenticación para monitoreo)
router.get('/health',
  async (req, res) => {
    try {
      await searchController.health(req, res);
    } catch (error) {
      logger.error('Error en endpoint /health:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Endpoint para traducir texto (útil para testing)
router.post('/translate',
  validateApiKey,
  async (req, res) => {
    try {
      const { text, from = 'es', to = 'de' } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Texto requerido'
        });
      }

      const translationService = require('../services/translationService');
      const translatedText = await translationService.translate(text, from, to);

      res.json({
        success: true,
        original: text,
        translated: translatedText,
        from,
        to,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error en endpoint /translate:', error);
      res.status(500).json({
        success: false,
        error: 'Error de traducción'
      });
    }
  }
);

// Endpoint para limpiar caché (solo admin)
router.post('/cache/clear',
  validateApiKey,
  adminLimiter,
  async (req, res) => {
    try {
      const cacheService = require('../services/cacheService');
      const cleared = await cacheService.clear();

      res.json({
        success: true,
        message: 'Caché limpiado exitosamente',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error limpiando caché:', error);
      res.status(500).json({
        success: false,
        error: 'Error limpiando caché'
      });
    }
  }
);

// Endpoint para obtener métricas de búsqueda (solo admin)
router.get('/metrics/searches',
  validateApiKey,
  adminLimiter,
  async (req, res) => {
    try {
      const { days = 7 } = req.query;
      const database = require('../config/database');

      const stats = await database.getSearchStats(parseInt(days));

      res.json({
        success: true,
        period: `${days} días`,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error obteniendo métricas:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo métricas'
      });
    }
  }
);

// Middleware de manejo de errores para todas las rutas
router.use((error, req, res, next) => {
  logger.error('Error no manejado en API:', {
    error: error.message,
    stack: error.stack,
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

module.exports = router;