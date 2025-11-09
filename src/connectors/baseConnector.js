const axios = require('axios');
const logger = require('../config/logger');

/**
 * Clase base para conectores de portales inmobiliarios
 * Implementa el patrón Adapter para unificar interfaces
 */

class BaseConnector {
  constructor(portalName) {
    this.portalName = portalName;
    this.baseUrl = '';
    this.rateLimitDelay = 2000; // 2 segundos entre requests
    this.maxRetries = 3;
    this.timeout = 15000; // 15 segundos
    this.userAgent = 'Hispaleman-Bot/1.0 (https://hispaleman.com)';

    // Configuración específica por portal
    this.setupPortalConfig();
  }

  /**
   * Configuración específica del portal (implementar en subclases)
   */
  setupPortalConfig() {
    throw new Error('setupPortalConfig() debe ser implementado en la subclase');
  }

  /**
   * Busca propiedades según criterios
   */
  async search(criteria) {
    const startTime = Date.now();

    try {
      logger.scraping(`Iniciando búsqueda en ${this.portalName}`, {
        portal: this.portalName,
        criteria: JSON.stringify(criteria)
      });

      const rawResults = await this.performSearch(criteria);
      const duration = Date.now() - startTime;

      logger.logScrapingResults(this.portalName, 'search', rawResults.length, duration, {
        criteria: JSON.stringify(criteria)
      });

      return rawResults;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logScrapingError(this.portalName, criteria.city || 'unknown', error, {
        durationMs: duration,
        criteria: JSON.stringify(criteria)
      });
      throw error;
    }
  }

  /**
   * Realiza la búsqueda específica del portal (implementar en subclases)
   */
  async performSearch(criteria) {
    throw new Error('performSearch() debe ser implementado en la subclase');
  }

  /**
   * Realiza una petición HTTP con reintentos y rate limiting
   */
  async makeRequest(url, options = {}) {
    const config = {
      method: 'GET',
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': this.baseUrl,
        ...options.headers
      },
      ...options
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(`Request attempt ${attempt}/${this.maxRetries} to ${url}`);

        const response = await axios(url, config);

        // Verificar respuesta exitosa
        if (response.status === 200) {
          return response;
        }

        // Si no es 200, intentar de nuevo
        logger.warn(`HTTP ${response.status} en intento ${attempt} para ${url}`);

      } catch (error) {
        logger.warn(`Error en intento ${attempt} para ${url}:`, error.message);

        // Si es el último intento, lanzar error
        if (attempt === this.maxRetries) {
          throw error;
        }

        // Esperar antes del siguiente intento (backoff exponencial)
        const delay = this.rateLimitDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Espera un tiempo determinado (para rate limiting)
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verifica si el portal está disponible
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest(this.baseUrl, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.warn(`Health check failed for ${this.portalName}:`, error.message);
      return false;
    }
  }

  /**
   * Obtiene estadísticas del conector
   */
  getStats() {
    return {
      portal: this.portalName,
      baseUrl: this.baseUrl,
      rateLimitDelay: this.rateLimitDelay,
      maxRetries: this.maxRetries,
      timeout: this.timeout
    };
  }

  /**
   * Construye URL de búsqueda (helper method)
   */
  buildSearchUrl(criteria) {
    // Implementar en subclases según la estructura URL del portal
    return this.baseUrl;
  }

  /**
   * Parsea HTML para extraer propiedades (helper method)
   */
  parseProperties(html, criteria) {
    // Implementar en subclases según la estructura HTML del portal
    return [];
  }

  /**
   * Extrae información de una propiedad individual (helper method)
   */
  extractPropertyData(element, $) {
    // Implementar en subclases según los selectores del portal
    return {};
  }

  /**
   * Valida criterios de búsqueda
   */
  validateCriteria(criteria) {
    const errors = [];

    if (!criteria.city) {
      errors.push('Ciudad es requerida');
    }

    if (criteria.budget && (criteria.budget < 100 || criteria.budget > 5000)) {
      errors.push('Presupuesto debe estar entre 100€ y 5000€');
    }

    if (criteria.rooms && (criteria.rooms < 1 || criteria.rooms > 10)) {
      errors.push('Habitaciones deben estar entre 1 y 10');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = BaseConnector;