const Property = require('../models/property');
const logger = require('../config/logger');

/**
 * Servicio de normalización de datos
 * Convierte datos crudos de diferentes portales al formato estándar Property
 */

class DataNormalizationService {
  constructor() {
    // Configuración de normalización por portal
    this.portalConfigs = {
      'wg-gesucht': {
        pricePatterns: [/(\d+(?:[.,]\d+)?)\s*€/i, /(\d+(?:[.,]\d+)?)\s*euro/i],
        areaPatterns: [/(\d+(?:[.,]\d+)?)\s*m²/i, /(\d+(?:[.,]\d+)?)\s*qm/i],
        roomPatterns: [/(\d+(?:[.,]\d+)?)\s*zimmer/i, /(\d+(?:[.,]\d+)?)\s*zi/i],
        typeMapping: {
          'wg-zimmer': 'room',
          'wohnung': 'apartment',
          'haus': 'house',
          '1-zimmer': 'studio'
        }
      },
      'immobilenscout24': {
        pricePatterns: [/(\d+(?:[.,]\d+)?)\s*€/i],
        areaPatterns: [/(\d+(?:[.,]\d+)?)\s*m²/i],
        roomPatterns: [/(\d+(?:[.,]\d+)?)\s*zimmer/i],
        typeMapping: {
          'wohnung': 'apartment',
          'haus': 'house',
          'zimmer': 'room'
        }
      },
      'immowelt': {
        pricePatterns: [/(\d+(?:[.,]\d+)?)\s*€/i],
        areaPatterns: [/(\d+(?:[.,]\d+)?)\s*m²/i],
        roomPatterns: [/(\d+(?:[.,]\d+)?)\s*zimmer/i],
        typeMapping: {
          'wohnung': 'apartment',
          'haus': 'house',
          'zimmer': 'room'
        }
      },
      'kleinanzeigen': {
        pricePatterns: [/(\d+(?:[.,]\d+)?)\s*€/i],
        areaPatterns: [/(\d+(?:[.,]\d+)?)\s*m²/i],
        roomPatterns: [/(\d+(?:[.,]\d+)?)\s*zimmer/i],
        typeMapping: {
          'wohnung': 'apartment',
          'zimmer': 'room',
          'haus': 'house'
        }
      },
      'immonet': {
        pricePatterns: [/(\d+(?:[.,]\d+)?)\s*€/i],
        areaPatterns: [/(\d+(?:[.,]\d+)?)\s*m²/i],
        roomPatterns: [/(\d+(?:[.,]\d+)?)\s*zimmer/i],
        typeMapping: {
          'wohnung': 'apartment',
          'haus': 'house',
          'zimmer': 'room'
        }
      }
    };
  }

  /**
   * Normaliza datos crudos de un portal a formato Property estándar
   */
  normalizeProperty(rawData, portal) {
    try {
      const config = this.portalConfigs[portal];
      if (!config) {
        logger.warn(`Configuración no encontrada para portal: ${portal}`);
        return null;
      }

      const normalized = {
        id: this.generatePropertyId(rawData, portal),
        source: portal,
        externalId: rawData.id || rawData.externalId || null,
        url: this.normalizeUrl(rawData.url, portal),
        title: this.cleanText(rawData.title),
        price: this.normalizePrice(rawData.price, config),
        squareMeters: this.normalizeArea(rawData.area || rawData.squareMeters, config),
        mainImage: this.normalizeImageUrl(rawData.image || rawData.mainImage, portal),
        location: this.cleanText(rawData.location || rawData.city),
        propertyType: this.normalizePropertyType(rawData.type || rawData.propertyType, config),
        publishedDate: this.normalizeDate(rawData.publishedDate || rawData.date),
        description: this.cleanText(rawData.description),
        rooms: this.normalizeRooms(rawData.rooms, config),

        // Campos opcionales
        floor: rawData.floor || null,
        totalFloors: rawData.totalFloors || null,
        constructionYear: rawData.constructionYear || null,
        energyEfficiency: rawData.energyEfficiency || null,
        heatingType: rawData.heatingType || null,
        parking: this.normalizeBoolean(rawData.parking),
        balcony: this.normalizeBoolean(rawData.balcony),
        garden: this.normalizeBoolean(rawData.garden),
        elevator: this.normalizeBoolean(rawData.elevator),
        furnished: this.normalizeBoolean(rawData.furnished)
      };

      // Crear instancia de Property
      const property = new Property(normalized);

      // Validar que tenga campos obligatorios
      if (!property.isValid()) {
        logger.warn(`Propiedad inválida después de normalización: ${property.id}`, {
          portal,
          missingFields: this.getMissingFields(property)
        });
        return null;
      }

      return property;

    } catch (error) {
      logger.error(`Error normalizando propiedad para ${portal}:`, {
        error: error.message,
        rawData: JSON.stringify(rawData).substring(0, 200)
      });
      return null;
    }
  }

  /**
   * Genera ID único para la propiedad
   */
  generatePropertyId(rawData, portal) {
    const externalId = rawData.id || rawData.externalId || rawData.url || Date.now();
    const hash = this.simpleHash(`${portal}_${externalId}`);
    return `${portal}_${hash}`;
  }

  /**
   * Hash simple para generar IDs consistentes
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32 bits
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Normaliza URLs asegurando que sean absolutas
   */
  normalizeUrl(url, portal) {
    if (!url) return null;

    if (url.startsWith('http')) {
      return url;
    }

    // Mapear dominios base por portal
    const baseUrls = {
      'wg-gesucht': 'https://www.wg-gesucht.de',
      'immobilenscout24': 'https://www.immobilenscout24.de',
      'immowelt': 'https://www.immowelt.de',
      'kleinanzeigen': 'https://www.kleinanzeigen.de',
      'immonet': 'https://www.immonet.de'
    };

    const baseUrl = baseUrls[portal];
    return baseUrl ? `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}` : url;
  }

