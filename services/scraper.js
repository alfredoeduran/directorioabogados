const { ApifyClient } = require('apify-client');
const axios = require('axios');
const cheerio = require('cheerio');
const database = require('../api/database');

class PropertyScraper {
  constructor() {
    this.apifyApiKey = process.env.APIFY_API_KEY;
    this.apify = this.apifyApiKey ? new ApifyClient({ token: this.apifyApiKey }) : null;
    this.lastScrapeTime = null;
    this.isScrapingActive = false;
  }

  // Método principal para obtener propiedades
  async scrapeProperties(city, options = {}) {
    console.log(`🔍 Iniciando scraping para: ${city}`);
    
    if (this.isScrapingActive) {
      console.log('⚠️ Scraping ya en progreso, usando datos existentes');
      return await this.getExistingProperties(city, options);
    }

    this.isScrapingActive = true;
    
    try {
      const results = [];
      
      // Scraping de WG-Gesucht
      if (this.apify) {
        console.log('🏠 Scraping WG-Gesucht con Apify...');
        const wgResults = await this.scrapeWGGesucht(city, options);
        results.push(...wgResults);
      } else {
        console.log('⚠️ Apify no configurado, usando scraping directo para WG-Gesucht');
        const wgResults = await this.scrapeWGGesuchtDirect(city, options);
        results.push(...wgResults);
      }

      // Scraping de ImmobilienScout24
      console.log('🏢 Scraping ImmobilienScout24...');
      const isResults = await this.scrapeImmobilienScout24(city, options);
      results.push(...isResults);

      // Scraping de Immowelt
      console.log('🏘️ Scraping Immowelt...');
      const iwResults = await this.scrapeImmowelt(city, options);
      results.push(...iwResults);

      // Scraping de Immonet
      console.log('🏠 Scraping Immonet...');
      const inResults = await this.scrapeImmonet(city, options);
      results.push(...inResults);

      // Scraping de Kleinanzeigen
      console.log('🏪 Scraping Kleinanzeigen...');
      const kaResults = await this.scrapeKleinanzeigen(city, options);
      results.push(...kaResults);

      // Guardar en base de datos
      await this.savePropertiesToDB(results);
      
      this.lastScrapeTime = new Date();
      console.log(`✅ Scraping completado: ${results.length} propiedades encontradas`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Error en scraping:', error);
      // Fallback a datos existentes
      return await this.getExistingProperties(city, options);
    } finally {
      this.isScrapingActive = false;
    }
  }

  // Scraping de WG-Gesucht usando Apify
  async scrapeWGGesucht(city, options) {
    try {
      console.log('⚠️ Apify configurado pero sin actor específico, usando scraping directo');
      // Por ahora usar scraping directo hasta configurar un actor específico
      return await this.scrapeWGGesuchtDirect(city, options);
    } catch (error) {
      console.error('Error scraping WG-Gesucht con Apify:', error);
      return [];
    }
  }

  // Scraping directo de WG-Gesucht (método alternativo)
  async scrapeWGGesuchtDirect(city, options) {
    try {
      // Construir URL más específica con parámetros de búsqueda
      let searchUrl = 'https://www.wg-gesucht.de/';
      
      // Determinar tipo de búsqueda basado en options.type
      if (options.type === 'room') {
        searchUrl += `wg-zimmer-in-${city.toLowerCase()}.html`;
      } else if (options.type === 'apartment') {
        searchUrl += `wohnungen-in-${city.toLowerCase()}.html`;
      } else {
        // Buscar tanto habitaciones como apartamentos
        const roomResults = await this.scrapeWGGesuchtByType(city, 'room', options);
        const apartmentResults = await this.scrapeWGGesuchtByType(city, 'apartment', options);
        return [...roomResults, ...apartmentResults];
      }
      
      return await this.scrapeWGGesuchtByType(city, options.type || 'all', options);
    } catch (error) {
      console.error('Error scraping WG-Gesucht directo:', error);
      return [];
    }
  }

  // Método auxiliar para scraping por tipo específico
  async scrapeWGGesuchtByType(city, type, options) {
    try {
      let searchUrl;
      if (type === 'room') {
        // Usar el formato correcto de URL para WG-Gesucht
        searchUrl = 'https://www.wg-gesucht.de/wohnraumangebote.html?cat=0&city_id=8&rent_type=0';
      } else {
        searchUrl = 'https://www.wg-gesucht.de/wohnraumangebote.html?cat=1&city_id=8&rent_type=0';
      }
      
      console.log(`🔍 Scraping WG-Gesucht ${type}: ${searchUrl}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'https://www.wg-gesucht.de/'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const properties = [];

      // Selectores más específicos para WG-Gesucht
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
          console.log(`✅ Encontrados ${items.length} elementos con selector: ${selector}`);
          foundItems = true;
          
          items.each((index, element) => {
            if (index >= (options.maxResults || 30)) return false;
            
            const $el = $(element);
            
            // Extraer información con múltiples selectores
            const title = this.extractText($el, [
              '.headline',
              '.detailansicht a',
              'h3 a',
              '.card-title',
              'a[title]'
            ]);
            
            const price = this.extractText($el, [
              '.rent',
              '.price',
              '.kosten',
              '.angaben .ang_spalte_mitte'
            ]);
            
            const location = this.extractText($el, [
              '.city',
              '.location',
              '.ort',
              '.angaben .ang_spalte_links'
            ]);
            
            const href = this.extractHref($el, [
              'a',
              '.headline a',
              '.detailansicht a'
            ]);
            
            if (title && (price || href)) {
              const property = {
                id: `wg_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                source: 'wg-gesucht',
                title: title,
                price: this.cleanPrice(price),
                location: location || city,
                rooms: this.extractRooms(title + ' ' + $el.text()),
                url: href ? (href.startsWith('http') ? href : `https://www.wg-gesucht.de${href}`) : `https://www.wg-gesucht.de/wg-zimmer-in-${city.toLowerCase()}.html`,
                image: this.getDefaultImage('wg-gesucht'),
                city: city,
                type: type === 'room' ? 'room' : 'apartment',
                description: this.extractText($el, ['.freitext', '.description', '.text']) || `${type === 'room' ? 'Habitación' : 'Apartamento'} en ${city}`
              };
              
              properties.push(property);
            }
          });
          break; // Si encontramos elementos con un selector, no necesitamos probar otros
        }
      }

      if (!foundItems) {
        console.log('⚠️ No se encontraron elementos con los selectores conocidos, intentando scraping genérico');
        // Fallback: buscar cualquier enlace que parezca una propiedad
        $('a').each((index, element) => {
          if (index >= 10) return false; // Limitar fallback
          
          const $el = $(element);
          const href = $el.attr('href');
          const text = $el.text().trim();
          
          if (href && text && (text.includes('€') || text.includes('zimmer') || text.includes('wohnung'))) {
            const property = {
              id: `wg_fallback_${Date.now()}_${index}`,
              source: 'wg-gesucht',
              title: text.substring(0, 100),
              price: this.extractPriceFromText(text),
              location: city,
              rooms: this.extractRooms(text),
              url: href.startsWith('http') ? href : `https://www.wg-gesucht.de${href}`,
              image: this.getDefaultImage('wg-gesucht'),
              city: city,
              type: type === 'room' ? 'room' : 'apartment',
              description: `Propiedad encontrada en WG-Gesucht para ${city}`
            };
            
            properties.push(property);
          }
        });
      }

      console.log(`✅ WG-Gesucht ${type}: ${properties.length} propiedades encontradas`);
      return properties;
      
    } catch (error) {
      console.error(`Error scraping WG-Gesucht ${type}:`, error.message);
      return [];
    }
  }

  // Scraping de Kleinanzeigen
  async scrapeKleinanzeigen(city, options) {
    try {
      // Construir URL más específica
      let searchUrl;
      if (options.type === 'room') {
        searchUrl = `https://www.kleinanzeigen.de/s-zimmer/${city}/c199`;
      } else {
        searchUrl = `https://www.kleinanzeigen.de/s-wohnung-mieten/${city}/c203`;
      }
      
      console.log(`🔍 Scraping Kleinanzeigen: ${searchUrl}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const properties = [];

      // Selectores múltiples para Kleinanzeigen
      const selectors = [
        '.ad-listitem',
        '.aditem',
        '.aditem-main',
        '[data-adid]',
        '.ad-item'
      ];

      let foundItems = false;

      for (const selector of selectors) {
        const items = $(selector);
        if (items.length > 0) {
          console.log(`✅ Encontrados ${items.length} elementos con selector: ${selector}`);
          foundItems = true;
          
          items.each((index, element) => {
            if (index >= (options.maxResults || 30)) return false;
            
            const $el = $(element);
            
            // Extraer información con múltiples selectores
            const title = this.extractText($el, [
              '.text-module-begin a',
              '.aditem-main--middle--title',
              'h2 a',
              '.ad-title',
              'a[title]'
            ]);
            
            const price = this.extractText($el, [
              '.aditem-main--middle--price',
              '.price',
              '.ad-price',
              '.text-module-end'
            ]);
            
            const location = this.extractText($el, [
              '.aditem-main--top--left',
              '.aditem-details',
              '.location',
              '.ad-location'
            ]);
            
            const href = this.extractHref($el, [
              '.text-module-begin a',
              'h2 a',
              'a',
              '.ad-title a'
            ]);
            
            // Extraer imagen
            const image = this.extractImage($el, [
              '.imagebox img',
              '.aditem-image img',
              'img'
            ]);
            
            if (title && (price || href)) {
              const property = {
                id: `ka_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                source: 'kleinanzeigen',
                title: title,
                price: this.cleanPrice(price),
                location: location || city,
                rooms: this.extractRooms(title + ' ' + $el.text()),
                url: href ? (href.startsWith('http') ? href : `https://www.kleinanzeigen.de${href}`) : `https://www.kleinanzeigen.de/s-wohnung-mieten/${city}/c203`,
                image: image || this.getDefaultImage('kleinanzeigen'),
                city: city,
                type: options.type === 'room' ? 'room' : 'apartment',
                description: this.extractText($el, ['.aditem-addon', '.description']) || `${options.type === 'room' ? 'Habitación' : 'Apartamento'} en ${city}`
              };
              
              properties.push(property);
            }
          });
          break;
        }
      }

      if (!foundItems) {
        console.log('⚠️ No se encontraron elementos con los selectores conocidos para Kleinanzeigen');
        // Fallback genérico
        $('a').each((index, element) => {
          if (index >= 10) return false;
          
          const $el = $(element);
          const href = $el.attr('href');
          const text = $el.text().trim();
          
          if (href && text && (text.includes('€') || text.includes('zimmer') || text.includes('wohnung') || text.includes('miete'))) {
            const property = {
              id: `ka_fallback_${Date.now()}_${index}`,
              source: 'kleinanzeigen',
              title: text.substring(0, 100),
              price: this.extractPriceFromText(text),
              location: city,
              rooms: this.extractRooms(text),
              url: href.startsWith('http') ? href : `https://www.kleinanzeigen.de${href}`,
              image: this.getDefaultImage('kleinanzeigen'),
              city: city,
              type: options.type === 'room' ? 'room' : 'apartment',
              description: `Propiedad encontrada en Kleinanzeigen para ${city}`
            };
            
            properties.push(property);
          }
        });
      }

      console.log(`✅ Kleinanzeigen: ${properties.length} propiedades encontradas`);
      return properties;
      
    } catch (error) {
      console.error('Error scraping Kleinanzeigen:', error.message);
      return [];
    }
  }

  // Scraping de ImmobilienScout24
  async scrapeImmobilienScout24(city, options) {
    try {
      // Construir URL para ImmobilienScout24
      let searchUrl;
      if (options.type === 'room') {
        searchUrl = `https://www.immobilienscout24.de/Suche/de/wg-zimmer/${city}`;
      } else {
        searchUrl = `https://www.immobilienscout24.de/Suche/de/wohnung-mieten/${city}`;
      }
      
      console.log(`🔍 Scraping ImmobilienScout24: ${searchUrl}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
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
          console.log(`✅ Encontrados ${items.length} elementos con selector: ${selector}`);
          foundItems = true;
          
          items.each((index, element) => {
            if (index >= (options.maxResults || 30)) return false;
            
            const $el = $(element);
            
            const title = this.extractText($el, [
              '.result-list-entry__brand-title',
              '.result-list-entry__title',
              'h2 a',
              '.title',
              'a[title]'
            ]);
            
            const price = this.extractText($el, [
              '.result-list-entry__primary-criterion',
              '.price',
              '.result-list-entry__price',
              '.criterion__value'
            ]);
            
            const location = this.extractText($el, [
              '.result-list-entry__address',
              '.address',
              '.location'
            ]);
            
            const href = this.extractHref($el, [
              '.result-list-entry__brand-title',
              'h2 a',
              'a'
            ]);
            
            const image = this.extractImage($el, [
              '.result-list-entry__image img',
              '.gallery-image img',
              'img'
            ]);

            if (title && href) {
              const property = {
                id: `is24_${Date.now()}_${index}`,
                source: 'immobilienscout24',
                title: title,
                price: this.cleanPrice(price),
                location: location || city,
                rooms: this.extractRooms(title),
                url: href.startsWith('http') ? href : `https://www.immobilienscout24.de${href}`,
                image: image || this.getDefaultImage('immobilienscout24'),
                city: city,
                type: options.type === 'room' ? 'room' : 'apartment',
                description: `Propiedad encontrada en ImmobilienScout24 para ${city}`
              };
              
              properties.push(property);
            }
          });
          break;
        }
      }

      console.log(`✅ ImmobilienScout24: ${properties.length} propiedades encontradas`);
      return properties;
      
    } catch (error) {
      console.error('Error scraping ImmobilienScout24:', error.message);
      return [];
    }
  }

  // Scraping de Immowelt
  async scrapeImmowelt(city, options) {
    try {
      // Construir URL para Immowelt
      let searchUrl;
      if (options.type === 'room') {
        searchUrl = `https://www.immowelt.de/liste/wg-zimmer/${city}`;
      } else {
        searchUrl = `https://www.immowelt.de/liste/wohnung-mieten/${city}`;
      }
      
      console.log(`🔍 Scraping Immowelt: ${searchUrl}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const properties = [];

      // Selectores para Immowelt
      const selectors = [
        '.listitem',
        '.listitem_wrap',
        '[data-test="result-item"]',
        '.result-item',
        '.estate-item'
      ];

      let foundItems = false;

      for (const selector of selectors) {
        const items = $(selector);
        if (items.length > 0) {
          console.log(`✅ Encontrados ${items.length} elementos con selector: ${selector}`);
          foundItems = true;
          
          items.each((index, element) => {
            if (index >= (options.maxResults || 30)) return false;
            
            const $el = $(element);
            
            const title = this.extractText($el, [
              '.listitem_headline',
              '.headline',
              'h2 a',
              '.title',
              'a[title]'
            ]);
            
            const price = this.extractText($el, [
              '.listitem_price',
              '.price',
              '.hardfact_price'
            ]);
            
            const location = this.extractText($el, [
              '.listitem_address',
              '.address',
              '.location'
            ]);
            
            const href = this.extractHref($el, [
              '.listitem_headline a',
              'h2 a',
              'a'
            ]);
            
            const image = this.extractImage($el, [
              '.listitem_image img',
              '.estate-image img',
              'img'
            ]);

            if (title && href) {
              const property = {
                id: `immowelt_${Date.now()}_${index}`,
                source: 'immowelt',
                title: title,
                price: this.cleanPrice(price),
                location: location || city,
                rooms: this.extractRooms(title),
                url: href.startsWith('http') ? href : `https://www.immowelt.de${href}`,
                image: image || this.getDefaultImage('immowelt'),
                city: city,
                type: options.type === 'room' ? 'room' : 'apartment',
                description: `Propiedad encontrada en Immowelt para ${city}`
              };
              
              properties.push(property);
            }
          });
          break;
        }
      }

      console.log(`✅ Immowelt: ${properties.length} propiedades encontradas`);
      return properties;
      
    } catch (error) {
      console.error('Error scraping Immowelt:', error.message);
      return [];
    }
  }

  // Scraping de Immonet
  async scrapeImmonet(city, options) {
    try {
      // Construir URL para Immonet
      let searchUrl;
      if (options.type === 'room') {
        searchUrl = `https://www.immonet.de/immobiliensuche/sel.do?suchart=1&objektart=1&city=${city}`;
      } else {
        searchUrl = `https://www.immonet.de/immobiliensuche/sel.do?suchart=1&objektart=1&city=${city}`;
      }
      
      console.log(`🔍 Scraping Immonet: ${searchUrl}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const properties = [];

      // Selectores para Immonet
      const selectors = [
        '.item',
        '.search-item',
        '.result-item',
        '.property-item',
        '[data-item]'
      ];

      let foundItems = false;

      for (const selector of selectors) {
        const items = $(selector);
        if (items.length > 0) {
          console.log(`✅ Encontrados ${items.length} elementos con selector: ${selector}`);
          foundItems = true;
          
          items.each((index, element) => {
            if (index >= (options.maxResults || 30)) return false;
            
            const $el = $(element);
            
            const title = this.extractText($el, [
              '.item-title',
              '.title',
              'h2 a',
              'h3 a',
              'a[title]'
            ]);
            
            const price = this.extractText($el, [
              '.item-price',
              '.price',
              '.rent-price'
            ]);
            
            const location = this.extractText($el, [
              '.item-address',
              '.address',
              '.location'
            ]);
            
            const href = this.extractHref($el, [
              '.item-title a',
              'h2 a',
              'h3 a',
              'a'
            ]);
            
            const image = this.extractImage($el, [
              '.item-image img',
              '.property-image img',
              'img'
            ]);

            if (title && href) {
              const property = {
                id: `immonet_${Date.now()}_${index}`,
                source: 'immonet',
                title: title,
                price: this.cleanPrice(price),
                location: location || city,
                rooms: this.extractRooms(title),
                url: href.startsWith('http') ? href : `https://www.immonet.de${href}`,
                image: image || this.getDefaultImage('immonet'),
                city: city,
                type: options.type === 'room' ? 'room' : 'apartment',
                description: `Propiedad encontrada en Immonet para ${city}`
              };
              
              properties.push(property);
            }
          });
          break;
        }
      }

      console.log(`✅ Immonet: ${properties.length} propiedades encontradas`);
      return properties;
      
    } catch (error) {
      console.error('Error scraping Immonet:', error.message);
      return [];
    }
  }

  // Métodos auxiliares mejorados
  extractText($el, selectors) {
    for (const selector of selectors) {
      const text = $el.find(selector).first().text().trim();
      if (text) return text;
    }
    return '';
  }

  extractHref($el, selectors) {
    for (const selector of selectors) {
      const href = $el.find(selector).first().attr('href');
      if (href) return href;
    }
    return '';
  }

  extractImage($el, selectors) {
    for (const selector of selectors) {
      const src = $el.find(selector).first().attr('src');
      if (src) return src;
    }
    return null;
  }

  cleanPrice(priceText) {
    if (!priceText) return '';
    
    // Extraer números y símbolo de euro
    const match = priceText.match(/(\d+(?:[.,]\d+)?)\s*€?/);
    if (match) {
      return `${match[1]} €`;
    }
    
    return priceText.trim();
  }

  extractPriceFromText(text) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*€/);
    return match ? `${match[1]} €` : '';
  }

  normalizeWGProperty(item) {
    return {
      id: `wg_apify_${item.id || Date.now()}`,
      source: 'wg-gesucht',
      title: item.title,
      price: item.rent,
      location: item.address,
      rooms: item.rooms,
      url: item.url,
      image: item.images?.[0] || this.getDefaultImage('wg-gesucht'),
      city: item.city,
      type: item.propertyType || 'apartment'
    };
  }

  extractRooms(text) {
    if (!text) return 1;
    
    // Buscar patrones como "3 Zimmer", "2-Zimmer", "1 zi", etc.
    const patterns = [
      /(\d+)\s*[-\s]*zimmer/i,
      /(\d+)\s*[-\s]*zi\b/i,
      /(\d+)\s*[-\s]*room/i,
      /(\d+)\s*[-\s]*bed/i
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

  determinePropertyType(title) {
    if (!title) return 'apartment';
    
    const titleLower = title.toLowerCase();
    if (titleLower.includes('zimmer') && !titleLower.includes('wohnung')) return 'room';
    if (titleLower.includes('wg') || titleLower.includes('mitbewohner')) return 'room';
    if (titleLower.includes('haus')) return 'house';
    return 'apartment';
  }

  getDefaultImage(source) {
    const images = {
      'wg-gesucht': 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=250&fit=crop',
      'kleinanzeigen': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=250&fit=crop',
      'immobilienscout24': 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=250&fit=crop',
      'immowelt': 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=250&fit=crop',
      'immonet': 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=400&h=250&fit=crop'
    };
    return images[source] || 'https://via.placeholder.com/400x250?text=Sin+Imagen';
  }

  async savePropertiesToDB(properties) {
    try {
      for (const property of properties) {
        await database.insertProperty(property);
      }
      console.log(`💾 ${properties.length} propiedades guardadas en BD`);
    } catch (error) {
      console.error('Error guardando propiedades:', error);
    }
  }

  async getExistingProperties(city, options) {
    try {
      return await database.searchProperties({
        city,
        type: options.type,
        rooms: options.rooms,
        budget: options.budget
      });
    } catch (error) {
      console.error('Error obteniendo propiedades existentes:', error);
      return [];
    }
  }

  // Verificar si necesita actualizar datos
  shouldRefreshData() {
    if (!this.lastScrapeTime) return true;
    
    const hoursSinceLastScrape = (Date.now() - this.lastScrapeTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastScrape >= 6; // Actualizar cada 6 horas
  }

  // Obtener estadísticas del scraper
  getStats() {
    return {
      lastScrapeTime: this.lastScrapeTime,
      isActive: this.isScrapingActive,
      apifyConfigured: !!this.apify
    };
  }
}

module.exports = new PropertyScraper();