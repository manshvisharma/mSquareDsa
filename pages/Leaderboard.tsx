import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, addDoc, onSnapshot, where, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';
import { UserProfile, DirectMessage } from '../types';
import { Trophy, Flame, User, MessageCircle, Heart, Lock, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const Leaderboard = () => {
    const { profile, user, refreshProfile } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [messageText, setMessageText] = useState('');
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [timeframe, setTimeframe] = useState<'all' | 'weekly' | 'monthly'>('all');
    const [sqlIds, setSqlIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadLeaderboard();
        
        // Let's ensure the current user has a username to participate fully
        if (user && profile && !profile.username) {
            const generateUsername = async () => {
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                const suggested = ((profile.displayName || '').replace(/\s+/g, '') || 'coder').toLowerCase() + randomNum;
                await setDoc(doc(db, COLLECTIONS.USERS, user.uid), { username: suggested }, { merge: true });
            };
            generateUsername();
        }
    }, [profile, timeframe]);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const sqlQ = profile?.role === 'admin' ? collection(db, "sqlProblems") : query(collection(db, "sqlProblems"), where("published", "==", true));
            const sqlSnap = await getDocs(sqlQ);
            const sIds = new Set<string>();
            sqlSnap.docs.forEach(d => sIds.add(d.id));
            setSqlIds(sIds);

            const ref = collection(db, COLLECTIONS.USERS);
            const snap = await getDocs(query(ref));
            let allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
                .filter(u => !u.privacySettings?.hideStats)
                .filter(u => u.role !== 'admin' && (u as any).isAdmin !== true && u.email?.toLowerCase() !== '17monusharma@gmail.com');

            try {
                const subSnap = await getDocs(collection(db, "sqlSubmissions"));
                const sqlSubs = new Map<string, Map<string, number>>();
                subSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.status === "Accepted") {
                        if (!sqlSubs.has(data.userId)) sqlSubs.set(data.userId, new Map());
                        const existing = sqlSubs.get(data.userId)!.get(data.problemId) || 0;
                        sqlSubs.get(data.userId)!.set(data.problemId, Math.max(existing, data.timestamp || Date.now() - 10000));
                    }
                });
                
                allUsers = allUsers.map(u => {
                    const subMap1 = sqlSubs.get(u.uid);
                    const subMap2 = sqlSubs.get(u.username!);
                    if (subMap1 || subMap2) {
                        u.completedProblems = u.completedProblems || {};
                        if (subMap1) subMap1.forEach((ts, pid) => { if (!u.completedProblems![pid]) u.completedProblems![pid] = ts; });
                        if (subMap2) subMap2.forEach((ts, pid) => { if (!u.completedProblems![pid]) u.completedProblems![pid] = ts; });
                    }
                    return u;
                });
            } catch (e) {
                // Ignore permission error - we fallback to completedProblems for users
            }

            const now = Date.now();
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            const oneMonth = 30 * 24 * 60 * 60 * 1000;

            // Sort logic based on timeframe
            allUsers.sort((a, b) => {
                const aProbs = Object.values(a.completedProblems || {}).filter(ts => {
                    if (timeframe === 'weekly') return ts && (now - ts < oneWeek);
                    if (timeframe === 'monthly') return ts && (now - ts < oneMonth);
                    return true;
                }).length;
                const bProbs = Object.values(b.completedProblems || {}).filter(ts => {
                    if (timeframe === 'weekly') return ts && (now - ts < oneWeek);
                    if (timeframe === 'monthly') return ts && (now - ts < oneMonth);
                    return true;
                }).length;

                if (bProbs !== aProbs) return bProbs - aProbs;
                return (b.maxStreak || 0) - (a.maxStreak || 0);
            });
            setUsers(allUsers);
        } catch (error) {
            console.error("Error loading leaderboard", error);
        }
        setLoading(false);
    };

    const handleSendMessage = async () => {
        if (!user || !profile || !selectedUser || !messageText.trim()) return;
        try {
            const msgObj = {
                senderId: user.uid,
                senderName: profile.username || profile.displayName || profile.email?.split('@')[0] || 'Anonymous',
                receiverId: selectedUser.uid,
                content: messageText.trim(),
                timestamp: Date.now(),
                read: false
            };
            await addDoc(collection(db, COLLECTIONS.MESSAGES), msgObj);
            setSendSuccess(true);
            setTimeout(() => {
                setSendSuccess(false);
                setShowMessageModal(false);
                setMessageText('');
            }, 1500);
        } catch (err) {
            console.error(err);
            alert("Failed to send message");
        }
    };

    const handleFollowToggle = async (targetUser: UserProfile) => {
        if (!user || !profile) return;
        const targetId = targetUser.uid;
        const following = profile.following || [];
        const isFollowing = following.includes(targetId);

        const newFollowing = isFollowing ? following.filter(id => id !== targetId) : [...following, targetId];
        
        try {
            // Update current user
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), { following: newFollowing }, { merge: true });
            await refreshProfile();
            loadLeaderboard(); // refresh data
        } catch (err) {
            console.error(err);
            alert("Failed to update follow status.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center"><div className="animate-pulse flex flex-col items-center"><div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div><p>Loading Leaderboard...</p></div></div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-dark-card glass-panel p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border">
                 <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                      <Trophy className="text-yellow-500" />
                      Hall of Fame
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      See how you stack up against the top coders globally.
                    </p>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="bg-gray-100 dark:bg-dark-surface p-1 rounded-xl flex shadow-inner">
                        <button onClick={() => setTimeframe('weekly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeframe === 'weekly' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'}`}>Weekly</button>
                        <button onClick={() => setTimeframe('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeframe === 'monthly' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'}`}>Monthly</button>
                        <button onClick={() => setTimeframe('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeframe === 'all' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'}`}>All Time</button>
                     </div>
                     <Link to="/inbox" className="px-5 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-bold border border-primary-200 dark:border-primary-800 flex items-center gap-2 hover:bg-primary-100 transition-colors">
                         <MessageCircle size={18} /> My Inbox
                     </Link>
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((u, i) => {
                    const now = Date.now();
                    const oneWeek = 7 * 24 * 60 * 60 * 1000;
                    const oneMonth = 30 * 24 * 60 * 60 * 1000;

                    const sheetSolved = Object.entries(u.completedProblems || {}).filter(([id, ts]: [string, any]) => {
                         if (sqlIds.has(id)) return false;
                         if (timeframe === 'weekly') return ts && (now - ts < oneWeek);
                         if (timeframe === 'monthly') return ts && (now - ts < oneMonth);
                         return true;
                    }).length;

                    const sqlSolved = Object.entries(u.completedProblems || {}).filter(([id, ts]: [string, any]) => {
                         if (!sqlIds.has(id)) return false;
                         if (timeframe === 'weekly') return ts && (now - ts < oneWeek);
                         if (timeframe === 'monthly') return ts && (now - ts < oneMonth);
                         return true;
                    }).length;

                    const displayedSolved = sheetSolved + sqlSolved;
                    
                    const isSelf = u.uid === user?.uid;
                    const isFollowing = profile?.following?.includes(u.uid);
                    
                    let bestMedal = null;
                    if ((u.maxStreak || 0) >= 100) bestMedal = { icon: "🔥", title: "100+ Days" };
                    else if ((u.maxStreak || 0) >= 50) bestMedal = { icon: "⚡", title: "50+ Days" };
                    else if ((u.maxStreak || 0) >= 10) bestMedal = { icon: "🌱", title: "10+ Days" };

                    return (
                        <div key={u.uid} className={`bg-white dark:bg-dark-card glass-container rounded-2xl shadow-sm border p-6 flex flex-col gap-4 relative transition-transform hover:-translate-y-1 ${i === 0 ? 'border-yellow-400 dark:border-yellow-600 bg-yellow-50/10' : i === 1 ? 'border-gray-400 dark:border-gray-600 bg-gray-50/10' : i === 2 ? 'border-orange-400 dark:border-orange-800 bg-orange-50/10' : 'border-gray-200 dark:border-dark-border'}`}>
                            {i < 3 && (
                                <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center font-black shadow-lg text-lg ${i === 0 ? 'bg-yellow-400 shadow-yellow-400/50' : i === 1 ? 'bg-gray-300 shadow-gray-400/50' : 'bg-orange-400 shadow-orange-400/50'}`}>
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                </div>
                            )}
                            
                            <div className="flex items-center gap-4">
                                {u.photoURL && !u.photoURL.includes('dicebear') ? (
                                    <img src={u.photoURL} alt={u.username} className="w-14 h-14 rounded-full border-2 border-primary-100 object-cover shadow-md bg-white" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary-400 to-purple-500 flex items-center justify-center font-bold shadow-md relative overflow-hidden border-2 border-primary-100">
                                        <img src={u.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username || u.uid}`} className="w-14 h-14 object-cover bg-white" alt={u.username} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 pointer-events-auto">
                                    <Link to={`/user/${u.username || u.uid}`} className="font-bold text-lg dark:text-white truncate flex items-center gap-1 hover:text-primary-600 transition-colors">
                                        {u.displayName || u.username || u.email?.split('@')[0] || 'Anonymous'}
                                        {bestMedal && <span title={bestMedal.title} className="text-sm cursor-help">{bestMedal.icon}</span>}
                                        {isSelf && <span className="bg-primary-100 text-primary-600 text-[10px] px-1.5 py-0.5 rounded ml-2">YOU</span>}
                                    </Link>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">@{u.username || u.email?.split('@')[0] || 'coder'} {u.leetcodeHandle && <span className="ml-1 text-[10px] border px-1 rounded bg-orange-50 text-orange-600 border-orange-200">LC: {u.leetcodeHandle}</span>}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="bg-gray-50 dark:bg-dark-surface rounded-xl p-3 border border-gray-100 dark:border-dark-border flex flex-col justify-center">
                                    <div className="flex items-end justify-center gap-2">
                                        <div className="text-xl font-black text-slate-800 dark:text-white leading-none">{displayedSolved}</div>
                                        <div className="flex flex-col text-[9px] font-bold text-gray-500 uppercase leading-tight pb-0.5 text-left">
                                            <span className="text-emerald-600 dark:text-emerald-400">{sheetSolved} Sheet</span>
                                            <span className="text-indigo-600 dark:text-indigo-400">{sqlSolved} SQL</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center mt-1.5">
                                        {timeframe === 'all' ? 'Solved' : timeframe === 'weekly' ? 'Weekly Solved' : 'Monthly Solved'}
                                    </div>
                                </div>
                                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center border border-orange-100 dark:border-orange-800/30">
                                    <div className="text-xl font-black text-orange-600 dark:text-orange-400 flex justify-center items-center gap-1">
                                        {u.maxStreak || 0} <Flame size={14} />
                                    </div>
                                    <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Max Streak</div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-auto pt-2">
                                {!isSelf && (
                                    <>
                                        <button 
                                            onClick={() => handleFollowToggle(u)}
                                            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${isFollowing ? 'bg-gray-100 dark:bg-dark-surface border-gray-200 dark:border-dark-border text-slate-700 dark:text-gray-300' : 'bg-primary-600 text-white border-primary-500 hover:bg-primary-700'} `}
                                        >
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </button>
                                        <button 
                                            onClick={() => { setSelectedUser(u); setShowMessageModal(true); }}
                                            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-dark-surface text-slate-700 dark:text-gray-300 font-bold border border-gray-200 dark:border-dark-border hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <MessageCircle size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Message Modal */}
            {showMessageModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-dark-card glass-container w-full max-w-md rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-dark-border animate-in zoom-in-95">
                        <h3 className="font-bold text-xl mb-4 text-slate-800 dark:text-white flex items-center gap-2">
                             <MessageCircle className="text-primary-500" /> Send Message
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            To: <span className="font-bold text-slate-800 dark:text-white">@{selectedUser.username}</span>
                        </p>
                        <textarea 
                            value={messageText}
                            onChange={e => setMessageText(e.target.value)}
                            placeholder="Type an encouraging message or ask a coding question..."
                            className="w-full h-32 p-3 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl mb-6 outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white resize-none"
                            autoFocus
                        />
                        {sendSuccess && (
                            <div className="mb-4 text-center text-sm font-bold text-green-600 bg-green-50 p-2 rounded-lg">
                                Message sent successfully!
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setShowMessageModal(false); setMessageText(''); }}
                                className="flex-1 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-dark-surface hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSendMessage}
                                disabled={!messageText.trim()}
                                className="flex-1 py-2.5 rounded-xl font-bold bg-primary-600 hover:bg-primary-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
