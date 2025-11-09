const logger = require('../config/logger');
const translationService = require('../services/translationService');
const cacheService = require('../services/cacheService');
const dataNormalizationService = require('../services/dataNormalizationService');
const WGGesuchtConnector = require('../connectors/wgGesuchtConnector');
const ImmobilienScout24Connector = require('../connectors/immobilienScout24Connector');

/**
 * Controlador principal para búsquedas de propiedades
 * Coordina la traducción, búsqueda en portales, normalización y respuesta
 */

class SearchController {
  constructor() {
    // Inicializar conectores
    this.connectors = {
      'wg-gesucht': process.env.WG_GESUCHT_ENABLED !== 'false' ? new WGGesuchtConnector() : null,
      'immobilienscout24': process.env.IS24_ENABLED !== 'false' ? new ImmobilienScout24Connector() : null
    };

    // Filtrar conectores disponibles
    this.availableConnectors = Object.entries(this.connectors)
      .filter(([_, connector]) => connector !== null)
      .map(([name, connector]) => ({ name, connector }));
  }

  /**
   * Endpoint principal de búsqueda
   */
  async search(req, res) {
    const startTime = Date.now();

    try {
      const { city, type, rooms, budget, page = 1, limit = 12, forceRefresh = false } = req.query;

      // Preparar criterios de búsqueda
      const criteria = {
        city: city?.trim(),
        type: type !== 'all' ? type : undefined,
        rooms: rooms !== 'all' ? parseInt(rooms) : undefined,
        budget: budget !== 'all' ? parseInt(budget) : undefined
      };

      logger.api(`Búsqueda iniciada: ${JSON.stringify(criteria)}`, {
        criteria,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Generar clave de caché
      const cacheKey = cacheService.generateCacheKey(criteria);

      let allProperties = [];
      let fromCache = false;
      let cacheSource = '';

      // Intentar obtener del caché (si no se fuerza refresh)
      if (!forceRefresh) {
        const cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
          allProperties = cachedData;
          fromCache = true;
          cacheSource = 'cache';
          logger.debug(`Resultados desde caché: ${allProperties.length} propiedades`);
        }
      }

      // Si no hay datos en caché, realizar búsqueda
      if (!fromCache) {
        allProperties = await this.performSearch(criteria);
        cacheSource = 'scraping';

        // Guardar en caché
        if (allProperties.length > 0) {
          await cacheService.set(cacheKey, allProperties);
        }
      }

      // Aplicar paginación
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const totalResults = allProperties.length;
      const totalPages = Math.ceil(totalResults / limitNum);
      const paginatedResults = allProperties.slice(offset, offset + limitNum);

      const duration = Date.now() - startTime;

      logger.performance('Búsqueda completada', duration, {
        criteria,
        totalResults,
        paginatedResults: paginatedResults.length,
        fromCache,
        cacheSource
      });

      res.json({
        success: true,
        results: paginatedResults,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalResults: totalResults,
          resultsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        },
        cached: fromCache,
        source: cacheSource,
        query: criteria,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error en búsqueda:', {
        error: error.message,
        stack: error.stack,
        criteria: req.query,
        durationMs: duration
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    }
  }

  /**
   * Realizar búsqueda en todos los portales disponibles
   */
  async performSearch(criteria) {
    const startTime = Date.now();

    // Traducir criterios si es necesario
    const translatedCriteria = await this.translateSearchCriteria(criteria);

    logger.scraping(`Iniciando búsqueda en ${this.availableConnectors.length} portales`, {
      criteria: translatedCriteria,
      portals: this.availableConnectors.map(c => c.name)
    });

    // Ejecutar búsquedas en paralelo con límite de concurrencia
    const concurrencyLimit = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 3;
    const results = await this.executeConcurrentSearches(translatedCriteria, concurrencyLimit);

    // Normalizar y combinar resultados
    const normalizedResults = this.normalizeAndCombineResults(results);

    const duration = Date.now() - startTime;
    logger.logScrapingResults('all-portals', 'combined-search', normalizedResults.length, duration, {
      criteria: translatedCriteria,
      portalsSearched: this.availableConnectors.length
    });

    return normalizedResults;
  }

  /**
   * Traducir criterios de búsqueda al alemán
   */
  async translateSearchCriteria(criteria) {
    if (!criteria.city) return criteria;

    try {
      const translatedCity = await translationService.translateSearchQuery(criteria.city, 'es', 'de');

      return {
        ...criteria,
        city: translatedCity || criteria.city,
        originalCity: criteria.city // Mantener original para logging
      };
    } catch (error) {
      logger.warn('Error traduciendo criterios de búsqueda, usando originales:', {
        error: error.message,
        criteria
      });
      return criteria;
    }
  }

  /**
   * Ejecutar búsquedas en portales con control de concurrencia
   */
  async executeConcurrentSearches(criteria, concurrencyLimit) {
    const results = [];
    const errors = [];

    // Procesar en lotes para controlar concurrencia
    for (let i = 0; i < this.availableConnectors.length; i += concurrencyLimit) {
      const batch = this.availableConnectors.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async ({ name, connector }) => {
        try {
          const portalResults = await connector.search(criteria);
          return { portal: name, results: portalResults, error: null };
        } catch (error) {
          logger.logScrapingError(name, criteria.city || 'unknown', error);
          return { portal: name, results: [], error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Esperar entre lotes para no sobrecargar
      if (i + concurrencyLimit < this.availableConnectors.length) {
        await this.sleep(1000);
      }
    }

    return results;
  }

  /**
   * Normalizar y combinar resultados de diferentes portales
   */
  normalizeAndCombineResults(portalResults) {
    const allProperties = [];
    const stats = {
      total: 0,
      byPortal: {},
      errors: []
    };

    for (const { portal, results, error } of portalResults) {
      if (error) {
        stats.errors.push({ portal, error });
        continue;
      }

      // Normalizar propiedades del portal
      const normalizedProperties = dataNormalizationService.normalizeProperties(results, portal);

      allProperties.push(...normalizedProperties);
      stats.byPortal[portal] = normalizedProperties.length;
      stats.total += normalizedProperties.length;
    }

    logger.scraping(`Resultados combinados: ${stats.total} propiedades`, {
      stats,
      portals: Object.keys(stats.byPortal)
    });

    // Ordenar por fecha de publicación (más recientes primero)
    return allProperties.sort((a, b) => {
      const dateA = new Date(a.publishedDate || 0);
      const dateB = new Date(b.publishedDate || 0);
      return dateB - dateA;
    });
  }

  /**
   * Endpoint para forzar actualización de datos
   */
  async refresh(req, res) {
    try {
      const { city } = req.params;
      const { maxResults = 30, type = 'all' } = req.query;

      if (!city || city.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Ciudad inválida'
        });
      }

      logger.api(`Forzando actualización para ${city}`, { city, maxResults, type });

      const criteria = { city, type, maxResults: parseInt(maxResults) };
      const results = await this.performSearch(criteria);

      // Invalidar caché relacionado
      await cacheService.invalidateCityCache(city);

      res.json({
        success: true,
        message: `Datos actualizados para ${city}`,
        results: results.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error forzando actualización:', {
        error: error.message,
        city: req.params.city
      });

      res.status(500).json({
        success: false,
        error: 'Error actualizando datos'
      });
    }
  }

  /**
   * Endpoint de estadísticas
   */
  async stats(req, res) {
    try {
      const connectorStats = {};
      for (const { name, connector } of this.availableConnectors) {
        connectorStats[name] = connector.getStats();
      }

      const cacheStats = await cacheService.getStats();
      const translationStats = translationService.getStats();

      res.json({
        success: true,
        connectors: connectorStats,
        cache: cacheStats,
        translation: translationStats,
        availablePortals: this.availableConnectors.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error.message);

      res.status(500).json({
        success: false,
        error: 'Error obteniendo estadísticas'
      });
    }
  }

  /**
   * Endpoint de health check
   */
  async health(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {}
      };

      // Verificar conectores
      for (const { name, connector } of this.availableConnectors) {
        try {
          const isHealthy = await connector.healthCheck();
          health.services[name] = isHealthy ? 'healthy' : 'unhealthy';
          if (!isHealthy) health.status = 'degraded';
        } catch (error) {
          health.services[name] = 'unhealthy';
          health.status = 'degraded';
        }
      }

      // Verificar caché
      const cacheHealth = await cacheService.healthCheck();
      health.services.cache = cacheHealth.status;
      if (cacheHealth.status !== 'healthy') {
        health.status = 'degraded';
      }

      // Verificar traducción
      try {
        await translationService.testConnection();
        health.services.translation = 'healthy';
      } catch (error) {
        health.services.translation = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);

    } catch (error) {
      logger.error('Error en health check:', error.message);

      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Utilidad para esperar
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SearchController();