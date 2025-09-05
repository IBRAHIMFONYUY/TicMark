
      // Import Firebase modules
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
      import {
        getAuth,
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        signOut,
        sendPasswordResetEmail,
        onAuthStateChanged,
        GoogleAuthProvider,
        signInWithPopup,
      } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
        onSnapshot,
        updateDoc,
        serverTimestamp,
        getDocs,
        documentId,
      } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
      import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
      import {
        getFunctions,
        httpsCallable,
      } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

      // Firebase configuration
      const firebaseConfig = {
        apiKey: "AIzaSyClsVvQhA7JGNdtgTuxKVhLEkTPzg6iEr0",
        authDomain: "ticmark-485c6.firebaseapp.com",
        projectId: "ticmark-485c6",
        storageBucket: "ticmark-485c6.firebasestorage.app",
        messagingSenderId: "403974173327",
        appId: "1:403974173327:web:e8acedc468981a4be976fa",
        measurementId: "G-QBL5LCF0KG",
      };

      // Initialize Firebase
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      const analytics = getAnalytics(app);
      const functions = getFunctions(app);

      // Initialize Google Auth Provider
      const googleProvider = new GoogleAuthProvider();
      googleProvider.addScope("email");
      googleProvider.addScope("profile");

      // Make Firebase services available globally
      window.firebaseAuth = auth;
      window.firebaseDb = db;
      window.firebaseApp = app;

      // Push notification system
      async function initializePushNotifications() {
        if ("Notification" in window && "serviceWorker" in navigator) {
          try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
              console.log("Push notifications enabled");
              localStorage.setItem("notificationsEnabled", "true");
            } else {
              console.log("Push notifications denied");
              localStorage.setItem("notificationsEnabled", "false");
            }
          } catch (error) {
            console.error("Error initializing push notifications:", error);
          }
        }
      }

      // Send push notification
      function sendPushNotification(title, body, icon = "/favicon.ico") {
        if (
          Notification.permission === "granted" &&
          localStorage.getItem("notificationsEnabled") === "true"
        ) {
          try {
            const notification = new Notification(title, {
              body: body,
              icon: icon,
              badge: icon,
              tag: "attendance-notification",
              requireInteraction: false,
              silent: false,
            });

            notification.onclick = function () {
              window.focus();
              notification.close();
            };

            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
          } catch (error) {
            console.error("Error sending push notification:", error);
          }
        }
      }

      // Email notification system
      async function sendEmailNotification(to, subject, body, type = "info") {
        try {
          const sendEmail = httpsCallable(functions, "sendEmail");
          const result = await sendEmail({ to, subject, body });

          if (result.data.success) {
            showNotification(`Email sent to ${to}`, "success");

            // Log the email
            const emailLog = JSON.parse(
              localStorage.getItem("emailLog") || "[]"
            );
            emailLog.push({
              to,
              subject,
              body,
              type,
              timestamp: Date.now(),
              status: "sent",
            });
            localStorage.setItem("emailLog", JSON.stringify(emailLog));

            return { success: true, messageId: Date.now().toString() };
          } else {
            showNotification("Failed to send email", "error");
            return { success: false, error: result.data.error };
          }
        } catch (err) {
          showNotification("Failed to send email", "error");
          return { success: false, error: err.message };
        } finally {
          hideLoading();
        }
      }

      // Global state
      window.currentUser = null;
      window.userRole = null;
      window.isLocationVerified = true;
      window.qrStream = null;
      window.currentAttendanceSession = null;
      window.workingHoursTimer = null;
      window.attendanceListeners = [];

      // Error handling utility
      function handleFirebaseError(error) {
        console.error("Firebase Error:", error);
        let message = "An error occurred. Please try again.";

        switch (error.code) {
          case "auth/user-not-found":
            message = "No account found with this email address.";
            break;
          case "auth/wrong-password":
            message = "Incorrect password. Please try again.";
            break;
          case "auth/email-already-in-use":
            message = "An account with this email already exists.";
            break;
          case "auth/weak-password":
            message = "Password should be at least 6 characters long.";
            break;
          case "auth/invalid-email":
            message = "Please enter a valid email address.";
            break;
          case "auth/network-request-failed":
            message = "Network error. Please check your connection.";
            break;
          case "permission-denied":
            message = "You do not have permission to perform this action.";
            break;
          case "unavailable":
            message =
              "Service temporarily unavailable. Please try again later.";
            break;
        }

        showNotification(message, "error");
        return message;
      }

      // Auth state observer with persistence
      onAuthStateChanged(auth, async (user) => {
        console.log(
          "Auth state changed:",
          user ? "User logged in" : "User logged out"
        );

        if (user) {
          try {
            showLoading();
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              window.currentUser = {
                uid: user.uid,
                email: user.email,
                photoURL: user.photoURL,
                displayName: user.displayName,
                ...userData,
              };
              window.userRole = userData.role;

              // Save to localStorage for persistence
              localStorage.setItem(
                "currentUser",
                JSON.stringify(window.currentUser)
              );
              localStorage.setItem("userRole", userData.role);
              localStorage.setItem("lastLoginTime", Date.now().toString());

              // Check if profile completion is needed
              if (userData.needsProfileCompletion) {
                hideLoading();
                showProfileCompletion(userData);
                return;
              }

              // Initialize push notifications
              await initializePushNotifications();

              if (userData.role === "admin") {
                showAdminDashboard();
                updateUserUI(
                  userData.firstName + " " + userData.lastName,
                  userData.photoURL || "AD"
                );
                await loadAdminData();
              } else {
                showInternDashboard();
                updateUserUI(
                  userData.firstName + " " + userData.lastName,
                  userData.photoURL ||
                    userData.firstName.charAt(0) + userData.lastName.charAt(0)
                );
                await loadInternData();
              }

              showNotification(
                `Welcome back, ${userData.firstName}!`,
                "success"
              );
            } else {
              // User document doesn't exist, sign out
              await signOut(auth);
            }
          } catch (error) {
            console.error("Auth state error:", error);
            handleFirebaseError(error);
          } finally {
            hideLoading();
          }
        } else {
          // User logged out - clear everything
          window.currentUser = null;
          window.userRole = null;
          localStorage.removeItem("currentUser");
          localStorage.removeItem("userRole");
          localStorage.removeItem("lastLoginTime");

          // Clean up listeners
          window.attendanceListeners.forEach((unsubscribe) => unsubscribe());
          window.attendanceListeners = [];

          // Stop timers
          stopWorkingHoursTimer();

          showLanding();
        }
      });

      // User registration
      async function registerUser(email, password, userData) {
        try {
          showLoading();
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
          const user = userCredential.user;

          // Save user data to Firestore
          await setDoc(doc(db, "users", user.uid), {
            ...userData,
            role: "intern", // Default role
            createdAt: serverTimestamp(),
            isActive: true,
          });

          showNotification("Account created successfully, please wait till redirected to dashboard!", "success");
          return user;
        } catch (error) {
          handleFirebaseError(error);
          throw error;
        } finally {
          hideLoading();
        }
      }

      // User login
      async function loginUser(email, password) {
        try {
          showLoading();
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
          );
          showNotification("Login successful , please wait till redirected to dashboard!!", "success");
          return userCredential.user;
        } catch (error) {
          handleFirebaseError(error);
          throw error;
        } finally {
          hideLoading();
        }
      }

      // Password reset
      async function resetPassword(email) {
        try {
          showLoading();
          await sendPasswordResetEmail(auth, email);
          showNotification("Password reset email sent!", "success");
        } catch (error) {
          handleFirebaseError(error);
          throw error;
        } finally {
          hideLoading();
        }
      }

      // Google Sign In
      async function signInWithGoogle(role = "intern") {
        try {
          showLoading();
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;

          // Check if user exists in Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));

          if (!userDoc.exists()) {
            // New user - create profile with role selection
            const userData = {
              firstName: user.displayName?.split(" ")[0] || "User",
              lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
              email: user.email,
              employeeId: `EMP${Date.now()}`, // Auto-generate employee ID
              department: "", // Will be set in profile completion
              role: role,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
              isActive: true,
              needsProfileCompletion: true,
              authProvider: "google",
            };

            await setDoc(doc(db, "users", user.uid), userData);

            // Show profile completion modal for new users
            if (role === "intern") {
              showProfileCompletion(userData);
            } else {
              showNotification(
                "Admin account created! Please complete your profile.",
                "success"
              );
            }
          } else {
            // Existing user - verify role matches
            const existingData = userDoc.data();
            if (existingData.role !== role) {
              await signOut(auth);
              showNotification(
                `This account is registered as ${existingData.role}. Please use the correct login portal.`,
                "error"
              );
              return;
            }

            showNotification("Google sign-in successful!", "success");
          }

          return user;
        } catch (error) {
          if (error.code === "auth/popup-closed-by-user") {
            showNotification("Sign-in cancelled", "warning");
          } else if (error.code === "auth/popup-blocked") {
            showNotification(
              "Popup blocked. Please allow popups and try again.",
              "error"
            );
          } else {
            handleFirebaseError(error);
          }
          throw error;
        } finally {
          hideLoading();
        }
      }

      // Complete Google user profile
      async function completeGoogleProfile(profileData) {
        if (!window.currentUser) return;

        try {
          showLoading();

          const userRef = doc(db, "users", window.currentUser.uid);
          await updateDoc(userRef, {
            ...profileData,
            needsProfileCompletion: false,
            updatedAt: serverTimestamp(),
          });

          // Update local user data
          window.currentUser = { ...window.currentUser, ...profileData };

          showNotification("Profile completed successfully!", "success");
          closeProfileCompletion();
          if (window.userRole === "intern") {
            showInternDashboard();
          } else {
            showAdminDashboard();
          }
        } catch (error) {
          handleFirebaseError(error);
        } finally {
          hideLoading();
        }
      }

      // Attendance functions
      async function checkIn() {
        if (!window.currentUser) return;

        try {
          showLoading();
          const now = new Date();
          const today = now.toDateString();

          // Check today's attendance
          const attendanceQuery = query(
            collection(db, "attendance"),
            where("userId", "==", window.currentUser.uid),
            where("date", "==", today)
          );
          const existingAttendance = await getDocs(attendanceQuery);

          if (!existingAttendance.empty) {
            const attendanceData = existingAttendance.docs[0].data();

            // Already checked in but not checked out → deny new check-in
            if (attendanceData.checkInTime && !attendanceData.checkOutTime) {
              showNotification("You are already checked in!", "warning");
              return;
            }

            // Already checked in and checked out → cannot check in again
            if (attendanceData.checkInTime && attendanceData.checkOutTime) {
              showNotification("You have already checked out today!", "info");
              return;
            }
          }

          // Validate location
          const accessCheck = await checkStudentAccess();
          if (!accessCheck.access) {
            showNotification(`Access denied: ${accessCheck.reason}`, "error");
            return;
          }

          const location = await getCurrentLocation();

          // Create attendance record
          const attendanceData = {
            userId: window.currentUser.uid,
            userEmail: window.currentUser.email,
            userName: `${window.currentUser.firstName} ${window.currentUser.lastName}`,
            department: window.currentUser.department,
            date: today,
            checkInTime: serverTimestamp(),
            checkInLocation: location,
            status: "checked-in",
            createdAt: serverTimestamp(),
          };

          await addDoc(collection(db, "attendance"), attendanceData);

          window.currentAttendanceSession = { checkInTime: Date.now() };
          updateAttendanceButtons("checked-in");
          updateCurrentStatus("checked-in", now.toLocaleTimeString());
          startWorkingHoursTimer();
          addRecentActivity("Checked in", now.toLocaleString());

          sendPushNotification("Attendance Update", "Successfully checked in!");
          showNotification("Checked in successfully!", "success");
        } catch (error) {
          handleFirebaseError(error);
        } finally {
          hideLoading();
        }
      }

      async function checkOut() {
        if (!window.currentUser) return;

        try {
          showLoading();
          const now = new Date();
          const today = now.toDateString();

          // Find today's attendance
          const attendanceQuery = query(
            collection(db, "attendance"),
            where("userId", "==", window.currentUser.uid),
            where("date", "==", today)
          );
          const existingAttendance = await getDocs(attendanceQuery);

          if (existingAttendance.empty) {
            showNotification("You haven't checked in today!", "warning");
            return;
          }

          const attendanceDoc = existingAttendance.docs[0];
          const attendanceRef = doc(db, "attendance", attendanceDoc.id);
          const attendanceData = attendanceDoc.data();

          if (!attendanceData.checkInTime) {
            showNotification("You haven't checked in today!", "warning");
            return;
          }

          if (attendanceData.checkOutTime) {
            showNotification("You have already checked out!", "info");
            return;
          }

          // Validate location before checkout
          const accessCheck = await checkStudentAccess();
          if (!accessCheck.access) {
            showNotification(`Checkout denied: ${accessCheck.reason}`, "error");
            return;
          }

          const location = await getCurrentLocation();

          // Calculate working hours
          const checkInTime = attendanceData.checkInTime.toDate();
          const workingHours = (now - checkInTime) / (1000 * 60 * 60);

          // Update checkout info
          await updateDoc(attendanceRef, {
            checkOutTime: serverTimestamp(),
            checkOutLocation: location,
            status: "checked-out",
            workingHours: workingHours,
            updatedAt: serverTimestamp(),
          });

          updateAttendanceButtons("checked-out");
          updateCurrentStatus("checked-out", now.toLocaleTimeString());
          updateWorkingHours(workingHours);
          stopWorkingHoursTimer();
          window.currentAttendanceSession = null;
          addRecentActivity("Checked out", now.toLocaleString());

          sendPushNotification(
            "Attendance Update",
            "Successfully checked out!"
          );
          showNotification("Checked out successfully!", "success");
        } catch (error) {
          handleFirebaseError(error);
        } finally {
          hideLoading();
        }
      }

      // Location services
      // Company fixed location (example)
      const companyLocation = {
        latitude: 3.860987,                                                                                               
        longitude: 11.498647,
      };

      // Haversine formula to calculate distance in km
      function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const toRad = (deg) => (deg * Math.PI) / 180;

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

        const c = 2 * Math.asin(Math.sqrt(a));

        return R * c; // Distance in km
      }

      // Location services with validation
      async function checkStudentAccess() {
        const studentLocation = await getCurrentLocation();
        const locationMessage = document.getElementById("locationMessage");
        const locationDistance = document.getElementById("locationDistance");

        if (!studentLocation.latitude || !studentLocation.longitude) {
          console.warn("Unable to fetch location:", studentLocation.error);
          return { access: false, reason: "Location not available" };
        }

        // Calculate distance

        const distance = haversineDistance(
          studentLocation.latitude,
          studentLocation.longitude,
          companyLocation.latitude,
          companyLocation.longitude
        );

        if (locationMessage) {
          locationMessage.textContent = `You are ${distance.toFixed(
            2
          )} km away from company`;
        }

        if (locationDistance) {
          locationDistance.textContent = `Accuracy: ${studentLocation.accuracy.toFixed(
            1
          )}m`;
        }

        if (distance <= 3) {
          return { access: true, reason: "Within safe boundary" };
        } else {
          return {
            access: false,
            reason: `Outside safe boundary  with ${distance.toFixed(2)}km`,
          };
        }
      }
      function getCurrentLocation() {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve({ error: "Geolocation not supported" });
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              });
            },
            (error) => {
              resolve({ error: error.message });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      }
      // Load intern dashboard data
      // Load intern dashboard data in real-time
      async function loadInternData() {
        if (!window.currentUser) return;

        const today = new Date().toDateString();

        // Listen for today's attendance changes
        const attendanceQueryToday = query(
          collection(db, "attendance"),
          where("userId", "==", window.currentUser.uid),
          where("date", "==", today)
        );

        const unsubscribeToday = onSnapshot(
          attendanceQueryToday,
          (snapshot) => {
            if (!snapshot.empty) {
              const attendanceData = snapshot.docs[0].data();
              if (attendanceData.status === "checked-in") {
                window.currentAttendanceSession = {
                  checkInTime: attendanceData.checkInTime.toDate().getTime(),
                };
                updateAttendanceButtons("checked-in");
                updateCurrentStatus(
                  "checked-in",
                  attendanceData.checkInTime.toDate().toLocaleTimeString()
                );
                startWorkingHoursTimer();
              } else if (attendanceData.status === "checked-out") {
                updateAttendanceButtons("checked-out");
                updateCurrentStatus(
                  "checked-out",
                  attendanceData.checkOutTime.toDate().toLocaleTimeString()
                );
                stopWorkingHoursTimer();
                window.currentAttendanceSession = null;
              }
            } else {
              updateAttendanceButtons("not-checked-in");
              updateCurrentStatus("not-checked-in", "--");
            }
          }
        );
        window.attendanceListeners.push(unsubscribeToday);

        // Load monthly stats in real-time
        loadMonthlyStats();

        // Load recent activity in real-time
        loadRecentActivity();
      }

      // Load monthly statistics
      function loadMonthlyStats() {
        if (!window.currentUser) return;

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const attendanceQuery = query(
          collection(db, "attendance"),
          where("userId", "==", window.currentUser.uid),
          where("createdAt", ">=", firstDay),
          where("createdAt", "<=", lastDay)
        );

        const unsubscribeMonthly = onSnapshot(attendanceQuery, (snapshot) => {
          const attendanceData = snapshot.docs.map((doc) => doc.data());

          const totalDays = attendanceData.length;
          const workingDays = lastDay.getDate();
          const avgHours =
            attendanceData.reduce(
              (sum, record) => sum + (record.workingHours || 0),
              0
            ) / totalDays || 0;
          const lateDays = attendanceData.filter((record) => {
            if (record.checkInTime) {
              const checkInHour = record.checkInTime.toDate().getHours();
              return checkInHour > 9; // 9 AM standard
            }
            return false;
          }).length;

          document.getElementById(
            "monthlyAttendance"
          ).textContent = `${totalDays}/${workingDays}`;
          document.getElementById("avgHours").textContent = `${avgHours.toFixed(
            1
          )}h`;
          document.getElementById("lateDays").textContent = lateDays;
          document.getElementById("streak").textContent = `${Math.min(
            totalDays,
            5
          )} days`;
        });
        window.attendanceListeners.push(unsubscribeMonthly);
      }

      // Load recent activity
      function loadRecentActivity() {
        if (!window.currentUser) return;

        const attendanceQuery = query(
          collection(db, "attendance"),
          where("userId", "==", window.currentUser.uid),
          orderBy("createdAt", "desc")
        );

        const unsubscribeRecent = onSnapshot(attendanceQuery, (snapshot) => {
          const activityContainer = document.getElementById("recentActivity");
          activityContainer.innerHTML = "";

          if (snapshot.empty) {
            activityContainer.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <i class="fas fa-clock text-2xl mb-2"></i>
          <p>No recent activity</p>
        </div>
      `;
            return;
          }

          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const activity = document.createElement("div");
            activity.className =
              "flex items-center space-x-3 p-3 bg-gray-50 rounded-lg";

            const isCheckIn =
              data.status === "checked-in" ||
              (data.checkInTime && !data.checkOutTime);
            const time = isCheckIn ? data.checkInTime : data.checkOutTime;
            const action = isCheckIn ? "Checked in" : "Checked out";
            const color = isCheckIn ? "green" : "orange";

            activity.innerHTML = `
        <div class="w-2 h-2 bg-${color}-500 rounded-full"></div>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">${action}</p>
          <p class="text-xs text-gray-500">${
            time ? time.toDate().toLocaleDateString() : "Unknown"
          }</p>
        </div>
      `;
            activityContainer.appendChild(activity);
          });
        });
        window.attendanceListeners.push(unsubscribeRecent);
      }

      // Load admin dashboard data
      async function loadAdminData() {
        if (!window.currentUser || window.userRole !== "admin") return;

        // Track all unsubscribe functions to clean up listeners
        window.adminListeners = window.adminListeners || [];
        window.adminListeners.forEach((unsub) => unsub());
        window.adminListeners = [];

        // Listen for all interns
        const usersQuery = query(
          collection(db, "users"),
          where("role", "==", "intern")
        );

        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          const totalInterns = snapshot.size;
          document.getElementById("totalInterns").textContent = totalInterns;

          loadInternsList(); // update the interns table
        });
        window.adminListeners.push(unsubscribeUsers);

        // Listen for today's attendance
        const today = new Date().toDateString();
        const attendanceQuery = query(
          collection(db, "attendance"),
          where("date", "==", today)
        );

        const unsubscribeAttendance = onSnapshot(
          attendanceQuery,
          (snapshot) => {
            const presentToday = snapshot.size;
            const currentlyWorking = snapshot.docs.filter(
              (doc) => doc.data().status === "checked-in"
            ).length;

            const totalInternsEl =
              document.getElementById("totalInterns").textContent;
            const totalInterns = totalInternsEl ? parseInt(totalInternsEl) : 0;
            const absentToday = totalInterns - presentToday;

            document.getElementById("presentToday").textContent = presentToday;
            document.getElementById("currentlyWorking").textContent =
              currentlyWorking;
            document.getElementById("absentToday").textContent = absentToday;

            loadInternsList(); // Refresh table on attendance change
          }
        );
        window.adminListeners.push(unsubscribeAttendance);
      }

      // Real-time listeners
      async function loadInternsList() {
        const internsList = document.getElementById("internsList");
        if (!internsList) return;

        const auth = window.firebaseAuth;
        const db = window.firebaseDb;

        const user = auth.currentUser;
        if (!user) return console.log("No user logged in") && (internsList.innerHTML = "");

        const tokenResult = await user.getIdTokenResult();
        console.log(tokenResult)
        if(!tokenResult) {
          return internsList.innerHTML = `
            <tr>
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                <i class="fas fa-users text-2xl mb-2"></i>
                <p>Access denied</p>
              </td>
            </tr>
          `;
        }
        
        const isAdmin = tokenResult.claims.role === "admin";

        let usersQuery;
        if (isAdmin) {
          usersQuery = query(
            collection(db, "users"),
            where("role", "==", "intern")
          );
        } else {
          usersQuery = query(
            collection(db, "users"),
            where("role", "==", "intern"),
            where(documentId(), "==", user.uid)
          );
        }

        const unsubscribe = onSnapshot(usersQuery, async (snapshot) => {
          internsList.innerHTML = "";
          const today = new Date().toDateString();

          if (snapshot.empty) {
            internsList.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-gray-500">
            <i class="fas fa-users text-2xl mb-2"></i>
            <p>No interns found</p>
          </td>
        </tr>
      `;
            return;
          }

          for (const userDoc of snapshot.docs) {
            const userData = userDoc.data();

            // Listen for today's attendance for this user
            const attendanceQuery = query(
              collection(db, "attendance"),
              where("userId", "==", userDoc.id),
              where("date", "==", today)
            );

            const attendanceSnap = await getDocs(attendanceQuery);
            let status = "Absent";
            let statusClass = "status-offline";
            let checkIn = "--";
            let checkOut = "--";
            let hours = "0h";

            if (!attendanceSnap.empty) {
              const attendanceData = attendanceSnap.docs[0].data();
              if (attendanceData.status === "checked-in") {
                status = "Working";
                statusClass = "status-online";
              } else if (attendanceData.status === "checked-out") {
                status = "Completed";
                statusClass = "status-away";
              }

              if (attendanceData.checkInTime)
                checkIn = attendanceData.checkInTime
                  .toDate()
                  .toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
              if (attendanceData.checkOutTime)
                checkOut = attendanceData.checkOutTime
                  .toDate()
                  .toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
              if (attendanceData.workingHours)
                hours = `${attendanceData.workingHours.toFixed(1)}h`;
            }

            const row = document.createElement("tr");
            row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
              ${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}
            </div>
            <div class="ml-4">
              <div class="text-sm font-medium text-gray-900">
                ${userData.firstName} ${userData.lastName}
              </div>
              <div class="text-sm text-gray-500">${userData.email}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            ${userData.department}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="flex items-center">
            <span class="status-indicator ${statusClass}"></span>
            <span class="text-sm text-gray-900">${status}</span>
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${checkIn}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${checkOut}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${hours}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          ${
            isAdmin
              ? `<button class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
          <button class="text-red-600 hover:text-red-900">Remove</button>`
              : ""
          }
        </td>
      `;
            internsList.appendChild(row);
          }
        });

        window.adminListeners.push(unsubscribe);
      }

      // Add new intern function
      async function addNewIntern(userData, password) {
        try {
          showLoading();

          // Create user account
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            userData.email,
            password
          );
          const user = userCredential.user;

          // Save user data to Firestore
          await setDoc(doc(db, "users", user.uid), {
            ...userData,
            role: "intern",
            createdAt: serverTimestamp(),
            isActive: true,
            needsPasswordChange: true,
          });

          showNotification("Intern added successfully!", "success");
          closeAddIntern();
          loadAdminData();
        } catch (error) {
          handleFirebaseError(error);
        } finally {
          hideLoading();
        }
      }

      function setupRealTimeListeners() {
        if (!window.currentUser) return;

        // Clean up existing listeners
        window.attendanceListeners.forEach((unsubscribe) => unsubscribe());
        window.attendanceListeners = [];

        if (window.userRole === "admin") {
          // Admin real-time listeners
          const usersQuery = query(
            collection(db, "users"),
            where("role", "==", "intern")
          );
          const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            loadAdminData();
          });
          window.attendanceListeners.push(unsubscribeUsers);

          const today = new Date().toDateString();
          const attendanceQuery = query(
            collection(db, "attendance"),
            where("date", "==", today)
          );
          const unsubscribeAttendance = onSnapshot(
            attendanceQuery,
            (snapshot) => {
              loadAdminData();
              loadInternsList();
            }
          );
          window.attendanceListeners.push(unsubscribeAttendance);
        } else {
          // Intern real-time listeners
          const today = new Date().toDateString();
          const attendanceQuery = query(
            collection(db, "attendance"),
            where("userId", "==", window.currentUser.uid),
            where("date", "==", today)
          );
          const unsubscribeAttendance = onSnapshot(
            attendanceQuery,
            (snapshot) => {
              if (!snapshot.empty) {
                const attendanceData = snapshot.docs[0].data();
                if (
                  attendanceData.status === "checked-in" &&
                  !window.currentAttendanceSession
                ) {
                  window.currentAttendanceSession = {
                    checkInTime: attendanceData.checkInTime.toDate().getTime(),
                  };
                  updateAttendanceButtons("checked-in");
                  updateCurrentStatus(
                    "checked-in",
                    attendanceData.checkInTime.toDate().toLocaleTimeString()
                  );
                  startWorkingHoursTimer();
                }
              }
            }
          );
          window.attendanceListeners.push(unsubscribeAttendance);

          // Listen for user profile updates
          const userDocRef = doc(db, "users", window.currentUser.uid);
          const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
              const userData = doc.data();
              window.currentUser = { ...window.currentUser, ...userData };
              updateUserUI(
                userData.firstName + " " + userData.lastName,
                userData.firstName.charAt(0) + userData.lastName.charAt(0)
              );
            }
          });
          window.attendanceListeners.push(unsubscribeUser);
        }
      }

      // Update user profile
      async function updateUserProfile(profileData) {
        if (!window.currentUser) return;

        try {
          showLoading();

          const userRef = doc(db, "users", window.currentUser.uid);
          await updateDoc(userRef, {
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            department: profileData.department,
            updatedAt: serverTimestamp(),
          });

          // Update local user data
          window.currentUser.firstName = profileData.firstName;
          window.currentUser.lastName = profileData.lastName;
          window.currentUser.department = profileData.department;

          showNotification("Profile updated successfully!", "success");
          closeProfile();
        } catch (error) {
          handleFirebaseError(error);
        } finally {
          hideLoading();
        }
      }

      // Export attendance data
      async function exportAttendanceData() {
        try {
          showLoading();

          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);

          const attendanceQuery = query(
            collection(db, "attendance"),
            where("createdAt", ">=", startDate),
            orderBy("createdAt", "desc")
          );

          const attendanceDocs = await getDocs(attendanceQuery);

          if (attendanceDocs.empty) {
            showNotification("No attendance data to export", "warning");
            return;
          }

          // Prepare CSV data
          const csvData = [];
          csvData.push([
            "Date",
            "Employee Name",
            "Employee Email",
            "Department",
            "Check In Date",
            "Check In Time",
            "Check Out Date",
            "Check Out Time",
            "Working Hours",
            "Status"
          ]);

          attendanceDocs.forEach((doc) => {
            const data = doc.data();
            csvData.push([
              data.date || "",
              data.userName || "",
              data.userEmail || "",
              data.department || "",
              data.checkInTime
                ? data.checkInTime.toDate().toLocaleString()
                : "",
              data.checkOutTime
                ? data.checkOutTime.toDate().toLocaleString()
                : "",
              data.workingHours ? data.workingHours.toFixed(2) + "h" : "",
              data.status || "",
            ]);
          });

          // Create and download CSV
          const csvContent = csvData.map((row) => row.join(",")).join("\n");
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `attendance-report-${
            new Date().toISOString().split("T")[0]
          }.csv`;
          link.click();
          window.URL.revokeObjectURL(url);

          showNotification("Attendance data exported successfully!", "success");
        } catch (error) {
          handleFirebaseError(error);
        } finally {
          hideLoading();
        }
      }

      async function sendNotifications() {
        if (!window.currentUser || window.userRole !== "admin") {
          showNotification("Access denied", "error");
          return;
        }

        try {
          showLoading();

          // Get all interns
          const usersQuery = query(
            collection(window.firebaseDb, "users"),
            where("role", "==", "intern")
          );
          const usersDocs = await getDocs(usersQuery);

          if (usersDocs.empty) {
            showNotification("No interns found to notify", "warning");
            return;
          }

          const today = new Date().toDateString();
          const currentTime = new Date().toLocaleTimeString();

          // Check who hasn't checked in today
          const attendanceQuery = query(
            collection(window.firebaseDb, "attendance"),
            where("date", "==", today)
          );
          const attendanceDocs = await getDocs(attendanceQuery);
          const checkedInUserIds = attendanceDocs.docs.map(
            (doc) => doc.data().userId
          );

          let notificationsSent = 0;

          // Send notifications to interns who haven't checked in
          for (const userDoc of usersDocs.docs) {
            const userData = userDoc.data();

            if (!checkedInUserIds.includes(userDoc.id)) {
              // Send email reminder
              await sendEmailNotification(
                userData.email,
                "Attendance Reminder - AttendanceHub",
                `Hello ${userData.firstName},\n\nThis is a friendly reminder to check in for today (${today}).\n\nCurrent time: ${currentTime}\n\nPlease log in to AttendanceHub and mark your attendance.\n\nBest regards,\nAttendanceHub Admin Team`,
                "reminder"
              );

              notificationsSent++;

              // Small delay to avoid overwhelming the system
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          // Send summary notification to admin
          sendPushNotification(
            "Notifications Sent",
            `Sent ${notificationsSent} attendance reminders to interns who haven't checked in today.`
          );

          showNotification(
            `Sent ${notificationsSent} attendance reminders successfully!`,
            "success"
          );
        } catch (error) {
          console.error("Error sending notifications:", error);
          showNotification("Error sending notifications", "error");
        } finally {
          hideLoading();
        }
      }

      // Make functions available globally
      window.registerUser = registerUser;
      window.loginUser = loginUser;
      window.resetPassword = resetPassword;
      window.signInWithGoogle = signInWithGoogle;
      window.completeGoogleProfile = completeGoogleProfile;
      window.checkIn = checkIn;
      window.checkOut = checkOut;
      window.loadInternData = loadInternData;
      window.loadAdminData = loadAdminData;
      window.setupRealTimeListeners = setupRealTimeListeners;
      window.addNewIntern = addNewIntern;
      window.updateUserProfile = updateUserProfile;
      window.exportAttendanceData = exportAttendanceData;
      window.initializePushNotifications = initializePushNotifications;
      window.sendPushNotification = sendPushNotification;
      window.sendEmailNotification = sendEmailNotification;
      window.sendNotifications = sendNotifications;
