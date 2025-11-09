const BaseConnector = require('./baseConnector');
const cheerio = require('cheerio');

/**
 * Conector para ImmobilienScout24.de
 * Uno de los portales inmobiliarios más grandes de Alemania
 */

class ImmobilienScout24Connector extends BaseConnector {
  setupPortalConfig() {
    this.baseUrl = 'https://www.immobilienscout24.de';
    this.rateLimitDelay = 2500; // 2.5 segundos entre requests
    this.maxRetries = 3;
  }

  async performSearch(criteria) {
    const validation = this.validateCriteria(criteria);
    if (!validation.isValid) {
      throw new Error(`Criterios inválidos: ${validation.errors.join(', ')}`);
    }

    // Construir URL de búsqueda
    const searchUrl = this.buildSearchUrl(criteria);

    // Realizar petición
    const response = await this.makeRequest(searchUrl);

    // Parsear resultados
    const properties = this.parseProperties(response.data, criteria);

    return properties;
  }

  buildSearchUrl(criteria) {
    // IS24 tiene URLs estructuradas por tipo y ciudad
    let basePath;

    if (criteria.type === 'room') {
      basePath = `Suche/de/wg-zimmer/${criteria.city}`;
    } else {
      basePath = `Suche/de/wohnung-mieten/${criteria.city}`;
    }

    // Construir URL base
    let url = `${this.baseUrl}/${basePath}`;

    // Añadir parámetros de filtro como query string
    const params = [];

    if (criteria.budget) {
      params.push(`priceTo=${criteria.budget}`);
    }

    if (criteria.rooms) {
      params.push(`numberOfRoomsFrom=${criteria.rooms}`);
      params.push(`numberOfRoomsTo=${criteria.rooms}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return url;
  }

  parseProperties(html, criteria) {
    const $ = cheerio.load(html);
    const properties = [];

    // Selectores para ImmobilienScout24
    const selectors = [
      '.result-list-entry',
      '.result-list__listing',
      '[data-item="result"]',
      '.resultlist-entry',
      '.result-item'
    ];

    let foundItems = false;

    for (const selector of selectors) {
      const items = $(selector);
      if (items.length > 0) {
        foundItems = true;

        items.each((index, element) => {
          if (index >= 50) return false; // Limitar resultados

          const property = this.extractPropertyData($(element), $, criteria);
          if (property) {
            properties.push(property);
          }
        });

        break;
      }
    }

    if (!foundItems) {
      // Fallback genérico
      $('a[href*="expose"]').each((index, element) => {
        if (index >= 20) return false;

        const $el = $(element);
        const href = $el.attr('href');
        const text = $el.text().trim();

        if (href && text) {
          const property = this.extractFallbackProperty($el, $, criteria);
          if (property) {
            properties.push(property);
          }
        }
      });
    }

    return properties;
  }

  extractPropertyData($element, $, criteria) {
    try {
      const title = this.extractText($element, [
        '.result-list-entry__brand-title',
        '.result-list-entry__title',
        'h2 a',
        '.title',
        'a[title]'
      ]);

      const price = this.extractText($element, [
        '.result-list-entry__primary-criterion',
        '.price',
        '.result-list-entry__price',
        '.criterion__value'
      ]);

      const location = this.extractText($element, [
        '.result-list-entry__address',
        '.address',
        '.location'
      ]);

      const href = this.extractHref($element, [
        '.result-list-entry__brand-title',
        'h2 a',
        'a'
      ]);

      const image = this.extractImage($element);

      // Extraer habitaciones del precio o descripción
      const fullText = $element.text();
      const rooms = this.extractRooms(fullText);

      if (title && href) {
        return {
          id: `is24_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: title,
          price: this.cleanPrice(price),
          location: location || criteria.city,
          rooms: rooms,
          url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
          image: image,
          type: criteria.type === 'room' ? 'room' : 'apartment',
          description: this.extractText($element, ['.result-list-entry__description']) || `Propiedad en ${criteria.city}`,
          publishedDate: this.extractDate($element) || new Date().toISOString()
        };
      }

      return null;

    } catch (error) {
      console.warn('Error extrayendo datos de propiedad IS24:', error.message);
      return null;
    }
  }

  extractFallbackProperty($element, $, criteria) {
    const href = $element.attr('href');
    const text = $element.text().trim();

    return {
      id: `is24_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: text.substring(0, 100),
      price: this.extractPriceFromText(text),
      location: criteria.city,
      rooms: this.extractRooms(text),
      url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
      image: null,
      type: criteria.type === 'room' ? 'room' : 'apartment',
      description: `Propiedad encontrada en ImmobilienScout24 para ${criteria.city}`,
      publishedDate: new Date().toISOString()
    };
  }

  extractImage($element) {
    const imageSelectors = [
      '.result-list-entry__image img',
      '.gallery-image img',
      'img'
    ];

    for (const selector of imageSelectors) {
      const src = $element.find(selector).first().attr('src');
      if (src) {
        return src.startsWith('http') ? src : (src.startsWith('//') ? `https:${src}` : `${this.baseUrl}${src}`);
      }
    }

    return null;
  }

  extractDate($element) {
    // IS24 no siempre muestra fechas, pero intentar extraer si está disponible
    const dateSelectors = ['.result-list-entry__date', '.date', 'time'];

    for (const selector of dateSelectors) {
      const dateText = $element.find(selector).first().text().trim();
      if (dateText) {
        try {
          const parsed = new Date(dateText);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        } catch (e) {
          // Ignorar errores de parsing
        }
      }
    }

    return null;
  }

  // Heredar métodos auxiliares del BaseConnector
  extractText($element, selectors) {
    return super.extractText($element, selectors);
  }

  extractHref($element, selectors) {
    return super.extractHref($element, selectors);
  }

  cleanPrice(priceText) {
    if (!priceText) return null;

    const match = priceText.match(/(\d+(?:[.,]\d+)?)\s*€?/);
    if (match) {
      return `${match[1]} €`;
    }

    return priceText.trim();
  }

  extractPriceFromText(text) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*€/);
    return match ? `${match[1]} €` : null;
  }

  extractRooms(text) {
    if (!text) return 1;

    const patterns = [
      /(\d+)\s*[-\s]*zimmer/i,
      /(\d+)\s*[-\s]*zi\b/i,
      /(\d+)\s*[-\s]*room/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const rooms = parseInt(match[1]);
        return rooms > 0 && rooms <= 10 ? rooms : 1;
      }
    }

    return 1;
  }
}

module.exports = ImmobilienScout24Connector;