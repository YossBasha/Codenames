import { useRef, useState, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { X, Trash2, Check, PenTool, Eraser, Undo2, Redo2, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../utils';

interface DrawingModalProps {
  onClose: () => void;
  onSubmit: (dataUrl: string) => void;
}

export default function DrawingModal({ onClose, onSubmit }: DrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [zoom, setZoom] = useState(1);

  const historyRef = useRef<ImageData[]>([]);
  const historyStepRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const saveHistoryState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = historyRef.current.slice(0, historyStepRef.current + 1);
    newHistory.push(imageData);
    historyRef.current = newHistory;
    historyStepRef.current = newHistory.length - 1;
    updateUndoRedoState();
  };

  const updateUndoRedoState = () => {
    setCanUndo(historyStepRef.current > 0);
    setCanRedo(historyStepRef.current < historyRef.current.length - 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Fill white background so it's not transparent
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistoryState();
  }, []);

  const handleUndo = () => {
    if (historyStepRef.current > 0) {
      historyStepRef.current -= 1;
      restoreHistoryState(historyRef.current[historyStepRef.current]);
      updateUndoRedoState();
    }
  };

  const handleRedo = () => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current += 1;
      restoreHistoryState(historyRef.current[historyStepRef.current]);
      updateUndoRedoState();
    }
  };

  const restoreHistoryState = (imageData: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.5, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.5, 1));

  const startDrawing = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = lineWidth;
    setIsDrawing(true);
  };

  const draw = (x: number, y: number) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistoryState();
    }
  };

  // Mouse Events
  const handleMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    startDrawing(
      (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      (e.clientY - rect.top) * (canvasRef.current!.height / rect.height)
    );
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    draw(
      (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      (e.clientY - rect.top) * (canvasRef.current!.height / rect.height)
    );
  };

  // Touch Events
  const handleTouchStart = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling
    
    if (e.touches.length >= 2) {
      if (isDrawing) {
        stopDrawing();
      }
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      initialPinchDistanceRef.current = dist;
      initialZoomRef.current = zoom;
      lastPanPointRef.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
      return;
    }

    if (e.touches.length === 1) {
      initialPinchDistanceRef.current = null;
      lastPanPointRef.current = null;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touch = e.touches[0];
      startDrawing(
        (touch.clientX - rect.left) * (canvasRef.current!.width / rect.width),
        (touch.clientY - rect.top) * (canvasRef.current!.height / rect.height)
      );
    }
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling
    
    if (e.touches.length >= 2 && initialPinchDistanceRef.current !== null && lastPanPointRef.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      // Zoom
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const newZoom = Math.max(1, Math.min(3, initialZoomRef.current * (dist / initialPinchDistanceRef.current)));
      setZoom(newZoom);
      
      // Pan
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;
      const dx = midX - lastPanPointRef.current.x;
      const dy = midY - lastPanPointRef.current.y;
      
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft -= dx;
        scrollContainerRef.current.scrollTop -= dy;
      }
      
      lastPanPointRef.current = { x: midX, y: midY };
      return;
    }

    if (e.touches.length === 1 && isDrawing) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touch = e.touches[0];
      draw(
        (touch.clientX - rect.left) * (canvasRef.current!.width / rect.width),
        (touch.clientY - rect.top) * (canvasRef.current!.height / rect.height)
      );
    }
  };

  const handleTouchEnd = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) {
      initialPinchDistanceRef.current = null;
      lastPanPointRef.current = null;
    }
    if (e.touches.length === 0) {
      stopDrawing();
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistoryState();
  };

  const handleSubmit = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSubmit(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-2xl max-h-[95vh] p-3 sm:p-6 border-2 border-slate-700 shadow-2xl relative flex flex-col gap-3 sm:gap-4 overflow-hidden">
        
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-full text-white">
              <PenTool className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-widest text-white">DRAW A CLUE</h2>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400">Sketch your hint instead of typing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </button>
        </div>

        <div 
          ref={scrollContainerRef}
          className="bg-white rounded-xl overflow-auto border-4 border-slate-600 shadow-inner relative flex-1 min-h-0 touch-none flex flex-col"
        >
          <div style={{ width: `${100 * zoom}%`, transformOrigin: 'top left', flexShrink: 0 }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              className="w-full h-auto block cursor-crosshair touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#2a2a2a] p-3 rounded-2xl border border-[#333] flex-shrink-0">
          <div className="flex items-center gap-2">
            {[
              { c: '#000000', label: 'Black' },
              { c: '#ef4444', label: 'Red' },
              { c: '#3b82f6', label: 'Blue' },
              { c: '#10b981', label: 'Green' },
            ].map((col) => (
              <button
                key={col.c}
                onClick={() => { setColor(col.c); setIsEraser(false); }}
                className={cn(
                  "w-8 h-8 rounded-full shadow-inner border-2 transition-transform",
                  color === col.c && !isEraser ? "border-white scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: col.c }}
                title={col.label}
              />
            ))}
            
            <div className="w-px h-8 bg-[#444] mx-2" />
            
            <button
              onClick={() => setIsEraser(!isEraser)}
              className={cn(
                "p-2 rounded-lg text-white transition-colors",
                isEraser ? "bg-slate-600 shadow-inner" : "hover:bg-slate-700"
              )}
              title="Eraser"
            >
              <Eraser className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
              title="Undo"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
              title="Redo"
            >
              <Redo2 className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-[#444] mx-1" />
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="p-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLineWidth(3)}
              className={cn("p-2 rounded-lg text-white font-bold text-xs transition-colors", lineWidth === 3 ? "bg-slate-600" : "hover:bg-slate-700")}
            >
              THIN
            </button>
            <button
              onClick={() => setLineWidth(6)}
              className={cn("p-2 rounded-lg text-white font-bold text-xs transition-colors", lineWidth === 6 ? "bg-slate-600" : "hover:bg-slate-700")}
            >
              MED
            </button>
            <button
              onClick={() => setLineWidth(12)}
              className={cn("p-2 rounded-lg text-white font-bold text-xs transition-colors", lineWidth === 12 ? "bg-slate-600" : "hover:bg-slate-700")}
            >
              THICK
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1 sm:mt-2 flex-shrink-0">
          <button 
            onClick={handleClear}
            className="flex-1 py-2 sm:py-3 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-xl font-black tracking-widest transition-colors flex justify-center items-center gap-2"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /> CLEAR
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-[2] py-2 sm:py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors flex justify-center items-center gap-2"
          >
            <Check className="w-4 h-4 sm:w-5 sm:h-5" /> SUBMIT DRAWING
          </button>
        </div>

      </div>
    </div>
  );
}

