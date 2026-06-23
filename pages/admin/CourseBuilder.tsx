import React, { useState, useEffect } from 'react';
import { BookOpen, Folder, PlayCircle, Layers, Plus, Edit2, Trash2, ChevronRight, Settings, Loader2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { learnAdminService } from '../../services/learnAdminService';
import { Course, LearningTopic, Lesson, Slide, SlideType, SlideConfig } from '../../types';

type ViewState = 'courses' | 'topics' | 'lessons' | 'slides';

export default function CourseBuilder() {
    const [view, setView] = useState<ViewState>('courses');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<LearningTopic | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

    const [courses, setCourses] = useState<Course[]>([]);
    const [topics, setTopics] = useState<LearningTopic[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedSlide, setSelectedSlide] = useState<Slide | null>(null);
    const [slideForm, setSlideForm] = useState<Partial<Slide>>({});
    const [isCreatingSlide, setIsCreatingSlide] = useState(false);

    // Modal states
    const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    
    // Form states
    const [courseForm, setCourseForm] = useState<Partial<Course>>({});
    const [topicForm, setTopicForm] = useState<Partial<LearningTopic>>({});
    const [lessonForm, setLessonForm] = useState<Partial<Lesson>>({});

    useEffect(() => {
        loadCourses();
    }, []);

    useEffect(() => {
        if (view === 'topics' && selectedCourse) loadTopics(selectedCourse.id!);
        if (view === 'lessons' && selectedTopic) loadLessons(selectedTopic.id!);
        if (view === 'slides' && selectedLesson) loadSlides(selectedLesson.id!);
    }, [view, selectedCourse, selectedTopic, selectedLesson]);

    const loadCourses = async () => {
        setLoading(true);
        const data = await learnAdminService.getCourses();
        setCourses(data);
        setLoading(false);
    };

    const loadTopics = async (courseId: string) => {
        setLoading(true);
        const data = await learnAdminService.getTopics(courseId);
        setTopics(data);
        setLoading(false);
    };

    const loadLessons = async (topicId: string) => {
        setLoading(true);
        const data = await learnAdminService.getLessons(topicId);
        setLessons(data);
        setLoading(false);
    };

    const loadSlides = async (lessonId: string) => {
        setLoading(true);
        const data = await learnAdminService.getSlides(lessonId);
        setSlides(data);
        setLoading(false);
    };

    // Form Handlers
    const handleSaveCourse = async () => {
        if (!courseForm.title || !courseForm.slug) return;
        setLoading(true);
        await learnAdminService.createCourse({
            title: courseForm.title,
            slug: courseForm.slug,
            description: courseForm.description || '',
            thumbnail: courseForm.thumbnail || '',
            order: courses.length + 1
        } as Course);
        setIsCourseModalOpen(false);
        setCourseForm({});
        await loadCourses();
    };

    const handleDeleteCourse = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm("Are you sure?")) return;
        await learnAdminService.deleteCourse(id);
        await loadCourses();
    };

    const handleSaveTopic = async () => {
        if (!topicForm.title || !selectedCourse) return;
        setLoading(true);
        await learnAdminService.createTopic({
            title: topicForm.title,
            description: topicForm.description || '',
            course_id: selectedCourse.id!,
            xp: Number(topicForm.xp || 50),
            estimated_time: Number(topicForm.estimated_time || 15),
            order: topics.length + 1
        } as LearningTopic);
        setIsTopicModalOpen(false);
        setTopicForm({});
        await loadTopics(selectedCourse.id!);
    };

    const handleDeleteTopic = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm("Are you sure?")) return;
        await learnAdminService.deleteTopic(id);
        await loadTopics(selectedCourse!.id!);
    };

    const handleSaveLesson = async () => {
        if (!lessonForm.title || !selectedTopic || !lessonForm.type) return;
        setLoading(true);
        await learnAdminService.createLesson({
            title: lessonForm.title,
            type: lessonForm.type as any,
            topic_id: selectedTopic.id!,
            order: lessons.length + 1
        } as Lesson);
        setIsLessonModalOpen(false);
        setLessonForm({});
        await loadLessons(selectedTopic.id!);
    };

    const handleDeleteLesson = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm("Are you sure?")) return;
        await learnAdminService.deleteLesson(id);
        await loadLessons(selectedTopic!.id!);
    };

    const handleAddSlide = () => {
        setSelectedSlide(null);
        setSlideForm({
            type: 'theory',
            configuration_json: {}
        });
        setIsCreatingSlide(true);
    };

    const handleEditSlide = (slide: Slide) => {
        setSelectedSlide(slide);
        setSlideForm(slide);
        setIsCreatingSlide(true);
    };

    const handleSaveSlide = async () => {
        if (!slideForm.title || !slideForm.type || !selectedLesson) return;
        setLoading(true);

        const slideData = {
            lesson_id: selectedLesson.id!,
            title: slideForm.title,
            type: slideForm.type as SlideType,
            content: slideForm.content || '',
            configuration_json: slideForm.configuration_json || {},
            order: Number(slideForm.order) || (slides.length + (selectedSlide ? 0 : 1))
        };

        if (selectedSlide?.id) {
            await learnAdminService.updateSlide(selectedSlide.id, slideData);
        } else {
            await learnAdminService.createSlide(slideData);
        }
        
        setIsCreatingSlide(false);
        setSlideForm({});
        setSelectedSlide(null);
        await loadSlides(selectedLesson.id!);
    };

    const handleDeleteSlide = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm("Are you sure?")) return;
        await learnAdminService.deleteSlide(id);
        if (selectedSlide?.id === id) {
            setIsCreatingSlide(false);
            setSlideForm({});
            setSelectedSlide(null);
        }
        await loadSlides(selectedLesson!.id!);
    };

    const handleSeedDemo = async () => {
        setLoading(true);
        try {
            const course = await learnAdminService.createCourse({
                title: "Introduction to HTML",
                slug: "intro-to-html",
                description: "Learn the foundation of the web. This course covers everything you need to know to build well-structured web pages.",
                thumbnail: "",
                order: 1
            } as Course);

            const topic1 = await learnAdminService.createTopic({
                course_id: course.id!,
                title: "Getting Started",
                description: "Learn what HTML is and how to create your first web page.",
                order: 1,
                xp: 100,
                estimated_time: 15
            } as LearningTopic);

            const topic2 = await learnAdminService.createTopic({
                course_id: course.id!,
                title: "Text & Structure",
                description: "Learn how to format text, create headings, lists, and paragraphs.",
                order: 2,
                xp: 150,
                estimated_time: 25
            } as LearningTopic);

            const lesson1 = await learnAdminService.createLesson({
                topic_id: topic1.id!,
                title: "What is HTML?",
                type: "learn",
                order: 1
            } as Lesson);

            const lesson2 = await learnAdminService.createLesson({
                topic_id: topic1.id!,
                title: "Your First HTML Page",
                type: "practice",
                order: 2
            } as Lesson);

            // Add Slides to Lesson 1
            await learnAdminService.createSlide({
                lesson_id: lesson1.id!,
                title: "The Web is built on HTML",
                type: "theory",
                content: "HTML stands for **HyperText Markup Language**.\n\nIt is the standard markup language for documents designed to be displayed in a web browser. HTML describes the structure of a web page semantically and originally included cues for the appearance of the document.",
                configuration_json: {},
                order: 1
            } as Slide);

            await learnAdminService.createSlide({
                lesson_id: lesson1.id!,
                title: "Knowledge Check",
                type: "quiz",
                content: "What does HTML stand for?",
                configuration_json: {
                    options: ["HyperText Markup Language", "Hyperlinks and Text Markup Language", "Home Tool Markup Language"],
                    correctAnswer: "HyperText Markup Language"
                },
                order: 2
            } as Slide);

            // Add Slides to Lesson 2
            await learnAdminService.createSlide({
                lesson_id: lesson2.id!,
                title: "Write your first tag!",
                type: "code",
                content: "An HTML element is defined by a start tag, some content, and an end tag: `<tagname>content goes here...</tagname>`\n\nTry creating an `<h1>` tag with the text 'Hello World!'",
                configuration_json: {
                    language: "html",
                    starterCode: "<!-- Write your h1 tag below -->\n"
                },
                order: 1
            } as Slide);

            await loadCourses();
            alert("Demo data seeded successfully!");
        } catch (error) {
            console.error("Error seeding data:", error);
            alert("Failed to seed demo data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
                <button onClick={() => { setView('courses'); setSelectedCourse(null); setSelectedTopic(null); setSelectedLesson(null); }} className="hover:text-primary-500 transition-colors">Courses</button>
                {selectedCourse && (
                    <>
                        <ChevronRight size={16} />
                        <button onClick={() => { setView('topics'); setSelectedTopic(null); setSelectedLesson(null); }} className="hover:text-primary-500 transition-colors">{selectedCourse.title}</button>
                    </>
                )}
                {selectedTopic && (
                    <>
                        <ChevronRight size={16} />
                        <button onClick={() => { setView('lessons'); setSelectedLesson(null); }} className="hover:text-primary-500 transition-colors">{selectedTopic.title}</button>
                    </>
                )}
                {selectedLesson && (
                    <>
                        <ChevronRight size={16} />
                        <span className="text-gray-900 dark:text-white capitalize grid-slides">{selectedLesson.title} (Slides)</span>
                    </>
                )}
            </div>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white capitalize">
                        {view === 'courses' ? 'All Courses' : 
                         view === 'topics' ? `Topics in ${selectedCourse?.title}` :
                         view === 'lessons' ? `Lessons in ${selectedTopic?.title}` : 
                         `Slides Builder: ${selectedLesson?.title}`}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Build and arrange learning content dynamically.
                    </p>
                </div>
                {view !== 'slides' && (
                    <div className="flex gap-3">
                        {view === 'courses' && (
                            <button
                                onClick={handleSeedDemo}
                                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-dark-surface dark:hover:bg-dark-border text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                            >
                                Seed Demo Data
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                if(view === 'courses') setIsCourseModalOpen(true);
                                if(view === 'topics') setIsTopicModalOpen(true);
                                if(view === 'lessons') setIsLessonModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                            <Plus size={18} />
                            New {view.slice(0, -1)}
                        </button>
                    </div>
                )}
            </div>

            {loading && (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-primary-500 w-8 h-8" />
                </div>
            )}

            {/* Courses View */}
            {!loading && view === 'courses' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <div key={course.id} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                    <BookOpen size={24} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 text-gray-400 hover:text-primary-500 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface"><Edit2 size={16} /></button>
                                    <button onClick={(e) => handleDeleteCourse(course.id, e)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{course.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">{course.description || `/${course.slug}`}</p>
                            
                            <button 
                                onClick={() => { setSelectedCourse(course); setView('topics'); }}
                                className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors font-medium"
                            >
                                Manage Topics <ChevronRight size={16} />
                            </button>
                        </div>
                    ))}
                    {courses.length === 0 && (
                        <div className="col-span-3 text-center py-12 text-gray-500 border border-dashed border-gray-300 dark:border-dark-border rounded-xl">
                            No courses yet. Click "New Course" to get started.
                        </div>
                    )}
                </div>
            )}

            {/* Topics View */}
            {!loading && view === 'topics' && (
                <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden shadow-sm">
                    {topics.map((topic, i) => (
                        <div key={topic.id} className={`flex items-center justify-between p-4 ${i !== topics.length - 1 ? 'border-b border-gray-200 dark:border-dark-border' : ''} hover:bg-gray-50 dark:hover:bg-dark-surface/50 group`}>
                            <div className="flex items-center gap-4">
                                <div className="text-gray-400">
                                    <Folder size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white">{topic.title}</h4>
                                    <p className="text-xs text-gray-500">Order: {topic.order} | {topic.xp} XP | {topic.estimated_time} mins</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 text-gray-400 hover:text-primary-500 rounded-md hover:bg-white dark:hover:bg-dark-card shadow-sm"><Edit2 size={14} /></button>
                                    <button onClick={(e) => handleDeleteTopic(topic.id, e)} className="p-2 text-gray-400 hover:text-red-500 rounded-md hover:bg-white dark:hover:bg-dark-card shadow-sm"><Trash2 size={14} /></button>
                                </div>
                                <button 
                                    onClick={() => { setSelectedTopic(topic); setView('lessons'); }}
                                    className="bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Lessons {'>'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {topics.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No topics yet for this course.
                        </div>
                    )}
                </div>
            )}

            {/* Lessons View */}
            {!loading && view === 'lessons' && (
                <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden shadow-sm">
                    {lessons.map((lesson, i) => (
                        <div key={lesson.id} className={`flex items-center justify-between p-4 ${i !== lessons.length - 1 ? 'border-b border-gray-200 dark:border-dark-border' : ''} hover:bg-gray-50 dark:hover:bg-dark-surface/50 group`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${lesson.type === 'learn' ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30' : 'bg-orange-50 text-orange-500 dark:bg-orange-900/30'}`}>
                                    <PlayCircle size={18} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white">{lesson.title}</h4>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{lesson.type} • Order: {lesson.order}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 text-gray-400 hover:text-primary-500 rounded-md hover:bg-white dark:hover:bg-dark-card shadow-sm"><Edit2 size={14} /></button>
                                    <button onClick={(e) => handleDeleteLesson(lesson.id, e)} className="p-2 text-gray-400 hover:text-red-500 rounded-md hover:bg-white dark:hover:bg-dark-card shadow-sm"><Trash2 size={14} /></button>
                                </div>
                                <button 
                                    onClick={async () => { 
                                        setSelectedLesson(lesson); 
                                        setView('slides'); 
                                        await loadSlides(lesson.id!);
                                    }}
                                    className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800/50"
                                >
                                    <Layers size={14} /> Open Builder
                                </button>
                            </div>
                        </div>
                    ))}
                    {lessons.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No lessons yet for this topic.
                        </div>
                    )}
                </div>
            )}

            {/* Slides View */}
            {!loading && view === 'slides' && (
                <div className="grid grid-cols-12 gap-6 min-h-[600px]">
                    <div className="col-span-4 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl flex flex-col h-[600px] shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface/50 rounded-t-xl">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">SLIDES</h3>
                            <button onClick={handleAddSlide} className="p-1 text-gray-500 hover:text-primary-500 hover:bg-white dark:hover:bg-dark-card rounded shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-dark-border transition-all">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="p-2 flex-grow overflow-y-auto space-y-2">
                            {slides.map((slide, i) => (
                                <div 
                                    key={slide.id} 
                                    onClick={() => handleEditSlide(slide)}
                                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedSlide?.id === slide.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface'} `}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold tracking-wider ${selectedSlide?.id === slide.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500'}`}>
                                            {String(slide.order || i + 1).padStart(2, '0')}. {slide.type.toUpperCase()}
                                        </span>
                                        <button onClick={(e) => handleDeleteSlide(slide.id, e)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                    <p className={`text-sm font-medium truncate mt-1 ${selectedSlide?.id === slide.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{slide.title}</p>
                                </div>
                            ))}
                            {slides.length === 0 && (
                                <div className="text-sm text-gray-500 text-center py-8">No slides yet. Click + to add one.</div>
                            )}
                        </div>
                    </div>

                    <div className="col-span-8 flex flex-col gap-6">
                        {isCreatingSlide ? (
                            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 shadow-sm min-h-[500px]">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedSlide ? 'Edit Slide' : 'New Slide'}</h3>
                                    <div className="flex gap-2">
                                        <select 
                                            value={slideForm.type || ''} 
                                            onChange={e => setSlideForm({...slideForm, type: e.target.value as SlideType})}
                                            className="px-3 py-1.5 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="theory">Theory</option>
                                            <option value="quiz">Quiz</option>
                                            <option value="code">Code</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                            <input 
                                                type="text" 
                                                value={slideForm.title || ''}
                                                onChange={e => setSlideForm({...slideForm, title: e.target.value})}
                                                className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order</label>
                                            <input 
                                                type="number" 
                                                value={slideForm.order || slides.length + 1}
                                                onChange={e => setSlideForm({...slideForm, order: Number(e.target.value)})}
                                                className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content (Markdown)</label>
                                        <textarea 
                                            rows={6} 
                                            value={slideForm.content || ''}
                                            onChange={e => setSlideForm({...slideForm, content: e.target.value})}
                                            className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all font-mono text-sm resize-none"
                                        ></textarea>
                                    </div>

                                    {/* Type-specific configurations */}
                                    {slideForm.type === 'code' && (
                                        <div className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border space-y-4">
                                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Code Editor Settings</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
                                                    <select 
                                                        value={slideForm.configuration_json?.language || 'html'}
                                                        onChange={e => setSlideForm({
                                                            ...slideForm, 
                                                            configuration_json: {...(slideForm.configuration_json || {}), language: e.target.value}
                                                        })}
                                                        className="w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg px-3 py-1.5 text-gray-900 dark:text-white"
                                                    >
                                                        <option value="html">HTML</option>
                                                        <option value="css">CSS</option>
                                                        <option value="javascript">JavaScript</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validation Regex (Optional)</label>
                                                    <input 
                                                        type="text"
                                                        placeholder="e.g. <h1>.*<\/h1>"
                                                        value={slideForm.configuration_json?.validationRegex || ''}
                                                        onChange={e => setSlideForm({
                                                            ...slideForm, 
                                                            configuration_json: {...(slideForm.configuration_json || {}), validationRegex: e.target.value}
                                                        })}
                                                        className="w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg px-3 py-1.5 text-gray-900 dark:text-white font-mono text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starter Code</label>
                                                <textarea 
                                                    rows={4} 
                                                    value={slideForm.configuration_json?.starterCode || ''}
                                                    onChange={e => setSlideForm({
                                                        ...slideForm, 
                                                        configuration_json: {...(slideForm.configuration_json || {}), starterCode: e.target.value}
                                                    })}
                                                    className="w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-gray-900 dark:text-white font-mono text-sm"
                                                ></textarea>
                                            </div>
                                        </div>
                                    )}

                                    {slideForm.type === 'quiz' && (
                                        <div className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border space-y-4">
                                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Quiz Settings</h4>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options (comma separated)</label>
                                                <input 
                                                    type="text" 
                                                    value={(slideForm.configuration_json?.options || []).join(', ')}
                                                    onChange={e => setSlideForm({
                                                        ...slideForm, 
                                                        configuration_json: {...(slideForm.configuration_json || {}), options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}
                                                    })}
                                                    placeholder="Option A, Option B, Option C"
                                                    className="w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correct Answer (must match one option exactly)</label>
                                                <input 
                                                    type="text" 
                                                    value={slideForm.configuration_json?.correctAnswer || ''}
                                                    onChange={e => setSlideForm({
                                                        ...slideForm, 
                                                        configuration_json: {...(slideForm.configuration_json || {}), correctAnswer: e.target.value}
                                                    })}
                                                    className="w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    )}

                                </div>

                                <div className="flex justify-end gap-3 mt-8">
                                    <button 
                                        onClick={() => { setIsCreatingSlide(false); setSlideForm({}); setSelectedSlide(null); }}
                                        className="px-6 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors">Discard</button>
                                    <button 
                                        onClick={handleSaveSlide}
                                        disabled={!slideForm.title || !slideForm.type}
                                        className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50">Save Slide</button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 shadow-sm min-h-[500px] flex items-center justify-center">
                                <div className="text-gray-500 flex flex-col items-center">
                                    <Layers size={48} className="mb-4 text-gray-300" />
                                    <p>Select a slide to edit or create a new one.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <Modal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} title="Create New Course">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Title</label>
                        <input value={courseForm.title || ''} onChange={e => setCourseForm({...courseForm, title: e.target.value})} type="text" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug (URL friendly)</label>
                        <input value={courseForm.slug || ''} onChange={e => setCourseForm({...courseForm, slug: e.target.value})} type="text" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea value={courseForm.description || ''} onChange={e => setCourseForm({...courseForm, description: e.target.value})} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" rows={3}></textarea>
                    </div>
                    <button onClick={handleSaveCourse} disabled={!courseForm.title || !courseForm.slug} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 rounded-lg disabled:opacity-50">Save Course</button>
                </div>
            </Modal>

            <Modal isOpen={isTopicModalOpen} onClose={() => setIsTopicModalOpen(false)} title="Create New Topic">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic Title</label>
                        <input value={topicForm.title || ''} onChange={e => setTopicForm({...topicForm, title: e.target.value})} type="text" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea value={topicForm.description || ''} onChange={e => setTopicForm({...topicForm, description: e.target.value})} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" rows={2}></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">XP Reward</label>
                            <input value={topicForm.xp || ''} onChange={e => setTopicForm({...topicForm, xp: Number(e.target.value)})} type="number" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. Time (mins)</label>
                            <input value={topicForm.estimated_time || ''} onChange={e => setTopicForm({...topicForm, estimated_time: Number(e.target.value)})} type="number" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                        </div>
                    </div>
                    <button onClick={handleSaveTopic} disabled={!topicForm.title} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 rounded-lg disabled:opacity-50">Save Topic</button>
                </div>
            </Modal>

            <Modal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)} title="Create New Lesson">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lesson Title</label>
                        <input value={lessonForm.title || ''} onChange={e => setLessonForm({...lessonForm, title: e.target.value})} type="text" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <select value={lessonForm.type || ''} onChange={e => setLessonForm({...lessonForm, type: e.target.value as any})} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white">
                            <option value="">Select Type...</option>
                            <option value="learn">Learn</option>
                            <option value="practice">Practice</option>
                            <option value="quiz">Quiz</option>
                            <option value="project">Project</option>
                        </select>
                    </div>
                    <button onClick={handleSaveLesson} disabled={!lessonForm.title || !lessonForm.type} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 rounded-lg disabled:opacity-50">Save Lesson</button>
                </div>
            </Modal>

        </div>
    );
}
