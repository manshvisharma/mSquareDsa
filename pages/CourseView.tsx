import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, CheckCircle, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { learnAdminService } from '../services/learnAdminService';
import { Course, LearningTopic, Lesson } from '../types';
import { useAuth } from '../App';

export default function CourseView() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();
    
    // We would normally index courses by slug. For now we will fetch all and find.
    const [course, setCourse] = useState<Course | null>(null);
    const [topics, setTopics] = useState<LearningTopic[]>([]);
    
    // For storing lessons per topic so we can display them in the tree
    const [topicLessons, setTopicLessons] = useState<Record<string, Lesson[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCourseData();
    }, [slug]);

    const loadCourseData = async () => {
        setLoading(true);
        const allCourses = await learnAdminService.getCourses();
        const found = allCourses.find(c => c.slug === slug);
        if (found && found.id) {
            setCourse(found);
            const loadedTopics = await learnAdminService.getTopics(found.id);
            setTopics(loadedTopics);
            
            // Load lessons for all topics
            const lessonsMap: Record<string, Lesson[]> = {};
            for (const t of loadedTopics) {
                if(t.id) {
                    const l = await learnAdminService.getLessons(t.id);
                    lessonsMap[t.id] = l;
                }
            }
            setTopicLessons(lessonsMap);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    if (!course) {
        return <div className="text-center py-20 text-gray-500">Course not found.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <button 
                onClick={() => navigate('/learn')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6 font-medium transition-colors"
            >
                <ArrowLeft size={16} /> Back to Courses
            </button>

            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 mb-12 text-white shadow-lg">
                <h1 className="text-3xl font-extrabold mb-2">{course.title}</h1>
                <p className="opacity-90 max-w-2xl">{course.description}</p>
            </div>

            <div className="space-y-12 relative before:absolute before:inset-0 before:ml-[39px] before:-translate-x-px md:before:ml-1/2 md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-dark-border">
                {topics.map((topic, index) => (
                    <div key={topic.id} className="relative z-10 flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        
                        {/* Center Node */}
                        <div className="flex items-center justify-center w-20 h-20 rounded-full border-4 border-white dark:border-gray-900 bg-indigo-100 dark:bg-indigo-900/50 shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 mx-auto">
                            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{index + 1}</span>
                        </div>

                        {/* Content Card */}
                        <div className="w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{topic.title}</h3>
                                <div className="text-xs font-bold bg-gray-100 dark:bg-dark-surface px-2 py-1 rounded text-gray-500">
                                    {topic.xp} XP
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{topic.description}</p>
                            
                            <div className="space-y-2">
                                {(topicLessons[topic.id!] || []).map((lesson, lIdx) => {
                                    const isCompleted = profile?.completedLessons?.[lesson.id!];
                                    return (
                                    <button 
                                        key={lesson.id}
                                        onClick={() => navigate(`/learn/lesson/${lesson.id}`)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-dark-border hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group/btn"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isCompleted ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 dark:bg-dark-surface group-hover/btn:bg-primary-100 dark:group-hover/btn:bg-primary-900/50 group-hover/btn:text-primary-600 dark:group-hover/btn:text-primary-400'}`}>
                                                {isCompleted ? <CheckCircle size={16} /> : <Play size={14} className="ml-0.5" />}
                                            </div>
                                            <span className={`text-sm font-medium ${isCompleted ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>{lesson.title}</span>
                                        </div>
                                    </button>
                                )})}
                                {!(topicLessons[topic.id!]?.length) && (
                                    <div className="text-sm text-gray-400 italic px-2">No lessons yet</div>
                                )}
                            </div>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}
