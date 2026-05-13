import { useState, useCallback, useRef } from "react";
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
  Plus,
  Upload,
  FileUp,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as pdfjs from "pdfjs-dist";

// Cargar el worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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

// --- Helpers ---
const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
};

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
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [result, setResult] = useState<ObraPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (textToAnalyze?: string) => {
    const content = textToAnalyze || input;
    if (!content.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const plan = await analyzeServiceOrder(content);
      setResult(plan);
    } catch (err: any) {
      setError(err.message || "Error al procesar la orden.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Por favor, sube solo archivos PDF.");
      return;
    }

    setIsReadingFile(true);
    setError(null);
    try {
      const text = await extractTextFromPDF(file);
      setInput(text);
      handleAnalyze(text);
    } catch (err) {
      console.error(err);
      setError("No se pudo leer el archivo PDF. Intenta copiar el texto manualmente.");
    } finally {
      setIsReadingFile(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-industrial-card border-b md:border-b-0 md:border-r border-industrial-line flex flex-col p-6 overflow-y-auto font-sans">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-lg">
            <HardHat size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ObraMaster AI</h1>
        </div>

        <nav className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-industrial-muted mb-3 tracking-widest px-2">Panel de Control</p>
          <button 
            onClick={() => { setResult(null); setInput(""); setError(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 bg-blue-600/10 text-blue-400 rounded-md border border-blue-500/20 text-sm font-medium hover:bg-blue-600/20 transition-all"
          >
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
      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-industrial-bg">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-mono text-blue-400 mb-1">PROCESADOR DE ÓRDENES DE SERVICIO v1.1</h2>
              <h3 className="text-3xl font-bold tracking-tight">Analizador de Pliegos PDF</h3>
            </div>
          </div>
        </header>

        {/* Input & Drop Section */}
        <section className="mb-10">
          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`
              relative bg-industrial-card border-2 border-dashed rounded-xl transition-all duration-200
              ${isDragging ? "border-blue-500 bg-blue-500/5 scale-[1.01]" : "border-industrial-line hover:border-industrial-muted"}
            `}
          >
            {isReadingFile && (
              <div className="absolute inset-0 bg-industrial-card/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
                <p className="text-sm font-mono uppercase tracking-widest text-blue-400">Extrayendo texto del PDF...</p>
              </div>
            )}

            <div className="p-1 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-industrial-bg/50 rounded-t-lg border-b border-industrial-line">
                <div className="flex items-center gap-2">
                  <FileUp size={14} className="text-industrial-muted" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-industrial-muted">Modo de Entrada</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf"
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Subir PDF
                  </button>
                  <span className="text-industrial-line">|</span>
                  <button 
                    onClick={() => setInput("")}
                    className="text-[10px] uppercase font-bold text-red-500/70 hover:text-red-500 transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <textarea
                className="w-full bg-transparent p-6 text-sm text-industrial-text placeholder-industrial-muted focus:outline-none min-h-[180px] resize-none font-sans leading-relaxed"
                placeholder="Arrastra aquí tu Orden de Servicio (PDF) o pega el texto directamente..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />

              <div className="bg-industrial-bg/30 px-4 py-4 flex items-center justify-between border-t border-industrial-line">
                <div className="flex items-center gap-3 text-industrial-muted">
                  <Upload size={18} className={`${isDragging ? "text-blue-400 animate-bounce" : ""}`} />
                  <div>
                    <p className="text-xs font-bold text-industrial-text">Drop PDF files here</p>
                    <p className="text-[10px] uppercase tracking-wider">O utiliza el cuadro de texto para entrada manual</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing || !input.trim() || isReadingFile}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-industrial-line disabled:text-industrial-muted text-white px-8 py-3 rounded-lg font-bold text-sm tracking-tight transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      PROCESANDO...
                    </>
                  ) : (
                    <>
                      <ChevronRight size={16} />
                      GENERAR PLAN DE OBRA
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between text-red-400 text-sm"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={18} />
                  {error}
                </div>
                <button onClick={() => setError(null)}>
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pb-20"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-[10px] uppercase font-bold text-green-500 font-mono">Análisis Estructural Completo</span>
                  </div>
                  <h4 className="text-2xl font-bold tracking-tight text-white">{result.projectName}</h4>
                </div>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-gray-200 rounded-md text-sm font-bold transition-all transform active:scale-95 shadow-lg">
                  <Download size={16} />
                  EXPORTAR PLANILLA
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  icon={DollarSign} 
                  label="Inversión Mano de Obra" 
                  value={formatCurrency(result.totalEstimatedCost)} 
                  color="bg-green-500" 
                />
                <StatCard 
                  icon={Clock} 
                  label="Plazo de Ejecución" 
                  value={result.overallTimeline} 
                  color="bg-blue-500" 
                />
                <StatCard 
                  icon={Hammer} 
                  label="Etapas Definidas" 
                  value={result.items.length} 
                  color="bg-orange-500" 
                />
              </div>

              {/* Tasks Table */}
              <div className="bg-industrial-card border border-industrial-line rounded-xl overflow-hidden mt-8 shadow-2xl">
                <div className="p-5 border-b border-industrial-line flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-industrial-line rounded">
                       <Hammer size={18} className="text-industrial-muted" />
                    </div>
                    <div>
                      <h5 className="text-xs uppercase font-bold tracking-widest text-white">Cronograma de Tareas</h5>
                      <p className="text-[10px] text-industrial-muted">DESGLOSE TÉCNICO Y ESTIMACIÓN DE RECURSOS</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left order-collapse">
                    <thead>
                      <tr className="bg-industrial-bg border-b border-industrial-line">
                        <th className="p-5 text-[10px] uppercase font-serif italic text-industrial-muted font-normal">Ident</th>
                        <th className="p-5 text-[10px] uppercase font-serif italic text-industrial-muted font-normal">Descripción de Tarea</th>
                        <th className="p-5 text-[10px] uppercase font-serif italic text-industrial-muted font-normal">Recursos / Materiales</th>
                        <th className="p-5 text-[10px] uppercase font-serif italic text-industrial-muted font-normal text-right">Mano de Obra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-line/50">
                      {result.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-all group cursor-default">
                          <td className="p-5 font-mono text-xs text-industrial-muted">{(idx + 1).toString().padStart(2, '0')}</td>
                          <td className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-bold text-sm">{item.task}</span>
                              <span className="px-2 py-0.5 bg-industrial-line rounded text-[10px] font-mono text-industrial-muted flex items-center gap-1">
                                <Clock size={10} /> {item.duration}
                              </span>
                            </div>
                            <div className="text-xs text-industrial-muted leading-relaxed max-w-md italic">{item.description}</div>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {item.materials.map((m, mIdx) => (
                                <span key={mIdx} className="bg-blue-500/5 text-blue-400 text-[10px] px-2.5 py-1 rounded-sm border border-blue-500/10">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-5 text-right">
                            <div className="text-base font-mono font-bold text-green-400">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="bg-industrial-card/30 p-8 rounded-2xl border border-industrial-line group hover:border-blue-500/30 transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                      <Truck size={20} />
                    </div>
                    <h6 className="text-sm font-bold tracking-tight text-white">Abastecimiento Sugerido</h6>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from(new Set(result.items.flatMap(i => i.materials))).slice(0, 10).map((m, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-industrial-muted">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40"></div>
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-industrial-card/30 p-8 rounded-2xl border border-industrial-line group hover:border-orange-500/30 transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                      <BarChart3 size={20} />
                    </div>
                    <h6 className="text-sm font-bold tracking-tight text-white">Notas de Implementación</h6>
                  </div>
                  <p className="text-xs text-industrial-muted leading-loose mb-6">
                    Este plan ha sido optimizado estructuralmente basándose en los parámetros de la <span className="text-white font-medium">Orden de Servicio</span> analizada. 
                    Las duraciones contemplan jornadas estándar de 8hs. Los precios son <span className="text-orange-400">valores de referencia</span> y deben ser validados con proveedores locales.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono p-1 bg-green-500/10 text-green-500 rounded border border-green-500/20 px-2">CÁLCULO AUTOMATIZADO</span>
                    <span className="text-[10px] font-mono text-industrial-muted">ID ANALISIS: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!result && !isAnalyzing && !isReadingFile && (
          <div className="mt-20 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-industrial-card rounded-full flex items-center justify-center border border-industrial-line mb-8 shadow-inner">
              <FileUp size={40} className="text-industrial-muted opacity-50" />
            </div>
            <h4 className="text-2xl font-bold mb-3 text-white">Sistema de Inteligencia en Obra</h4>
            <p className="text-industrial-muted text-sm max-w-md leading-relaxed">
              Carga tu <span className="text-blue-400 font-bold">PDF de Orden de Servicio</span> gubernamental. 
              Extraeremos las metas, plazos y requerimientos tecnológicos para generar un plan maestro en segundos.
            </p>
            <div className="mt-10 flex gap-4">
               <div className="px-4 py-2 bg-industrial-card border border-industrial-line rounded-lg text-[10px] uppercase font-bold text-industrial-muted">Extracción OCR</div>
               <div className="px-4 py-2 bg-industrial-card border border-industrial-line rounded-lg text-[10px] uppercase font-bold text-industrial-muted">Costos ARS/USD</div>
               <div className="px-4 py-2 bg-industrial-card border border-industrial-line rounded-lg text-[10px] uppercase font-bold text-industrial-muted">Cronograma IA</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
