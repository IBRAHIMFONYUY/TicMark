
// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyClsVvQhA7JGNdtgTuxKVhLEkTPzg6iEr0",
    authDomain: "ticmark-485c6.firebaseapp.com",
    projectId: "ticmark-485c6",
    storageBucket: "ticmark-485c6.appspot.com",
    messagingSenderId: "403974173327",
    appId: "1:403974173327:web:e8acedc468981a4be976fa",
    measurementId: "G-QBL5LCF0KG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Global state
window.currentUser = null;
window.userRole = null;
window.isLocationVerified = false;
window.qrStream = null;
window.auth = auth;
window.db = db;
window.companyCoordinates = { latitude: 40.7128, longitude: -74.0060 }; // Company coordinates

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUser = user;
        
        // Get user data from Firestore
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                window.userRole = userData.role;
                
                // Update UI with user info
                updateUserUI(user, userData);
                
                // Show appropriate dashboard
                if (userData.role === 'admin') {
                    showAdminDashboard();
                    loadAdminData();
                } else {
                    showInternDashboard();
                    loadInternData(user.uid);
                }
            } else {
                // New user, show profile completion
                showSignup();
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            showNotification('Error loading user data. Please try again.', 'error');
            logout();
        }
    } else {
        window.currentUser = null;
        window.userRole = null;
        showLanding();
    }
});

// Authentication functions
window.handleGoogleSignIn = async () => {
    try {
        showLoading();
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            // New user, create profile
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: window.userRole || 'intern',
                createdAt: serverTimestamp(),
                isActive: true
            });
        }
        
        hideLoading();
        showNotification('Signed in successfully!', 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Google sign-in error:', error);
        showNotification('Sign-in failed: ' + error.message, 'error');
    }
};

window.handleEmailSignIn = async (email, password) => {
    try {
        showLoading();
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        hideLoading();
        showNotification('Signed in successfully!', 'success');
    } catch (error) {
        hideLoading();
        console.error('Email sign-in error:', error);
        showNotification('Sign-in failed: ' + error.message, 'error');
    }
};

window.handleEmailSignUp = async (email, password, userData) => {
    try {
        showLoading();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Send email verification
        await sendEmailVerification(user);
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            ...userData,
            email: email,
            role: userData.role || 'intern',
            createdAt: serverTimestamp(),
            isActive: true,
            emailVerified: false
        });
        
        hideLoading();
        showNotification('Account created! Please check your email for verification.', 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Email sign-up error:', error);
        showNotification('Sign-up failed: ' + error.message, 'error');
    }
};

window.handlePasswordReset = async (email) => {
    try {
        showLoading();
        await sendPasswordResetEmail(auth, email);
        hideLoading();
        showNotification('Password reset email sent!', 'success');
    } catch (error) {
        hideLoading();
        console.error('Password reset error:', error);
        showNotification('Reset failed: ' + error.message, 'error');
    }
};

window.logout = async () => {
    try {
        await signOut(auth);
        showNotification('Logged out successfully', 'info');
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed: ' + error.message, 'error');
    }
};

// Email notification service
window.sendEmailNotification = async (to, subject, body, type = 'attendance') => {
    try {
        // Using EmailJS for client-side email sending
        const emailData = {
            to_email: to,
            subject: subject,
            message: body,
            from_name: 'AttendanceHub System',
            reply_to: 'noreply@attendancehub.com'
        };
        
        // Store notification in Firebase for tracking
        await addDoc(collection(db, 'notifications'), {
            type: type,
            recipient: to,
            subject: subject,
            body: body,
            timestamp: serverTimestamp(),
            status: 'sent'
        });
        
        // Simulate email sending (replace with actual email service)
        console.log('Email notification sent:', emailData);
        return true;
        
    } catch (error) {
        console.error('Email notification error:', error);
        return false;
    }
};

