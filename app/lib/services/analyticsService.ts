/**
 * Servicio de analíticas para el restaurante
 * Rastrea métricas de pedidos, productos populares y performance del agente de voz
 */

export interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  popularProducts: ProductSales[];
  conversionRate: number;
  voiceInteractionMetrics: VoiceMetrics;
}

export interface ProductSales {
  productId: string;
  productName: string;
  totalSold: number;
  revenue: number;
  category: string;
}

export interface VoiceMetrics {
  totalSessions: number;
  successfulOrders: number;
  averageSessionDuration: number;
  errorRate: number;
}

export interface UserInteractionEvent {
  type: 'voice_start' | 'voice_end' | 'product_add' | 'order_complete' | 'error';
  timestamp: Date;
  data?: any;
}

class AnalyticsService {
  private events: UserInteractionEvent[] = [];
  private readonly STORAGE_KEY = 'restaurant_analytics';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Rastrea un evento de interacción del usuario
   */
  trackEvent(type: UserInteractionEvent['type'], data?: any) {
    const event: UserInteractionEvent = {
      type,
      timestamp: new Date(),
      data
    };

    this.events.push(event);
    this.saveToStorage();

    console.log(`[Analytics] Evento rastreado: ${type}`, data);
  }

  /**
   * Obtiene analíticas del período especificado
   */
  getAnalytics(daysBack: number = 7): OrderAnalytics {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const recentEvents = this.events.filter(event => event.timestamp >= cutoffDate);
    
    const completedOrders = recentEvents.filter(event => event.type === 'order_complete');
    const voiceSessions = recentEvents.filter(event => event.type === 'voice_start');
    const errors = recentEvents.filter(event => event.type === 'error');

    const totalRevenue = completedOrders.reduce((sum, event) => 
      sum + (event.data?.total || 0), 0);

    const productSales = this.calculateProductSales(completedOrders);

    return {
      totalOrders: completedOrders.length,
      totalRevenue,
      averageOrderValue: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
      popularProducts: productSales,
      conversionRate: voiceSessions.length > 0 ? 
        (completedOrders.length / voiceSessions.length) * 100 : 0,
      voiceInteractionMetrics: {
        totalSessions: voiceSessions.length,
        successfulOrders: completedOrders.length,
        averageSessionDuration: this.calculateAverageSessionDuration(recentEvents),
        errorRate: voiceSessions.length > 0 ? 
          (errors.length / voiceSessions.length) * 100 : 0
      }
    };
  }

  /**
   * Calcula las ventas por producto
   */
  private calculateProductSales(orderEvents: UserInteractionEvent[]): ProductSales[] {
    const productMap = new Map<string, ProductSales>();

    orderEvents.forEach(event => {
      if (event.data?.items) {
        event.data.items.forEach((item: any) => {
          const existing = productMap.get(item.id) || {
            productId: item.id,
            productName: item.name,
            totalSold: 0,
            revenue: 0,
            category: item.categoryId || 'unknown'
          };

          existing.totalSold += item.quantity;
          existing.revenue += item.quantity * item.price;
          productMap.set(item.id, existing);
        });
      }
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 10); // Top 10 productos
  }

  /**
   * Calcula la duración promedio de las sesiones
   */
  private calculateAverageSessionDuration(events: UserInteractionEvent[]): number {
    const sessions: { start: Date; end?: Date }[] = [];
    let currentSession: { start: Date; end?: Date } | null = null;

    events.forEach(event => {
      if (event.type === 'voice_start') {
        currentSession = { start: event.timestamp };
        sessions.push(currentSession);
      } else if (event.type === 'voice_end' && currentSession) {
        currentSession.end = event.timestamp;
        currentSession = null;
      }
    });

    const completedSessions = sessions.filter(session => session.end);
    if (completedSessions.length === 0) return 0;

    const totalDuration = completedSessions.reduce((sum, session) => {
      const duration = session.end!.getTime() - session.start.getTime();
      return sum + duration;
    }, 0);

    return totalDuration / completedSessions.length / 1000; // en segundos
  }

  /**
   * Exporta datos de analíticas para reportes
   */
  exportData(): string {
    return JSON.stringify({
      events: this.events,
      analytics: this.getAnalytics(),
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Limpia datos antiguos (más de 30 días)
   */
  cleanOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const initialCount = this.events.length;
    this.events = this.events.filter(event => event.timestamp >= cutoffDate);
    
    this.saveToStorage();
    console.log(`[Analytics] Limpiados ${initialCount - this.events.length} eventos antiguos`);
  }

  /**
   * Guarda los datos en localStorage
   */
  private saveToStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
      } catch (error) {
        console.error('[Analytics] Error al guardar en localStorage:', error);
      }
    }
  }

  /**
   * Carga los datos desde localStorage
   */
  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.events = parsed.map((event: any) => ({
            ...event,
            timestamp: new Date(event.timestamp)
          }));
        }
      } catch (error) {
        console.error('[Analytics] Error al cargar desde localStorage:', error);
        this.events = [];
      }
    }
  }
}

// Instancia singleton
export const analyticsService = new AnalyticsService();

// Función de utilidad para uso fácil en componentes
export const trackEvent = (type: UserInteractionEvent['type'], data?: any) => {
  analyticsService.trackEvent(type, data);
};