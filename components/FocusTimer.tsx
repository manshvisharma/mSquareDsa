import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw, X, Target } from 'lucide-react';

export const FocusTimer = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes default
    const [isRunning, setIsRunning] = useState(false);
    
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsRunning(false);
            // Play notification sound
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
        return () => clearInterval(interval);
    }, [isRunning, timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleReset = () => {
        setIsRunning(false);
        setTimeLeft(25 * 60);
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 left-6 p-4 bg-slate-900 glass-container dark:bg-primary-600 text-white rounded-full shadow-2xl hover:-translate-y-1 hover:shadow-primary-500/30 transition-all z-40 group flexItems-center gap-0 border border-slate-700 dark:border-primary-500"
                title="Focus Mode"
            >
                <Timer size={24} className={isRunning ? 'animate-pulse text-emerald-400' : ''} />
                {isRunning && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-white dark:ring-dark-bg">
                        {formatTime(timeLeft)}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 left-6 w-72 bg-white dark:bg-dark-card glass-container rounded-3xl shadow-2xl border border-gray-200 dark:border-dark-border z-40 overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95">
            <div className="bg-slate-900 dark:bg-primary-900/40 p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-2 font-bold">
                    <Target size={18} className="text-primary-400" /> Focus Mode
                </div>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>
            <div className="p-6 text-center">
                <div className={`text-5xl font-black mb-6 tracking-tight font-mono ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-white'}`}>
                    {formatTime(timeLeft)}
                </div>
                
                <div className="flex justify-center gap-4">
                    <button 
                        onClick={() => setIsRunning(!isRunning)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-white transform transition-all active:scale-95 shadow-md ${isRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-primary-600 hover:bg-primary-700'}`}
                    >
                        {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                    </button>
                    <button 
                        onClick={handleReset}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transform transition-all active:scale-95"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-dark-surface/50 p-3 flex justify-around text-xs font-bold text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-dark-border">
                <button onClick={() => { setTimeLeft(15 * 60); setIsRunning(false); }} className="hover:text-primary-600 transition-colors">15m</button>
                <button onClick={() => { setTimeLeft(25 * 60); setIsRunning(false); }} className="hover:text-primary-600 transition-colors">25m</button>
                <button onClick={() => { setTimeLeft(50 * 60); setIsRunning(false); }} className="hover:text-primary-600 transition-colors">50m</button>
            </div>
        </div>
    );
}
