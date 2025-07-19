/**
 * Monitor de performance para la aplicación del restaurante
 * Rastrea métricas de rendimiento, tiempos de carga y optimizaciones
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: any;
}

export interface PerformanceReport {
  pageLoadTime: number;
  voiceLatency: number;
  orderProcessingTime: number;
  memoryUsage: number;
  jsHeapSize: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  recommendations: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000;

  constructor() {
    this.initializePerformanceObserver();
  }

  /**
   * Inicia el monitoreo de performance del navegador
   */
  private initializePerformanceObserver() {
    if (typeof window === 'undefined') return;

    // Observar métricas de navegación
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordMetric(`web_vital_${entry.name}`, entry.value || 0, {
            entryType: entry.entryType
          });
        });
      });

      try {
        observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
      } catch (error) {
        console.warn('[PerformanceMonitor] Performance Observer no soportado:', error);
      }
    }

    // Métricas de memoria si están disponibles
    this.trackMemoryUsage();
  }

  /**
   * Registra una métrica de performance personalizada
   */
  recordMetric(name: string, value: number, metadata?: any) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      metadata
    };

    this.metrics.push(metric);

    // Mantener solo las últimas métricas para evitar problemas de memoria
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    console.log(`[Performance] ${name}: ${value}ms`, metadata);
  }

  /**
   * Mide el tiempo de una operación específica
   */
  async measureOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`${name}_error`, duration, { error: error.message });
      throw error;
    }
  }

  /**
   * Rastrea el uso de memoria
   */
  private trackMemoryUsage() {
    if (typeof window === 'undefined') return;

    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        this.recordMetric('memory_used', memory.usedJSHeapSize / 1024 / 1024); // MB
        this.recordMetric('memory_total', memory.totalJSHeapSize / 1024 / 1024); // MB
        this.recordMetric('memory_limit', memory.jsHeapSizeLimit / 1024 / 1024); // MB
      }
    };

    // Verificar memoria cada 30 segundos
    setInterval(checkMemory, 30000);
    checkMemory(); // Verificación inicial
  }

  /**
   * Genera un reporte completo de performance
   */
  generateReport(): PerformanceReport {
    const recentMetrics = this.getRecentMetrics(300000); // Últimos 5 minutos
    
    const report: PerformanceReport = {
      pageLoadTime: this.getAverageMetric('page_load', recentMetrics),
      voiceLatency: this.getAverageMetric('voice_latency', recentMetrics),
      orderProcessingTime: this.getAverageMetric('order_processing', recentMetrics),
      memoryUsage: this.getLatestMetric('memory_used', recentMetrics),
      jsHeapSize: this.getLatestMetric('memory_total', recentMetrics),
      domContentLoaded: this.getLatestMetric('web_vital_DOMContentLoaded', recentMetrics),
      firstContentfulPaint: this.getLatestMetric('web_vital_first-contentful-paint', recentMetrics),
      recommendations: this.generateRecommendations(recentMetrics)
    };

    return report;
  }

  /**
   * Obtiene métricas recientes
   */
  private getRecentMetrics(timeWindowMs: number): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Calcula el promedio de una métrica específica
   */
  private getAverageMetric(name: string, metrics: PerformanceMetric[]): number {
    const relevantMetrics = metrics.filter(m => m.name.includes(name));
    if (relevantMetrics.length === 0) return 0;
    
    const sum = relevantMetrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / relevantMetrics.length;
  }

  /**
   * Obtiene el valor más reciente de una métrica
   */
  private getLatestMetric(name: string, metrics: PerformanceMetric[]): number {
    const relevantMetrics = metrics.filter(m => m.name === name);
    if (relevantMetrics.length === 0) return 0;
    
    return relevantMetrics[relevantMetrics.length - 1].value;
  }

  /**
   * Genera recomendaciones basadas en las métricas
   */
  private generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];
    
    const memoryUsage = this.getLatestMetric('memory_used', metrics);
    const pageLoadTime = this.getAverageMetric('page_load', metrics);
    const voiceLatency = this.getAverageMetric('voice_latency', metrics);

    if (memoryUsage > 50) {
      recommendations.push('Alto uso de memoria detectado. Considera optimizar componentes o limpiar listeners.');
    }

    if (pageLoadTime > 3000) {
      recommendations.push('Tiempo de carga lento. Considera lazy loading para componentes no críticos.');
    }

    if (voiceLatency > 2000) {
      recommendations.push('Latencia alta en interacciones de voz. Verifica la conexión o optimiza el API de Ultravox.');
    }

    const errorMetrics = metrics.filter(m => m.name.includes('_error'));
    if (errorMetrics.length > 5) {
      recommendations.push('Múltiples errores detectados. Revisa logs para identificar problemas recurrentes.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance óptima - sin problemas detectados.');
    }

    return recommendations;
  }

  /**
   * Exporta métricas para análisis externo
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      report: this.generateReport(),
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Limpia métricas antiguas
   */
  clearOldMetrics(olderThanHours: number = 24) {
    const cutoff = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(metric => metric.timestamp >= cutoff);
    
    console.log(`[PerformanceMonitor] Limpiadas ${initialCount - this.metrics.length} métricas antiguas`);
  }
}

// Instancia singleton
export const performanceMonitor = new PerformanceMonitor();

// Funciones de utilidad para uso en componentes
export const recordPerformanceMetric = (name: string, value: number, metadata?: any) => {
  performanceMonitor.recordMetric(name, value, metadata);
};

export const measurePerformance = <T>(name: string, operation: () => Promise<T>): Promise<T> => {
  return performanceMonitor.measureOperation(name, operation);
};