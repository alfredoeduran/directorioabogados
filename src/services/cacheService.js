const redis = require('redis');
const logger = require('../config/logger');

/**
 * Servicio de caché unificado que soporta Redis y SQLite como fallback
 * Implementa estrategias de cache inteligente para búsquedas inmobiliarias
 */

class CacheService {
  constructor() {
    this.redisClient = null;
    this.useRedis = process.env.USE_REDIS === 'true';
    this.database = null; // Se inyectará desde el módulo database

    this.initRedis();
  }

  /**
   * Inicializa conexión Redis si está habilitado
   */
  initRedis() {
    if (!this.useRedis) {
      logger.info('Redis deshabilitado, usando solo caché de base de datos');
      return;
    }

    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      this.redisClient.on('error', (err) => {
        logger.error('Error de conexión Redis:', err.message);
        this.useRedis = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Conectado a Redis');
      });

      // Conectar de forma asíncrona
      this.redisClient.connect().catch(err => {
        logger.warn('No se pudo conectar a Redis, usando fallback:', err.message);
        this.useRedis = false;
      });

    } catch (error) {
      logger.warn('Redis no disponible, usando solo caché de base de datos:', error.message);
      this.useRedis = false;
    }
  }

  /**
   * Inyecta la dependencia de base de datos
   */
  setDatabase(database) {
    this.database = database;
  }

  /**
   * Genera clave de caché para búsquedas
   */
  generateCacheKey(params) {
    // Crear clave consistente ordenando las propiedades
    const sortedParams = {};
    Object.keys(params).sort().forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        sortedParams[key] = params[key];
      }
    });

    return `search:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Obtiene datos del caché
   */
  async get(key) {
    try {
      if (this.useRedis && this.redisClient?.isOpen) {
        const data = await this.redisClient.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          logger.debug(`Cache hit (Redis): ${key}`);
          return parsed;
        }
      }

      // Fallback a base de datos
      if (this.database) {
        const data = await this.database.getCachedSearch(JSON.parse(key.replace('search:', '')));
        if (data) {
          logger.debug(`Cache hit (Database): ${key}`);
          return data;
        }
      }

      logger.debug(`Cache miss: ${key}`);
      return null;

    } catch (error) {
      logger.warn('Error obteniendo del caché:', error.message);
      return null;
    }
  }

  /**
   * Guarda datos en caché
   */
  async set(key, data, ttlSeconds = null) {
    const ttl = ttlSeconds || parseInt(process.env.CACHE_TTL) || 1800; // 30 minutos por defecto

    try {
      // Intentar Redis primero
      if (this.useRedis && this.redisClient?.isOpen) {
        await this.redisClient.setEx(key, ttl, JSON.stringify(data));
        logger.debug(`Cached in Redis: ${key} (TTL: ${ttl}s)`);
        return true;
      }

      // Fallback a base de datos
      if (this.database) {
        const searchParams = JSON.parse(key.replace('search:', ''));
        await this.database.setCachedSearch(searchParams, data);
        logger.debug(`Cached in Database: ${key} (TTL: ${ttl}s)`);
        return true;
      }

      return false;

    } catch (error) {
      logger.warn('Error guardando en caché:', error.message);
      return false;
    }
  }

  /**
   * Invalida una clave específica
   */
  async invalidate(key) {
    try {
      if (this.useRedis && this.redisClient?.isOpen) {
        await this.redisClient.del(key);
        logger.debug(`Invalidated Redis key: ${key}`);
      }

      if (this.database) {
        // Para base de datos, invalidar por parámetros de búsqueda
        const searchParams = JSON.parse(key.replace('search:', ''));
        await this.database.invalidateCache(searchParams);
        logger.debug(`Invalidated Database cache: ${key}`);
      }

      return true;

    } catch (error) {
      logger.warn('Error invalidando caché:', error.message);
      return false;
    }
  }

  /**
   * Invalida todas las claves que coincidan con un patrón
   */
  async invalidatePattern(pattern) {
    try {
      if (this.useRedis && this.redisClient?.isOpen) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
          logger.debug(`Invalidated ${keys.length} Redis keys matching: ${pattern}`);
        }
      }

      // Para base de datos, limpiar caché expirado como aproximación
      if (this.database) {
        await this.database.cleanExpiredCache();
        logger.debug(`Cleaned expired database cache for pattern: ${pattern}`);
      }

      return true;

    } catch (error) {
      logger.warn('Error invalidando patrón de caché:', error.message);
      return false;
    }
  }

  /**
   * Invalida caché relacionado con una ciudad
   */
  async invalidateCityCache(city) {
    const pattern = `search:*${city.toLowerCase()}*`;
    return await this.invalidatePattern(pattern);
  }

  /**
   * Invalida caché relacionado con un portal
   */
  async invalidatePortalCache(portal) {
    // Esta invalidación es más compleja, requiere buscar en los datos
    // Por ahora, invalidar todo el caché como aproximación
    logger.info(`Invalidating cache for portal: ${portal}`);
    return await this.invalidatePattern('search:*');
  }

  /**
   * Obtiene estadísticas del caché
   */
  async getStats() {
    const stats = {
      redis: {
        enabled: this.useRedis,
        connected: this.redisClient?.isOpen || false
      },
      database: {
        available: !!this.database
      }
    };

    try {
      if (this.useRedis && this.redisClient?.isOpen) {
        const info = await this.redisClient.info();
        const dbSize = await this.redisClient.dbSize();

        stats.redis.info = {
          dbSize,
          version: info.match(/redis_version:([^\r\n]+)/)?.[1],
          uptime: info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1]
        };
      }

      if (this.database) {
        // Obtener estadísticas de caché de base de datos
        stats.database.cacheEntries = await this.database.getCacheStats();
      }

    } catch (error) {
      logger.warn('Error obteniendo estadísticas de caché:', error.message);
    }

    return stats;
  }

  /**
   * Limpia todo el caché
   */
  async clear() {
    try {
      if (this.useRedis && this.redisClient?.isOpen) {
        await this.redisClient.flushAll();
        logger.info('Redis cache cleared');
      }

      if (this.database) {
        await this.database.clearAllCache();
        logger.info('Database cache cleared');
      }

      return true;

    } catch (error) {
      logger.warn('Error limpiando caché:', error.message);
      return false;
    }
  }

  /**
   * Cierra conexiones
   */
  async close() {
    if (this.redisClient?.isOpen) {
      await this.redisClient.quit();
      logger.info('Redis connection closed');
    }
  }

  /**
   * Health check del servicio de caché
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      services: {}
    };

    // Verificar Redis
    if (this.useRedis) {
      try {
        if (this.redisClient?.isOpen) {
          await this.redisClient.ping();
          health.services.redis = 'healthy';
        } else {
          health.services.redis = 'disconnected';
          health.status = 'degraded';
        }
      } catch (error) {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
      }
    }

    // Verificar base de datos
    if (this.database) {
      try {
        await this.database.healthCheck();
        health.services.database = 'healthy';
      } catch (error) {
        health.services.database = 'unhealthy';
        health.status = 'unhealthy';
      }
    }

    return health;
  }
}

module.exports = new CacheService();