'use client';

import React, { useRef } from 'react';
import { ShoppingCart, Trash2, ShoppingBag, MinusCircle, PlusCircle } from 'lucide-react';
import { useOrder } from '@/app/lib/hooks/useOrder';
import { menuItems } from '@/app/lib/data/menu-items';

/**
 * Componente que muestra los detalles del pedido actual
 */
export const OrderDetails = () => {
  const { order, removeItem, updateItemQuantity, clearOrder } = useOrder();
  const orderRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Función para encontrar la información completa del producto
  const getProductDetails = (productId: string) => {
    return menuItems.find(item => item.id === productId);
  };

  // Animación cuando se actualiza el pedido
  const animateOrderUpdate = () => {
    if (orderRef.current) {
      orderRef.current.classList.add('order-updated');
      setTimeout(() => {
        if (orderRef.current) {
          orderRef.current.classList.remove('order-updated');
        }
      }, 1000);
    }
  };

  return (
    <div ref={orderRef} className="bg-white rounded-lg shadow-lg p-5 h-full flex flex-col animate-fade-in">
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-t-lg -mt-5 -mx-5 p-4 mb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <ShoppingCart className="mr-2 text-2xl" /> 
          Detalles del Pedido
        </h2>
      </div>
      
      {order.items.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
          <ShoppingCart className="text-6xl mb-3 text-amber-300 animate-bounce-slow" />
          <p className="text-lg font-medium">Tu pedido está vacío</p>
          <p className="text-sm mt-2 text-center">Los productos que menciones al agente aparecerán aquí</p>
        </div>
      ) : (
        <>
          <div className="flex-grow overflow-auto order-items-container">
            {order.items.map((item, index) => {
              const productDetails = getProductDetails(item.id);
              return (
                <div key={index} className="mb-3 p-3 border border-gray-100 rounded-lg shadow-sm hover-float product-card bg-white">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{productDetails?.imageUrl || '🍽️'}</span>
                      <div>
                        <h3 className="font-medium text-amber-900">{item.name}</h3>
                        <p className="text-xs text-gray-500">{productDetails?.description}</p>
                        {item.specialInstructions && (
                          <p className="text-xs italic text-amber-600 mt-1">
                            Nota: {item.specialInstructions}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-700">
                        {formatCurrency(item.quantity * item.price)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × {formatCurrency(item.price)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Controles de cantidad */}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center">
                      <button 
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        className="text-amber-500 hover:text-amber-700 transition-colors"
                        aria-label="Disminuir cantidad"
                      >
                        <MinusCircle size={18} />
                      </button>
                      <span className="mx-2 font-medium text-gray-700">{item.quantity}</span>
                      <button 
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        className="text-amber-500 hover:text-amber-700 transition-colors"
                        aria-label="Aumentar cantidad"
                      >
                        <PlusCircle size={18} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Eliminar producto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium text-gray-800">Total:</span>
              <span className="font-bold text-xl text-amber-700">{formatCurrency(order.total)}</span>
            </div>
            
            <div className="flex justify-between">
              <button 
                onClick={clearOrder}
                className="btn px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Limpiar pedido
              </button>
              
              <button 
                className="btn ripple bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md shadow-md transition-all flex items-center"
              >
                <ShoppingBag className="mr-2" /> 
                Proceder al pago
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrderDetails; 