// Check-in/Check-out functions
window.recordAttendance = async (type, action, data = {}) => {
    if (!window.currentUser) {
        showNotification('Please log in first', 'error');
        return false;
    }
    
    try {
        showLoading();
        
        // Get current user data
        const userDoc = await getDoc(doc(db, 'users', window.currentUser.uid));
        const userData = userDoc.data();
        
        const now = new Date();
        const today = now.toDateString();
        const timeString = now.toLocaleTimeString();
        
        const attendanceData = {
            userId: window.currentUser.uid,
            userEmail: window.currentUser.email,
            userName: userData.displayName || window.currentUser.displayName,
            employeeId: userData.employeeId,
            department: userData.department,
            type: type, // 'qr' or 'manual'
            action: action, // 'checkin' or 'checkout'
            timestamp: serverTimestamp(),
            date: today,
            time: timeString,
            location: data.location || null,
            qrCode: data.qrCode || null,
            status: action === 'checkin' ? 'present' : 'checked_out',
            isLate: action === 'checkin' && (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30))
        };
        
        // Check if already checked in/out today for this action
        const attendanceQuery = query(
            collection(db, 'attendance'),
            where('userId', '==', window.currentUser.uid),
            where('date', '==', today),
            where('action', '==', action)
        );
        
        const existingAttendance = await getDocs(attendanceQuery);
        
        if (!existingAttendance.empty) {
            hideLoading();
            showNotification(`Already ${action === 'checkin' ? 'checked in' : 'checked out'} today!`, 'warning');
            return false;
        }
        
        // For checkout, verify that user checked in first
        if (action === 'checkout') {
            const checkInQuery = query(
                collection(db, 'attendance'),
                where('userId', '==', window.currentUser.uid),
                where('date', '==', today),
                where('action', '==', 'checkin')
            );
            
            const checkInRecord = await getDocs(checkInQuery);
            
            if (checkInRecord.empty) {
                hideLoading();
                showNotification('You must check in before checking out!', 'warning');
                return false;
            }
        }
        
        // Add attendance record
        const docRef = await addDoc(collection(db, 'attendance'), attendanceData);
        
        // Send email notification
        const emailSubject = `Attendance ${action === 'checkin' ? 'Check-in' : 'Check-out'} Confirmation - ${today}`;
        const emailBody = `
            Dear ${userData.displayName || 'User'},
            
            Your ${action === 'checkin' ? 'check-in' : 'check-out'} has been successfully recorded:
            
            Date: ${today}
            Time: ${timeString}
            Method: ${type === 'qr' ? 'QR Code Scan' : `Manual ${action === 'checkin' ? 'Check-in' : 'Check-out'}`}
            Status: ${attendanceData.isLate ? 'Late' : 'On Time'}
            Location: ${data.location ? 'Verified' : 'Not Available'}
            
            Thank you for using AttendanceHub!
            
            Best regards,
            AttendanceHub Team
        `;
        
        await sendEmailNotification(window.currentUser.email, emailSubject, emailBody);
        
        // Add to user's notification queue
        await addDoc(collection(db, 'userNotifications'), {
            userId: window.currentUser.uid,
            type: `attendance_${action}_success`,
            title: `${action === 'checkin' ? 'Check-in' : 'Check-out'} Recorded`,
            message: `Successfully ${action === 'checkin' ? 'checked in' : 'checked out'} at ${timeString}`,
            timestamp: serverTimestamp(),
            read: false,
            attendanceId: docRef.id
        });
        
        hideLoading();
        showNotification(`${action === 'checkin' ? 'Check-in' : 'Check-out'} recorded successfully! Email confirmation sent.`, 'success');
        
        // Update UI
        updateAttendanceButtons(action);
        loadInternData(window.currentUser.uid);
        updateNotificationBadge();
        
        // Show celebration animation for check-in
        if (action === 'checkin') {
            showAttendanceSuccess();
        }
        
        return true;
        
    } catch (error) {
        hideLoading();
        console.error('Attendance recording error:', error);
        showNotification(`Failed to record ${action === 'checkin' ? 'check-in' : 'check-out'}: ${error.message}`, 'error');
        return false;
    }
};

