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
  X,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as pdfjs from "pdfjs-dist";

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
    contents: `Analiza la siguiente Orden de Servicio del gobierno y genera un plan de obra detallado. Contenido: "${orderContent}"`,
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
                materials: { type: Type.ARRAY, items: { type: Type.STRING } },
                laborCost: { type: Type.NUMBER },
                description: { type: Type.STRING },
              },
              required: ["task", "duration", "materials", "laborCost", "description"],
            },
          },
        },
        required: ["projectName", "totalEstimatedCost", "items", "overallTimeline"],
      },
    },
  });

  try {
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Error parsing Gemini response:", e);
    throw new Error("Respuesta de IA inválida. Intenta simplificar el texto de entrada.");
  }
}

// --- Sub-components ---

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: "blue" | "green" | "orange";
}) {
  const accentClasses = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  };

  return (
    <div className="rounded-xl border border-[#27272d] bg-[#111113] p-5 flex flex-col gap-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${accentClasses[accent]}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#71717a] mb-1">{label}</p>
        <p className="text-xl font-semibold font-mono text-[#f2f2f4] leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-white/8 text-[#f2f2f4] border border-[#3a3a45]"
          : "text-[#71717a] hover:text-[#f2f2f4] hover:bg-white/5"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

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
    if (files?.[0]) processFile(files[0]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.[0]) processFile(files[0]);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0a0a0b] font-sans">
      {/* ── Sidebar ── */}
      <aside className="w-full md:w-56 shrink-0 bg-[#0a0a0b] border-b md:border-b-0 md:border-r border-[#27272d] flex flex-col p-5 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <HardHat size={16} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[#f2f2f4] tracking-tight">ObraMaster AI</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          <p className="text-[10px] uppercase font-semibold text-[#71717a] tracking-widest px-3 mb-1">
            Panel
          </p>
          <SidebarButton
            icon={Plus}
            label="Nueva Orden"
            active
            onClick={() => { setResult(null); setInput(""); setError(null); }}
          />
          <SidebarButton icon={FileText} label="Historial" />
          <SidebarButton icon={BarChart3} label="Analítica" />
        </nav>

        {/* AI Status */}
        <div className="mt-auto">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/15">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-green-500">
              Gemini Activo
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-sm border-b border-[#27272d] px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-0.5">
              v1.1 · Procesador de Órdenes
            </p>
            <h1 className="text-lg font-semibold text-[#f2f2f4] leading-none">
              Analizador de Pliegos PDF
            </h1>
          </div>
          {result && (
            <button className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-xs font-semibold transition-all active:scale-95">
              <Download size={13} />
              Exportar
            </button>
          )}
        </div>

        <div className="px-8 py-8 max-w-5xl mx-auto w-full space-y-8">
          {/* ── Upload / Input card ── */}
          <section>
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${
                isDragging
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-[#27272d] bg-[#111113] hover:border-[#3a3a45]"
              }`}
            >
              {/* Loading overlay */}
              {isReadingFile && (
                <div className="absolute inset-0 bg-[#111113]/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={24} className="animate-spin text-blue-400" />
                  <p className="text-xs font-mono uppercase tracking-widest text-blue-400">
                    Extrayendo texto...
                  </p>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#27272d] bg-[#0f0f11]">
                <div className="flex items-center gap-2 text-[#71717a]">
                  <FileUp size={13} />
                  <span className="text-[11px] font-medium uppercase tracking-widest">
                    Orden de Servicio
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Subir PDF
                  </button>
                  <span className="text-[#27272d]">|</span>
                  <button
                    onClick={() => setInput("")}
                    className="text-[11px] font-semibold text-[#71717a] hover:text-[#f2f2f4] transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                className="w-full bg-transparent px-5 py-4 text-sm text-[#f2f2f4] placeholder-[#3a3a45] focus:outline-none min-h-[160px] resize-none leading-relaxed"
                placeholder="Arrastrá tu Orden de Servicio (PDF) o pegá el texto aquí..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />

              {/* Footer bar */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#27272d] bg-[#0f0f11]">
                <div className="flex items-center gap-2.5 text-[#71717a]">
                  <Upload
                    size={14}
                    className={isDragging ? "text-blue-400 animate-bounce" : ""}
                  />
                  <span className="text-[11px]">
                    {isDragging ? "Soltá el archivo aquí" : "PDF · Arrastrar y soltar o entrada manual"}
                  </span>
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing || !input.trim() || isReadingFile}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1a1a1e] disabled:text-[#71717a] disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/20"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Zap size={13} />
                      Generar Plan
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 flex items-center justify-between gap-3 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl text-red-400 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={15} />
                    <span className="text-xs">{error}</span>
                  </div>
                  <button onClick={() => setError(null)} className="shrink-0 hover:text-red-300 transition-colors">
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* ── Results ── */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 pb-16"
              >
                {/* Result header */}
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-green-400 mt-1 shrink-0" />
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-green-400 mb-1">
                      Análisis Completo
                    </p>
                    <h2 className="text-2xl font-semibold text-[#f2f2f4] text-balance">
                      {result.projectName}
                    </h2>
                  </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard
                    icon={DollarSign}
                    label="Mano de Obra"
                    value={formatCurrency(result.totalEstimatedCost)}
                    accent="green"
                  />
                  <StatCard
                    icon={Clock}
                    label="Plazo de Ejecución"
                    value={result.overallTimeline}
                    accent="blue"
                  />
                  <StatCard
                    icon={Hammer}
                    label="Etapas Definidas"
                    value={result.items.length}
                    accent="orange"
                  />
                </div>

                {/* Tasks table */}
                <div className="rounded-xl border border-[#27272d] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#27272d] bg-[#111113] flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-[#1a1a1e] border border-[#27272d] flex items-center justify-center">
                      <Hammer size={13} className="text-[#71717a]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#f2f2f4]">Cronograma de Tareas</p>
                      <p className="text-[10px] text-[#71717a] uppercase tracking-wider">
                        Desglose técnico y estimación de recursos
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#27272d] bg-[#0a0a0b]">
                          <th className="px-5 py-3 text-[10px] uppercase tracking-widest font-medium text-[#71717a] w-12">
                            #
                          </th>
                          <th className="px-5 py-3 text-[10px] uppercase tracking-widest font-medium text-[#71717a]">
                            Tarea
                          </th>
                          <th className="px-5 py-3 text-[10px] uppercase tracking-widest font-medium text-[#71717a]">
                            Materiales
                          </th>
                          <th className="px-5 py-3 text-[10px] uppercase tracking-widest font-medium text-[#71717a] text-right">
                            Mano de Obra
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((item, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-[#27272d]/60 last:border-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-5 py-4 font-mono text-xs text-[#71717a] align-top">
                              {(idx + 1).toString().padStart(2, "0")}
                            </td>
                            <td className="px-5 py-4 align-top max-w-xs">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="text-sm font-medium text-[#f2f2f4]">{item.task}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1a1a1e] border border-[#27272d] rounded text-[10px] font-mono text-[#71717a]">
                                  <Clock size={9} />
                                  {item.duration}
                                </span>
                              </div>
                              <p className="text-xs text-[#71717a] leading-relaxed">{item.description}</p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                                {item.materials.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="px-2 py-0.5 bg-blue-500/8 text-blue-400 text-[10px] rounded border border-blue-500/12"
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top text-right">
                              <span className="text-sm font-mono font-semibold text-green-400">
                                {formatCurrency(item.laborCost)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer detail cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Supply card */}
                  <div className="rounded-xl border border-[#27272d] bg-[#111113] p-6 hover:border-[#3a3a45] transition-colors">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Truck size={13} className="text-blue-400" />
                      </div>
                      <p className="text-xs font-semibold text-[#f2f2f4]">Abastecimiento Sugerido</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from(new Set(result.items.flatMap((i) => i.materials)))
                        .slice(0, 10)
                        .map((m, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px] text-[#71717a]">
                            <span className="w-1 h-1 rounded-full bg-blue-500/50 shrink-0" />
                            {m}
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Notes card */}
                  <div className="rounded-xl border border-[#27272d] bg-[#111113] p-6 hover:border-[#3a3a45] transition-colors">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-7 h-7 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <BarChart3 size={13} className="text-orange-400" />
                      </div>
                      <p className="text-xs font-semibold text-[#f2f2f4]">Notas de Implementación</p>
                    </div>
                    <p className="text-xs text-[#71717a] leading-relaxed mb-5">
                      Este plan fue optimizado a partir de los parámetros de la{" "}
                      <span className="text-[#f2f2f4] font-medium">Orden de Servicio</span>{" "}
                      analizada. Las duraciones contemplan jornadas estándar de 8 hs. Los costos son{" "}
                      <span className="text-orange-400">valores de referencia</span> a validar con
                      proveedores locales.
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/8 text-green-400 text-[10px] font-mono rounded border border-green-500/15">
                        <CheckCircle2 size={10} />
                        Cálculo automatizado
                      </span>
                      <span className="text-[10px] font-mono text-[#71717a]">
                        ID: {Math.random().toString(36).substring(7).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Empty state ── */}
          {!result && !isAnalyzing && !isReadingFile && (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-[#111113] border border-[#27272d] flex items-center justify-center mb-6">
                <FileUp size={26} className="text-[#3a3a45]" />
              </div>
              <h3 className="text-lg font-semibold text-[#f2f2f4] mb-2">
                Sistema de Inteligencia en Obra
              </h3>
              <p className="text-sm text-[#71717a] max-w-sm leading-relaxed mb-8">
                Cargá tu{" "}
                <span className="text-blue-400 font-medium">PDF de Orden de Servicio</span>{" "}
                gubernamental. Extraeremos las metas, plazos y requerimientos para generar un plan
                maestro en segundos.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["Extracción OCR", "Costos ARS/USD", "Cronograma IA"].map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 bg-[#111113] border border-[#27272d] rounded-lg text-[10px] uppercase font-semibold tracking-wider text-[#71717a]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
