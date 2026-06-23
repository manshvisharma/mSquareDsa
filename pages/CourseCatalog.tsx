import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Loader2, Star, Clock } from 'lucide-react';
import { learnAdminService } from '../services/learnAdminService';
import { Course } from '../types';

export default function CourseCatalog() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        setLoading(true);
        const data = await learnAdminService.getCourses();
        setCourses(data);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Learn to Code</h1>
                <p className="text-gray-500 dark:text-gray-400 text-lg">Interactive courses to level up your skills.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map(course => (
                    <div 
                        key={course.id}
                        onClick={() => navigate(`/learn/${course.slug}`)}
                        className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-all transform hover:-translate-y-1"
                    >
                        <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <BookOpen size={48} className="text-white opacity-90" />
                        </div>
                        <div className="p-5">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{course.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                                {course.description || 'No description provided.'}
                            </p>
                            <div className="flex items-center justify-between text-sm font-medium">
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1 text-amber-500"><Star size={14} /> 4.9</span>
                                </div>
                                <span className="text-primary-600 dark:text-primary-400 flex items-center gap-1 group-hover:text-primary-700">
                                    Start <ChevronRight size={16} />
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                
                {courses.length === 0 && (
                    <div className="col-span-12 text-center py-20 bg-gray-50 dark:bg-dark-surface rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                        <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Check back soon!</h3>
                        <p className="text-gray-500 dark:text-gray-400">Courses are being prepared by the administrators.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