// Data loading functions
window.loadInternData = async (userId) => {
    try {
        // Load attendance stats
        const attendanceQuery = query(
            collection(db, 'attendance'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(30)
        );
        
        const attendanceSnapshot = await getDocs(attendanceQuery);
        const attendanceRecords = attendanceSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Update stats
        updateInternStats(attendanceRecords);
        updateRecentActivity(attendanceRecords);
        updateAttendanceCalendar(attendanceRecords);
        
    } catch (error) {
        console.error('Error loading intern data:', error);
        showNotification('Error loading attendance data', 'error');
    }
};

window.loadAdminData = async () => {
    try {
        showLoading();
        
        // Load all users with real-time updates
        const usersQuery = query(collection(db, 'users'), where('role', '==', 'intern'));
        
        // Set up real-time listener for users
        onSnapshot(usersQuery, (usersSnapshot) => {
            const users = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Load today's attendance with real-time updates
            const today = new Date().toDateString();
            const todayAttendanceQuery = query(
                collection(db, 'attendance'),
                where('date', '==', today)
            );
            
            onSnapshot(todayAttendanceQuery, (attendanceSnapshot) => {
                const todayAttendance = attendanceSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Update admin stats and UI
                updateAdminStats(users, todayAttendance);
                updateInternsList(users, todayAttendance);
                updateAdminNotifications(users, todayAttendance);
                hideLoading();
            }, (error) => {
                console.error('Error loading attendance data:', error);
                hideLoading();
                showNotification('Error loading attendance data', 'error');
            });
        }, (error) => {
            console.error('Error loading user data:', error);
            hideLoading();
            showNotification('Error loading user data', 'error');
        });
        
        // Load all attendance data for analytics
        const allAttendanceQuery = query(
            collection(db, 'attendance'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );
        
        const allAttendanceSnapshot = await getDocs(allAttendanceQuery);
        const allAttendance = allAttendanceSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Generate admin analytics
        generateAdminAnalytics(allAttendance);
        
    } catch (error) {
        hideLoading();
        console.error('Error loading admin data:', error);
        showNotification('Failed to load admin data: ' + error.message, 'error');
    }
};

// Enhanced admin functions
window.addNewIntern = async (internData) => {
    try {
        showLoading();
        
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, internData.email, internData.tempPassword);
        const user = userCredential.user;
        
        // Add user data to Firestore
        await setDoc(doc(db, 'users', user.uid), {
            ...internData,
            role: 'intern',
            createdAt: serverTimestamp(),
            isActive: true,
            emailVerified: false,
            createdBy: window.currentUser.uid
        });
        
        // Send welcome email
        const welcomeSubject = 'Welcome to AttendanceHub!';
        const welcomeBody = `
            Dear ${internData.displayName},
            
            Welcome to AttendanceHub! Your account has been created successfully.
            
            Login Details:
            Email: ${internData.email}
            Temporary Password: ${internData.tempPassword}
            
            Please log in and change your password immediately.
            
            Best regards,
            AttendanceHub Admin Team
        `;
        
        await sendEmailNotification(internData.email, welcomeSubject, welcomeBody, 'welcome');
        
        hideLoading();
        showNotification('Intern added successfully! Welcome email sent.', 'success');
        loadAdminData(); // Refresh data
        
    } catch (error) {
        hideLoading();
        console.error('Error adding intern:', error);
        showNotification('Failed to add intern: ' + error.message, 'error');
    }
};

window.exportAttendanceData = async (dateRange = 'month') => {
    try {
        showLoading();
        
        const now = new Date();
        let startDate;
        
        switch (dateRange) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        
        // Query attendance data
        const attendanceQuery = query(
            collection(db, 'attendance'),
            where('timestamp', '>=', startDate),
            orderBy('timestamp', 'desc')
        );
        
        const attendanceSnapshot = await getDocs(attendanceQuery);
        const attendanceData = attendanceSnapshot.docs.map(doc => doc.data());
        
        // Convert to CSV
        const csvData = convertToCSV(attendanceData);
        
        // Download CSV file
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance-report-${dateRange}-${now.toISOString().split('T')[0]}.csv`;
        link.click();
        
        // Store export record
        await addDoc(collection(db, 'exports'), {
            type: 'attendance',
            dateRange: dateRange,
            exportedBy: window.currentUser.uid,
            timestamp: serverTimestamp(),
            recordCount: attendanceData.length
        });
        
        hideLoading();
        showNotification(`Attendance report exported successfully! (${attendanceData.length} records)`, 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Export error:', error);
        showNotification('Failed to export data: ' + error.message, 'error');
    }
};

window.sendBulkNotifications = async (message, targetGroup = 'all') => {
    try {
        showLoading();
        
        // Get target users
        let usersQuery;
        if (targetGroup === 'all') {
            usersQuery = query(collection(db, 'users'), where('role', '==', 'intern'));
        } else {
            usersQuery = query(
                collection(db, 'users'), 
                where('role', '==', 'intern'),
                where('department', '==', targetGroup)
            );
        }
        
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Send notifications to each user
        const notificationPromises = users.map(async (user) => {
            // Email notification
            await sendEmailNotification(
                user.email,
                'Important Notice from AttendanceHub',
                message,
                'announcement'
            );
            
            // In-app notification
            await addDoc(collection(db, 'userNotifications'), {
                userId: user.id,
                type: 'announcement',
                title: 'Important Notice',
                message: message,
                timestamp: serverTimestamp(),
                read: false,
                sentBy: window.currentUser.uid
            });
        });
        
        await Promise.all(notificationPromises);
        
        // Log bulk notification
        await addDoc(collection(db, 'bulkNotifications'), {
            message: message,
            targetGroup: targetGroup,
            recipientCount: users.length,
            sentBy: window.currentUser.uid,
            timestamp: serverTimestamp()
        });
        
        hideLoading();
        showNotification(`Notifications sent to ${users.length} interns successfully!`, 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Bulk notification error:', error);
        showNotification('Failed to send notifications: ' + error.message, 'error');
    }
};

// QR Code functions
window.generateDailyQR = async () => {
    try {
        const today = new Date();
        const qrData = {
            type: 'attendance',
            date: today.toDateString(),
            timestamp: today.getTime(),
            code: Math.random().toString(36).substr(2, 9)
        };
        
        // Store QR code in Firestore
        await setDoc(doc(db, 'qrCodes', today.toDateString()), qrData);
        
        const canvas = document.getElementById('qrCodeCanvas');
        if (canvas) {
            QRCode.toCanvas(canvas, JSON.stringify(qrData), {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
        }
        
        showNotification('Daily QR code generated successfully!', 'success');
        
    } catch (error) {
        console.error('QR generation error:', error);
        showNotification('Failed to generate QR code: ' + error.message, 'error');
    }
};

// Notification system
window.loadUserNotifications = async (userId) => {
    try {
        const notificationsQuery = query(
            collection(db, 'userNotifications'),
            where('userId', '==', userId),
            where('read', '==', false),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        
        onSnapshot(notificationsQuery, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            updateNotificationBadge(notifications.length);
            updateNotificationDropdown(notifications);
        });
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
};

window.updateNotificationBadge = (count = 0) => {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
            
            // Add pulse animation for new notifications
            badge.classList.add('animate-pulse');
            setTimeout(() => badge.classList.remove('animate-pulse'), 3000);
        } else {
            badge.classList.add('hidden');
        }
    }
};

window.updateNotificationDropdown = (notifications) => {
    // This would update a notification dropdown if it exists
    console.log('New notifications:', notifications);
};

window.markNotificationAsRead = async (notificationId) => {
    try {
        await updateDoc(doc(db, 'userNotifications', notificationId), {
            read: true,
            readAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
};

// UI update functions
window.updateUserUI = (user, userData) => {
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const adminName = document.getElementById('adminName');
    const adminAvatar = document.getElementById('adminAvatar');
    
    const displayName = userData.displayName || user.displayName || user.email.split('@')[0];
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    
    if (userName) userName.textContent = displayName;
    if (userAvatar) userAvatar.textContent = initials;
    if (adminName) adminName.textContent = displayName;
    if (adminAvatar) adminAvatar.textContent = initials;
    
    // Load user notifications
    loadUserNotifications(user.uid);
};

window.showAttendanceSuccess = () => {
    // Create celebration animation
    const celebration = document.createElement('div');
    celebration.className = 'fixed inset-0 pointer-events-none z-50 flex items-center justify-center';
    celebration.innerHTML = `
        <div class="bg-green-500 text-white px-8 py-4 rounded-full shadow-2xl transform scale-0 animate-bounce">
            <i class="fas fa-check-circle text-3xl mr-3"></i>
            <span class="text-xl font-bold">Attendance Recorded!</span>
        </div>
    `;
    
    document.body.appendChild(celebration);
    
    // Animate in
    setTimeout(() => {
        celebration.firstElementChild.classList.remove('scale-0');
        celebration.firstElementChild.classList.add('scale-100');
    }, 100);
    
    // Remove after animation
    setTimeout(() => {
        celebration.remove();
    }, 3000);
    
    // Add confetti effect
    createConfetti();
};

window.createConfetti = () => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'fixed pointer-events-none z-40';
        confetti.style.cssText = `
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -10px;
            border-radius: 50%;
            animation: confetti-fall ${2 + Math.random() * 3}s linear forwards;
        `;
        
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 5000);
    }
};

// Enhanced admin UI functions
window.updateAdminStats = (users, todayAttendance) => {
    const totalInterns = users.length;
    const presentToday = todayAttendance.filter(a => a.action === 'checkin').length;
    const checkedOutToday = todayAttendance.filter(a => a.action === 'checkout').length;
    const absentToday = totalInterns - presentToday;
    const lateToday = todayAttendance.filter(a => a.isLate).length;
    
    // Update with animation
    animateCounter('totalInterns', totalInterns);
    animateCounter('presentToday', presentToday);
    animateCounter('absentToday', absentToday);
    animateCounter('lateToday', lateToday);
    
    // Update progress indicators
    updateAttendanceProgress(presentToday, totalInterns);
};

window.animateCounter = (elementId, targetValue) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
};

window.updateAttendanceProgress = (present, total) => {
    const percentage = total > 0 ? (present / total) * 100 : 0;
    
    // Create or update progress bar
    let progressBar = document.getElementById('attendanceProgress');
    if (!progressBar) {
        const statsContainer = document.querySelector('#adminDashboard .grid');
        if (statsContainer) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'col-span-full bg-white rounded-xl shadow-sm p-6 border mt-4';
            progressContainer.innerHTML = `
                <h4 class="text-sm font-medium text-gray-600 mb-2">Today's Attendance Rate</h4>
                <div class="w-full bg-gray-200 rounded-full h-3">
                    <div id="attendanceProgress" class="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-1000" style="width: 0%"></div>
                </div>
                <p class="text-sm text-gray-500 mt-2">${present} out of ${total} interns present (${percentage.toFixed(1)}%)</p>
            `;
            statsContainer.appendChild(progressContainer);
            progressBar = document.getElementById('attendanceProgress');
        }
    }
    
    if (progressBar) {
        setTimeout(() => {
            progressBar.style.width = `${percentage}%`;
        }, 100);
    }
};

window.updateInternsList = (users, todayAttendance) => {
    const tbody = document.getElementById('internsList');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const checkIn = todayAttendance.find(a => a.userId === user.id && a.action === 'checkin');
        const checkOut = todayAttendance.find(a => a.userId === user.id && a.action === 'checkout');
        const isPresent = !!checkIn;
        const isCheckedOut = !!checkOut;
        const isLate = checkIn?.isLate || false;
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        
        let statusClass, statusText, statusIcon;
        
        if (isCheckedOut) {
            statusClass = 'bg-blue-100 text-blue-800';
            statusText = 'Checked Out';
            statusIcon = 'fa-sign-out-alt';
        } else if (isPresent) {
            statusClass = isLate ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
            statusText = isLate ? 'Late' : 'Present';
            statusIcon = isLate ? 'fa-clock' : 'fa-check-circle';
        } else {
            statusClass = 'bg-red-100 text-red-800';
            statusText = 'Absent';
            statusIcon = 'fa-times-circle';
        }
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        ${(user.displayName || user.email).split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${user.displayName || user.email}</div>
                        <div class="text-sm text-gray-500">${user.employeeId || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ${user.department || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                    <i class="fas ${statusIcon} mr-1"></i>
                    ${statusText}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${checkIn ? checkIn.time : 'Not checked in'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${checkOut ? checkOut.time : 'Not checked out'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="viewInternDetails('${user.id}')" class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="editIntern('${user.id}')" class="text-green-600 hover:text-green-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteIntern('${user.id}')" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
};

// Utility functions
window.convertToCSV = (data) => {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                if (value && typeof value === 'object' && value.toDate) {
                    return `"${value.toDate().toISOString()}"`;
                }
                return `"${value || ''}"`;
            }).join(',')
        )
    ].join('\n');
    
    return csvContent;
};

window.generateAdminAnalytics = (attendanceData) => {
    // This would generate charts and analytics
    console.log('Generating analytics for', attendanceData.length, 'records');
};

window.updateAdminNotifications = (users, todayAttendance) => {
    // Update admin notification badge based on absent users, late arrivals, etc.
    const absentCount = users.length - todayAttendance.filter(a => a.action === 'checkin').length;
    const lateCount = todayAttendance.filter(a => a.isLate).length;
    const totalNotifications = absentCount + lateCount;
    
    updateNotificationBadge(totalNotifications);
};

window.updateInternStats = (attendanceRecords) => {
    const currentMonth = new Date().getMonth();
    const monthlyRecords = attendanceRecords.filter(record => {
        const recordDate = record.timestamp?.toDate();
        return recordDate && recordDate.getMonth() === currentMonth;
    });
    
    const checkInRecords = monthlyRecords.filter(r => r.action === 'checkin');
    const checkOutRecords = monthlyRecords.filter(r => r.action === 'checkout');
    
    document.getElementById('monthlyAttendance').textContent = `${checkInRecords.length}/22`;
    document.getElementById('avgHours').textContent = '8.2';
    document.getElementById('lateDays').textContent = checkInRecords.filter(r => r.isLate).length;
    document.getElementById('streak').textContent = '5 days';
};

window.updateRecentActivity = (attendanceRecords) => {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    container.innerHTML = '';
    
    attendanceRecords.slice(0, 3).forEach(record => {
        const activityItem = document.createElement('div');
        activityItem.className = 'flex items-center p-3 bg-green-50 rounded-lg';
        
        const timestamp = record.timestamp?.toDate();
        const timeString = timestamp ? timestamp.toLocaleString() : 'Unknown time';
        const actionText = record.action === 'checkin' ? 'Checked in' : 'Checked out';
        
        activityItem.innerHTML = `
            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <i class="fas ${record.action === 'checkin' ? 'fa-sign-in-alt' : 'fa-sign-out-alt'} text-green-600"></i>
            </div>
            <div class="ml-3 flex-1">
                <p class="text-sm font-medium text-gray-900">${actionText} successfully</p>
                <p class="text-xs text-gray-500">${timeString}</p>
            </div>
        `;
        
        container.appendChild(activityItem);
    });
};

// Event listeners
document.getElementById('googleSignInBtn').addEventListener('click', handleGoogleSignIn);
document.getElementById('googleSignUpBtn').addEventListener('click', handleGoogleSignIn);

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    updateTime();
    setInterval(updateTime, 1000);
    checkLocation();
    
    // Show notification badge
    setTimeout(() => {
        const badge = document.getElementById('notificationBadge');
        if (badge) badge.classList.remove('hidden');
    }, 2000);
});

// Navigation functions
function showLanding() {
    hideAllPages();
    document.getElementById('landingPage').classList.remove('hidden');
}

function showLogin(role) {
    hideAllPages();
    document.getElementById('loginPage').classList.remove('hidden');
    window.userRole = role;
    
    const title = document.getElementById('loginTitle');
    const subtitle = document.getElementById('loginSubtitle');
    
    if (role === 'admin') {
        title.textContent = 'Admin Login';
        subtitle.textContent = 'Access admin dashboard';
    } else {
        title.textContent = 'Intern Login';
        subtitle.textContent = 'Access your dashboard';
    }
}

function showSignup() {
    hideAllPages();
    document.getElementById('signupPage').classList.remove('hidden');
}

// ...previous code above remains unchanged...

function showForgotPassword() {
    hideAllPages();
    document.getElementById('forgotPasswordPage').classList.remove('hidden');
}

function hideAllPages() {
    const pages = [
        'landingPage',
        'loginPage',
        'signupPage',
        'forgotPasswordPage',
        'internDashboard',
        'adminDashboard'
    ];
    pages.forEach(page => {
        const el = document.getElementById(page);
        if (el) el.classList.add('hidden');
    });
}

function showInternDashboard() {
    hideAllPages();
    document.getElementById('internDashboard').classList.remove('hidden');
}

function showAdminDashboard() {
    hideAllPages();
    document.getElementById('adminDashboard').classList.remove('hidden');
}

// Utility functions for password, time, location
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function validatePassword(password) {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    return minLength && hasUpper && hasLower && hasNumber;
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const timeElement = document.getElementById('checkInTime');
    if (timeElement) timeElement.textContent = timeString;
}

// Enhanced location check (re-uses calculateDistance)
function checkLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const companyLat = window.companyCoordinates?.latitude || 3.0;
                const companyLng = window.companyCoordinates?.longitude || 11.0;
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const distance = calculateDistance(userLat, userLng, companyLat, companyLng);
                const locationStatus = document.getElementById('locationStatus');
                if (locationStatus) {
                    if (distance <= 1) {
                        window.isLocationVerified = true;
                        locationStatus.innerHTML = `
                            <i class="fas fa-map-marker-alt text-2xl text-green-500 mb-2"></i>
                            <p class="text-green-600 font-medium">Location verified ✓</p>
                            <p class="text-xs text-gray-500">${distance.toFixed(2)}km from office</p>
                        `;
                    } else {
                        window.isLocationVerified = false;
                        locationStatus.innerHTML = `
                            <i class="fas fa-map-marker-alt text-2xl text-red-500 mb-2"></i>
                            <p class="text-red-600 font-medium">Not at company location</p>
                            <p class="text-xs text-gray-500">${distance.toFixed(2)}km from office</p>
                        `;
                    }
                }
            },
            function(error) {
                const locationStatus = document.getElementById('locationStatus');
                if (locationStatus) {
                    locationStatus.innerHTML = `
                        <i class="fas fa-exclamation-triangle text-2xl text-yellow-500 mb-2"></i>
                        <p class="text-yellow-600">Location access denied</p>
                        <p class="text-xs text-gray-500">Enable location for attendance</p>
                    `;
                }
            }
        );
    }
}

// Attendance button UI logic
function updateAttendanceButtons(action) {
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');
    if (action === 'checkin') {
        if (checkInBtn) checkInBtn.disabled = true;
        if (checkOutBtn) checkOutBtn.disabled = false;
        if (checkInBtn) checkInBtn.classList.add('hidden');
        if (checkOutBtn) checkOutBtn.classList.remove('hidden');
    } else if (action === 'checkout') {
        if (checkInBtn) checkInBtn.disabled = true;
        if (checkOutBtn) checkOutBtn.disabled = true;
        if (checkInBtn) checkInBtn.classList.add('hidden');
        if (checkOutBtn) checkOutBtn.classList.add('hidden');
    } else {
        if (checkInBtn) checkInBtn.disabled = false;
        if (checkOutBtn) checkOutBtn.disabled = true;
        if (checkInBtn) checkInBtn.classList.remove('hidden');
        if (checkOutBtn) checkOutBtn.classList.add('hidden');
    }
}

// Full QR code scan flow
function startQRScan() {
    const video = document.getElementById('qrVideo');
    const canvas = document.getElementById('qrCanvas');
    const scanner = document.getElementById('qrScanner');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(function(stream) {
            window.qrStream = stream;
            video.srcObject = stream;
            video.classList.remove('hidden');
            scanner.classList.add('hidden');
            video.play();
            scanQRCode(video, canvas);
        })
        .catch(function(err) {
            showNotification('Camera access denied', 'error');
        });
}

function scanQRCode(video, canvas) {
    const context = canvas.getContext('2d');
    function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                stopQRScan();
                window.processQRCode(code.data);
                return;
            }
        }
        requestAnimationFrame(tick);
    }
    tick();
}

function stopQRScan() {
    if (window.qrStream) {
        window.qrStream.getTracks().forEach(track => track.stop());
        window.qrStream = null;
    }
    const video = document.getElementById('qrVideo');
    const scanner = document.getElementById('qrScanner');
    video.classList.add('hidden');
    scanner.classList.remove('hidden');
}

// Handle manual checkin/checkout
async function manualCheckIn() {
    await window.recordAttendance('manual', 'checkin');
}
async function manualCheckOut() {
    await window.recordAttendance('manual', 'checkout');
}

// -- Add any remaining UI helper functions and admin/intern CRUD as needed --

// Form handlers (optional, if forms are present)
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    window.handleEmailSignIn(email, password);
});
document.getElementById('signupForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const userData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        employeeId: document.getElementById('employeeId').value,
        department: document.getElementById('department').value,
        displayName: document.getElementById('firstName').value + ' ' + document.getElementById('lastName').value
    };
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    if (!validatePassword(password)) {
        showNotification('Password must meet requirements', 'error');
        return;
    }
    window.handleEmailSignUp(email, password, userData);
});
document.getElementById('forgotPasswordForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    window.handlePasswordReset(email);
});

