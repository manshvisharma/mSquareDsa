import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, CheckCircle, XCircle, Code, Loader2, Play, Award, Sparkles } from 'lucide-react';
import { learnAdminService } from '../services/learnAdminService';
import { Slide } from '../types';
import Markdown from 'react-markdown';
import { useAuth } from '../App';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants';
import Editor from '@monaco-editor/react';
import confetti from 'canvas-confetti';

export default function LessonPlayer() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const { user, profile, refreshProfile } = useAuth();

    const [slides, setSlides] = useState<Slide[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    // Interactive states
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isLessonComplete, setIsLessonComplete] = useState(false);
    
    // AI Tutor states
    const [isRequestingHint, setIsRequestingHint] = useState(false);
    const [aiHint, setAiHint] = useState<string | null>(null);

    // Code states
    const [codeValue, setCodeValue] = useState('');

    useEffect(() => {
        if (lessonId) loadLesson();
    }, [lessonId]);

    const loadLesson = async () => {
        setLoading(true);
        const data = await learnAdminService.getSlides(lessonId!);
        setSlides(data);
        if (data.length > 0 && data[0].type === 'code') {
            setCodeValue(data[0].configuration_json?.starterCode || '');
        }
        setLoading(false);
    };

    const handleNext = async () => {
        if (currentIndex < slides.length - 1) {
            const nextSlide = slides[currentIndex + 1];
            setCurrentIndex(currentIndex + 1);
            // Reset states
            setSelectedOption(null);
            setIsCorrect(null);
            setAiHint(null);
            if (nextSlide.type === 'code') {
                setCodeValue(nextSlide.configuration_json?.starterCode || '');
            }
        } else {
            // Finished
            setIsLessonComplete(true);
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899']
            });

            if (user && lessonId && !profile?.completedLessons?.[lessonId]) {
                const updates: any = {
                    [`completedLessons.${lessonId}`]: Date.now(),
                    points: increment(50)
                };
                try {
                    await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), updates);
                    refreshProfile();
                } catch(e) {
                    console.error("Failed to update progress", e);
                }
            }
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            const prevSlide = slides[currentIndex - 1];
            setCurrentIndex(currentIndex - 1);
             // Reset states
             setSelectedOption(null);
             setIsCorrect(null);
             setAiHint(null);
             if (prevSlide.type === 'code') {
                 setCodeValue(prevSlide.configuration_json?.starterCode || ''); // usually we'd keep user code in state but this is simple mockup
             }
        }
    };

    const handleQuizSelect = (option: string) => {
        const slide = slides[currentIndex];
        setSelectedOption(option);
        const correct = slide.configuration_json?.correctAnswer || '';
        setIsCorrect(option === correct);
    };

    const handleCodeSubmit = () => {
        const slide = slides[currentIndex];
        const rule = slide.configuration_json?.validationRegex;
        
        if (rule) {
            try {
                const regex = new RegExp(rule);
                const passed = regex.test(codeValue);
                setIsCorrect(passed);
                if (!passed) {
                    alert('Validation failed. Try again!');
                }
            } catch (e) {
                console.error("Regex error", e);
                setIsCorrect(true); // pass anyway if regex fails
            }
        } else {
            setIsCorrect(true);
        }
    };

    const askAITutor = async () => {
        if (!codeValue) return;
        setIsRequestingHint(true);
        try {
            const currentSlide = slides[currentIndex];
            const response = await fetch('/api/tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: codeValue,
                    instructions: currentSlide.content,
                    errorMsg: "Code failed to match required output pattern."
                }),
            });
            const data = await response.json();
            if (data.hint) {
                setAiHint(data.hint);
            } else {
                setAiHint("Hmm, not sure what happened there. Try adjusting your syntax!");
            }
        } catch(e) {
            setAiHint("I couldn't reach the AI tutor right now.");
        } finally {
            setIsRequestingHint(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    if (slides.length === 0) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Slides Yet</h2>
                <p className="text-gray-500 mb-8">This lesson doesn't have any content configured yet.</p>
                <button onClick={() => navigate(-1)} className="text-primary-600 hover:text-primary-700 font-medium">Go Back</button>
            </div>
        );
    }

    if (isLessonComplete) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-20 min-h-[85vh] flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <Award size={48} />
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">Lesson Complete!</h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md">
                    Outstanding work. You've mastered all the concepts in this lesson. Keep the streak going!
                </p>
                
                <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl p-6 shadow-sm mb-10 min-w-[280px]">
                    <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Rewards Earned</div>
                    <div className="flex items-center justify-center gap-3 text-2xl font-black text-amber-500">
                        <span>+50</span> <span className="text-gray-900 dark:text-white">XP</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-transform active:scale-95 shadow-sm"
                    >
                        Continue Journey
                    </button>
                </div>
            </div>
        );
    }

    const currentSlide = slides[currentIndex];
    const progress = ((currentIndex + 1) / slides.length) * 100;

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 min-h-[85vh] flex flex-col">
            {/* Header & Progress */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex-grow bg-gray-200 dark:bg-dark-border h-2.5 rounded-full overflow-hidden">
                    <div className="bg-primary-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="text-sm font-bold text-gray-500">{currentIndex + 1} / {slides.length}</span>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-gray-100 dark:border-dark-border flex-grow overflow-y-auto">
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">{currentSlide.title}</h1>
                    
                    <div className="prose prose-indigo dark:prose-invert max-w-none mb-8">
                        <Markdown>{currentSlide.content}</Markdown>
                    </div>

                    {/* Interactive Elements based on Type */}
                    {currentSlide.type === 'quiz' && (
                        <div className="space-y-3 mt-8">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4">Select the correct answer:</h3>
                            {(currentSlide.configuration_json?.options || []).map((opt, idx) => {
                                const isSelected = selectedOption === opt;
                                let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all font-medium text-gray-700 dark:text-gray-200";
                                if (isSelected) {
                                    if (isCorrect) btnClass += " border-green-500 bg-green-50 dark:bg-green-900/20";
                                    else btnClass += " border-red-500 bg-red-50 dark:bg-red-900/20";
                                } else {
                                    btnClass += " border-gray-200 dark:border-dark-border hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-dark-surface";
                                }

                                return (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleQuizSelect(opt)}
                                        disabled={isCorrect === true}
                                        className={btnClass}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{opt}</span>
                                            {isSelected && isCorrect && <CheckCircle className="text-green-500 w-5 h-5" />}
                                            {isSelected && isCorrect === false && <XCircle className="text-red-500 w-5 h-5" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {currentSlide.type === 'code' && (
                        <div className="mt-6 flex flex-col h-[450px]">
                            <div className="flex-grow grid grid-cols-2 gap-2">
                                <div className="h-full border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden flex flex-col">
                                    <div className="bg-gray-100 dark:bg-[#2d2d2d] px-4 py-2 border-b border-gray-200 dark:border-[#3e3e3e] flex justify-between items-center text-xs font-mono text-gray-500 dark:text-gray-400">
                                        <span>{currentSlide.configuration_json?.language || 'main.js'}</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={askAITutor}
                                                disabled={isRequestingHint || isCorrect === true}
                                                className="flex items-center gap-1.5 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded transition-colors disabled:opacity-50"
                                            >
                                                {isRequestingHint ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} fill="currentColor" />} 
                                                Ask AI
                                            </button>
                                            <button 
                                                onClick={handleCodeSubmit}
                                                className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded transition-colors"
                                            >
                                                <Play size={12} fill="currentColor"/> Run
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-grow relative">
                                        <Editor
                                            height="100%"
                                            language={currentSlide.configuration_json?.language || 'html'}
                                            theme="vs-dark"
                                            value={codeValue}
                                            onChange={(v) => setCodeValue(v || '')}
                                            options={{
                                                minimap: { enabled: false },
                                                fontSize: 14,
                                                padding: { top: 16 }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="h-full border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden bg-white flex flex-col">
                                    <div className="bg-gray-100 dark:bg-[#2d2d2d] px-4 py-2 border-b border-gray-200 dark:border-[#3e3e3e] flex justify-between items-center text-xs font-mono text-gray-500 dark:text-gray-400">
                                        <span>Live Preview</span>
                                    </div>
                                    <iframe 
                                        title="preview"
                                        className="w-full h-full bg-white flex-grow"
                                        srcDoc={
                                            currentSlide.configuration_json?.language === 'html'
                                                ? codeValue
                                                : `<html><body><script>${codeValue}<\/script><\/body><\/html>`
                                        }
                                    />
                                </div>
                            </div>
                            
                            {isCorrect && (
                                <div className="mt-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-3 border border-green-200 dark:border-green-900/50 rounded-lg flex items-center gap-2 font-medium text-sm">
                                    <CheckCircle size={16} /> Code passed!
                                </div>
                            )}

                            {!isCorrect && aiHint && (
                                <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 p-4 border border-indigo-200 dark:border-indigo-900/50 rounded-lg flex items-start gap-3">
                                    <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                                    <div className="text-sm prose prose-sm prose-indigo dark:prose-invert">
                                        <Markdown>{aiHint}</Markdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-gray-50 dark:bg-dark-surface border-t border-gray-200 dark:border-dark-border flex justify-between items-center">
                    <button 
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="px-4 py-2 text-gray-500 font-medium hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                    >
                        Previous
                    </button>
                    
                    {currentSlide.type === 'theory' || isCorrect ? (
                        <button 
                            onClick={handleNext}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium transition-transform active:scale-95 shadow-sm"
                        >
                            {currentIndex === slides.length - 1 ? 'Finish Lesson' : 'Continue'} <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button 
                            disabled
                            className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 px-6 py-2 rounded-lg font-medium cursor-not-allowed"
                        >
                            Complete below to continue
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
