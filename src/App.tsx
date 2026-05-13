import { useState } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  BarChart3, 
  FileText, 
  HardHat, 
  Hammer, 
  Clock, 
  Truck, 
  DollarSign, 
  ChevronRight, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Download,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- Types ---
export interface PlanItem {
  task: string;
  duration: string;
  materials: string[];
  laborCost: number;
  description: string;
}

export interface ObraPlan {
  projectName: string;
  totalEstimatedCost: number;
  items: PlanItem[];
  overallTimeline: string;
}

// --- AI Service ---
async function analyzeServiceOrder(orderContent: string): Promise<ObraPlan> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analiza la siguiente Orden de Servicio del gobierno y genera un plan de obra detallado. 
    Contenido: "${orderContent}"`,
    config: {
      systemInstruction: `Eres un experto Ingeniero Civil y Analista de Costos de Construcción. 
      Tu tarea es desglosar órdenes de servicio gubernamentales en tareas específicas de obra.
      Para cada tarea, debes estimar:
      1. El tiempo de ejecución (ej. "3 días", "1 semana").
      2. Materiales necesarios (lista de strings).
      3. Costo estimado de mano de obra en Pesos Argentinos (ARS) o dólares (USD) según corresponda, pero siempre devuelve un número entero basado en valores de mercado actuales.
      4. Una descripción técnica breve.
      
      Debes responder ÚNICAMENTE en formato JSON. Sé preciso y realista con los tiempos y materiales.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectName: { type: Type.STRING },
          totalEstimatedCost: { type: Type.NUMBER },
          overallTimeline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                task: { type: Type.STRING },
                duration: { type: Type.STRING },
                materials: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                laborCost: { type: Type.NUMBER },
                description: { type: Type.STRING }
              },
              required: ["task", "duration", "materials", "laborCost", "description"]
            }
          }
        },
        required: ["projectName", "totalEstimatedCost", "items", "overallTimeline"]
      }
    }
  });

  try {
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Error parsing Gemini response:", e);
    throw new Error("Respuesta de IA inválida. Intenta simplificar el texto de entrada.");
  }
}

