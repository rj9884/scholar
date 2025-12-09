import { useEffect, useState } from 'react';
import * as db from './data/db';

export default function StudentRecordSystem() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState('teacher');
  const [teachers, setTeachers] = useState([]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [isSignup, setIsSignup] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [loadingApp, setLoadingApp] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState(null);

  const ADMIN_EMAIL = 'admin@scholar.com';
  const ADMIN_PASSWORD = 'admin123';

  const [fileStructure, setFileStructure] = useState({});
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [currentStudents, setCurrentStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    branch: 'CSE',
    subject: '',
    marksObtained: '',
    maxMarks: ''
  });
  const [editingId, setEditingId] = useState(null);

  const branches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIV', 'EE'];

  const buildStructureFromStudents = (students) => {
    const structure = {};
    students.forEach((student) => {
      if (!structure[student.branch]) structure[student.branch] = {};
      if (!structure[student.branch][student.subject]) structure[student.branch][student.subject] = [];
      structure[student.branch][student.subject].push(student);
    });
    return structure;
  };

  const loadTeacherData = async (teacherEmail) => {
    setDataLoading(true);
    try {
      const students = await db.getStudentsForTeacher(teacherEmail);
      setFileStructure(buildStructureFromStudents(students));
      setSelectedBranch(null);
      setSelectedSubject(null);
      setCurrentStudents([]);
    } catch (err) {
      setError('Could not load student records.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    db.setupDB()
      .then(() => db.getAllTeachers())
      .then((list) => {
        if (active) setTeachers(list || []);
      })
      .catch(() => setError('Could not load saved accounts.'))
      .finally(() => {
        if (active) setLoadingApp(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignup = async () => {
    if (!signupForm.email || !signupForm.password || !signupForm.confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const newTeacher = { email: signupForm.email, password: signupForm.password };
    try {
      await db.addTeacher(newTeacher);
      setTeachers((prev) => [...prev, newTeacher]);
      alert('Account created successfully! Please login.');
      setSignupForm({ email: '', password: '', confirmPassword: '' });
      setIsSignup(false);
    } catch (err) {
      if (err?.name === 'ConstraintError') {
        alert('Email already registered');
      } else {
        alert('Could not create account. Please try again.');
      }
    }
  };

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      alert('Please fill in all fields');
      return;
    }

    if (userType === 'admin') {
      if (loginForm.email === ADMIN_EMAIL && loginForm.password === ADMIN_PASSWORD) {
        setIsLoggedIn(true);
        setLoginForm({ email: '', password: '' });
      } else {
        alert('Invalid admin credentials');
      }
    } else {
      const teacher = await db.validateTeacher(loginForm.email, loginForm.password);
      if (teacher) {
        setIsLoggedIn(true);
        setCurrentTeacher(teacher);
        setLoginForm({ email: '', password: '' });
        loadTeacherData(teacher.email);
      } else {
        alert('Invalid email or password');
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentTeacher(null);
    setFileStructure({});
    setSelectedBranch(null);
    setSelectedSubject(null);
    setCurrentStudents([]);
    setShowTypeSelector(true);
    setUserType('teacher');
    setError(null);
    setDataLoading(false);
  };

  const calculateGrade = (marks, maxMarks) => {
    const percentage = (marks / maxMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  };

  const calculatePercentage = (marks, maxMarks) => ((marks / maxMarks) * 100).toFixed(2);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addOrUpdateStudent = async () => {
    if (!currentTeacher) return;
    if (!formData.name || !formData.rollNo || !formData.branch || !formData.subject || !formData.marksObtained || !formData.maxMarks) {
      alert('Please fill in all fields');
      return;
    }
    const marksNum = parseFloat(formData.marksObtained);
    const maxMarksNum = parseFloat(formData.maxMarks);
    if (marksNum < 0 || maxMarksNum < 0) {
      alert('Marks cannot be negative');
      return;
    }
    if (marksNum > maxMarksNum) {
      alert(`⚠️ Obtained marks (${marksNum}) cannot exceed maximum marks (${maxMarksNum}). Please correct the values.`);
      return;
    }
    const grade = calculateGrade(marksNum, maxMarksNum);
    const percentage = calculatePercentage(marksNum, maxMarksNum);
    const newStudent = {
      ...formData,
      id: editingId || undefined,
      grade,
      percentage,
      marksObtained: marksNum,
      maxMarks: maxMarksNum,
      teacherEmail: currentTeacher.email
    };

    const newId = await db.upsertStudent(newStudent);
    const studentWithId = { ...newStudent, id: editingId || newId };
    const newStructure = { ...fileStructure };
    if (!newStructure[formData.branch]) newStructure[formData.branch] = {};
    if (!newStructure[formData.branch][formData.subject]) newStructure[formData.branch][formData.subject] = [];

    if (editingId) {
      const index = newStructure[formData.branch][formData.subject].findIndex((s) => s.id === editingId);
      if (index !== -1) {
        newStructure[formData.branch][formData.subject][index] = studentWithId;
      }
      setEditingId(null);
    } else {
      newStructure[formData.branch][formData.subject].push(studentWithId);
    }

    setFileStructure(newStructure);
    if (selectedBranch === formData.branch && selectedSubject === formData.subject) {
      setCurrentStudents(newStructure[formData.branch][formData.subject]);
    }
    setFormData({ name: '', rollNo: '', branch: 'CSE', subject: '', marksObtained: '', maxMarks: '' });
  };

  const selectBranchAndSubject = (branch, subject) => {
    setSelectedBranch(branch);
    setSelectedSubject(subject);
    setCurrentStudents(fileStructure[branch][subject] || []);
    setEditingId(null);
    setFormData({ name: '', rollNo: '', branch: 'CSE', subject: '', marksObtained: '', maxMarks: '' });
  };

  const deleteStudent = async (id) => {
    if (!selectedBranch || !selectedSubject) return;
    await db.deleteStudent(id);
    const newStructure = { ...fileStructure };
    newStructure[selectedBranch][selectedSubject] = newStructure[selectedBranch][selectedSubject].filter((s) => s.id !== id);
    if (newStructure[selectedBranch][selectedSubject].length === 0) {
      delete newStructure[selectedBranch][selectedSubject];
    }
    if (Object.keys(newStructure[selectedBranch]).length === 0) {
      delete newStructure[selectedBranch];
    }
    setFileStructure(newStructure);
    setCurrentStudents(newStructure[selectedBranch]?.[selectedSubject] || []);
  };

  const editStudent = (student) => {
    setFormData({
      name: student.name,
      rollNo: student.rollNo,
      branch: student.branch,
      subject: student.subject,
      marksObtained: student.marksObtained.toString(),
      maxMarks: student.maxMarks.toString()
    });
    setEditingId(student.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', rollNo: '', branch: 'CSE', subject: '', marksObtained: '', maxMarks: '' });
  };

  const generatePDF = () => {
    if (currentStudents.length === 0) {
      alert('No student records to download');
      return;
    }
    let htmlContent = `<!DOCTYPE html><html><head><title>Student Records</title><style>body{font-family:Arial,sans-serif;margin:32px;background:#f6f7fb;padding:0} .container{background:white;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,0.08);overflow:hidden;border:1px solid #e5e7eb} .header{background:#0f172a;color:white;padding:28px 32px;text-align:left} .header h1{margin:0;font-size:26px;font-weight:700} .header p{margin:6px 0;font-size:13px;opacity:0.85} .content{padding:28px 32px} table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px} th{background:#f1f5f9;color:#0f172a;padding:12px 10px;text-align:left;font-weight:600;border-bottom:1px solid #e5e7eb} td{padding:11px 10px;border-bottom:1px solid #e5e7eb;color:#0f172a} tr:nth-child(even){background:#f8fafc} .grade{font-weight:700;font-size:13px;display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #e5e7eb} .grade-a{background:#ecfdf3;color:#166534;border-color:#bbf7d0} .grade-b{background:#eff6ff;color:#1d4ed8;border-color:#dbeafe} .grade-c{background:#fff7ed;color:#c2410c;border-color:#fed7aa} .grade-f{background:#fef2f2;color:#b91c1c;border-color:#fecdd3} .summary{margin-top:18px;padding:16px 18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px} .footer{text-align:center;margin-top:18px;color:#6b7280;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>Academic Records Report</h1><p><strong>Subject:</strong> ${selectedSubject}</p><p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p></div><div class="content"><table><thead><tr><th>Student Name</th><th>Roll Number</th><th>Marks</th><th>Percentage</th><th>Grade</th></tr></thead><tbody>`;

    currentStudents.forEach((student) => {
      let gradeClass = 'grade-f';
      if (student.grade === 'A+' || student.grade === 'A') gradeClass = 'grade-a';
      else if (student.grade === 'B+' || student.grade === 'B') gradeClass = 'grade-b';
      else if (student.grade === 'C') gradeClass = 'grade-c';
      htmlContent += `<tr><td>${student.name}</td><td>${student.rollNo}</td><td>${student.marksObtained}/${student.maxMarks}</td><td>${student.percentage}%</td><td><span class="grade ${gradeClass}">${student.grade}</span></td></tr>`;
    });

    const avgPercentage = (currentStudents.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / currentStudents.length).toFixed(2);
    htmlContent += `</tbody></table><div class="summary"><strong>Summary:</strong><br>Total Students: ${currentStudents.length}<br>Average: ${avgPercentage}%</div><div class="footer"><p>Official Report - For Records Only</p></div></div></div></body></html>`;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const clearAllData = async () => {
    if (!currentTeacher) return;
    if (window.confirm('Are you sure? This action cannot be undone.')) {
      await db.clearTeacherStudents(currentTeacher.email);
      setFileStructure({});
      setSelectedBranch(null);
      setSelectedSubject(null);
      setCurrentStudents([]);
    }
  };

  const getGradeColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (grade === 'B+' || grade === 'B') return 'bg-sky-100 text-sky-800 border border-sky-200';
    if (grade === 'C') return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-rose-100 text-rose-800 border border-rose-200';
  };

  const filteredStudents = currentStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStats = {
    total: filteredStudents.length,
    average:
      filteredStudents.length > 0
        ? (filteredStudents.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / filteredStudents.length).toFixed(2)
        : 0,
    passed: filteredStudents.filter((s) => parseFloat(s.percentage) >= 40).length,
    failed: filteredStudents.filter((s) => parseFloat(s.percentage) < 40).length
  };

  if (loadingApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-700">
        <div className="text-center space-y-3">
          <div className="text-5xl">⏳</div>
          <p className="text-lg">Setting up database...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn && showTypeSelector) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <div className="text-5xl mb-3">📚</div>
            <h1 className="text-4xl font-semibold tracking-tight">Scholar</h1>
            <p className="text-slate-500 text-lg">Student Record Management System</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => {
                setShowTypeSelector(false);
                setUserType('teacher');
              }}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-left hover:shadow-md transition"
            >
              <div className="text-4xl mb-4">👨‍🏫</div>
              <h2 className="text-2xl font-semibold mb-2">Teacher Login</h2>
              <p className="text-slate-500">Manage student records and grades.</p>
            </button>

            <button
              onClick={() => {
                setShowTypeSelector(false);
                setUserType('admin');
              }}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-left hover:shadow-md transition"
            >
              <div className="text-4xl mb-4">👨‍💼</div>
              <h2 className="text-2xl font-semibold mb-2">Admin Login</h2>
              <p className="text-slate-500">View all registered teachers.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">📚</div>
              <h1 className="text-3xl font-semibold mb-2">Scholar</h1>
              <p className="text-slate-500">{userType === 'admin' ? 'Admin Portal' : 'Student Record System'}</p>
            </div>

            {!isSignup ? (
              <>
                <div className="space-y-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="login-email">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      placeholder={userType === 'admin' ? 'Admin Email' : 'Email Address'}
                      value={loginForm.email}
                      onChange={handleLoginChange}
                      className="w-full px-4 py-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="login-password">
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      className="w-full px-4 py-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    />
                  </div>
                </div>
                <button onClick={handleLogin} className="w-full bg-sky-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-sky-700 transition mb-3">
                  {userType === 'admin' ? 'Admin Login' : 'Login'}
                </button>
                <button
                  onClick={() => {
                    setShowTypeSelector(true);
                    setLoginForm({ email: '', password: '' });
                  }}
                  className="w-full text-slate-600 font-semibold py-2 hover:underline"
                >
                  ← Back
                </button>
                {userType === 'admin' && (
                  <p className="text-center text-slate-500 text-xs mt-3">
                    <strong>Demo Admin:</strong> admin@scholar.com / admin123
                  </p>
                )}
                {userType !== 'admin' && (
                  <p className="text-center text-slate-600 mt-3">
                    Don't have an account?{' '}
                    <button onClick={() => setIsSignup(true)} className="text-sky-700 font-semibold hover:underline">
                      Sign up
                    </button>
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-800 mb-4">Create Account</h2>
                <div className="space-y-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="signup-email">
                      Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={signupForm.email}
                      onChange={handleSignupChange}
                      className="w-full px-4 py-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="signup-password">
                      Password
                    </label>
                    <input
                      id="signup-password"
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={signupForm.password}
                      onChange={handleSignupChange}
                      className="w-full px-4 py-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="signup-confirm">
                      Confirm Password
                    </label>
                    <input
                      id="signup-confirm"
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm Password"
                      value={signupForm.confirmPassword}
                      onChange={handleSignupChange}
                      className="w-full px-4 py-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    />
                  </div>
                </div>
                <button onClick={handleSignup} className="w-full bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-emerald-700 transition mb-3">
                  Create Account
                </button>
                <p className="text-center text-slate-600">
                  Already have an account?{' '}
                  <button onClick={() => setIsSignup(false)} className="text-sky-700 font-semibold hover:underline">
                    Login
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (userType === 'admin' && isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">Admin Dashboard</h1>
              <p className="text-slate-500 mt-1">View all registered teachers and their records.</p>
            </div>
            <button onClick={handleLogout} className="bg-slate-900 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-slate-800 transition">
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="text-2xl mb-2">👨‍🏫</div>
              <div className="text-sm text-slate-500">Total Teachers</div>
              <div className="text-3xl font-semibold">{teachers.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="text-2xl mb-2">✅</div>
              <div className="text-sm text-slate-500">Active Users</div>
              <div className="text-3xl font-semibold">{teachers.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="text-2xl mb-2">📚</div>
              <div className="text-sm text-slate-500">System Status</div>
              <div className="text-3xl font-semibold text-emerald-700">Online</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <span className="text-xl">📋</span>
              <h2 className="text-xl font-semibold">Registered Teachers</h2>
            </div>

            {teachers.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <div className="text-5xl mb-3">🎓</div>
                <p className="text-lg">No teachers registered yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr className="border-b border-slate-200 text-left text-slate-700">
                      <th className="px-6 py-3 font-semibold">Teacher Email</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Join Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher, index) => (
                      <tr key={index} className="border-t border-slate-200 hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold">
                              {teacher.email.charAt(0).toUpperCase()}
                            </div>
                            {teacher.email}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Active</span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{new Date().toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Scholar</h1>
            <p className="text-slate-500 mt-1">Welcome, {currentTeacher?.email}</p>
          </div>
          <button onClick={handleLogout} className="bg-slate-900 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-slate-800 transition">
            Logout
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">{error}</div>
        )}
        {dataLoading && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 flex items-center gap-2">
            <span className="text-xl">⏳</span>
            <span>Refreshing records from the database...</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-xl">📁</span> File System
              </h2>
              {Object.keys(fileStructure).length === 0 ? (
                <p className="text-slate-500 text-sm">No data yet. Add students to create folders.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.keys(fileStructure).map((branch) => (
                    <div key={branch} className="rounded-lg overflow-hidden border border-slate-200">
                      <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-800 text-sm">{branch}</div>
                      <div className="bg-white p-2 space-y-1">
                        {Object.keys(fileStructure[branch]).map((subject) => {
                          const count = fileStructure[branch][subject].length;
                          const isSelected = selectedBranch === branch && selectedSubject === subject;
                          return (
                            <button
                              key={subject}
                              onClick={() => selectBranchAndSubject(branch, subject)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${isSelected ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                            >
                              <span className="text-lg">📄</span> {subject}{' '}
                              <span className="text-xs text-slate-500">({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">{editingId ? 'Edit Student' : 'Add New Student'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Student Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
                <input
                  type="text"
                  name="rollNo"
                  placeholder="Roll Number"
                  value={formData.rollNo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  className="px-4 py-3 bg-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="subject"
                  placeholder="Subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
                <input
                  type="number"
                  name="marksObtained"
                  placeholder="Marks Obtained"
                  value={formData.marksObtained}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
                <input
                  type="number"
                  name="maxMarks"
                  placeholder="Max Marks"
                  value={formData.maxMarks}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={addOrUpdateStudent} className="bg-slate-900 text-white font-semibold py-3 px-7 rounded-xl hover:bg-slate-800 transition">
                  {editingId ? 'Save changes' : 'Add student'}
                </button>
                {editingId && (
                  <button onClick={cancelEdit} className="bg-white border border-slate-300 text-slate-700 font-semibold py-3 px-7 rounded-xl hover:bg-slate-100 transition">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {selectedBranch && selectedSubject && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="text-2xl mb-1">👥</div>
                  <div className="text-sm text-slate-500">Total Students</div>
                  <div className="text-2xl font-semibold">{totalStats.total}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="text-2xl mb-1">✅</div>
                  <div className="text-sm text-slate-500">Passed</div>
                  <div className="text-2xl font-semibold text-emerald-700">{totalStats.passed}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="text-2xl mb-1">❌</div>
                  <div className="text-sm text-slate-500">Failed</div>
                  <div className="text-2xl font-semibold text-rose-700">{totalStats.failed}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm text-slate-500">Avg %</div>
                  <div className="text-2xl font-semibold">{totalStats.average}%</div>
                </div>
              </div>
            )}

            {selectedBranch && selectedSubject && (
              <input
                type="text"
                placeholder="Search by name or roll number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 transition border border-slate-300"
              />
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex gap-3">
                <button
                  onClick={generatePDF}
                  disabled={currentStudents.length === 0}
                  className="bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Download PDF
                </button>
                <button
                  onClick={clearAllData}
                  disabled={Object.keys(fileStructure).length === 0}
                  className="bg-white border border-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center">
                <div className="text-5xl mb-3">��</div>
                <p className="text-slate-600 text-lg">Select a subject or add a new student.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="px-6 py-3 text-left font-semibold">Name</th>
                        <th className="px-6 py-3 text-left font-semibold">Roll</th>
                        <th className="px-6 py-3 text-left font-semibold">Marks</th>
                        <th className="px-6 py-3 text-left font-semibold">%</th>
                        <th className="px-6 py-3 text-left font-semibold">Grade</th>
                        <th className="px-6 py-3 text-center font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, index) => (
                        <tr
                          key={student.id}
                          className={`border-t border-slate-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100 transition`}
                        >
                          <td className="px-6 py-4 text-slate-900 font-medium">{student.name}</td>
                          <td className="px-6 py-4 text-slate-700">{student.rollNo}</td>
                          <td className="px-6 py-4 text-slate-700">{student.marksObtained}/{student.maxMarks}</td>
                          <td className="px-6 py-4 text-slate-700">{student.percentage}%</td>
                          <td className="px-6 py-4">
                            <span className={`px-4 py-2 rounded-full text-sm font-bold ${getGradeColor(student.grade)}`}>{student.grade}</span>
                          </td>
                          <td className="px-6 py-4 text-center space-x-2">
                            <button onClick={() => editStudent(student)} className="text-slate-700 hover:text-slate-900 font-semibold transition">
                              ✏️
                            </button>
                            <button onClick={() => deleteStudent(student.id)} className="text-rose-600 hover:text-rose-700 font-semibold transition">
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
