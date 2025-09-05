// Navigation functions
function showLanding() {
  hideAllPages();
  document.getElementById("landingPage").classList.remove("hidden");
}

function showLogin(role) {
  hideAllPages();
  document.getElementById("loginPage").classList.remove("hidden");
  window.userRole = role;

  const title = document.getElementById("loginTitle");
  const subtitle = document.getElementById("loginSubtitle");

  if (role === "admin") {
    title.textContent = "Admin Login";
    subtitle.textContent = "Access admin dashboard";
  } else {
    title.textContent = "Intern Login";
    subtitle.textContent = "Access your dashboard";
  }
}

function showSignup() {
  hideAllPages();
  document.getElementById("signupPage").classList.remove("hidden");
}

function showForgotPassword() {
  hideAllPages();
  document.getElementById("forgotPasswordPage").classList.remove("hidden");
}

function hideAllPages() {
  const pages = [
    "landingPage",
    "loginPage",
    "signupPage",
    "forgotPasswordPage",
    "internDashboard",
    "adminDashboard",
  ];
  pages.forEach((page) => {
    document.getElementById(page).classList.add("hidden");
  });
}

function showInternDashboard() {
  hideAllPages();
  document.getElementById("internDashboard").classList.remove("hidden");
  generateCalendar();
  updateTime();
  setInterval(updateTime, 1000);
  window.loadInternData();
  window.setupRealTimeListeners();
}

function showAdminDashboard() {
  hideAllPages();
  document.getElementById("adminDashboard").classList.remove("hidden");
  generateDailyQR();
  window.loadAdminData();
  window.setupRealTimeListeners();
}

// Form handlers
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    clearFormErrors();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!validateEmail(email)) {
      showFieldError("loginEmailError", "Please enter a valid email address");
      return;
    }

    if (!password) {
      showFieldError("loginPasswordError", "Password is required");
      return;
    }

    try {
      await window.loginUser(email, password);
      clearAutoSave("loginForm"); // Clear auto-saved data on successful login
    } catch (error) {
      // Error is already handled in loginUser function
    }
  });

document
  .getElementById("signupForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    clearFormErrors();

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const employeeId = document.getElementById("employeeId").value.trim();
    const department = document.getElementById("department").value;
    const password = document.getElementById("signupPassword").value;

    let hasErrors = false;

    if (!firstName) {
      showFieldError("firstNameError", "First name is required");
      hasErrors = true;
    }

    if (!lastName) {
      showFieldError("lastNameError", "Last name is required");
      hasErrors = true;
    }

    if (!validateEmail(email)) {
      showFieldError("signupEmailError", "Please enter a valid email address");
      hasErrors = true;
    }

    if (!employeeId) {
      showFieldError("employeeIdError", "Employee ID is required");
      hasErrors = true;
    }

    if (!department) {
      showFieldError("departmentError", "Please select a department");
      hasErrors = true;
    }

    if (!validatePassword(password)) {
      showFieldError(
        "signupPasswordError",
        "Password must be at least 8 characters with uppercase, lowercase, and number"
      );
      hasErrors = true;
    }

    if (hasErrors) return;

    const userData = {
      firstName,
      lastName,
      email,
      employeeId,
      department,
    };

    try {
      await window.registerUser(email, password, userData);
      clearAutoSave("signupForm"); // Clear auto-saved data on successful signup
    } catch (error) {
      // Error is already handled in registerUser function
    }
  });

document
  .getElementById("forgotPasswordForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    clearFormErrors();

    const email = document.getElementById("resetEmail").value.trim();

    if (!validateEmail(email)) {
      showFieldError("resetEmailError", "Please enter a valid email address");
      return;
    }

    try {
      await window.resetPassword(email);
      setTimeout(() => showLogin("intern"), 2000);
    } catch (error) {
      // Error is already handled in resetPassword function
    }
  });

// Form validation utilities
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return minLength && hasUpper && hasLower && hasNumber;
}

function showFieldError(fieldId, message) {
  const errorElement = document.getElementById(fieldId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
  }
}

function clearFormErrors() {
  const errorElements = document.querySelectorAll(".error-message");
  errorElements.forEach((element) => {
    element.textContent = "";
    element.classList.add("hidden");
  });
}

// Utility functions
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const icon = input.nextElementSibling.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

function updateTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const dateString = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeElement = document.getElementById("checkInTime");
  const dateElement = document.getElementById("currentDate");

  if (timeElement) timeElement.textContent = timeString;
  if (dateElement) dateElement.textContent = dateString;
}

function updateUserUI(name, avatarData) {
  const userName =
    document.getElementById("userName") || document.getElementById("adminName");
  const userAvatar =
    document.getElementById("userAvatar") ||
    document.getElementById("adminAvatar");

  if (userName) userName.textContent = name;

  if (userAvatar) {
    if (typeof avatarData === "string" && avatarData.startsWith("http")) {
      // It's a photo URL
      userAvatar.innerHTML = `<img src="${avatarData}" alt="Profile" class="w-8 h-8 rounded-full object-cover">`;
    } else {
      // It's initials
      userAvatar.textContent = avatarData;
      userAvatar.innerHTML = avatarData; // Reset to text content
    }
  }
}

// Attendance functions
async function manualCheckIn() {
  if (!window.isLocationVerified) {
    showNotification("Location verification required", "error");
    return;
  }

  await window.checkIn();
}

async function manualCheckOut() {
  await window.checkOut();
}

function updateAttendanceButtons(status) {
  const checkInBtn = document.getElementById("checkInBtn");
  const checkOutBtn = document.getElementById("checkOutBtn");

  if (status === "checked-in") {
    checkInBtn.classList.add("hidden");
    checkOutBtn.classList.remove("hidden");
  } else {
    checkInBtn.classList.remove("hidden");
    checkOutBtn.classList.add("hidden");
  }
}

function updateCurrentStatus(status, time) {
  const statusElement = document.getElementById("currentStatus");
  const indicator = statusElement.querySelector(".status-indicator");
  const text = statusElement.querySelector("span:last-child");

  if (status === "checked-in") {
    indicator.className = "status-indicator status-online";
    text.textContent = `Checked in at ${time}`;
  } else if (status === "checked-out") {
    indicator.className = "status-indicator status-offline";
    text.textContent = `Checked out at ${time}`;
  }
}

function startWorkingHoursTimer() {
  if (window.workingHoursTimer) {
    clearInterval(window.workingHoursTimer);
  }

  window.workingHoursTimer = setInterval(() => {
    if (window.currentAttendanceSession) {
      const elapsed =
        (Date.now() - window.currentAttendanceSession.checkInTime) /
        (1000 * 60 * 60);
      updateWorkingHours(elapsed);
    }
  }, 60000);
}

function stopWorkingHoursTimer() {
  if (window.workingHoursTimer) {
    clearInterval(window.workingHoursTimer);
    window.workingHoursTimer = null;
  }
}

function updateWorkingHours(hours) {
  const hoursElement = document.getElementById("workingHours");
  if (hoursElement) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    hoursElement.textContent = `${h}:${m.toString().padStart(2, "0")}`;
  }
}

function addRecentActivity(action, time) {
  const activityContainer = document.getElementById("recentActivity");
  if (!activityContainer) return;

  // Remove "no activity" message if it exists
  const noActivity = activityContainer.querySelector(".text-center");
  if (noActivity) {
    noActivity.remove();
  }

  const newActivity = document.createElement("div");
  newActivity.className =
    "flex items-center space-x-3 p-3 bg-gray-50 rounded-lg";
  newActivity.innerHTML = `
                <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">${action}</p>
                    <p class="text-xs text-gray-500">${time}</p>
                </div>
            `;

  activityContainer.insertBefore(newActivity, activityContainer.firstChild);

  // Keep only the last 5 activities
  while (activityContainer.children.length > 5) {
    activityContainer.removeChild(activityContainer.lastChild);
  }
}

// QR Code functions
function startQRScan() {
  const video = document.getElementById("qrVideo");
  const scanner = document.getElementById("qrScanner");

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      window.qrStream = stream;
      video.srcObject = stream;
      video.classList.remove("hidden");
      scanner.classList.add("hidden");
      video.setAttribute("playsinline", true); // For iOS Safari
      video.play();

      requestAnimationFrame(() => scanQRCode(video));
    })
    .catch((err) => {
      console.error("Camera access denied:", err);
      showNotification("Camera access denied", "error");
    });
}