  /**
   * Normaliza URLs de imágenes
   */
  normalizeImageUrl(imageUrl, portal) {
    if (!imageUrl) return null;

    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    // Algunos portales tienen URLs de imagen relativas
    if (imageUrl.startsWith('//')) {
      return `https:${imageUrl}`;
    }

    // Para imágenes relativas, intentar construir URL completa
    const baseUrls = {
      'wg-gesucht': 'https://www.wg-gesucht.de',
      'immobilenscout24': 'https://www.immobilenscout24.de',
      'immowelt': 'https://www.immowelt.de',
      'kleinanzeigen': 'https://www.kleinanzeigen.de',
      'immonet': 'https://www.immonet.de'
    };

    const baseUrl = baseUrls[portal];
    return baseUrl ? `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}` : imageUrl;
  }

  /**
   * Normaliza precios usando patrones específicos del portal
   */
  normalizePrice(price, config) {
    if (!price) return null;

    const priceStr = price.toString();

    for (const pattern of config.pricePatterns) {
      const match = priceStr.match(pattern);
      if (match) {
        const numericPrice = parseFloat(match[1].replace(',', '.'));
        return `${numericPrice} €`;
      }
    }

    // Fallback: buscar cualquier número seguido de €
    const fallbackMatch = priceStr.match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (fallbackMatch) {
      return `${parseFloat(fallbackMatch[1].replace(',', '.'))} €`;
    }

    return null;
  }

  /**
   * Normaliza áreas en metros cuadrados
   */
  normalizeArea(area, config) {
    if (!area) return null;

    const areaStr = area.toString();

    for (const pattern of config.areaPatterns) {
      const match = areaStr.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(',', '.'));
      }
    }

    // Fallback: buscar cualquier número razonable
    const fallbackMatch = areaStr.match(/(\d+(?:[.,]\d+)?)/);
    if (fallbackMatch) {
      const numericArea = parseFloat(fallbackMatch[1].replace(',', '.'));
      // Validar que sea un área razonable (10-1000 m²)
      if (numericArea >= 10 && numericArea <= 1000) {
        return numericArea;
      }
    }

    return null;
  }

  /**
   * Normaliza número de habitaciones
   */
  normalizeRooms(rooms, config) {
    if (!rooms) return null;

    const roomsStr = rooms.toString();

    for (const pattern of config.roomPatterns) {
      const match = roomsStr.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    // Fallback: intentar parsear como número
    const numericRooms = parseInt(roomsStr);
    if (!isNaN(numericRooms) && numericRooms >= 1 && numericRooms <= 20) {
      return numericRooms;
    }

    return null;
  }

  /**
   * Normaliza tipo de propiedad
   */
  normalizePropertyType(type, config) {
    if (!type) return 'apartment';

    const typeStr = type.toString().toLowerCase();

    // Buscar en mapeo específico del portal
    for (const [key, value] of Object.entries(config.typeMapping)) {
      if (typeStr.includes(key)) {
        return value;
      }
    }

    // Usar normalización general
    return Property.normalizePropertyType(typeStr) || 'apartment';
  }

  /**
   * Normaliza fechas a formato ISO
   */
  normalizeDate(date) {
    if (!date) return null;

    try {
      if (date instanceof Date) {
        return date.toISOString();
      }

      if (typeof date === 'string') {
        // Intentar diferentes formatos
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }

      if (typeof date === 'number') {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }

      return null;
    } catch (error) {
      logger.warn('Error normalizando fecha:', { date, error: error.message });
      return null;
    }
  }

  /**
   * Normaliza valores booleanos
   */
  normalizeBoolean(value) {
    if (value === null || value === undefined) return null;

    if (typeof value === 'boolean') return value;

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (['yes', 'true', '1', 'ja', 'sí', 'si'].includes(lowerValue)) return true;
      if (['no', 'false', '0', 'nein', 'no'].includes(lowerValue)) return false;
    }

    return null;
  }

  /**
   * Limpia texto removiendo caracteres especiales y espacios extra
   */
  cleanText(text) {
    if (!text) return null;

    return text
      .toString()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .substring(0, 1000); // Limitar longitud
  }

  /**
   * Obtiene campos faltantes para debugging
   */
  getMissingFields(property) {
    const requiredFields = [
      'id', 'source', 'externalId', 'url', 'title',
      'price', 'squareMeters', 'mainImage', 'location', 'propertyType'
    ];

    return requiredFields.filter(field => !property[field]);
  }

  /**
   * Normaliza un array de propiedades crudas
   */
  normalizeProperties(rawProperties, portal) {
    const startTime = Date.now();
    const normalized = [];
    let errors = 0;

    for (const rawProperty of rawProperties) {
      const normalizedProperty = this.normalizeProperty(rawProperty, portal);
      if (normalizedProperty) {
        normalized.push(normalizedProperty);
      } else {
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    logger.logScrapingResults(portal, 'normalization', normalized.length, duration, {
      totalInput: rawProperties.length,
      errors,
      successRate: ((normalized.length / rawProperties.length) * 100).toFixed(1) + '%'
    });

    return normalized;
  }

  /**
   * Obtiene estadísticas de normalización
   */
  getStats() {
    return {
      supportedPortals: Object.keys(this.portalConfigs),
      portalCount: Object.keys(this.portalConfigs).length
    };
  }
}

module.exports = new DataNormalizationService();