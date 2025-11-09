const cron = require('node-cron');
const scraper = require('./scraper');

class DataScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Iniciar el programador automático
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler ya está ejecutándose');
      return;
    }

    console.log('🕒 Iniciando scheduler de datos...');
    
    // Programar scraping cada 6 horas
    const scrapingJob = cron.schedule('0 */6 * * *', async () => {
      console.log('🔄 Ejecutando scraping programado...');
      await this.performScheduledScraping();
    }, {
      scheduled: false,
      timezone: 'Europe/Berlin'
    });

    // Programar limpieza de caché cada 24 horas
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Ejecutando limpieza programada...');
      await this.performScheduledCleanup();
    }, {
      scheduled: false,
      timezone: 'Europe/Berlin'
    });

    // Programar scraping inicial después de 5 minutos
    const initialJob = cron.schedule('*/5 * * * *', async () => {
      console.log('🚀 Ejecutando scraping inicial...');
      await this.performInitialScraping();
      // Detener este job después de la primera ejecución
      initialJob.stop();
      this.jobs.delete('initial');
    }, {
      scheduled: false,
      timezone: 'Europe/Berlin'
    });

    // Guardar y iniciar jobs
    this.jobs.set('scraping', scrapingJob);
    this.jobs.set('cleanup', cleanupJob);
    this.jobs.set('initial', initialJob);

    // Iniciar todos los jobs
    scrapingJob.start();
    cleanupJob.start();
    initialJob.start();

    this.isRunning = true;
    console.log('✅ Scheduler iniciado correctamente');
    console.log('📅 Próximas ejecuciones:');
    console.log('   - Scraping inicial: En 5 minutos');
    console.log('   - Scraping regular: Cada 6 horas');
    console.log('   - Limpieza: Diariamente a las 2:00 AM');
  }

  // Detener el programador
  stop() {
    console.log('🛑 Deteniendo scheduler...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`   - Job '${name}' detenido`);
    });
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Scheduler detenido');
  }

  // Scraping programado para ciudades principales
  async performScheduledScraping() {
    const mainCities = ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt'];
    
    for (const city of mainCities) {
      try {
        console.log(`🏙️ Scraping programado para ${city}...`);
        
        const results = await scraper.scrapeProperties(city, {
          maxResults: 50,
          type: 'all'
        });
        
        console.log(`✅ ${city}: ${results.length} propiedades actualizadas`);
        
        // Esperar 30 segundos entre ciudades para no sobrecargar
        await this.sleep(30000);
        
      } catch (error) {
        console.error(`❌ Error scraping ${city}:`, error.message);
      }
    }
    
    console.log('🎉 Scraping programado completado');
  }

  // Scraping inicial más ligero
  async performInitialScraping() {
    try {
      console.log('🚀 Ejecutando scraping inicial para Berlin...');
      
      const results = await scraper.scrapeProperties('Berlin', {
        maxResults: 20,
        type: 'all'
      });
      
      console.log(`✅ Scraping inicial completado: ${results.length} propiedades`);
      
    } catch (error) {
      console.error('❌ Error en scraping inicial:', error.message);
    }
  }

  // Limpieza programada
  async performScheduledCleanup() {
    try {
      const database = require('../api/database');
      
      // Limpiar caché expirado
      await database.cleanExpiredCache();
      
      // Limpiar propiedades muy antiguas (más de 7 días)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      // Aquí podrías implementar limpieza de propiedades antiguas
      
      console.log('✅ Limpieza programada completada');
      
    } catch (error) {
      console.error('❌ Error en limpieza programada:', error.message);
    }
  }

  // Ejecutar scraping manual para una ciudad específica
  async manualScraping(city, options = {}) {
    try {
      console.log(`🔍 Scraping manual iniciado para ${city}...`);
      
      const results = await scraper.scrapeProperties(city, {
        maxResults: options.maxResults || 30,
        type: options.type || 'all'
      });
      
      console.log(`✅ Scraping manual completado: ${results.length} propiedades`);
      return results;
      
    } catch (error) {
      console.error(`❌ Error en scraping manual para ${city}:`, error.message);
      throw error;
    }
  }

  // Obtener estado del scheduler
  getStatus() {
    const jobsStatus = {};
    
    this.jobs.forEach((job, name) => {
      jobsStatus[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });

    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      jobs: jobsStatus,
      scraperStats: scraper.getStats()
    };
  }

  // Programar scraping para una ciudad específica
  scheduleCustomScraping(city, cronExpression) {
    const jobName = `custom_${city.toLowerCase()}`;
    
    if (this.jobs.has(jobName)) {
      console.log(`⚠️ Ya existe un job programado para ${city}`);
      return false;
    }

    const customJob = cron.schedule(cronExpression, async () => {
      console.log(`🔄 Scraping programado personalizado para ${city}...`);
      await this.manualScraping(city);
    }, {
      scheduled: true,
      timezone: 'Europe/Berlin'
    });

    this.jobs.set(jobName, customJob);
    console.log(`✅ Job personalizado creado para ${city}: ${cronExpression}`);
    return true;
  }

  // Cancelar job personalizado
  cancelCustomJob(city) {
    const jobName = `custom_${city.toLowerCase()}`;
    
    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName).stop();
      this.jobs.delete(jobName);
      console.log(`✅ Job personalizado cancelado para ${city}`);
      return true;
    }
    
    return false;
  }

  // Utilidad para esperar
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new DataScheduler();