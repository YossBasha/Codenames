import { useRef, useState, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { X, Trash2, Check, PenTool } from 'lucide-react';
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Fill white background so it's not transparent
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
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
    setIsDrawing(false);
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
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    startDrawing(
      (touch.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      (touch.clientY - rect.top) * (canvasRef.current!.height / rect.height)
    );
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    draw(
      (touch.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      (touch.clientY - rect.top) * (canvasRef.current!.height / rect.height)
    );
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSubmit(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-2xl p-4 sm:p-6 border-2 border-slate-700 shadow-2xl relative flex flex-col gap-4">
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-full text-white">
              <PenTool className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-widest text-white">DRAW A CLUE</h2>
              <p className="text-xs font-bold text-slate-400">Sketch your hint instead of typing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="bg-white rounded-xl overflow-hidden border-4 border-slate-600 shadow-inner relative flex-1 touch-none">
          <canvas
            ref={canvasRef}
            width={800}
            height={450}
            className="w-full h-auto cursor-crosshair touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={stopDrawing}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#2a2a2a] p-3 rounded-2xl border border-[#333]">
          <div className="flex items-center gap-2">
            {[
              { c: '#000000', label: 'Black' },
              { c: '#ef4444', label: 'Red' },
              { c: '#3b82f6', label: 'Blue' },
              { c: '#10b981', label: 'Green' },
            ].map((col) => (
              <button
                key={col.c}
                onClick={() => setColor(col.c)}
                className={cn(
                  "w-8 h-8 rounded-full shadow-inner border-2 transition-transform",
                  color === col.c ? "border-white scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: col.c }}
                title={col.label}
              />
            ))}
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

        <div className="flex items-center gap-3 mt-2">
          <button 
            onClick={handleClear}
            className="flex-1 py-3 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-xl font-black tracking-widest transition-colors flex justify-center items-center gap-2"
          >
            <Trash2 className="w-5 h-5" /> CLEAR
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors flex justify-center items-center gap-2"
          >
            <Check className="w-5 h-5" /> SUBMIT DRAWING
          </button>
        </div>

      </div>
    </div>
  );
}
