import React, { useState } from 'react';
import { useAuth } from '../App';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS } from '../constants';
import { User, Key, Save, CheckCircle } from 'lucide-react';

export default function Account() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setMsg({ type: '', text: '' });

    try {
      // Update Auth (compat method on user object)
      await user.updateProfile({ displayName });
      // Update Firestore
      await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { displayName });
      await refreshProfile();
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await auth.sendPasswordResetEmail(user.email);
      setMsg({ type: 'success', text: `Password reset email sent to ${user.email}` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold dark:text-white">Account Settings</h1>

      {msg.text && (
        <div className={`p-4 rounded-lg flex items-center ${msg.type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
          {msg.type === 'success' && <CheckCircle className="mr-2" size={20}/>}
          {msg.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center dark:text-gray-100">
          <User className="mr-2 text-primary-600" size={24} /> 
          Profile Details
        </h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input 
              type="text" 
              disabled 
              value={user?.email || ''} 
              className="w-full px-4 py-2 bg-gray-100 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
            <input 
              type="text" 
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSaving}
            className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Save size={18} className="mr-2" />
            Save Changes
          </button>
        </form>
      </div>

      {/* Security Section */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center dark:text-gray-100">
          <Key className="mr-2 text-orange-500" size={24} /> 
          Security
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Need to update your password? We will send you an email with a secure link to reset it.
        </p>
        <button 
          onClick={handlePasswordReset}
          className="px-4 py-2 border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-border/50 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
        >
          Reset Password
        </button>
      </div>
    </div>
  );
}