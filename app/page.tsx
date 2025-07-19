'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation'; 
import { startCall, endCall } from '@/lib/callFunctions'
import { CallConfig, SelectedTool, OrderItem } from '@/lib/types'
import demoConfig from '@/app/demo-config';
import { Role, UltravoxExperimentalMessageEvent, UltravoxSessionStatus } from 'ultravox-client';
import { Transcript as TranscriptType } from 'ultravox-client';
import BorderedImage from '@/app/components/BorderedImage';
import CallStatus from '@/app/components/CallStatus';
import DebugMessages from '@/app/components/DebugMessages';
import MicToggleButton from '@/app/components/MicToggleButton';
import OrderDetails from '@/app/components/OrderDetails';
import MenuTaqueria from '@/app/components/MenuTaqueria';
import { PhoneOffIcon, MenuIcon, BookUserIcon, MessageSquareTextIcon } from 'lucide-react';
import OrderAnalytics from './components/order/OrderAnalytics';
import OrderSummary from './components/OrderSummary';
import VoiceCommands from './components/VoiceCommands';

type SearchParamsProps = {
  showMuteSpeakerButton: boolean;
  modelOverride: string | undefined;
  showDebugMessages: boolean;
  showUserTranscripts: boolean;
};

type SearchParamsHandlerProps = {
  children: (props: SearchParamsProps) => React.ReactNode;
};

function SearchParamsHandler({ children }: SearchParamsHandlerProps) {
  // Process query params to see if we want to change the behavior for showing speaker mute button or changing the model
  const searchParams = useSearchParams();
  const showMuteSpeakerButton = searchParams.get('showSpeakerMute') === 'true';
  const showDebugMessages = searchParams.get('showDebugMessages') === 'true';
  const showUserTranscripts = searchParams.get('showUserTranscripts') === 'true';
  let modelOverride: string | undefined;
  
  if (searchParams.get('model')) {
    modelOverride = "fixie-ai/" + searchParams.get('model');
  }

  return children({ showMuteSpeakerButton, modelOverride, showDebugMessages, showUserTranscripts });
}

