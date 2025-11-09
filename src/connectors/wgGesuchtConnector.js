const BaseConnector = require('./baseConnector');
const cheerio = require('cheerio');

/**
 * Conector para WG-Gesucht.de
 * Portal especializado en habitaciones compartidas y apartamentos
 */

class WGGesuchtConnector extends BaseConnector {
  setupPortalConfig() {
    this.baseUrl = 'https://www.wg-gesucht.de';
    this.rateLimitDelay = 3000; // 3 segundos entre requests (más conservador)
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
    // WG-Gesucht tiene URLs específicas según el tipo
    let basePath;

    if (criteria.type === 'room') {
      basePath = 'wohnraumangebote.html';
    } else {
      basePath = 'wohnraumangebote.html';
    }

    // Parámetros de búsqueda
    const params = new URLSearchParams({
      city_id: '8', // Berlin por defecto (esto debería mapearse dinámicamente)
      rent_type: '0', // Alquiler
      category: criteria.type === 'room' ? '0' : '1' // 0=habitaciones, 1=apartamentos
    });

    // Añadir filtros adicionales si están disponibles
    if (criteria.budget) {
      params.append('min_rent', '0');
      params.append('max_rent', criteria.budget.toString());
    }

    if (criteria.rooms) {
      params.append('min_rooms', criteria.rooms.toString());
      params.append('max_rooms', (criteria.rooms + 1).toString());
    }

    return `${this.baseUrl}/${basePath}?${params.toString()}`;
  }

  parseProperties(html, criteria) {
    const $ = cheerio.load(html);
    const properties = [];

    // Selectores para WG-Gesucht (basado en estructura actual)
    const selectors = [
      '.offer_list_item',
      '.listitem',
      '.wgg_card',
      '[id^="liste-"]',
      '.panel-body .row'
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

        break; // Usar el primer selector que funcione
      }
    }

    if (!foundItems) {
      // Fallback: buscar cualquier enlace que parezca una propiedad
      $('a').each((index, element) => {
        if (index >= 20) return false;

        const $el = $(element);
        const href = $el.attr('href');
        const text = $el.text().trim();

        if (href && text && (text.includes('€') || text.includes('zimmer') || text.includes('wohnung'))) {
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
      // Extraer información usando múltiples selectores para robustez
      const title = this.extractText($element, [
        '.headline',
        '.detailansicht a',
        'h3 a',
        '.card-title',
        'a[title]'
      ]);

      const price = this.extractText($element, [
        '.rent',
        '.price',
        '.kosten',
        '.angaben .ang_spalte_mitte'
      ]);

      const location = this.extractText($element, [
        '.city',
        '.location',
        '.ort',
        '.angaben .ang_spalte_links'
      ]);

      const href = this.extractHref($element, [
        'a',
        '.headline a',
        '.detailansicht a'
      ]);

      // Extraer habitaciones del título o descripción
      const fullText = $element.text();
      const rooms = this.extractRooms(fullText);

      if (title && (price || href)) {
        return {
          id: `wg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: title,
          price: this.cleanPrice(price),
          location: location || criteria.city,
          rooms: rooms,
          url: href ? (href.startsWith('http') ? href : `${this.baseUrl}${href}`) : this.buildSearchUrl(criteria),
          image: this.extractImage($element),
          type: criteria.type === 'room' ? 'room' : 'apartment',
          description: this.extractText($element, ['.freitext', '.description', '.text']) || `${criteria.type === 'room' ? 'Habitación' : 'Apartamento'} en ${criteria.city}`,
          publishedDate: new Date().toISOString() // WG-Gesucht no siempre muestra fechas exactas
        };
      }

      return null;

    } catch (error) {
      console.warn('Error extrayendo datos de propiedad WG-Gesucht:', error.message);
      return null;
    }
  }

  extractFallbackProperty($element, $, criteria) {
    const href = $element.attr('href');
    const text = $element.text().trim();

    return {
      id: `wg_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: text.substring(0, 100),
      price: this.extractPriceFromText(text),
      location: criteria.city,
      rooms: this.extractRooms(text),
      url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
      image: null,
      type: criteria.type === 'room' ? 'room' : 'apartment',
      description: `Propiedad encontrada en WG-Gesucht para ${criteria.city}`,
      publishedDate: new Date().toISOString()
    };
  }

  // Métodos auxiliares para extracción de datos
  extractText($element, selectors) {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text) return text;
    }
    return '';
  }

  extractHref($element, selectors) {
    for (const selector of selectors) {
      const href = $element.find(selector).first().attr('href');
      if (href) return href;
    }
    return '';
  }

  extractImage($element) {
    const imageSelectors = ['.image img', '.gallery img', 'img'];
    for (const selector of imageSelectors) {
      const src = $element.find(selector).first().attr('src');
      if (src) {
        return src.startsWith('http') ? src : `${this.baseUrl}${src}`;
      }
    }
    return null;
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

module.exports = WGGesuchtConnector;