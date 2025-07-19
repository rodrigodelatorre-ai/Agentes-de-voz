'use client';

import React, { useState, useEffect } from 'react';
import { analyticsService, OrderAnalytics } from '@/app/lib/services/analyticsService';
import { performanceMonitor, PerformanceReport } from '@/app/lib/performance/performanceMonitor';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, DollarSign, ShoppingBag, AlertCircle, Download, RefreshCw } from 'lucide-react';

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
}

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'];

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null);
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const analyticsData = analyticsService.getAnalytics(timeRange);
      const performanceData = performanceMonitor.generateReport();
      
      setAnalytics(analyticsData);
      setPerformanceReport(performanceData);
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    const analyticsData = analyticsService.exportData();
    const performanceData = performanceMonitor.exportMetrics();
    
    const combinedData = {
      analytics: JSON.parse(analyticsData),
      performance: JSON.parse(performanceData),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restaurant-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading || !analytics || !performanceReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-amber-600 font-medium">Cargando dashboard...</span>
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      title: 'Ingresos Totales',
      value: formatCurrency(analytics.totalRevenue),
      icon: DollarSign,
      color: 'bg-green-500',
      change: '+12.5%'
    },
    {
      title: 'Pedidos Totales',
      value: analytics.totalOrders.toString(),
      icon: ShoppingBag,
      color: 'bg-blue-500',
      change: '+8.2%'
    },
    {
      title: 'Valor Promedio',
      value: formatCurrency(analytics.averageOrderValue),
      icon: TrendingUp,
      color: 'bg-amber-500',
      change: '+5.1%'
    },
    {
      title: 'Conversión',
      value: formatPercentage(analytics.conversionRate),
      icon: Users,
      color: 'bg-purple-500',
      change: '+3.7%'
    }
  ];

  const productSalesData = analytics.popularProducts.map(product => ({
    name: product.productName,
    ventas: product.totalSold,
    ingresos: product.revenue
  }));

  const performanceData = [
    { name: 'Carga de Página', tiempo: performanceReport.pageLoadTime },
    { name: 'Latencia de Voz', tiempo: performanceReport.voiceLatency },
    { name: 'Proc. Pedidos', tiempo: performanceReport.orderProcessingTime }
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-600">Taquería &quot;El Buen Sabor&quot;</p>
        </div>
        
        <div className="flex space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value) as 7 | 30)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
          </select>
          
          <button
            onClick={handleExportData}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Datos</span>
          </button>
          
          <button
            onClick={loadDashboardData}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-green-600">{stat.change}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos Populares */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos Más Vendidos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productSalesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="ventas" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Métricas de Performance */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance del Sistema</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}ms`, 'Tiempo']} />
              <Bar dataKey="tiempo" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Voice Metrics & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Métricas de Voz */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Interacciones de Voz</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sesiones Totales</span>
              <span className="font-semibold">{analytics.voiceInteractionMetrics.totalSessions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pedidos Exitosos</span>
              <span className="font-semibold">{analytics.voiceInteractionMetrics.successfulOrders}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Duración Promedio</span>
              <span className="font-semibold">{analytics.voiceInteractionMetrics.averageSessionDuration.toFixed(1)}s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tasa de Error</span>
              <span className={`font-semibold ${
                analytics.voiceInteractionMetrics.errorRate > 10 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatPercentage(analytics.voiceInteractionMetrics.errorRate)}
              </span>
            </div>
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-amber-600" />
            Recomendaciones
          </h3>
          <div className="space-y-3">
            {performanceReport.recommendations.map((recommendation, index) => (
              <div key={index} className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                <p className="text-sm text-amber-800">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}