// Componente simple para mostrar la transcripción
function TranscriptView({ transcripts }: { transcripts: TranscriptType[] | null }) {
  return (
    <div className="p-4 overflow-y-auto flex-grow bg-amber-50 rounded-lg shadow-inner">
      <h2 className="text-xl font-bold mb-3 text-amber-900 border-b-2 border-amber-200 pb-2 flex items-center">
        <MessageSquareTextIcon className="w-5 h-5 mr-2 text-amber-600" />
        Conversación
      </h2>
      <div className="space-y-3">
        {transcripts && transcripts.length > 0 ? (
          transcripts.map((transcript, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg transition-all duration-300 ${
                transcript.speaker === Role.USER 
                  ? 'bg-green-100 border-l-4 border-green-600 ml-8 hover:bg-green-50' 
                  : 'bg-amber-100 border-l-4 border-amber-600 mr-8 hover:bg-amber-50'
              } shadow-sm`}
              style={{
                animationDelay: `${index * 0.05}s`,
                animation: 'fadeIn 0.3s ease-out',
              }}
            >
              <span className="font-bold text-amber-900">
                {transcript.speaker === Role.USER ? '👤 Tú: ' : '🌮 Asistente: '}
              </span>
              <span className="text-amber-950">{transcript.text}</span>
            </div>
          ))
        ) : (
          <div className="text-center py-8 bg-white/50 rounded-lg border border-amber-100 shadow-sm">
            <p className="text-amber-800 font-medium">Inicia una conversación con nuestro asistente</p>
            <p className="text-sm text-amber-600 mt-2">Pregunta por nuestras especialidades o haz tu pedido</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente para mostrar el estado del agente con estilo mexicano
function AgentStatusView({ status }: { status: string }) {
  return (
    <div className="p-4 border-t-2 border-amber-300 bg-amber-50 rounded-b-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${status === 'off' ? 'bg-red-600' : 'bg-green-600'} animate-pulse`}></div>
          <span className="text-sm font-medium text-amber-900">
            {status === 'off' 
              ? 'Asistente desconectado' 
              : status === 'speaking' 
                ? 'Asistente hablando...' 
                : status === 'listening' 
                  ? 'Asistente escuchando...' 
                  : `Estado: ${status}`}
          </span>
        </div>
        <div className="text-xs text-amber-700">
          {status !== 'off' && '¡Estamos para servirte!'}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [agentStatus, setAgentStatus] = useState<"idle" | "thinking" | "speaking" | "off">("idle");
  const [callTranscript, setCallTranscript] = useState<TranscriptType[] | null>([]);
  const [callDebugMessages, setCallDebugMessages] = useState<UltravoxExperimentalMessageEvent[]>([]);
  const [customerProfileKey, setCustomerProfileKey] = useState<string | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingStartTimeRef = useRef<number | null>(null);
  const MAX_THINKING_TIME = 15000; // 15 segundos máximo en estado "thinking"
  
  // Nuevo estado para el manejo de la vista activa
  const [activeView, setActiveView] = useState<'chat' | 'menu'>('chat');
  // Nuevo estado para la categoría activa del menú
  const [activeMenuCategory, setActiveMenuCategory] = useState<'tacos' | 'bebidas' | 'extras'>('tacos');
  // Estado para controlar las animaciones de transición entre vistas
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [orderCompletedData, setOrderCompletedData] = useState<any>(null);
  
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [callTranscript]);

  useEffect(() => {
    // Monitorear el estado "thinking" y recuperarse si dura demasiado tiempo
    if (agentStatus === "thinking") {
      console.log("[ThinkingMonitor] Agente en estado thinking, iniciando temporizador de seguridad");
      thinkingStartTimeRef.current = Date.now();
      
      // Limpiar cualquier timeout anterior
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      
      // Establecer un nuevo timeout
      thinkingTimeoutRef.current = setTimeout(() => {
        console.warn("[ThinkingMonitor] ¡Alerta! El agente lleva demasiado tiempo en estado thinking");
        
        // Si seguimos en estado thinking después del timeout, intentar recuperar
        if (agentStatus === "thinking") {
          console.error("[ThinkingMonitor] Detectado bloqueo en estado thinking, ejecutando recuperación");
          
          // 1. Actualizar el estado a idle para permitir nuevas interacciones
          setAgentStatus("idle");
          
          // 2. Si hay una sesión activa, intentar reiniciarla o finalizarla
          if (isCallActive) {
            try {
              console.log("[ThinkingMonitor] Intentando finalizar la sesión bloqueada");
              handleEndCallButtonClick()
                .then(() => {
                  console.log("[ThinkingMonitor] Sesión finalizada con éxito");
                })
                .catch(error => {
                  console.error("[ThinkingMonitor] Error al finalizar la sesión:", error);
                  setAgentStatus("off");
                  setIsCallActive(false);
                  window.alert('Hubo un problema con el asistente. Por favor, inténtalo de nuevo.');
                });
            } catch (e) {
              console.error("[ThinkingMonitor] Error al finalizar la sesión:", e);
            }
          }
          
          // 3. Mostrar un mensaje al usuario (opcional: podría implementarse con un toast o alerta)
          console.log("[ThinkingMonitor] Sesión recuperada después de un bloqueo");
        }
      }, MAX_THINKING_TIME);
      
      // Limpiar el timeout cuando cambiemos a otro estado
      return () => {
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }
        
        // Si salimos del estado thinking, registrar cuánto tiempo estuvo
        if (thinkingStartTimeRef.current) {
          const thinkingDuration = Date.now() - thinkingStartTimeRef.current;
          console.log(`[ThinkingMonitor] El agente estuvo en estado thinking durante ${thinkingDuration}ms`);
          thinkingStartTimeRef.current = null;
        }
      };
    }
  }, [agentStatus, isCallActive]);

  useEffect(() => {
    if (!callTranscript || callTranscript.length === 0) return;
    
    // Obtener el último mensaje del agente
    const lastAgentMessage = [...callTranscript].reverse().find(t => t.speaker !== Role.USER);
    if (!lastAgentMessage) return;
    
    const text = lastAgentMessage.text.toLowerCase();
    
    // Registrar para fines de depuración
    console.log("[page] Analizando mensaje del agente:", text);
    
    // Detectar menciones a categorías del menú y cambiar vista
    if (text.includes('menú') || text.includes('carta')) {
      console.log("[page] Mostrando menú completo");
      setActiveView('menu');
      return;
    }
    
    // Detección de categorías específicas
    if (text.includes('tacos') && !text.includes('taco de') && !text.includes('taco al')) {
      console.log("[page] Mostrando categoría de tacos");
      setActiveView('menu');
      setActiveMenuCategory('tacos');
      return;
    }
    
    if (text.includes('bebidas') || text.includes('refrescos') || text.includes('aguas')) {
      console.log("[page] Mostrando categoría de bebidas");
      setActiveView('menu');
      setActiveMenuCategory('bebidas');
      return;
    }
    
    if (text.includes('extras') || text.includes('complementos') || text.includes('adicionales') || 
        text.includes('guacamole') || text.includes('quesadilla') || text.includes('queso extra') || 
        text.includes('cebollitas')) {
      console.log("[page] Mostrando categoría de extras");
      setActiveView('menu');
      setActiveMenuCategory('extras');
      return;
    }
    
    // Objeto para mapear términos mencionados a productos específicos
    const menuMappings = {
      // Tacos
      'pastor': { category: 'tacos', productId: 'taco-pastor' },
      'taco al pastor': { category: 'tacos', productId: 'taco-pastor' },
      'suadero': { category: 'tacos', productId: 'taco-suadero' },
      'taco de suadero': { category: 'tacos', productId: 'taco-suadero' },
      'bistec': { category: 'tacos', productId: 'taco-bistec' },
      'taco de bistec': { category: 'tacos', productId: 'taco-bistec' },
      'campechano': { category: 'tacos', productId: 'taco-campechano' },
      'taco campechano': { category: 'tacos', productId: 'taco-campechano' },
      'carnitas': { category: 'tacos', productId: 'taco-carnitas' },
      'taco de carnitas': { category: 'tacos', productId: 'taco-carnitas' },
      
      // Bebidas
      'horchata': { category: 'bebidas', productId: 'agua-horchata' },
      'agua de horchata': { category: 'bebidas', productId: 'agua-horchata' },
      'jamaica': { category: 'bebidas', productId: 'agua-jamaica' },
      'agua de jamaica': { category: 'bebidas', productId: 'agua-jamaica' },
      'refresco': { category: 'bebidas', productId: 'refresco' },
      
      // Extras
      'guacamole': { category: 'extras', productId: 'guacamole' },
      'quesadilla': { category: 'extras', productId: 'quesadilla' },
      'queso extra': { category: 'extras', productId: 'queso-extra' },
      'cebollitas': { category: 'extras', productId: 'cebollitas' },
      'orden de cebollitas': { category: 'extras', productId: 'cebollitas' }
    };
    
    // Función para resaltar un producto mencionado en el menú SIN agregarlo al pedido
    const highlightProductInMenu = (category: 'tacos' | 'bebidas' | 'extras', productId: string) => {
      console.log(`[page] Resaltando producto: ${productId} en categoría: ${category}`);
      
      // Cambiar a la vista del menú
      setActiveView('menu');
      
      // Cambiar a la categoría del producto
      setActiveMenuCategory(category);
      
      // Simular un clic en el producto
      // Esto lo hacemos emitiendo un evento personalizado que MenuTaqueria escuchará
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('highlightProduct', { 
          detail: { productId }
        }));
      }
    };
    
    // Buscar menciones a productos específicos
    for (const [term, details] of Object.entries(menuMappings)) {
      // Busca la palabra completa o frase exacta, no substrings
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(text)) {
        console.log(`[page] Producto detectado: "${term}" -> ${details.productId}`);
        highlightProductInMenu(details.category as 'tacos' | 'bebidas' | 'extras', details.productId);
        // Solo resaltar un producto a la vez para evitar confusión
        break;
      }
    }
    
  }, [callTranscript]);

  const handleStatusChange = useCallback((status: UltravoxSessionStatus | string | undefined) => {
    if(status) {
      setAgentStatus(status as "idle" | "thinking" | "speaking" | "off");
    } else {
      setAgentStatus("off");
    }
    
  }, []);

  const handleTranscriptChange = useCallback((transcripts: TranscriptType[] | undefined) => {
    if(transcripts) {
      setCallTranscript([...transcripts]);
    }
  }, []);

  const handleDebugMessage = useCallback((debugMessage: UltravoxExperimentalMessageEvent) => {
    setCallDebugMessages(prevMessages => [...prevMessages, debugMessage]);
  }, []);

  const clearCustomerProfile = useCallback(() => {
    // This will trigger a re-render of CustomerProfileForm with a new empty profile
    setCustomerProfileKey(prev => prev ? `${prev}-cleared` : 'cleared');
  }, []);

  const handleStartCallButtonClick = async (modelOverride?: string, showDebugMessages?: boolean) => {
    try {
      handleStatusChange('Starting call...');
      setCallTranscript(null);
      setCallDebugMessages([]);
      clearCustomerProfile();

      // Generate a new key for the customer profile
      const newKey = `call-${Date.now()}`;
      setCustomerProfileKey(newKey);

      // Setup our call config including the call key as a parameter restriction
      let callConfig: CallConfig = {
        systemPrompt: demoConfig.callConfig.systemPrompt,
        model: modelOverride || demoConfig.callConfig.model,
        languageHint: demoConfig.callConfig.languageHint,
        voice: demoConfig.callConfig.voice,
        temperature: demoConfig.callConfig.temperature,
        maxDuration: demoConfig.callConfig.maxDuration,
        timeExceededMessage: demoConfig.callConfig.timeExceededMessage
      };

      const paramOverride: { [key: string]: any } = {
        "callId": newKey
      }

      let cpTool: SelectedTool | undefined = demoConfig?.callConfig?.selectedTools?.find(tool => tool.toolName === "createProfile");
      
      if (cpTool) {
        cpTool.parameterOverrides = paramOverride;
      }
      callConfig.selectedTools = demoConfig.callConfig.selectedTools;

      await startCall({
        onStatusChange: handleStatusChange,
        onTranscriptChange: handleTranscriptChange,
        onDebugMessage: handleDebugMessage
      }, callConfig, showDebugMessages);

      setIsCallActive(true);
      handleStatusChange('Call started successfully');
    } catch (error) {
      handleStatusChange(`Error starting call: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEndCallButtonClick = async () => {
    setAgentStatus("off");
    if (isCallActive) {
      try {
        endCall();
        setIsCallActive(false);
        setCallTranscript([]);
        setCallDebugMessages([]);
        setCustomerProfileKey(null);
        handleStatusChange('Llamada finalizada con éxito');
        console.log("Llamada finalizada con éxito");
      } catch (error) {
        console.error('Error al finalizar la llamada:', error);
        handleStatusChange('Error al finalizar la llamada');
      }
    }
  };

  // Manejador para añadir elementos al pedido desde el menú
  const handleAddToOrder = (item: OrderItem) => {
    // Crear un evento personalizado para actualizar el pedido
    const currentOrderStr = localStorage.getItem('currentOrder') || '[]';
    let currentOrder;
    
    try {
      currentOrder = JSON.parse(currentOrderStr);
      // Asegurarse de que currentOrder es un array
      if (!Array.isArray(currentOrder)) {
        console.warn('currentOrder no es un array, reseteando', currentOrder);
        currentOrder = [];
      }
    } catch (error) {
      console.error('Error al parsear el pedido:', error);
      currentOrder = [];
    }
    
    // Verificar si el ítem ya existe en el pedido
    const existingItemIndex = currentOrder.findIndex((orderItem: OrderItem) => 
      orderItem.name === item.name && orderItem.specialInstructions === item.specialInstructions
    );
    
    if (existingItemIndex >= 0) {
      // Actualizar cantidad si el ítem ya existe
      currentOrder[existingItemIndex].quantity += item.quantity;
    } else {
      // Agregar nuevo ítem al pedido
      currentOrder.push(item);
    }
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('currentOrder', JSON.stringify(currentOrder));
    
    // Disparar evento con el nuevo pedido
    const event = new CustomEvent('orderDetailsUpdated', {
      detail: JSON.stringify(currentOrder)
    });
    window.dispatchEvent(event);
    
    console.log('Pedido actualizado:', currentOrder);
  };

  const changeView = (newView: 'chat' | 'menu') => {
    if (newView === activeView) return;
    
    setIsViewTransitioning(true);
    setTimeout(() => {
      setActiveView(newView);
      setTimeout(() => {
        setIsViewTransitioning(false);
      }, 50);
    }, 300);
  };

  // Manejar el toggle del micrófono
  const handleToggleVoice = () => {
    setIsVoiceActive(prev => !prev);
  };
  
  // Volver a la vista principal desde la vista de resumen de pedido
  const handleBackToMainView = () => {
    setShowOrderSummary(false);
    setOrderCompletedData(null);
  };

  return (
    <SearchParamsHandler>
      {({ showMuteSpeakerButton, modelOverride, showDebugMessages, showUserTranscripts }) => (
        <div className="flex flex-col h-screen bg-amber-100">
          
          {/* Header */}
          <header className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <BorderedImage 
                  src="/taco-icon.svg" 
                  alt="Taquería Logo" 
                  width={50} 
                  height={50} 
                  className="rounded-full border-4 border-white shadow-lg" 
                />
                <div>
                  <h1 className="text-2xl font-bold">Taquería "El Buen Sabor"</h1>
                  <p className="text-xs text-amber-200">Asistente de voz para tu pedido</p>
                </div>
              </div>
              
              {/* Botones de navegación */}
              <div className="flex space-x-2">
                <button 
                  onClick={() => changeView('chat')}
                  className={`p-2 rounded-lg transition-all duration-300 flex items-center ${
                    activeView === 'chat' 
                      ? 'bg-white text-amber-700' 
                      : 'bg-amber-700/50 text-white hover:bg-amber-700/80'
                  }`}
                  aria-label="Ver chat"
                >
                  <MessageSquareTextIcon size={20} />
                  <span className="ml-2 hidden sm:inline">Chat</span>
                </button>
                <button 
                  onClick={() => changeView('menu')}
                  className={`p-2 rounded-lg transition-all duration-300 flex items-center ${
                    activeView === 'menu' 
                      ? 'bg-white text-amber-700' 
                      : 'bg-amber-700/50 text-white hover:bg-amber-700/80'
                  }`}
                  aria-label="Ver menú"
                >
                  <MenuIcon size={20} />
                  <span className="ml-2 hidden sm:inline">Menú</span>
                </button>
              </div>
            </div>
          </header>
          
          {/* Contenido principal con transición */}
          <main className="flex-grow overflow-hidden">
            <div className="container mx-auto h-full flex flex-col md:flex-row gap-4 p-4">
              {/* Columna izquierda */}
              <div className="w-full md:w-8/12 flex flex-col overflow-hidden">
                <div className={`transition-opacity duration-300 h-full ${isViewTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                  {activeView === 'chat' ? (
                    <div className="h-full flex flex-col">
                      <div className="flex-grow" ref={transcriptContainerRef}>
                        <TranscriptView transcripts={callTranscript} />
                      </div>
                      <AgentStatusView status={agentStatus} />
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <MenuTaqueria 
                        activeCategory={activeMenuCategory}
                        onCategoryChange={setActiveMenuCategory}
                        onAddToOrder={(item) => {
                          try {
                            console.log("[page] Agregando producto al pedido:", item);
                            handleAddToOrder(item);
                          } catch (error) {
                            console.error("[page] Error al agregar producto:", error);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Columna derecha */}
              <div className="w-full md:w-4/12 flex flex-col gap-4">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <OrderDetails />
                </div>
                <div className="mt-4">
                  <OrderAnalytics />
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <div className="flex flex-col gap-3">
                    <CallStatus
                      isCallActive={isCallActive}
                      agentStatus={agentStatus}
                      onCallClick={isCallActive ? handleEndCallButtonClick : handleStartCallButtonClick}
                    />
                    
                    {isCallActive && (
                      <div className="w-full grid grid-cols-2 gap-2">
                        <MicToggleButton
                          label="Micrófono"
                          className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg transition-colors flex justify-center items-center space-x-2"
                        />
                        {showMuteSpeakerButton && (
                          <button 
                            onClick={handleMuteSpeakerToggle}
                            className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg transition-colors flex justify-center items-center space-x-2"
                          >
                            <span>Altavoz</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {showDebugMessages && (
                  <div className="mt-4">
                    <DebugMessages messages={callDebugMessages} />
                  </div>
                )}
              </div>
            </div>
          </main>
          
          {/* Footer */}
          <footer className="bg-amber-800 text-amber-200 py-3 text-center text-sm">
            <div className="container mx-auto">
              <p>Taquería &quot;El Buen Sabor&quot; © 2023 - Asistente de voz Cognitive Data Solutions</p>
            </div>
          </footer>
          
          {/* Estilos globales para animaciones */}
          <style jsx global>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </SearchParamsHandler>
  );
}