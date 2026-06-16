import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants';
import { UserProfile, Problem } from '../types';
import { Trophy, Flame, MessageCircle, Activity, ArrowLeft, UserPlus, UserMinus } from 'lucide-react';
import { getProblemDictionary } from '../services/dataService';
import { ContributionGraph } from './UserDashboard';
import { useAuth } from '../App';

export default function ProfileView() {
    const { userId } = useParams();
    const { user, profile: currentUserProfile, refreshProfile } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [problemDict, setProblemDict] = useState<Record<string, Problem>>({});
    const [rankIndex, setRankIndex] = useState<number | null>(null);

    const handleFollowToggle = async () => {
        if (!user || !currentUserProfile || !profileUid) return;
        const targetId = profileUid;
        const following = currentUserProfile.following || [];
        const isFollowing = following.includes(targetId);

        const newFollowing = isFollowing ? following.filter(id => id !== targetId) : [...following, targetId];
        
        try {
            // Update current user
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), { following: newFollowing }, { merge: true });
            
            // update local profile to reflect changes without full reload
            setProfile(prev => {
                if (!prev) return prev;
                const newFollowersList = isFollowing ? (prev.followers || []).filter(id => id !== user.uid) : [...(prev.followers || []), user.uid];
                return { ...prev, followers: newFollowersList };
            });
            await refreshProfile();
        } catch (err) {
            console.error("Failed to toggle follow status", err);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userId) return;
            try {
                const usersSnap = await getDocs(query(collection(db, COLLECTIONS.USERS)));
                const allUsers: UserProfile[] = [];
                let foundProfile: UserProfile | null = null;
                let foundUid: string | null = null;
                
                usersSnap.docs.forEach(doc => {
                     const data = { uid: doc.id, ...doc.data() } as UserProfile;
                     allUsers.push(data);
                     if (data.username === userId || doc.id === userId) {
                         foundProfile = data;
                         foundUid = doc.id;
                     }
                });
                
                if (foundProfile) {
                    const followersCountFromAll = allUsers.filter(u => u.following?.includes(foundUid!)).length;
                    
                    const originalObj = foundProfile as UserProfile;
                    const typedProfile = {
                        ...originalObj,
                        followers: Array.from({ length: followersCountFromAll }) as string[]
                    } as UserProfile;
                    setProfile(typedProfile);
                    setProfileUid(foundUid);
                    
                    allUsers.sort((a,b) => {
                         const sA = Object.keys(a.completedProblems || {}).length + (a.points || 0);
                         const sB = Object.keys(b.completedProblems || {}).length + (b.points || 0);
                         if (sA !== sB) return sB - sA;
                         return (b.maxStreak || 0) - (a.maxStreak || 0);
                    });
                    
                    const rIndex = allUsers.findIndex(u => u.uid === foundUid);
                    if (rIndex >= 0 && rIndex < 3) {
                         setRankIndex(rIndex);
                    }

                    const solvedIds = Object.keys(typedProfile.completedProblems || {});
                    if (solvedIds.length > 0) {
                        const dict = await getProblemDictionary(solvedIds);
                        setProblemDict(dict);
                    }
                }
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        fetchProfile();
    }, [userId]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Profile...</div>;
    
    if (!profile || !profileUid) return (
       <div className="p-12 text-center text-gray-500">
           <h2 className="text-2xl font-bold mb-4">User not found</h2>
           <Link to="/leaderboard" className="text-primary-600 font-bold hover:underline">Go back to Leaderboard</Link>
       </div>
    );

    const totalSolved = Object.keys(profile.completedProblems || {}).length;

    const recentActivity = Object.entries(profile.completedProblems || {})
        .filter(([_, ts]) => ts && typeof ts === 'number')
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5);

    // Build Heatmap for the last ~6 months / 180 days (or 365 if complex)
    // To keep it simple, let's do a simple summary block for now.
    
    let bestMedal = null;
    if ((profile.maxStreak || 0) >= 100) bestMedal = { icon: "🔥", title: "100+ Days Streak" };
    else if ((profile.maxStreak || 0) >= 50) bestMedal = { icon: "⚡", title: "50+ Days Streak" };
    else if ((profile.maxStreak || 0) >= 10) bestMedal = { icon: "🌱", title: "10+ Days Streak" };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in pb-12">
            <Link to="/leaderboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                 <ArrowLeft size={16} /> Back to Rankings
            </Link>
            
            <div className="bg-white dark:bg-dark-card glass-container rounded-2xl p-8 border border-gray-200 dark:border-dark-border shadow-sm flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left relative overflow-hidden">
                 {/* Decorative background element */}
                 <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-100 dark:bg-primary-900/20 rounded-full blur-3xl pointer-events-none"></div>
                 
                 <div className="shrink-0 relative">
                     {profile.photoURL && !profile.photoURL.includes('dicebear') ? (
                         <img src={profile.photoURL} alt={profile.username} className="w-32 h-32 rounded-full border-4 border-white dark:border-dark-card shadow-xl object-cover relative z-10 bg-white" />
                     ) : (
                         <div className="w-32 h-32 rounded-full border-4 border-white dark:border-dark-card shadow-xl bg-gradient-to-tr from-primary-400 to-purple-500 text-white flex items-center justify-center font-bold relative z-10 overflow-hidden">
                             <img src={profile.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.username || userId}`} alt={profile.username} className="w-32 h-32 object-cover bg-white" />
                         </div>
                     )}
                     {bestMedal && (
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-dark-card rounded-full flex items-center justify-center text-2xl shadow-lg border border-gray-100 dark:border-dark-border z-20 tooltip" title={bestMedal.title}>
                            {bestMedal.icon}
                        </div>
                     )}
                 </div>
                 
                 <div className="flex-1 relative z-10">
                     <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight flex items-center justify-center md:justify-start gap-2">
                         {profile.displayName || profile.email?.split('@')[0] || 'Anonymous User'}
                         {rankIndex === 0 && <span className="text-yellow-500 text-3xl" title="1st Place">🥇</span>}
                         {rankIndex === 1 && <span className="text-gray-400 text-3xl" title="2nd Place">🥈</span>}
                         {rankIndex === 2 && <span className="text-orange-500 text-3xl" title="3rd Place">🥉</span>}
                     </h1>
                     <p className="text-lg text-gray-500 dark:text-gray-400 font-medium mb-6 flex items-center justify-center md:justify-start gap-2">
                         <span>@{profile.username || 'coder'}</span>
                         {profile.leetcodeHandle && (
                             <a href={`https://leetcode.com/u/${profile.leetcodeHandle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100 transition-colors">
                                 LeetCode: {profile.leetcodeHandle}
                             </a>
                         )}
                     </p>
                     
                     <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                         <div className="bg-gray-50 dark:bg-dark-surface px-5 py-3 rounded-xl border border-gray-100 dark:border-dark-border flex flex-col items-center min-w-[100px]">
                              <span className="text-2xl font-black text-slate-800 dark:text-white">{totalSolved}</span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Solved</span>
                         </div>
                         <div className="bg-orange-50 dark:bg-orange-900/10 px-5 py-3 rounded-xl border border-orange-100 dark:border-orange-800/20 flex flex-col items-center min-w-[100px]">
                              <span className="text-2xl font-black text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                  {profile.maxStreak || 0} <Flame size={18} className="text-orange-500" />
                              </span>
                              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mt-1">Max Streak</span>
                         </div>
                         <div className="bg-blue-50 dark:bg-blue-900/10 px-5 py-3 rounded-xl border border-blue-100 dark:border-blue-800/20 flex flex-col items-center min-w-[100px]">
                              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{profile.followers?.length || 0}</span>
                              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-1">Followers</span>
                         </div>
                         <div className="bg-purple-50 dark:bg-purple-900/10 px-5 py-3 rounded-xl border border-purple-100 dark:border-purple-800/20 flex flex-col items-center min-w-[100px]">
                              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{profile.following?.length || 0}</span>
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mt-1">Following</span>
                         </div>
                     </div>
                 </div>
                 
                 <div className="absolute top-6 right-6 z-20 flex gap-2">
                      {user && profileUid !== user.uid && (
                          <button 
                              onClick={handleFollowToggle}
                              title={currentUserProfile?.following?.includes(profileUid!) ? "Unfollow User" : "Follow User"}
                              className={`p-3 rounded-full shadow-lg transition-transform hover:-translate-y-1 inline-flex items-center justify-center ${currentUserProfile?.following?.includes(profileUid!) ? 'bg-gray-100 dark:bg-dark-surface text-slate-700 dark:text-gray-300' : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/30'}`}
                          >
                              {currentUserProfile?.following?.includes(profileUid!) ? <UserMinus size={20} /> : <UserPlus size={20} />}
                          </button>
                      )}
                      {user && profileUid !== user.uid && (
                          <Link to={`/inbox?user=${profileUid}`} className="bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full shadow-lg shadow-primary-500/30 transition-transform hover:-translate-y-1 inline-flex items-center justify-center tooltip" title="Message User">
                              <MessageCircle size={20} />
                          </Link>
                      )}
                 </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Left Column: Recent Activity Simple Feed */}
                 <div className="md:col-span-2 bg-white dark:bg-dark-card glass-container rounded-2xl p-6 border border-gray-200 dark:border-dark-border shadow-sm">
                      <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-white">
                          <Activity className="text-primary-500" /> Recent Activity Highlights
                      </h3>
                      {profile.privacySettings?.hideActivity ? (
                           <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-surface rounded-xl">
                               This user has chosen to keep their activity private.
                           </div>
                      ) : (
                           <div className="space-y-6">
                               <ContributionGraph completedProblems={profile.completedProblems || {}} />
                               
                               <div className="space-y-3">
                                   {recentActivity.length > 0 ? (
                                       recentActivity.map(([probId, ts]) => (
                                           <div key={probId} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-surface transition-transform hover:-translate-y-0.5">
                                               <div className="w-10 h-10 rounded-full bg-success-100 text-success-600 flex items-center justify-center shrink-0">
                                                   <Trophy size={18} />
                                               </div>
                                               <div>
                                                   <p className="text-slate-800 dark:text-gray-200 text-sm">
                                                       <span className="font-bold">{profile.displayName || profile.username || 'User'}</span> successfully solved <span className="font-semibold text-primary-600 dark:text-primary-400">{problemDict[probId]?.title || 'a problem'}</span>
                                                   </p>
                                                   <p className="text-xs text-gray-500 mt-1">{new Date(ts as number).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                               </div>
                                           </div>
                                       ))
                                   ) : (
                                       <div className="text-center p-8 text-gray-400 bg-gray-50 dark:bg-dark-surface rounded-xl">No recent coding activity to display yet.</div>
                                   )}
                               </div>
                           </div>
                      )}
                 </div>
                 
                 {/* Right Column: Badges */}
                 <div className="bg-white dark:bg-dark-card glass-container rounded-2xl p-6 border border-gray-200 dark:border-dark-border shadow-sm">
                      <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-white">
                          <Trophy className="text-yellow-500" /> Trophies
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                           {bestMedal ? (
                               <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 p-4 rounded-xl flex flex-col items-center justify-center text-center aspect-square transition-transform hover:scale-105">
                                   <div className="text-4xl mb-2">{bestMedal.icon}</div>
                                   <div className="text-xs font-bold text-yellow-700 dark:text-yellow-400">{bestMedal.title}</div>
                               </div>
                           ) : (
                               <div className="bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border p-4 rounded-xl flex flex-col items-center justify-center text-center aspect-square opacity-50">
                                   <div className="text-3xl mb-2 text-gray-400">🔒</div>
                                   <div className="text-[10px] font-bold text-gray-500">Streak Novice</div>
                               </div>
                           )}
                           
                           {totalSolved >= 100 ? (
                               <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 p-4 rounded-xl flex flex-col items-center justify-center text-center aspect-square transition-transform hover:scale-105">
                                   <div className="text-4xl mb-2">💎</div>
                                   <div className="text-xs font-bold text-purple-700 dark:text-purple-400">Centurion (100+)</div>
                               </div>
                           ) : (
                               <div className="bg-gray-50 dark:bg-dark-surface border border-gray-100 dark:border-dark-border p-4 rounded-xl flex flex-col items-center justify-center text-center aspect-square opacity-50">
                                   <div className="text-3xl mb-2 text-gray-400">🔒</div>
                                   <div className="text-[10px] font-bold text-gray-500">Centurion (100+)</div>
                               </div>
                           )}
                      </div>
                 </div>
            </div>
        </div>
    );
}

