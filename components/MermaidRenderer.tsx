import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import mermaid from 'mermaid';
import { Maximize2, X, ZoomIn, ZoomOut, Download, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MermaidRendererProps {
    code: string;
    isGenerating?: boolean;
}

// Simple Portal Component
const Portal = ({ children }: { children: React.ReactNode }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(children, document.body);
};

// Helper for pinch zoom
const getDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
};

// Memoize to prevent re-renders when code hasn't changed
export const MermaidRenderer = memo<MermaidRendererProps>(function MermaidRenderer({ code, isGenerating }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Zoom/Pan State
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const pinchStartDist = useRef<number>(0);
    const pinchStartScale = useRef<number>(1);

    const renderDiagram = useCallback(async (diagramCode: string) => {
        setIsLoading(true);
        try {
            setError(null);
            const isDark = document.documentElement.classList.contains('dark');

            // Configure Mermaid
            mermaid.initialize({
                startOnLoad: false,
                theme: 'base',
                securityLevel: 'loose',
                fontFamily: 'inherit',
                themeVariables: isDark ? {
                    darkMode: true,
                    background: '#18181b',
                    primaryColor: '#27272a',
                    primaryTextColor: '#ffffff',
                    secondaryColor: '#27272a',
                    tertiaryColor: '#18181b',
                    edgeLabelBackground: '#18181b',
                    lineColor: '#a1a1aa',
                    textColor: '#ffffff',
                    mainBkg: '#18181b',
                    nodeBorder: '#3f3f46',
                    clusterBkg: '#18181b',
                    clusterBorder: '#3f3f46',
                    fontSize: '15px',
                } : {
                    darkMode: false,
                    background: '#ffffff',
                    primaryColor: '#f4f4f5',
                    primaryTextColor: '#18181b',
                    secondaryColor: '#ffffff',
                    tertiaryColor: '#ffffff',
                    edgeLabelBackground: '#ffffff',
                    lineColor: '#52525b',
                    textColor: '#18181b',
                    mainBkg: '#ffffff',
                    nodeBorder: '#e4e4e7',
                    clusterBkg: '#fafafa',
                    clusterBorder: '#e4e4e7',
                    fontSize: '15px',
                }
            });

            let cleanCode = diagramCode;
            cleanCode = cleanCode.replace(/^graph CR/m, 'graph LR');
            cleanCode = cleanCode.replace(/^graph CL/m, 'graph RL');
            // Removed aggressive replacements that break ER diagrams (||--||)
            // cleanCode = cleanCode.replace(/\|\-\-/g, '-->'); 
            cleanCode = cleanCode.replace(/\+\-\-/g, '-->');

            // Validate syntax before rendering
            try {
                await mermaid.parse(cleanCode);
            } catch (e) {
                throw new Error((e as Error).message);
            }

            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
            const { svg } = await mermaid.render(id, cleanCode);
            setSvg(svg);
        } catch (err) {
            const msg = (err instanceof Error ? err.message : String(err));
            // Show all errors to prevent blank boxes, but formatted
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Debounced Render Effect
    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            renderDiagram(code);
        }, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [code, renderDiagram]);

    useEffect(() => {
        if (!isFullscreen) {
            setScale(1);
            setPan({ x: 0, y: 0 });
        }
    }, [isFullscreen]);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagram-${Date.now()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!isFullscreen) return;

        const delta = -e.deltaY * 0.008; // Faster zoom speed
        const newScale = Math.min(20, Math.max(0.2, scale + delta)); // Max 20x (2000%)

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const worldX = (mouseX - pan.x) / scale;
        const worldY = (mouseY - pan.y) / scale;

        const newPanX = mouseX - (worldX * newScale);
        const newPanY = mouseY - (worldY * newScale);

        setScale(newScale);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isFullscreen) return;
        if (e.button === 2) {
            e.preventDefault();
            setIsDragging(true);
            dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isFullscreen || !isDragging) return;
        e.preventDefault();
        setPan({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isFullscreen) return;
        if (e.touches.length === 1) {
            setIsDragging(true);
            const touch = e.touches[0];
            dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
        } else if (e.touches.length === 2) {
            pinchStartDist.current = getDistance(e.touches[0], e.touches[1]);
            pinchStartScale.current = scale;
            setIsDragging(false);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isFullscreen) return;

        if (e.touches.length === 1 && isDragging) {
            const touch = e.touches[0];
            setPan({
                x: touch.clientX - dragStart.current.x,
                y: touch.clientY - dragStart.current.y
            });
        } else if (e.touches.length === 2) {
            const dist = getDistance(e.touches[0], e.touches[1]);
            if (pinchStartDist.current > 0) {
                const ratio = dist / pinchStartDist.current;
                const newScale = Math.min(20, Math.max(0.2, pinchStartScale.current * ratio));
                setScale(newScale);
            }
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (isFullscreen) {
            e.preventDefault();
        }
    };

    return (
        <>
            <div className="group relative my-8 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm transition-all hover:shadow-md">
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                        className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 text-gray-500 hover:text-black dark:hover:text-white shadow-sm transition-all hover:scale-105"
                        title="Fullscreen"
                    >
                        <Maximize2 size={16} />
                    </button>
                    <button
                        onClick={handleDownload}
                        className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 text-gray-500 hover:text-black dark:hover:text-white shadow-sm transition-all hover:scale-105"
                        title="Download SVG"
                    >
                        <Download size={16} />
                    </button>
                </div>

                <div className="relative p-8 overflow-x-auto custom-scrollbar flex justify-center min-h-[200px]">
                    {isLoading && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm transition-all duration-300">
                            <div className="relative flex items-center justify-center mb-4">
                                <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-600 dark:border-indigo-400/20 dark:border-t-indigo-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-500 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 tracking-[0.2em] uppercase animate-pulse">Rendering Schematic</span>
                                <span className="text-[10px] text-zinc-400 font-mono">Parsing Structure...</span>
                            </div>
                        </div>
                    )}

                    {!error ? (
                        <div
                            className={`mermaid-container w-full h-full flex justify-center items-center transition-opacity duration-300 ${isLoading ? 'opacity-30' : 'opacity-100'}`}
                            dangerouslySetInnerHTML={{ __html: svg }}
                            style={{ fontFamily: 'inherit' }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center text-amber-600 dark:text-amber-500 w-full">
                            <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
                            <p className="text-sm font-medium">Visual Generation Pending...</p>
                            <p className="text-xs opacity-70 mt-1 max-w-md truncate">{error.slice(0, 100)}...</p>
                        </div>
                    )}
                </div>
            </div>

            {isFullscreen && (
                <Portal>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-white/95 dark:bg-black/95 backdrop-blur-md flex flex-col font-sans"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onContextMenu={handleContextMenu}
                    >
                        <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-50 shadow-sm relative pointer-events-auto">
                            <h3 className="font-display font-bold text-lg text-black dark:text-white flex items-center gap-2">
                                <span className="hidden md:inline">Diagram View</span>
                                <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                    {Math.round(scale * 100)}%
                                </span>
                            </h3>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="p-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors rounded-md hover:bg-white dark:hover:bg-white/10"><ZoomOut size={18} /></button>
                                    <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="px-3 py-1 text-xs font-mono text-gray-500 hover:text-black dark:hover:text-white transition-colors border-x border-gray-200 dark:border-white/5 mx-1" title="Reset Zoom">Reset</button>
                                    <button onClick={() => setScale(s => Math.min(20, s + 0.5))} className="p-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors rounded-md hover:bg-white dark:hover:bg-white/10"><ZoomIn size={18} /></button>
                                </div>
                                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-4" />
                                <button onClick={() => setIsFullscreen(false)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors"><X size={24} /></button>
                            </div>
                        </div>

                        <div
                            className={`flex-1 overflow-hidden relative ${isDragging ? 'cursor-grabbing' : 'cursor-text'} bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]`}
                            style={{ touchAction: 'none' }}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                                    transformOrigin: '0 0',
                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                }}
                                className="w-full h-full flex items-center justify-center p-20"
                            >
                                <div className="mermaid-container pointer-events-auto select-text" dangerouslySetInnerHTML={{ __html: svg }} />
                            </div>
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white text-xs rounded-full shadow-lg backdrop-blur-sm pointer-events-none opacity-50 whitespace-nowrap">
                                Drag to Pan • Zoom Buttons
                            </div>
                        </div>
                    </motion.div>
                </Portal>
            )}
        </>
    );
});