function scanQRCode(video) {
  const canvas = document.getElementById("qrCanvas");
  const context = canvas.getContext("2d");

  function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert", // improves detection speed
      });

      if (code) {
        stopQRScan();
        processQRCode(code.data);
        return;
      }
    }
    requestAnimationFrame(tick);
  }

  tick();
}

function stopQRScan() {
  if (window.qrStream) {
    window.qrStream.getTracks().forEach((track) => track.stop());
    window.qrStream = null;
  }

  const video = document.getElementById("qrVideo");
  const scanner = document.getElementById("qrScanner");

  video.classList.add("hidden");
  scanner.classList.remove("hidden");
}

function processQRCode(data) {
  try {
    const qrData = JSON.parse(data);

    if (qrData.type === "attendance") {
      if (window.currentAttendanceSession) {
        manualCheckOut(); // use your existing checkout logic
      } else {
        manualCheckIn(); // use your existing checkin logic
      }
    } else {
      showNotification("Invalid QR code", "error");
    }
  } catch (error) {
    console.error("QR processing error:", error);
    showNotification("Invalid QR code format", "error");
  }
}

// Form event listeners
document
  .getElementById("profileForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const profileData = {
      firstName: document.getElementById("profileFirstName").value.trim(),
      lastName: document.getElementById("profileLastName").value.trim(),
      department: document.getElementById("profileDepartment").value,
    };

    if (
      !profileData.firstName ||
      !profileData.lastName ||
      !profileData.department
    ) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    await window.updateUserProfile(profileData);
  });

document
  .getElementById("profileCompletionForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const profileData = {
      firstName: document.getElementById("googleFirstName").value.trim(),
      lastName: document.getElementById("googleLastName").value.trim(),
      employeeId: document.getElementById("googleEmployeeId").value.trim(),
      department: document.getElementById("googleDepartment").value,
    };

    if (
      !profileData.firstName ||
      !profileData.lastName ||
      !profileData.employeeId ||
      !profileData.department
    ) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    await window.completeGoogleProfile(profileData);
  });

document
  .getElementById("addInternForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const userData = {
      firstName: document.getElementById("newInternFirstName").value.trim(),
      lastName: document.getElementById("newInternLastName").value.trim(),
      email: document.getElementById("newInternEmail").value.trim(),
      employeeId: document.getElementById("newInternEmployeeId").value.trim(),
      department: document.getElementById("newInternDepartment").value,
    };

    const password = document.getElementById("newInternPassword").value;

    if (
      !userData.firstName ||
      !userData.lastName ||
      !userData.email ||
      !userData.employeeId ||
      !userData.department ||
      !password
    ) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    if (!validateEmail(userData.email)) {
      showNotification("Please enter a valid email address", "error");
      return;
    }

    await window.addNewIntern(userData, password);
  });

// Admin functions
function generateDailyQR() {
  const qrData = {
    type: "attendance",
    date: new Date().toDateString(),
    timestamp: Date.now(),
    code: Math.random().toString(36).substr(2, 9),
  };

  const canvas = document.getElementById("qrCodeCanvas");
  if (canvas) {
    QRCode.toCanvas(canvas, JSON.stringify(qrData), {
      width: 200,
      margin: 2,
      color: {
        dark: "#1f2937",
        light: "#ffffff",
      },
    });
  }

  showNotification("Daily QR code generated!", "success");
}