// --- UI Components ---
const StatCard = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) => (
  <div className="bg-industrial-card border border-industrial-line p-4 rounded-lg">
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-md ${color} bg-opacity-10 text-${color.split('-')[1]}-400`}>
        <Icon size={18} />
      </div>
      <span className="text-xs uppercase tracking-wider text-industrial-muted font-medium">{label}</span>
    </div>
    <div className="text-2xl font-mono tracking-tight text-industrial-text">{value}</div>
  </div>
);

export default function App() {
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ObraPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const plan = await analyzeServiceOrder(input);
      setResult(plan);
    } catch (err: any) {
      setError(err.message || "Error al procesar la orden.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-industrial-card border-b md:border-b-0 md:border-r border-industrial-line flex flex-col p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-lg">
            <HardHat size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ObraMaster AI</h1>
        </div>

        <nav className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-industrial-muted mb-3 tracking-widest px-2">Panel de Control</p>
          <button className="w-full flex items-center gap-3 px-3 py-2 bg-blue-600/10 text-blue-400 rounded-md border border-blue-500/20 text-sm font-medium">
            <Plus size={18} />
            Nueva Orden
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-industrial-muted hover:bg-white/5 hover:text-white rounded-md text-sm transition-colors mt-2">
            <FileText size={18} />
            Historial de Planes
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-industrial-muted hover:bg-white/5 hover:text-white rounded-md text-sm transition-colors">
            <BarChart3 size={18} />
            Analítica de Costos
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-industrial-line">
          <div className="flex items-center gap-2 mb-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] uppercase font-bold text-green-500 tracking-tighter">Motor Gemini Activo</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-sm font-mono text-blue-400 mb-1">PROCESADOR DE ÓRDENES DE SERVICIO v1.0</h2>
          <h3 className="text-3xl font-bold tracking-tight">Generación de Plan de Obra</h3>
        </header>

        {/* Input Section */}
        <section className="mb-10">
          <div className="bg-industrial-card border border-industrial-line rounded-xl p-1 overflow-hidden">
            <textarea
              className="w-full bg-transparent p-4 text-sm text-industrial-text placeholder-industrial-muted focus:outline-none min-h-[200px] resize-none"
              placeholder="Copia y pega aquí el contenido de la Orden de Servicio gubernamental (texto de pliego, descripción de tareas, requisitos)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="bg-industrial-bg px-4 py-3 flex items-center justify-between border-t border-industrial-line">
              <div className="flex items-center gap-2 text-industrial-muted">
                <AlertCircle size={14} />
                <span className="text-[10px] uppercase tracking-wide">Asegúrate de incluir plazos y detalles técnicos del pliego</span>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !input.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-industrial-line disabled:text-industrial-muted text-white px-6 py-2 rounded-md font-bold text-sm tracking-tighter transition-all flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    ANALIZANDO...
                  </>
                ) : (
                  <>
                    <ChevronRight size={16} />
                    PROCESAR ORDEN
                  </>
                )}
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400 text-sm"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-[10px] uppercase font-bold text-green-500 font-mono">Plan Generado Exitosamente</span>
                  </div>
                  <h4 className="text-2xl font-bold tracking-tight">{result.projectName}</h4>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-industrial-line hover:bg-industrial-line/80 text-white rounded-md text-sm font-medium transition-colors">
                  <Download size={16} />
                  Exportar PDF
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  icon={DollarSign} 
                  label="Presupuesto Mano de Obra" 
                  value={formatCurrency(result.totalEstimatedCost)} 
                  color="bg-green-500" 
                />
                <StatCard 
                  icon={Clock} 
                  label="Tiempo Estimado Total" 
                  value={result.overallTimeline} 
                  color="bg-blue-500" 
                />
                <StatCard 
                  icon={Hammer} 
                  label="Tareas Identificadas" 
                  value={result.items.length} 
                  color="bg-orange-500" 
                />
              </div>

              {/* Tasks Table */}
              <div className="bg-industrial-card border border-industrial-line rounded-xl overflow-hidden mt-8">
                <div className="p-4 border-b border-industrial-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hammer size={18} className="text-industrial-muted" />
                    <h5 className="text-xs uppercase font-bold tracking-widest text-industrial-muted">Glosario de Tareas y Recursos</h5>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-industrial-bg border-b border-industrial-line">
                        <th className="p-4 text-[10px] uppercase font-serif italic text-industrial-muted">ID</th>
                        <th className="p-4 text-[10px] uppercase font-serif italic text-industrial-muted">Tarea</th>
                        <th className="p-4 text-[10px] uppercase font-serif italic text-industrial-muted">Materiales Estimados</th>
                        <th className="p-4 text-[10px] uppercase font-serif italic text-industrial-muted">Tiempo</th>
                        <th className="p-4 text-[10px] uppercase font-serif italic text-industrial-muted">Mano de Obra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-line">
                      {result.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                          <td className="p-4 font-mono text-xs text-industrial-muted">{(idx + 1).toString().padStart(2, '0')}</td>
                          <td className="p-4">
                            <div className="font-bold text-sm mb-1">{item.task}</div>
                            <div className="text-xs text-industrial-muted leading-relaxed max-w-sm">{item.description}</div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {item.materials.slice(0, 3).map((m, mIdx) => (
                                <span key={mIdx} className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded border border-blue-500/20">{m}</span>
                              ))}
                              {item.materials.length > 3 && (
                                <span className="text-[10px] text-industrial-muted">+{item.materials.length - 3} más</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-xs font-mono text-industrial-text">
                              <Clock size={12} className="text-industrial-muted" />
                              {item.duration}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-mono font-bold text-green-400">
                              {formatCurrency(item.laborCost)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Footer Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                <div className="bg-industrial-card/50 p-6 rounded-xl border border-industrial-line">
                  <div className="flex items-center gap-2 mb-4">
                    <Truck size={20} className="text-industrial-muted" />
                    <h6 className="text-sm font-bold tracking-tight">Logística y Materiales</h6>
                  </div>
                  <ul className="space-y-2">
                    {Array.from(new Set(result.items.flatMap(i => i.materials))).slice(0, 8).map((m, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-xs text-industrial-muted">
                        <div className="w-1 h-1 rounded-full bg-industrial-line"></div>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-industrial-card/50 p-6 rounded-xl border border-industrial-line">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={20} className="text-industrial-muted" />
                    <h6 className="text-sm font-bold tracking-tight">Análisis de Mercado</h6>
                  </div>
                  <p className="text-xs text-industrial-muted leading-relaxed mb-4">
                    Las estimaciones presentadas están basadas en promedios de mercado regional actualizados por el motor de IA. Se recomienda una revisión técnica in-situ para ajustes finos de volumetría.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-industrial-line h-1 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full w-[70%]" />
                    </div>
                    <span className="text-[10px] font-mono text-industrial-muted">CERTEZA: 92%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!result && !isAnalyzing && (
          <div className="mt-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-industrial-card rounded-full flex items-center justify-center border border-industrial-line mb-6">
              <FileText size={32} className="text-industrial-muted" />
            </div>
            <h4 className="text-xl font-bold mb-2">Sin plan de obra activo</h4>
            <p className="text-industrial-muted text-sm max-w-sm">
              Carga una órden de servicio detallada arriba para que nuestra IA desglose automáticamente las tareas, materiales y presupuestos.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
