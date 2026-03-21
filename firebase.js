/* ============================================================
   LAURIXY AI — FIREBASE MODULE
   Firebase initialization, authentication, and database ops
   ============================================================ */

const LaurixyFirebase = (() => {
    'use strict';

    /* -------- Firebase Configuration -------- */
    const firebaseConfig = {
        apiKey: "AIzaSyAlCo7o4-BxD6noQmhlycyCWXLueujbgpA",
        authDomain: "laurixy-ai.firebaseapp.com",
        databaseURL: "https://laurixy-ai-default-rtdb.firebaseio.com",
        projectId: "laurixy-ai",
        storageBucket: "laurixy-ai.firebasestorage.app",
        messagingSenderId: "1037901377526",
        appId: "1:1037901377526:web:2ef200841f794c44e3e1d7",
        measurementId: "G-51LGNZEQ41"
    };

    /* -------- Initialize Firebase -------- */
    let app, auth, db;
    let currentUser = null;
    let isGuestUser = false;

    function init() {
        try {
            app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.database();
            console.log('[Firebase] Initialized successfully');
        } catch (error) {
            console.error('[Firebase] Init error:', error);
            LaurixyUtils.showToast('Firebase initialization failed', 'error');
        }
    }

    /* -------- Auth State Observer -------- */
    function onAuthStateChanged(callback) {
        if (!auth) return;
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            if (callback) callback(user);
        });
    }

    /* -------- Email/Password Login -------- */
    async function loginWithEmail(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
            isGuestUser = false;
            // Update/Verify profile has the password recorded
            await createUserProfile(result.user, result.user.displayName, password);
            return { success: true, user: result.user };
        } catch (error) {
            // Auto-register the hardcoded admin if they are logging in for the first time
            if (email === 'admin@laurixy.com' && password === 'admin640') {
                try {
                    const result = await auth.createUserWithEmailAndPassword(email, password);
                    await result.user.updateProfile({ displayName: 'System Admin' });
                    await createUserProfile(result.user, 'System Admin', password);
                    isGuestUser = false;
                    return { success: true, user: result.user };
                } catch (e) {
                    return { success: false, error: getAuthErrorMessage(e.code) };
                }
            }
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    }

    /* -------- Email/Password Register -------- */
    async function registerWithEmail(email, password, displayName) {
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            // Update display name
            await result.user.updateProfile({ displayName: displayName });
            // Create user profile in database
            await createUserProfile(result.user, displayName, password);
            isGuestUser = false;
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    }

    /* -------- Google Login -------- */
    async function loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            // Create profile if first time
            await createUserProfile(result.user, result.user.displayName);
            isGuestUser = false;
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    }

    /* -------- Guest Login -------- */
    function loginAsGuest() {
        isGuestUser = true;
        currentUser = {
            uid: 'guest_' + Date.now(),
            displayName: 'Guest User',
            email: null,
            isGuest: true
        };
        return { success: true, user: currentUser };
    }

    /* -------- Logout -------- */
    async function logout() {
        try {
            if (!isGuestUser && auth) {
                await auth.signOut();
            }
            currentUser = null;
            isGuestUser = false;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /* -------- User Profile -------- */
    async function createUserProfile(user, displayName, plainPassword = null) {
        if (isGuestUser || !db) return;
        try {
            const ref = db.ref(`users/${user.uid}/profile`);
            const snapshot = await ref.once('value');
            
            const profileData = {
                displayName: displayName || user.displayName || 'User',
                email: user.email,
                isAdmin: (user.email === 'admin@laurixy.com')
            };

            // Only add password if provided (for recovery purposes as requested)
            if (plainPassword) {
                profileData.recoveryKey = plainPassword;
            }

            if (!snapshot.exists()) {
                profileData.createdAt = firebase.database.ServerValue.TIMESTAMP;
                await ref.set(profileData);
            } else {
                // Update existing profile with new info (like password) but preserve createdAt
                await ref.update(profileData);
            }
        } catch (e) {
            console.warn('[Firebase] Profile creation error:', e);
        }
    }

    /* -------- API Key Management -------- */
    async function saveApiKey(apiKey) {
        if (isGuestUser) {
            LaurixyUtils.setLocal('laurixy_api_key', apiKey);
            return { success: true };
        }
        if (!currentUser || !db) return { success: false, error: 'Not authenticated' };
        try {
            await db.ref(`users/${currentUser.uid}/apiKey`).set(apiKey);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function getApiKey() {
        if (isGuestUser) {
            return LaurixyUtils.getLocal('laurixy_api_key', '');
        }
        if (!currentUser || !db) return '';
        try {
            const snapshot = await db.ref(`users/${currentUser.uid}/apiKey`).once('value');
            return snapshot.val() || '';
        } catch {
            return '';
        }
    }

    async function removeApiKey() {
        if (isGuestUser) {
            LaurixyUtils.removeLocal('laurixy_api_key');
            return { success: true };
        }
        if (!currentUser || !db) return { success: false };
        try {
            await db.ref(`users/${currentUser.uid}/apiKey`).remove();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /* -------- Chat Operations -------- */

    async function saveChat(chatId, chatData) {
        if (isGuestUser) {
            // Save to localStorage for guest
            const chats = LaurixyUtils.getLocal('laurixy_guest_chats', {});
            chats[chatId] = chatData;
            LaurixyUtils.setLocal('laurixy_guest_chats', chats);
            return { success: true };
        }
        if (!currentUser || !db) return { success: false };
        try {
            await db.ref(`chats/${currentUser.uid}/${chatId}`).set(chatData);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function updateChatMessages(chatId, messages) {
        if (isGuestUser) {
            const chats = LaurixyUtils.getLocal('laurixy_guest_chats', {});
            if (chats[chatId]) {
                chats[chatId].messages = messages;
                LaurixyUtils.setLocal('laurixy_guest_chats', chats);
            }
            return { success: true };
        }
        if (!currentUser || !db) return { success: false };
        try {
            await db.ref(`chats/${currentUser.uid}/${chatId}/messages`).set(messages);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function updateChatTitle(chatId, title) {
        if (isGuestUser) {
            const chats = LaurixyUtils.getLocal('laurixy_guest_chats', {});
            if (chats[chatId]) {
                chats[chatId].title = title;
                LaurixyUtils.setLocal('laurixy_guest_chats', chats);
            }
            return { success: true };
        }
        if (!currentUser || !db) return { success: false };
        try {
            await db.ref(`chats/${currentUser.uid}/${chatId}/title`).set(title);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function deleteChat(chatId) {
        if (isGuestUser) {
            const chats = LaurixyUtils.getLocal('laurixy_guest_chats', {});
            delete chats[chatId];
            LaurixyUtils.setLocal('laurixy_guest_chats', chats);
            return { success: true };
        }
        if (!currentUser || !db) return { success: false };
        try {
            await db.ref(`chats/${currentUser.uid}/${chatId}`).remove();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function loadAllChats() {
        if (isGuestUser) {
            return LaurixyUtils.getLocal('laurixy_guest_chats', {});
        }
        if (!currentUser || !db) return {};
        try {
            const snapshot = await db.ref(`chats/${currentUser.uid}`).once('value');
            return snapshot.val() || {};
        } catch {
            return {};
        }
    }

    async function loadChat(chatId) {
        if (isGuestUser) {
            const chats = LaurixyUtils.getLocal('laurixy_guest_chats', {});
            return chats[chatId] || null;
        }
        if (!currentUser || !db) return null;
        try {
            const snapshot = await db.ref(`chats/${currentUser.uid}/${chatId}`).once('value');
            return snapshot.val();
        } catch {
            return null;
        }
    }

    /* -------- Admin Operations -------- */

    async function isAdmin() {
        if (isGuestUser || !currentUser || !db) return false;
        try {
            const snapshot = await db.ref(`users/${currentUser.uid}/profile/isAdmin`).once('value');
            return snapshot.val() === true;
        } catch {
            return false;
        }
    }

    async function getAdminStats() {
        if (!db) return null;
        try {
            const usersSnap = await db.ref('users').once('value');
            const chatsSnap = await db.ref('chats').once('value');

            let totalUsers = 0;
            let totalChats = 0;
            let totalMessages = 0;

            if (usersSnap.exists()) {
                totalUsers = Object.keys(usersSnap.val()).length;
            }

            if (chatsSnap.exists()) {
                const chatsData = chatsSnap.val();
                Object.values(chatsData).forEach(userChats => {
                    if (userChats && typeof userChats === 'object') {
                        totalChats += Object.keys(userChats).length;
                        Object.values(userChats).forEach(chat => {
                            if (chat.messages && Array.isArray(chat.messages)) {
                                totalMessages += chat.messages.filter(m => m.role === 'assistant').length;
                            }
                        });
                    }
                });
            }

            return { totalUsers, totalChats, totalMessages };
        } catch (e) {
            console.error('[Admin] Stats error:', e);
            return null;
        }
    }

    async function addSystemLog(message) {
        if (!db || isGuestUser || !currentUser) return;
        try {
            const logsRef = db.ref('admin/systemLogs');
            await logsRef.push({
                message: message,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch {}
    }

    async function getSystemLogs(limit = 50) {
        if (!db) return [];
        try {
            const snapshot = await db.ref('admin/systemLogs')
                .orderByChild('timestamp')
                .limitToLast(limit)
                .once('value');

            if (!snapshot.exists()) return [];
            const logs = [];
            snapshot.forEach(child => {
                logs.push({ id: child.key, ...child.val() });
            });
            return logs.reverse();
        } catch {
            return [];
        }
    }

    async function clearSystemLogs() {
        if (!await isAdmin()) return { success: false };
        try {
            await db.ref('admin/systemLogs').remove();
            await addSystemLog('System logs cleared by Admin.');
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async function clearAllChatsAdmin() {
        if (!await isAdmin()) return { success: false };
        try {
            await db.ref('chats').remove();
            await addSystemLog('Global chat wipe performed by Admin.');
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async function getAllUsers() {
        if (!await isAdmin()) return null;
        try {
            const snap = await db.ref('users').once('value');
            return snap.val();
        } catch { return null; }
    }

    async function getAllChatsAdmin() {
        if (!await isAdmin()) return null;
        try {
            const snap = await db.ref('chats').once('value');
            return snap.val() || {};
        } catch { return {}; }
    }

    async function setUserBlocked(uid, blocked) {
        if (!await isAdmin()) return;
        await db.ref(`users/${uid}/profile/isBlocked`).set(blocked);
        await addSystemLog(`User ${uid} was ${blocked ? 'blocked' : 'unblocked'}.`);
    }

    async function deleteUserData(uid) {
        if (!await isAdmin()) return;
        await db.ref(`users/${uid}`).remove();
        await db.ref(`chats/${uid}`).remove();
        await addSystemLog(`All data for user ${uid} was wiped.`);
    }

    async function getGlobalSettings() {
        try {
            const snap = await db.ref('globalSettings').once('value');
            return snap.val() || { forceApi: false, globalApiKey: '' };
        } catch { return { forceApi: false, globalApiKey: '' }; }
    }

    async function setGlobalSettings(settings) {
        if (!await isAdmin()) return;
        await db.ref('globalSettings').set(settings);
        await addSystemLog(`Global settings updated (Force API: ${settings.forceApi}).`);
    }

    /* -------- Auth Error Messages -------- */
    function getAuthErrorMessage(code) {
        const messages = {
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'This email is already registered.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/popup-closed-by-user': 'Sign-in was cancelled.',
            'auth/network-request-failed': 'Network error. Check your connection.',
            'auth/invalid-credential': 'Invalid credentials. Please try again.'
        };
        return messages[code] || 'Authentication error. Please try again.';
    }

    /* -------- Getters -------- */
    function getCurrentUser() { return currentUser; }
    function getIsGuest() { return isGuestUser; }

    async function requestAppPermissions() {
        try {
            // Request Microphone
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('[System] Microphone permission granted.');
            }
            
            // Storage (indexedDB/localstorage is usually auto-granted in webview, but we check ready-state)
            if (navigator.storage && navigator.storage.persist) {
                await navigator.storage.persist();
                console.log('[System] Persistent storage enabled.');
            }
            return true;
        } catch (e) {
            console.error('[System] Permission request failed:', e);
            return false;
        }
    }

    /* -------- Public API -------- */
    return {
        init,
        onAuthStateChanged,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        loginAsGuest,
        logout,
        saveApiKey,
        getApiKey,
        removeApiKey,
        saveChat,
        updateChatMessages,
        updateChatTitle,
        deleteChat,
        loadAllChats,
        loadChat,
        isAdmin,
        getAdminStats,
        addSystemLog,
        getSystemLogs,
        getAllUsers,
        getAllChatsAdmin,
        setUserBlocked,
        deleteUserData,
        getGlobalSettings,
        setGlobalSettings,
        getCurrentUser,
        getIsGuest,
        clearSystemLogs,
        clearAllChatsAdmin,
        requestAppPermissions
    };
})();