function downloadQR() {
  const canvas = document.getElementById("qrCodeCanvas");
  if (canvas) {
    const link = document.createElement("a");
    link.download = `attendance-qr-${new Date().toDateString()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    showNotification("QR code downloaded!", "success");
  }
}

function exportAttendance() {
  window.exportAttendanceData();
}

function viewReports() {
  showReports();
}

// Calendar generation
function generateCalendar() {
  const calendarDays = document.getElementById("calendarDays");
  const calendarMonth = document.getElementById("calendarMonth");

  if (!calendarDays || !calendarMonth) return;

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  calendarMonth.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  calendarDays.innerHTML = "";

  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "h-8";
    calendarDays.appendChild(emptyDay);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement("div");
    dayElement.className =
      "h-8 flex items-center justify-center text-sm cursor-pointer hover:bg-gray-100 rounded";
    dayElement.textContent = day;

    // Highlight today
    if (day === today.getDate()) {
      dayElement.className += " bg-blue-600 text-white hover:bg-blue-700";
    }

    // Add attendance indicators (will be populated with real data later)
    if (day < today.getDate() && Math.random() > 0.3) {
      dayElement.className += " bg-green-100 text-green-800";
      dayElement.title = "Present";
    }

    calendarDays.appendChild(dayElement);
  }
}

// Modal functions
function showProfile() {
  const modal = document.getElementById("profileModal");
  if (!modal) return;
  if (!window.currentUser) return;

  const avatar = document.getElementById("profileAvatar");
  const firstName = document.getElementById("profileFirstName");
  const lastName = document.getElementById("profileLastName");
  const email = document.getElementById("profileEmail");
  const employeeId = document.getElementById("profileEmployeeId");
  const department = document.getElementById("profileDepartment");

  // Populate form with current user data
  if (avatar && window.currentUser.firstName && window.currentUser.lastName) {
    avatar.textContent =
      window.currentUser.firstName.charAt(0) +
      window.currentUser.lastName.charAt(0);
  }
  if (firstName) firstName.value = window.currentUser.firstName || "";
  if (lastName) lastName.value = window.currentUser.lastName || "";
  if (email) email.value = window.currentUser.email || "";
  if (employeeId) employeeId.value = window.currentUser.employeeId || "";
  if (department) department.value = window.currentUser.department || "";

  modal.style.display = "flex";

  closeAllMenus();
}

function closeProfile() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.style.display = "none";
}

function showSettings() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "flex";
  closeAllMenus();
}

function closeSettings() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "none";
}

function showAddIntern() {
  const modal = document.getElementById("addInternModal");
  if (modal) modal.style.display = "flex";
}

function closeAddIntern() {
  const modal = document.getElementById("addInternModal");
  if (modal) modal.style.display = "none";
  const form = document.getElementById("addInternForm");
  if (form) form.reset();
}

function showReports() {
  loadReportsData();
  const modal = document.getElementById("reportsModal");
  if (modal) modal.style.display = "flex";
}

function closeReports() {
  const modal = document.getElementById("reportsModal");
  if (modal) modal.style.display = "none";
}

function showProfileCompletion(userData) {
  const modal = document.getElementById("profileCompletionModal");
  const photo = document.getElementById("googleUserPhoto");
  const initials = document.getElementById("googleUserInitials");
  const firstName = document.getElementById("googleFirstName");
  const lastName = document.getElementById("googleLastName");
  const email = document.getElementById("googleEmail");
  const employeeId = document.getElementById("googleEmployeeId");

  // Show user photo or initials
  if (userData.photoURL) {
    photo.src = userData.photoURL;
    photo.classList.remove("hidden");
    initials.classList.add("hidden");
  } else {
    initials.textContent =
      userData.firstName.charAt(0) + (userData.lastName.charAt(0) || "");
    photo.classList.add("hidden");
    initials.classList.remove("hidden");
  }

  // Populate form
  firstName.value = userData.firstName || "";
  lastName.value = userData.lastName || "";
  email.value = userData.email || "";
  employeeId.value = userData.employeeId || "";

  modal.classList.remove("hidden");
  hideAllPages();
}

function closeProfileCompletion() {
  document.getElementById("profileCompletionModal").classList.add("hidden");
}

function closeAllMenus() {
  const menus = ["userMenu", "adminUserMenu"];
  menus.forEach((menuId) => {
    const menu = document.getElementById(menuId);
    if (menu) menu.classList.add("hidden");
  });
}

// Settings functions
function saveSettings() {
  const emailNotifications =
    document.getElementById("emailNotifications").checked;
  const locationTracking = document.getElementById("locationTracking").checked;
  const darkMode = document.getElementById("darkMode").checked;

  // Save to localStorage for now (could be saved to Firebase)
  localStorage.setItem(
    "settings",
    JSON.stringify({
      emailNotifications,
      locationTracking,
      darkMode,
    })
  );

  if (darkMode) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }

  showNotification("Settings saved successfully!", "success");
  closeSettings();
}

function changePassword() {
  showNotification("Password change feature - Coming soon!", "info");
}

// Reports functions
async function loadReportsData() {
  if (!window.currentUser) return;

  try {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let attendanceQuery;
    if (window.userRole === "admin") {
      attendanceQuery = query(
        collection(window.firebaseDb, "attendance"),
        where("createdAt", ">=", startOfMonth)
      );
    } else {
      attendanceQuery = query(
        collection(window.firebaseDb, "attendance"),
        where("userId", "==", window.currentUser.uid),
        where("createdAt", ">=", startOfMonth)
      );
    }

    const attendanceDocs = await getDocs(attendanceQuery);
    const attendanceData = attendanceDocs.docs.map((doc) => doc.data());

    // Calculate weekly attendance
    const weeklyData = attendanceData.filter(
      (record) => record.createdAt && record.createdAt.toDate() >= startOfWeek
    );
    const weeklyRate =
      weeklyData.length > 0
        ? (weeklyData.filter((r) => r.status === "checked-out").length /
            weeklyData.length) *
          100
        : 0;

    // Calculate monthly attendance
    const monthlyRate =
      attendanceData.length > 0
        ? (attendanceData.filter((r) => r.status === "checked-out").length /
            attendanceData.length) *
          100
        : 0;

    // Calculate total hours
    const totalHours = attendanceData.reduce(
      (sum, record) => sum + (record.workingHours || 0),
      0
    );

    // Update UI
    document.getElementById(
      "weeklyAttendance"
    ).textContent = `${weeklyRate.toFixed(1)}%`;
    document.getElementById(
      "monthlyAttendanceRate"
    ).textContent = `${monthlyRate.toFixed(1)}%`;
    document.getElementById("totalHours").textContent = `${totalHours.toFixed(
      1
    )}h`;

    // Load recent activity
    const reportsActivity = document.getElementById("reportsActivity");
    reportsActivity.innerHTML = "";

    attendanceData.slice(0, 10).forEach((record) => {
      const activity = document.createElement("div");
      activity.className =
        "flex items-center justify-between p-2 bg-white rounded border";
      activity.innerHTML = `
                        <div>
                            <p class="text-sm font-medium">${
                              record.userName || "Unknown User"
                            }</p>
                            <p class="text-xs text-gray-500">${
                              record.date || "Unknown Date"
                            }</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm">${
                              record.workingHours
                                ? record.workingHours.toFixed(1) + "h"
                                : "N/A"
                            }</p>
                            <p class="text-xs text-gray-500">${
                              record.status || "Unknown"
                            }</p>
                        </div>
                    `;
      reportsActivity.appendChild(activity);
    });
  } catch (error) {
    console.error("Error loading reports data:", error);
    showNotification("Error loading reports data", "error");
  }
}

function exportReports() {
  window.exportAttendanceData();
}

// Email log functions
function viewEmailLog() {
  const emailLog = JSON.parse(localStorage.getItem("emailLog") || "[]");
  const emailLogContent = document.getElementById("emailLogContent");
  const emailLogCount = document.getElementById("emailLogCount");

  emailLogCount.textContent = emailLog.length;

  if (emailLog.length === 0) {
    emailLogContent.innerHTML = `
                    <div class="text-center text-gray-500 py-8">
                        <i class="fas fa-envelope text-2xl mb-2"></i>
                        <p>No emails sent yet</p>
                    </div>
                `;
  } else {
    emailLogContent.innerHTML = "";

    emailLog.reverse().forEach((email, index) => {
      const emailEntry = document.createElement("div");
      emailEntry.className = "bg-white p-4 rounded-lg border";

      const typeColors = {
        info: "bg-blue-100 text-blue-800",
        reminder: "bg-yellow-100 text-yellow-800",
        success: "bg-green-100 text-green-800",
        error: "bg-red-100 text-red-800",
      };

      emailEntry.innerHTML = `
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-1">
                                    <span class="px-2 py-1 text-xs font-medium rounded-full ${
                                      typeColors[email.type] || typeColors.info
                                    }">
                                        ${email.type.toUpperCase()}
                                    </span>
                                    <span class="text-sm text-gray-600">
                                        ${new Date(
                                          email.timestamp
                                        ).toLocaleString()}
                                    </span>
                                </div>
                                <h4 class="font-medium text-gray-900">${
                                  email.subject
                                }</h4>
                                <p class="text-sm text-gray-600">To: ${
                                  email.to
                                }</p>
                            </div>
                            <button onclick="toggleEmailBody(${index})" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </div>
                        <div id="emailBody${index}" class="hidden mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap">
                            ${email.body}
                        </div>
                    `;

      emailLogContent.appendChild(emailEntry);
    });
  }

  document.getElementById("emailLogModal").classList.remove("hidden");
}

function toggleEmailBody(index) {
  const emailBody = document.getElementById(`emailBody${index}`);
  emailBody.classList.toggle("hidden");
}

function closeEmailLog() {
  document.getElementById("emailLogModal").classList.add("hidden");
}

function clearEmailLog() {
  if (
    confirm(
      "Are you sure you want to clear the email log? This action cannot be undone."
    )
  ) {
    localStorage.removeItem("emailLog");
    showNotification("Email log cleared successfully", "success");
    viewEmailLog(); // Refresh the view
  }
}

function exportEmailLog() {
  const emailLog = JSON.parse(localStorage.getItem("emailLog") || "[]");

  if (emailLog.length === 0) {
    showNotification("No email log data to export", "warning");
    return;
  }

  // Prepare CSV data
  const csvData = [];
  csvData.push(["Timestamp", "To", "Subject", "Type", "Status", "Body"]);

  emailLog.forEach((email) => {
    csvData.push([
      new Date(email.timestamp).toLocaleString(),
      email.to,
      email.subject,
      email.type,
      email.status,
      email.body.replace(/\n/g, " "), // Replace newlines with spaces for CSV
    ]);
  });

  // Create and download CSV
  const csvContent = csvData
    .map((row) =>
      row.map((field) => `"${field.toString().replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `email-log-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);

  showNotification("Email log exported successfully!", "success");
}

