import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';
import { DirectMessage, UserProfile } from '../types';
import { MessageCircle, Trash2, Send, ArrowLeft, Smile, Plus } from 'lucide-react';
import EmojiPicker, { Theme, Emoji, EmojiStyle } from 'emoji-picker-react';
import { Link, useSearchParams } from 'react-router-dom';

export const Inbox = () => {
    const { user, profile } = useAuth();
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
    const [top3Ids, setTop3Ids] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [searchParams] = useSearchParams();
    const [msgToDelete, setMsgToDelete] = useState<string | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const defaultReactions = [
        { emoji: '❤️', unified: '2764-fe0f' },
        { emoji: '👍', unified: '1f44d' },
        { emoji: '😂', unified: '1f602' },
        { emoji: '😮', unified: '1f62e' },
        { emoji: '🥺', unified: '1f97a' },
        { emoji: '🙏', unified: '1f64f' }
    ];
    const [recentReactions, setRecentReactions] = useState<{emoji: string, unified: string}[]>(defaultReactions);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('recentReactionsV2');
            if (stored) setRecentReactions(JSON.parse(stored));
        } catch (e) {}
    }, []);

    const handleReactionSelect = (msgId: string, emojiObj: {emoji: string, unified: string}) => {
        const newRecent = [emojiObj, ...recentReactions.filter(e => e.unified !== emojiObj.unified)].slice(0, 6);
        setRecentReactions(newRecent);
        localStorage.setItem('recentReactionsV2', JSON.stringify(newRecent));
        toggleReaction(msgId, emojiObj.unified);
    };


    const formatLastSeen = (timestamp?: number) => {
        if (!timestamp) return 'Offline';
        const diff = Date.now() - timestamp;
        if (diff < 2 * 60 * 1000) return 'Online';
        
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `Last seen ${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Last seen ${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `Last seen ${days}d ago`;
        return `Last seen ${new Date(timestamp).toLocaleDateString()}`;
    };

    const isOnline = (timestamp?: number) => {
        if (!timestamp) return false;
        return (Date.now() - timestamp) < 2 * 60 * 1000;
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
            };
        });
    };

    useEffect(() => {
        const uParam = searchParams.get('user');
        if (uParam) setSelectedUser(uParam);
    }, [searchParams]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const ref = collection(db, COLLECTIONS.MESSAGES);
        
        // Fetch all users to map avatars and names in real-time
        const fetchUsers = () => {
            return onSnapshot(collection(db, COLLECTIONS.USERS), (snap) => {
                const umap: Record<string, UserProfile> = {};
                const userArr: UserProfile[] = [];
                snap.docs.forEach(d => { 
                    const data = { uid: d.id, ...d.data() } as UserProfile;
                    umap[d.id] = data; 
                    userArr.push(data);
                });
                setUsersMap(umap);
                userArr.sort((a,b) => {
                    const sA = Object.keys(a.completedProblems || {}).length + (a.points || 0);
                    const sB = Object.keys(b.completedProblems || {}).length + (b.points || 0);
                    if (sA !== sB) return sB - sA;
                    return (b.maxStreak || 0) - (a.maxStreak || 0);
                });
                setTop3Ids(userArr.slice(0,3).map(u => u.uid as string));
            });
        };
        const unsubUsers = fetchUsers();
        
        const qReceiver = query(ref, where('receiverId', '==', user.uid));
        const qSender = query(ref, where('senderId', '==', user.uid));
        
        const unsub1 = onSnapshot(qReceiver, snap => {
            const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage));
            setMessages(prev => {
                const filtered = prev.filter(m => m.receiverId !== user.uid);
                return [...filtered, ...msgs].sort((a,b) => a.timestamp - b.timestamp);
            });
            setLoading(false);
        }, error => {
            console.error("Error listening to received messages:", error);
            setLoading(false);
        });

        const unsub2 = onSnapshot(qSender, snap => {
            const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage));
            setMessages(prev => {
                const filtered = prev.filter(m => m.senderId !== user.uid);
                return [...filtered, ...msgs].sort((a,b) => a.timestamp - b.timestamp);
            });
        }, error => {
            console.error("Error listening to sent messages:", error);
        });

        return () => { unsub1(); unsub2(); unsubUsers(); };
    }, [user]);

    const conversations = useMemo(() => {
        if (!user) return [];
        const map = new Map<string, { partnerId: string, partnerName: string, partnerAvatar?: string, lastMsg: DirectMessage, unread: number }>();
        
        messages.forEach(m => {
            const isMeSender = m.senderId === user.uid;
            const partnerId = isMeSender ? m.receiverId : m.senderId;
            const pUser = usersMap[partnerId];
            const partnerName = pUser ? (pUser.displayName || pUser.username || pUser.email?.split('@')[0] || 'User') : (isMeSender ? 'User' : m.senderName);
            const partnerAvatar = pUser?.photoURL || (partnerName ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${partnerName}` : undefined);
            
            const existing = map.get(partnerId);
            const isUnread = (!isMeSender && !m.read) ? 1 : 0;
            
            if (!existing || existing.lastMsg.timestamp < m.timestamp) {
                map.set(partnerId, {
                    partnerId,
                    partnerName,
                    partnerAvatar,
                    lastMsg: m,
                    unread: (existing ? existing.unread : 0) + isUnread
                });
            } else {
                 existing.unread += isUnread;
            }
        });
        
        return Array.from(map.values()).sort((a,b) => b.lastMsg.timestamp - a.lastMsg.timestamp);
    }, [messages, user, usersMap]);

    const [partnerTyping, setPartnerTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!selectedUser) return;
        const unsub = onSnapshot(doc(db, COLLECTIONS.USERS, selectedUser), (docSnap) => {
            if (docSnap.exists() && docSnap.data()?.typingTo === user?.uid) {
                setPartnerTyping(true);
            } else {
                setPartnerTyping(false);
            }
        });
        return () => unsub();
    }, [selectedUser, user]);

    useEffect(() => {
        if (selectedUser) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            // Mark as read
            messages.filter(m => m.senderId === selectedUser && m.receiverId === user?.uid && !m.read).forEach(m => {
                setDoc(doc(db, COLLECTIONS.MESSAGES, m.id), { read: true, readAt: Date.now() }, { merge: true });
            });
        }
    }, [messages, selectedUser]);

    const handleTyping = (text: string) => {
        setReplyText(text);
        if (!user || !selectedUser) return;
        
        // Update typing status
        setDoc(doc(db, COLLECTIONS.USERS, user.uid), { typingTo: selectedUser }, { merge: true });
        
        // Clear timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        // Set new timeout to clear typing status
        typingTimeoutRef.current = setTimeout(() => {
            setDoc(doc(db, COLLECTIONS.USERS, user.uid), { typingTo: null }, { merge: true });
        }, 2000);
    };

    const handleSend = async () => {
        if (!user || !profile || !selectedUser || (!replyText.trim() && !pendingImage)) return;
        
        const currentText = replyText.trim();
        const currentImage = pendingImage;
        
        setReplyText('');
        setPendingImage(null);
        setDoc(doc(db, COLLECTIONS.USERS, user.uid), { typingTo: null }, { merge: true });

        try {
            await addDoc(collection(db, COLLECTIONS.MESSAGES), {
                senderId: user.uid,
                senderName: profile.displayName || profile.username || profile.email?.split('@')[0] || 'Anonymous',
                receiverId: selectedUser,
                content: currentText,
                imageUrl: currentImage || null,
                timestamp: Date.now(),
                read: false,
                reactions: {}
            });
        } catch (e) { console.error(e); }
    };

    const toggleReaction = async (msgId: string, emojiOrUnified: string) => {
        if (!user) return;
        const msgRef = doc(db, COLLECTIONS.MESSAGES, msgId);
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        const currentReactions = msg.reactions || {};
        const newReactions = { ...currentReactions };
        
        if (newReactions[user.uid] === emojiOrUnified) {
            // Remove own reaction if clicking the same one again
            delete newReactions[user.uid];
        } else {
            // Add or swap to new reaction for current user
            newReactions[user.uid] = emojiOrUnified;
        }

        try {
            await setDoc(msgRef, { reactions: newReactions }, { merge: true });
        } catch (e) {
            console.error('Failed to react:', e);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Messages...</div>;

    return (
        <div className="max-w-6xl mx-auto h-[85vh] flex flex-col md:flex-row gap-6 animate-in fade-in duration-300 pb-6">
            
            {/* Sidebar (Conversations) */}
            <div className={`w-full md:w-1/3 h-full bg-white dark:bg-dark-card glass-container rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <MessageCircle className="text-primary-500" /> Inbox
                    </h2>
                    <Link to="/leaderboard" className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400">
                        New Message
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {conversations.length === 0 ? (
                         <div className="text-center p-8 text-gray-400 text-sm">No conversations yet.</div>
                    ) : (
                        conversations.map(c => (
                            <button 
                                key={c.partnerId}
                                onClick={() => setSelectedUser(c.partnerId)}
                                className={`w-full text-left p-4 rounded-xl flex items-center gap-3 transition-colors mb-1 ${selectedUser === c.partnerId ? 'bg-primary-50 dark:bg-primary-900/20 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-dark-surface'}`}
                            >
                                <div className="relative flex-shrink-0">
                                    {c.partnerAvatar && !c.partnerAvatar.includes('dicebear') ? (
                                        <img src={c.partnerAvatar} alt={c.partnerName} className="w-12 h-12 rounded-full border border-primary-200 object-cover shadow-sm bg-white" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-400 to-purple-500 text-white flex items-center justify-center font-bold text-lg shadow-sm border border-primary-200 overflow-hidden relative">
                                            <img src={c.partnerAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.partnerName}`} alt={c.partnerName} className="w-12 h-12 object-cover" />
                                        </div>
                                    )}
                                    {isOnline(usersMap[c.partnerId]?.lastActive) && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-dark-card shadow-sm"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className={`font-bold truncate text-sm flex items-center gap-1 ${c.unread > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-gray-300'}`}>
                                            {c.partnerName}
                                            {top3Ids.indexOf(c.partnerId) === 0 && <span className="text-yellow-500" title="1st Place">🥇</span>}
                                            {top3Ids.indexOf(c.partnerId) === 1 && <span className="text-gray-400" title="2nd Place">🥈</span>}
                                            {top3Ids.indexOf(c.partnerId) === 2 && <span className="text-orange-500" title="3rd Place">🥉</span>}
                                        </h3>
                                        <span className="text-[10px] text-gray-400">{new Date(c.lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className={`text-sm truncate ${c.unread > 0 ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {usersMap[c.partnerId]?.typingTo === user?.uid ? (
                                            <span className="text-primary-500 italic flex items-center gap-1">
                                                typing
                                                <span className="flex gap-0.5">
                                                    <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce"></span>
                                                    <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                                    <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                                                </span>
                                            </span>
                                        ) : c.lastMsg.imageUrl ? (
                                            <span className="flex items-center gap-1">🖼️ Photo</span>
                                        ) : (
                                            c.lastMsg.senderId === user?.uid ? `You: ${c.lastMsg.content}` : c.lastMsg.content
                                        )}
                                    </p>
                                </div>
                                {c.unread > 0 && <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-red-400/50">{c.unread}</div>}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`w-full md:w-2/3 h-full bg-white dark:bg-dark-card glass-container rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border flex flex-col ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
                {selectedUser ? (
                    <>
                        <div className="p-4 border-b border-gray-100 dark:border-dark-border flex items-center gap-3 bg-gray-50 dark:bg-dark-surface/50 rounded-t-2xl">
                            <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 -ml-2 text-gray-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="relative">
                                {conversations.find(c => c.partnerId === selectedUser)?.partnerAvatar ? (
                                    <img src={conversations.find(c => c.partnerId === selectedUser)?.partnerAvatar} alt="Partner" className="w-10 h-10 rounded-full shadow-sm bg-white object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-400 to-purple-500 text-white flex items-center justify-center font-bold shadow-sm">
                                        {conversations.find(c => c.partnerId === selectedUser)?.partnerName[0]?.toUpperCase() || 'U'}
                                    </div>
                                )}
                                {isOnline(usersMap[selectedUser]?.lastActive) && (
                                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-dark-surface shadow-sm"></div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white hover:text-primary-600 cursor-pointer flex items-center gap-1 leading-tight">
                                    <Link to={`/user/${usersMap[selectedUser]?.username || selectedUser}`}>
                                        {conversations.find(c => c.partnerId === selectedUser)?.partnerName || 'Chat'}
                                    </Link>
                                    {top3Ids.indexOf(selectedUser) === 0 && <span className="text-yellow-500 text-sm ml-1" title="1st Place">🥇</span>}
                                    {top3Ids.indexOf(selectedUser) === 1 && <span className="text-gray-400 text-sm ml-1" title="2nd Place">🥈</span>}
                                    {top3Ids.indexOf(selectedUser) === 2 && <span className="text-orange-500 text-sm ml-1" title="3rd Place">🥉</span>}
                                </h3>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {isOnline(usersMap[selectedUser]?.lastActive) ? 'Online now' : formatLastSeen(usersMap[selectedUser]?.lastActive)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {(() => {
                                let lastDate = '';
                                return messages.filter(m => m.senderId === selectedUser || m.receiverId === selectedUser).map(msg => {
                                    const isMe = msg.senderId === user?.uid;
                                    const msgDate = new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                                    const showDate = msgDate !== lastDate;
                                    lastDate = msgDate;
                                    
                                    return (
                                        <React.Fragment key={msg.id}>
                                            {showDate && (
                                                <div className="flex justify-center my-4">
                                                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-surface px-3 py-1 rounded-full shadow-sm">{msgDate}</span>
                                                </div>
                                            )}
                                            <div className={`w-full flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`group flex items-center gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    
                                                    {/* Message Bubble */}
                                                    <div className={`relative px-4 py-2 shadow-sm rounded-2xl ${isMe ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-gray-100 dark:bg-dark-surface text-slate-800 dark:text-gray-100 rounded-bl-sm border border-gray-200 dark:border-dark-border'}`}>
                                                        {msg.imageUrl && (
                                                            <img 
                                                                src={msg.imageUrl} 
                                                                alt="Attached" 
                                                                onClick={() => setExpandedImage(msg.imageUrl!)}
                                                                className="w-48 h-48 sm:w-64 sm:h-64 object-cover rounded-xl mt-1 mb-2 cursor-zoom-in border border-black/10 dark:border-white/10" 
                                                            />
                                                        )}
                                                        {msg.content && <p className="whitespace-pre-wrap word-break text-[15px]">{msg.content}</p>}
                                                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isMe ? 'justify-end text-primary-200' : 'justify-start text-gray-400'}`}>
                                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                            {isMe && (
                                                                <span className="flex items-center gap-0.5 ml-1" title={msg.read && msg.readAt ? `Seen ${new Date(msg.readAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Sent'}>
                                                                    {msg.read ? (
                                                                        <span className="flex items-center text-blue-300 drop-shadow-sm gap-0.5">
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-3.5 3.5"/></svg>
                                                                            <span className="font-medium text-[9px] uppercase tracking-wider">Seen {msg.readAt ? new Date(msg.readAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="flex items-center opacity-70 gap-0.5">
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                                                            <span className="font-medium text-[9px] uppercase tracking-wider">Sent</span>
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                            <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex gap-0.5 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-full px-1.5 py-0.5 shadow-sm text-[12px] select-none z-10 items-center`}>
                                                                {Array.from(new Set(Object.values(msg.reactions))).map((emojiVal, idx) => (
                                                                    <button key={idx} onClick={() => toggleReaction(msg.id, emojiVal as string)} className="cursor-pointer hover:scale-110 transition-transform flex items-center justify-center p-0.5" title="Toggle Reaction">
                                                                        {/^[0-9a-fA-F-]+$/.test(emojiVal as string) ? (
                                                                            <Emoji unified={emojiVal as string} size={14} emojiStyle={EmojiStyle.APPLE} />
                                                                        ) : (
                                                                            <span style={{fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'}}>{emojiVal as string}</span>
                                                                        )}
                                                                    </button>
                                                                ))}
                                                                {Object.keys(msg.reactions).length > 1 && (
                                                                    <span className="text-[10px] font-bold text-gray-500 ml-0.5 bg-gray-100 dark:bg-dark-surface rounded-full w-4 h-4 flex items-center justify-center">{Object.keys(msg.reactions).length}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Hover Actions Menu */}
                                                    <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0 px-1 relative`}>
                                                         <div className="flex bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-full shadow-sm px-1.5 py-1 gap-0.5 z-20">
                                                             {recentReactions.slice(0, 4).map(em => (
                                                                 <button
                                                                    key={em.unified}
                                                                    onClick={() => handleReactionSelect(msg.id, em)}
                                                                    className={`hover:scale-125 hover:-translate-y-1 transition-transform p-1.5 flex items-center justify-center rounded-full ${msg.reactions?.[user?.uid || ''] === em.unified ? 'bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200' : ''}`}
                                                                 ><Emoji unified={em.unified} size={16} emojiStyle={EmojiStyle.APPLE} /></button>
                                                             ))}
                                                             <button 
                                                                 onClick={() => setReactionPickerMsgId(msg.id)} 
                                                                 className="text-gray-400 hover:text-primary-500 ml-1 pl-1 border-l border-gray-200 dark:border-dark-border flex items-center justify-center cursor-pointer"
                                                             >
                                                                 <Plus size={16} />
                                                             </button>
                                                             {isMe && (
                                                                 <button onClick={() => setMsgToDelete(msg.id)} className="text-gray-400 hover:text-red-500 ml-1 pl-1.5 border-l border-gray-200 dark:border-dark-border flex items-center justify-center cursor-pointer">
                                                                     <Trash2 size={16} />
                                                                 </button>
                                                             )}
                                                         </div>
                                                         {reactionPickerMsgId === msg.id && (
                                                             <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} z-50 animate-in fade-in zoom-in-95 duration-200`}>
                                                                 <div className="fixed inset-0 z-40" onClick={() => setReactionPickerMsgId(null)} />
                                                                 <div className="relative z-50 shadow-2xl rounded-xl overflow-hidden border border-gray-200 dark:border-dark-border">
                                                                     <EmojiPicker 
                                                                         theme={Theme.AUTO}
                                                                         emojiStyle={EmojiStyle.APPLE}
                                                                         width={320}
                                                                         height={400}
                                                                         onEmojiClick={(emojiData) => {
                                                                             handleReactionSelect(msg.id, { emoji: emojiData.emoji, unified: emojiData.unified });
                                                                             setReactionPickerMsgId(null);
                                                                         }}
                                                                     />
                                                                 </div>
                                                             </div>
                                                         )}
                                                    </div>

                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                });
                            })()}
                            {partnerTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 dark:bg-dark-surface rounded-2xl px-4 py-3 shadow-sm border border-gray-200 dark:border-dark-border rounded-bl-sm flex gap-1 items-center">
                                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></span>
                                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{animationDelay: '0.4s'}}></span>
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-white dark:bg-dark-card rounded-b-2xl">
                            {pendingImage && (
                                <div className="mb-3 relative inline-block">
                                    <img src={pendingImage} alt="Pasted" className="w-32 h-32 object-cover rounded-xl border border-gray-200 dark:border-dark-border shadow-sm" />
                                    <button 
                                        onClick={() => setPendingImage(null)}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}
                            <div className="flex items-end gap-2 bg-gray-50 dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-2 focus-within:ring-2 focus-within:ring-primary-500 transition-all relative">
                                <button 
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                                    title="Add Emoji"
                                >
                                    <Smile size={20} />
                                </button>
                                
                                {showEmojiPicker && (
                                    <div className="absolute bottom-16 left-0 z-50 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                                        <div className="relative z-50 shadow-2xl rounded-xl overflow-hidden border border-gray-200 dark:border-dark-border">
                                            <EmojiPicker 
                                                theme={Theme.AUTO}
                                                emojiStyle={EmojiStyle.APPLE}
                                                width={320}
                                                height={400}
                                                onEmojiClick={(emojiData) => {
                                                    setReplyText(prev => prev + emojiData.emoji);
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                                <label className="cursor-pointer p-2 text-gray-400 hover:text-primary-600 transition-colors">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const compressed = await compressImage(file);
                                                setPendingImage(compressed);
                                            }
                                        }}
                                    />
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                </label>
                                <textarea 
                                    value={replyText}
                                    onChange={e => {
                                        handleTyping(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                                    }}
                                    onPaste={async (e) => {
                                        const items = e.clipboardData.items;
                                        for (let i = 0; i < items.length; i++) {
                                            if (items[i].type.indexOf('image') !== -1) {
                                                const blob = items[i].getAsFile();
                                                if (blob) {
                                                    const compressed = await compressImage(blob);
                                                    setPendingImage(compressed);
                                                    e.preventDefault();
                                                }
                                            }
                                        }
                                    }}
                                    // Submit on Enter (without Shift)
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                            e.currentTarget.style.height = 'auto';
                                        }
                                    }}
                                    placeholder="Message... (Paste images)"
                                    className="flex-1 bg-transparent border-0 outline-none resize-none max-h-32 min-h-[40px] px-2 py-2 text-slate-800 dark:text-white"
                                    rows={1}
                                />
                                <button 
                                    onClick={handleSend}
                                    disabled={!replyText.trim() && !pendingImage}
                                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors mb-1 shadow-sm"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 p-8 text-center">
                        <MessageCircle size={48} className="mb-4 opacity-50" />
                        <h3 className="text-xl font-bold mb-2 text-slate-700 dark:text-gray-300">Your Messages</h3>
                        <p className="text-sm">Select a conversation or find someone on the Leaderboard to start chatting.</p>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {msgToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-xl shadow-2xl p-6 border border-gray-200 dark:border-dark-border animate-in zoom-in-95 duration-200 text-center">
                        <Trash2 className="text-red-500 mx-auto mb-4" size={32} />
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Delete Message?</h3>
                        <p className="text-slate-500 dark:text-gray-400 mb-6 text-sm">This action cannot be undone. The message will be removed for both you and the recipient.</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setMsgToDelete(null)}
                                className="flex-1 py-2 rounded-lg font-bold bg-gray-100 hover:bg-gray-200 dark:bg-dark-surface dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={async () => {
                                    if (msgToDelete) {
                                        await deleteDoc(doc(db, COLLECTIONS.MESSAGES, msgToDelete));
                                        setMsgToDelete(null);
                                    }
                                }}
                                className="flex-1 py-2 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Expansion Modal */}
            {expandedImage && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out animate-in fade-in"
                    onClick={() => setExpandedImage(null)}
                >
                    <img src={expandedImage} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="Expanded" />
                </div>
            )}
        </div>
    );
};