// UI functions
function toggleUserMenu(type = "intern") {
  const menuId = type === "admin" ? "adminUserMenu" : "userMenu";
  const menu = document.getElementById(menuId);
  if (menu) {
    menu.classList.toggle("hidden");
  }
}

async function logout() {
  try {
    showLoading();
    await window.firebaseAuth.signOut();

    // Clean up
    window.currentUser = null;
    window.userRole = null;
    window.currentAttendanceSession = null;
    stopWorkingHoursTimer();

    // Clear any listeners
    window.attendanceListeners.forEach((unsubscribe) => unsubscribe());
    window.attendanceListeners = [];

    showNotification("Logged out successfully", "info");
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Error logging out", "error");
  } finally {
    hideLoading();
  }
}

// Loading and notification functions
function showLoading() {
  document.getElementById("loadingOverlay").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden");
}

function showNotification(message, type = "info", duration = 5000) {
  const container = document.getElementById("notificationContainer");
  const notification = document.createElement("div");

  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };

  const icons = {
    success: "fa-check-circle",
    error: "fa-times-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };

  notification.className = `notification ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 max-w-sm`;
  notification.innerHTML = `
                <i class="fas ${icons[type]}"></i>
                <span class="flex-1">${message}</span>
                <button onclick="this.parentElement.remove()" class="text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            `;

  container.appendChild(notification);

  // Animate in
  setTimeout(() => notification.classList.add("show"), 100);

  // Auto remove
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Network status monitoring
function updateNetworkStatus() {
  const offlineIndicator = document.getElementById("offlineIndicator");

  if (navigator.onLine) {
    offlineIndicator.classList.remove("show");
  } else {
    offlineIndicator.classList.add("show");
  }
}

// Search and filter functionality for intern management
document
  .getElementById("searchInterns")
  ?.addEventListener("input", filterInternsManagement);
document
  .getElementById("filterDepartment")
  ?.addEventListener("change", filterInternsManagement);

function filterInternsManagement() {
  const searchTerm =
    document.getElementById("searchInterns").value.toLowerCase() || "";
  const departmentFilter =
    document.getElementById("filterDepartment").value || "";

  const rows = document.querySelectorAll("#internsList tr");

  rows.forEach((row) => {
    if (row.cells.length < 7) return; // Skip empty rows

    const name =
      row.cells[0]
        ?.querySelector(".text-gray-900")
        ?.textContent.toLowerCase() || "";
    const email =
      row.cells[0]
        ?.querySelector(".text-gray-500")
        ?.textContent.toLowerCase() || "";
    const department = row.cells[1]?.textContent.toLowerCase() || "";

    const matchesSearch =
      name.includes(searchTerm) || email.includes(searchTerm);
    const matchesDepartment =
      !departmentFilter || department.includes(departmentFilter.toLowerCase());

    if (matchesSearch && matchesDepartment) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

// Click outside to close modals
document.addEventListener("click", function (e) {
  // Close user menus when clicking outside
  if (!e.target.closest(".relative")) {
    closeAllMenus();
  }

  // Close modals when clicking outside
  const modals = [
    "profileModal",
    "settingsModal",
    "addInternModal",
    "reportsModal",
    "profileCompletionModal",
    "emailLogModal",
  ];
  modals.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (modal && !modal.classList.contains("hidden")) {
      const modalContent = modal.querySelector(".bg-white");
      if (!modalContent.contains(e.target)) {
        // Don't allow closing profile completion modal by clicking outside
        if (modalId !== "profileCompletionModal") {
          modal.classList.add("hidden");
        }
      }
    }
  });
});

// Session persistence check
function checkSessionPersistence() {
  const savedUser = localStorage.getItem("currentUser");
  const savedRole = localStorage.getItem("userRole");
  const lastLoginTime = localStorage.getItem("lastLoginTime");

  if (savedUser && savedRole && lastLoginTime) {
    try {
      const userData = JSON.parse(savedUser);
      const loginTime = parseInt(lastLoginTime);
      const now = Date.now();
      const sessionDuration = now - loginTime;
      const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionDuration < maxSessionDuration) {
        // Session is still valid, restore user data
        window.currentUser = userData;
        window.userRole = savedRole;

        console.log("Session restored from localStorage");

        // Firebase auth will handle the rest when it initializes
        return true;
      } else {
        // Session expired, clear data
        localStorage.removeItem("currentUser");
        localStorage.removeItem("userRole");
        localStorage.removeItem("lastLoginTime");
        console.log("Session expired, cleared localStorage");
      }
    } catch (error) {
      console.error("Error parsing saved session:", error);
      localStorage.removeItem("currentUser");
      localStorage.removeItem("userRole");
      localStorage.removeItem("lastLoginTime");
    }
  }

  return false;
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  updateTime();
  updateNetworkStatus();

  // Check for existing session
  const hasValidSession = checkSessionPersistence();
  if (hasValidSession) {
    showNotification("Restoring your session...", "info");
  }

  // Network status listeners
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  // Load saved settings
  const savedSettings = localStorage.getItem("settings");
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      const emailNotifications = document.getElementById("emailNotifications");
      const locationTracking = document.getElementById("locationTracking");
      const darkMode = document.getElementById("darkMode");

      if (emailNotifications)
        emailNotifications.checked = settings.emailNotifications || false;
      if (locationTracking)
        locationTracking.checked = settings.locationTracking !== false; // Default to true
      if (darkMode) darkMode.checked = settings.darkMode || false;

      if (settings.darkMode) {
        document.body.classList.add("dark");
      }
    } catch (error) {
      console.error("Error loading saved settings:", error);
    }
  }

  // Auto-save form data to prevent data loss
  setupAutoSave();

  if (!hasValidSession) {
    showNotification(
      "Welcome to AttendanceHub! Professional attendance management with Google Authentication support.",
      "info"
    );
  }
});

// Auto-save form data
function setupAutoSave() {
  const forms = ["loginForm", "signupForm", "profileForm", "addInternForm"];

  forms.forEach((formId) => {
    const form = document.getElementById(formId);
    if (form) {
      const inputs = form.querySelectorAll("input, select");
      inputs.forEach((input) => {
        if (input.type !== "password") {
          // Don't save passwords
          input.addEventListener("input", function () {
            const key = `autosave_${formId}_${input.id}`;
            localStorage.setItem(key, input.value);
          });

          // Restore saved value
          const key = `autosave_${formId}_${input.id}`;
          const savedValue = localStorage.getItem(key);
          if (savedValue && !input.value) {
            input.value = savedValue;
          }
        }
      });
    }
  });
}

// Clear auto-saved form data
function clearAutoSave(formId) {
  const form = document.getElementById(formId);
  if (form) {
    const inputs = form.querySelectorAll("input, select");
    inputs.forEach((input) => {
      const key = `autosave_${formId}_${input.id}`;
      localStorage.removeItem(key);
    });
  }
}
