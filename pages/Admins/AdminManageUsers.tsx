import React, { useState, useEffect } from "react";
import { collection, getDocs, setDoc, addDoc, query,where, updateDoc, doc, Timestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut } from "firebase/auth"; // Firebase auth imports
import { firestore, auth } from "../../services/firebaseConfig"; // Assuming Firebase is configured here
import { CSVLink } from "react-csv";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserCircle } from "@fortawesome/free-solid-svg-icons";
import AdminSidebar from "./AdminSidebar";
import "../../styles/AdminManageStudent.css";
import StudentAccountDeletion from "./StudentAccountDeletion";
import FacultyAccountDeletion from "./FacultyAccountDeletion";
import Swal from 'sweetalert2';
import DataTable from 'react-data-table-component';
import { showToast } from '../../components/toast';

const AdminManageUsers: React.FC = () => {
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showEditFacultyModal, setShowEditFacultyModal] = useState(false);
  const [showDeleteFacultyModal, setShowDeleteFacultyModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [newStudent, setNewStudent] = useState({
    firstname: "",
    lastname: "",
    department: "",
    studentNumber: "",
    year: "",
    email: "",
    password: "DLSUD123", 
    userId: "" // Initialize userId
  });
const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
const [newFaculty, setNewFaculty] = useState({
  firstname: "",
  lastname: "",
  department: "",
  facultyNumber: "",
  email: "",
  password: "DLSUD123", // Default password
  userId: "" // Initialize userId
});

/* ================= FACULTY TABLE SECTION ================= */
// STATE FOR FACULTY TABLE 
const [faculty, setFaculty] = useState<any[]>([]);
const [filteredFaculty, setFilteredFaculty] = useState<any[]>([]);

// Datable Column for Faculty
const facultyColumns = [
  {
    name: 'Profile',
    selector: (row: any) => row.profilePicUrl ? <img src={row.profilePicUrl} alt={row.firstname} className="profilepicture" /> : <FontAwesomeIcon icon={faUserCircle} className="default-profilepicture" />,
    sortable: false,
  },
  {
    name: 'Full Name',
    cell: (row: any) => `${row.firstname} ${row.lastname}`,
    sortable: true,
  },
  {
    name: 'Faculty Number',
    selector: (row: any) => row.facultyNumber,
    sortable: true,
  },
  {
    name: 'Department',
    selector: (row: any) => row.department,
    sortable: true,
  },
  {
    name: 'Email',
    cell: (row: any) => row.email,
    sortable: true,
  },
  {
    name: 'Status',
    selector: (row: any) => row.disabled ? '🔴 Disabled' : '🟢 Enabled',
    sortable: true,
  },
  {
    name: 'Actions',
    cell: (row: any) => (
      <div className="actions-column">
        <button onClick={() => { setSelectedFaculty(row); setShowEditFacultyModal(true); }} className="edit-btn">Edit</button>
{/*         <button onClick={() => { setSelectedFaculty(row); setShowDeleteFacultyModal(true); }} className="delete-btn">Delete</button>
 */}        <button onClick={() => handleToggleFacultyAccount(row.userId, row.disabled)} className="toggle-btn">{row.disabled ? 'Enable' : 'Disable'}</button>
      </div>
    ),
    ignoreRowClick: true,
    allowOverflow: true,
    button: true,
  },
];

//HOOK FOR FACULTY TABLE (Fetches the faculty table from Firestore)
useEffect(() => {
  const fetchFaculty = async () => {
    const querySnapshot = await getDocs(collection(firestore, "faculty"));
    const facultyList = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId, // Ensure userId is included
        uid: data.userId,    // Optionally map it to uid for consistency
        disabled: data.disabled !== undefined ? data.disabled : false, // Ensure disabled field is included
        ...data
      };
    });

    // Update Firestore documents to include the disabled field if it doesn't exist
    facultyList.forEach(async (facultyMember) => {
      if (facultyMember.disabled === undefined) {
        await updateDoc(doc(firestore, "faculty", facultyMember.id), { disabled: false });
      }
    });

    setFaculty(facultyList);
    setFilteredFaculty(facultyList);
  };
  fetchFaculty();
}, []);

// Function for editing faculty account
const handleEditFaculty = async (e: React.FormEvent) => {
  e.preventDefault();
  if (selectedFaculty) {
    try {
      await updateDoc(doc(firestore, "faculty", selectedFaculty.id), selectedFaculty);
      await logActivity(`Edited faculty: ${selectedFaculty.firstname} ${selectedFaculty.lastname}`);
      showToast("Faculty updated successfully.", "success");
      setShowEditFacultyModal(false);
      window.location.reload();
    } catch (error) {
      console.error("Error updating faculty: ", error);
      showToast("Failed to update faculty.", "error");
    }
  }
};

// Function that adds faculty account
const handleAddFaculty = async (e: React.FormEvent) => {
  e.preventDefault();
  const { email, password, firstname, lastname, facultyNumber, department } = newFaculty;

  try {
    // Step 1: Create user with Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Step 2: Send email verification
    await sendEmailVerification(user);

    // Step 3: Add faculty to Firestore
    await addDoc(collection(firestore, 'faculty'), {
      firstname,
      lastname,
      email,
      facultyNumber,
      department,
      userId: user.uid,
      createdAt: new Date(),
      disabled: false, // Ensure disabled field is included
    });

    // Step 4: Show success message
    Swal.fire('Success', 'Faculty created successfully! Verification email sent.', 'success');

    // Step 5: Close modal and reset form
    setShowAddFacultyModal(false);
    setNewFaculty({
      firstname: '',
      lastname: '',
      department: '',
      facultyNumber: '',
      email: '',
      password: 'DLSUD123', // Default password
      userId: ''
    });

    // Step 6: Refresh the faculty list
    const facultyQuerySnapshot = await getDocs(collection(firestore, 'faculty'));
    const facultyDocs: any[] = [];
    facultyQuerySnapshot.forEach((doc) => {
      const facultyData = doc.data();
      facultyDocs.push({
        ...facultyData,
        userId: doc.id,
      });
    });

    setFaculty(facultyDocs); // Update the faculty list
    setFilteredFaculty(facultyDocs); // Update the filtered faculty list
  } catch (error) {
    Swal.fire('Error', 'Failed to create faculty', 'error');
  }
};

// Disables and enables faculty account
const handleToggleFacultyAccount = async (uid: string, currentStatus: boolean | undefined) => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: `You are about to ${currentStatus ? 'enable' : 'disable'} this faculty account.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#dc3545',
    confirmButtonText: 'Yes',
    cancelButtonText: 'No',
  });

  if (result.isConfirmed) {
    try {
      // Find the faculty by userId
      const facultyMember = faculty.find((faculty) => faculty.userId === uid);
      if (!facultyMember) {
        throw new Error('Faculty not found');
      }

      // Use the Firestore document ID (facultyMember.id) to update the document
      await updateDoc(doc(firestore, 'faculty', facultyMember.id), {
        disabled: !currentStatus,
      });

      // Log the activity
      await logActivity(
        `${currentStatus ? 'Enabled' : 'Disabled'} faculty account: ${facultyMember.firstname} ${facultyMember.lastname}`
      );

      // Show success message
      Swal.fire('Success', `Faculty account ${currentStatus ? 'enabled' : 'disabled'}`, 'success');

      // Update the local state
      setFaculty((prevFaculty) =>
        prevFaculty.map((facultyMember) =>
          facultyMember.userId === uid ? { ...facultyMember, disabled: !currentStatus } : facultyMember
        )
      );
      setFilteredFaculty((prevFilteredFaculty) =>
        prevFilteredFaculty.map((facultyMember) =>
          facultyMember.userId === uid ? { ...facultyMember, disabled: !currentStatus } : facultyMember
        )
      );
    } catch (error) {
      console.error('Error toggling faculty account:', error);
      Swal.fire('Error', 'Failed to update faculty account status', 'error');
    }
  }
};

/* ================= STUDENT TABLE SECTION ================= */
  // Fetch students from Firestore
  useEffect(() => {
    const fetchStudents = async () => {
      const querySnapshot = await getDocs(collection(firestore, "students"));
      const studentsList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        userId: doc.data().userId, // Ensure userId is included
        uid: doc.data().userId,    // Optionally map it to uid for consistency
        ...doc.data()
      }));
      setStudents(studentsList);
      setFilteredStudents(studentsList);
      setLoading(false);
    };
    fetchStudents();
  }, []);

  // Datable Column for Student
  const columns = [
    {
      name: 'Profile',
      selector: (row: any) => row.profilePicUrl ? <img src={row.profilePicUrl} alt={row.firstname} className="profilepicture" /> : <FontAwesomeIcon icon={faUserCircle} className="default-profilepicture" />,
      sortable: false,
    },
    {
      name: 'Full Name',
      cell: (row: any) => `${row.firstname} ${row.lastname}`,
      sortable: true,
    },
    {
      name: 'Student Number',
      selector: (row: any) => row.studentNumber,
      sortable: true,
    },
    {
      name: 'Department',
      selector: (row: any) => row.department,
      sortable: true,
    },
    {
      name: 'Year Level',
      selector: (row: any) => row.year,
      sortable: true,
    },
    {
      name: 'Email',
      cell: (row: any) => row.email,
      sortable: true,
    },
    {
      name: 'Account Status',
      selector: (row: any) => row.disabled ? '🔴 Disabled' : '🟢 Enabled',
      sortable: true,
    },
    {
      name: 'Actions',
      cell: (row: any) => (
        <div className="actions-column">
          <button onClick={() => { setSelectedStudent(row); setShowEditStudentModal(true); }} className="edit-btn">Edit</button>
{/*           <button onClick={() => { setSelectedStudent(row); setShowDeleteStudentModal(true); }} className="delete-btn">Delete</button>
 */}          <button onClick={() => handleToggleStudentAccount(row.userId, row.disabled)} className="toggle-btn">{row.disabled ? 'Enable' : 'Disable'}</button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
    },
  ];

  //enables and disables students
  const handleToggleStudentAccount = async (uid: string, currentStatus: boolean | undefined) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to ${currentStatus ? 'enable' : 'disable'} this student account.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#dc3545',
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    });
  
    if (result.isConfirmed) {
      try {
        // Find the student by userId
        const student = students.find((student) => student.userId === uid);
        if (!student) {
          throw new Error('Student not found');
        }
  
        // Update the student's disabled status in Firestore
        await updateDoc(doc(firestore, 'students', uid), {
          disabled: !currentStatus,
        });
  
        // Log the activity
        await logActivity(
          `${currentStatus ? 'Enabled' : 'Disabled'} student account: ${student.firstname} ${student.lastname}`
        );
  
        // Show success message
        Swal.fire('Success', `Student account ${currentStatus ? 'enabled' : 'disabled'}`, 'success');
  
        // Update the local state
        setStudents((prevStudents) =>
          prevStudents.map((student) =>
            student.userId === uid ? { ...student, disabled: !currentStatus } : student
          )
        );
        setFilteredStudents((prevFilteredStudents) =>
          prevFilteredStudents.map((student) =>
            student.userId === uid ? { ...student, disabled: !currentStatus } : student
          )
        );
      } catch (error) {
        console.error('Error toggling student account:', error);
        Swal.fire('Error', 'Failed to update student account status', 'error');
      }
    }
  };
  
  // Log activity to Firestore
  const logActivity = async (activity: string) => {
     const admin = auth.currentUser;
     if (!admin) return;
   
     try {
       const adminQuery = query(collection(firestore, "admin"), where("userID", "==", admin.uid));
       const querySnapshot = await getDocs(adminQuery);
   
       if (!querySnapshot.empty) {
         const adminDoc = querySnapshot.docs[0];
         const data = adminDoc.data();
         const adminName = `${data.firstName} ${data.lastName}`;
   
         await addDoc(collection(firestore, "logs"), {
           activity,
           userName: adminName,
           timestamp: Timestamp.now(),
           role: data.role || "admin",
         });
       }
     } catch (error) {
       console.error("Error logging activity:", error);
     }
   };


  // Handle add student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const { email, password, firstname, lastname, studentNumber, department, year } = newStudent;
  
    try {
      // Step 1: Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
  
      // Step 2: Send email verification
      await sendEmailVerification(user);
  
      // Step 3: Add student to Firestore
      await addDoc(collection(firestore, 'students'), {
        firstname,
        lastname,
        email,
        studentNumber,
        department,
        year,
        disabled: false, // This is explicitly set as a boolean
        userId: user.uid,
        createdAt: new Date(),
      });
  
      // Step 4: Show success message
      Swal.fire('Success', 'Student created successfully! Verification email sent.', 'success');
  
      // Step 5: Close modal and reset form
      setShowAddStudentModal(false);
      setNewStudent({
        firstname: '',
        lastname: '',
        department: '',
        studentNumber: '',
        year: '',
        email: '',
        password: 'DLSUD123', // Default password
        userId: ''
      });
  
      // Step 6: Refresh the student list
      const studentQuerySnapshot = await getDocs(collection(firestore, 'students'));
      const studentDocs: any[] = [];
      studentQuerySnapshot.forEach((doc) => {
        const studentData = doc.data();
        studentDocs.push({
          ...studentData,
          userId: doc.id,
        });
      });
  
      setStudents(studentDocs); // Update the student list
      setFilteredStudents(studentDocs); // Update the filtered student list
    } catch (error) {
      Swal.fire('Error', 'Failed to create student', 'error');
    }
  };

// Handle edit student
const handleEditStudent = async (e: React.FormEvent) => {
  e.preventDefault();
  if (selectedStudent) {
    try {
      await updateDoc(doc(firestore, "students", selectedStudent.id), selectedStudent);
      await logActivity(`Edited student: ${selectedStudent.firstname} ${selectedStudent.lastname}`);
      showToast("Student updated successfully.", "success");

      // Update the student in the state without refreshing the page
      setStudents((prevStudents) =>
        prevStudents.map((student) =>
          student.userId === selectedStudent.userId ? selectedStudent : student
        )
      );
      setFilteredStudents((prevFilteredStudents) =>
        prevFilteredStudents.map((student) =>
          student.userId === selectedStudent.userId ? selectedStudent : student
        )
      );

      setShowEditStudentModal(false);
    } catch (error) {
      console.error("Error updating student: ", error);
      showToast("Failed to update student.", "error");
    }
  }
};

  // Handle search input (now added faculty option)
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);
  
    // Filter students
    const filteredStudents = students.filter((student) =>
      student.firstname.toLowerCase().includes(query) ||
      student.lastname.toLowerCase().includes(query) ||
      student.studentNumber.includes(query) ||
      student.department.toLowerCase().includes(query) ||
      student.year.toLowerCase().includes(query)
    );
    setFilteredStudents(filteredStudents);
  
    // Filter faculty
    const filteredFaculty = faculty.filter((facultyMember) =>
      facultyMember.firstname.toLowerCase().includes(query) ||
      facultyMember.lastname.toLowerCase().includes(query) ||
      facultyMember.facultyNumber.includes(query) ||
      facultyMember.department.toLowerCase().includes(query)
    );
    setFilteredFaculty(filteredFaculty);
  };

const [activeTab, setActiveTab] = useState<'students' | 'faculty'>('students');

// Handle CSV DATA EXPORT, This must below the activeTab state ^^^
const handleCSVExport = () => {
  logActivity(`Exported ${activeTab} as CSV`);
};
const prepareCSVData = (data: any[], excludeFields: string[]) => {
  return data.map((item) => {
    const newItem = { ...item };
    excludeFields.forEach((field) => delete newItem[field]);
    return newItem;
  });
};

const csvData = activeTab === 'students'
  ? prepareCSVData(filteredStudents, ['id', 'userId', 'uid', 'profilePicUrl', 'online', 'createdAt'])
  : prepareCSVData(filteredFaculty, ['id', 'userId', 'uid', 'profilePicUrl', 'online', 'createdAt']);
const csvFilename = activeTab === 'students' ? 'students.csv' : 'faculty.csv';


  if (loading) {
    // Only prevent rendering the student table while loading
    return (
      <div className="admin-dashboard">
        <AdminSidebar />
        <div className="admin-dashboard-content">
          <div className="header-actions">
            <p>Loading students...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className="admin-dashboard">
    <AdminSidebar />
    <div className="admin-dashboard-content">
    <h2 className="PageTitle">Manage Users</h2>      {/* Header Actions */}
      <div className="header-actions">
        <CSVLink
          data={csvData}
          filename={csvFilename}
          className="export-btn"
          onClick={handleCSVExport}
        >
          Export as CSV
        </CSVLink>

        {/* Search Input */}
        <input
        type="text"
        placeholder="Search by name, student number, department, etc."
        value={searchQuery}
        onChange={handleSearch}
        className="search-input"
      />
      
        <div className="add-buttons-container">
          <button className="add-student-btn" onClick={() => setShowAddStudentModal(true)}>
            Add Student
          </button>
          <button className="add-student-btn" onClick={() => setShowAddFacultyModal(true)}>
            Add Faculty
          </button>
        </div>
      </div>
      
    <br></br>

      {/* Tab Buttons */}
    <div className="tabs">
      <button
        className={`tab-button ${activeTab === 'students' ? 'active' : ''}`}
        onClick={() => setActiveTab('students')}
      >
        Students
      </button>
      <button
        className={`tab-button ${activeTab === 'faculty' ? 'active' : ''}`}
        onClick={() => setActiveTab('faculty')}
      >
        Faculty
      </button>
    </div>

    <br></br>

      {/* Student Table Tab */}
      {activeTab === 'students' && (
  <div className="student-table-wrapper">
    <DataTable
      columns={columns}
      data={filteredStudents}
      pagination
      paginationPerPage={7}
      paginationRowsPerPageOptions={[7, 10, 15, 20]} 
    />
  </div>
)}

      {/* Faculty Table Tab*/}
      {activeTab === 'faculty' && (
  <div className="student-table-wrapper">
    <DataTable
      columns={facultyColumns}
      data={filteredFaculty}
      pagination
      paginationPerPage={7}
      paginationRowsPerPageOptions={[7, 10, 15, 20]} 
    />
  </div>
)}

      {/* Edit Student Modal */}
      {showEditStudentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Student</h3>
            <form onSubmit={handleEditStudent}>
              <h5>First Name:</h5>
              <input
                type="text"
                value={selectedStudent?.firstname}
                onChange={(e) =>
                  setSelectedStudent((prev: any) => ({
                    ...prev,
                    firstname: e.target.value,
                  }))
                }
              />
              <h5>Last Name:</h5>
              <input
                type="text"
                value={selectedStudent?.lastname}
                onChange={(e) =>
                  setSelectedStudent((prev: any) => ({
                    ...prev,
                    lastname: e.target.value,
                  }))
                }
              />
              <h5>Department:</h5>
              <input
                type="text"
                value={selectedStudent?.department}
                onChange={(e) =>
                  setSelectedStudent((prev: any) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
              />
              <h5>Student Number:</h5>
              <input
                type="text"
                value={selectedStudent?.studentNumber}
                onChange={(e) =>
                  setSelectedStudent((prev: any) => ({
                    ...prev,
                    studentNumber: e.target.value,
                  }))
                }
              />
              <h5>Year Level:</h5>
              <input
                type="text"
                value={selectedStudent?.year}
                onChange={(e) =>
                  setSelectedStudent((prev: any) => ({
                    ...prev,
                    year: e.target.value,
                  }))
                }
              />
              <button type="submit">Save</button>
              <button
                type="button"
                onClick={() => setShowEditStudentModal(false)}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Add New Student</h3>
            <form onSubmit={handleAddStudent}>
              <input
                type="text"
                placeholder="First Name"
                value={newStudent.firstname}
                onChange={(e) =>
                  setNewStudent((prev: any) => ({
                    ...prev,
                    firstname: e.target.value,
                  }))
                }
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={newStudent.lastname}
                onChange={(e) =>
                  setNewStudent((prev: any) => ({
                    ...prev,
                    lastname: e.target.value,
                  }))
                }
                required
              />
              <input
                type="text"
                placeholder="Department"
                value={newStudent.department}
                onChange={(e) =>
                  setNewStudent((prev: any) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
                required
              />
              <input
                type="text"
                placeholder="Student Number"
                value={newStudent.studentNumber}
                onChange={(e) =>
                  setNewStudent((prev: any) => ({
                    ...prev,
                    studentNumber: e.target.value,
                  }))
                }
                required
              />
              <input
                type="text"
                placeholder="Year Level"
                value={newStudent.year}
                onChange={(e) =>
                  setNewStudent((prev: any) => ({
                    ...prev,
                    year: e.target.value,
                  }))
                }
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newStudent.email}
                onChange={(e) =>
                  setNewStudent((prev: any) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                required
              />
              <button type="submit">Add Student</button>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      {showDeleteStudentModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Student Account</h3>
            <StudentAccountDeletion
              student={selectedStudent} // Pass the selected student
              onClose={() => setShowDeleteStudentModal(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {showEditFacultyModal && selectedFaculty && (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>Edit Faculty</h3>
          <form onSubmit={handleEditFaculty}>
            <h5>First Name:</h5>
            <input
              type="text"
              value={selectedFaculty?.firstname}
              onChange={(e) =>
                setSelectedFaculty((prev: any) => ({
                  ...prev,
                  firstname: e.target.value,
                }))
              }
            />
            <h5>Last Name:</h5>
            <input
              type="text"
              value={selectedFaculty?.lastname}
              onChange={(e) =>
                setSelectedFaculty((prev: any) => ({
                  ...prev,
                  lastname: e.target.value,
                }))
              }
            />
            <h5>Department</h5>
            <input
              type="text"
              value={selectedFaculty?.department}
              onChange={(e) =>
                setSelectedFaculty((prev: any) => ({
                  ...prev,
                  department: e.target.value,
                }))
              }
            />
            <h5>Faculty Number:</h5>
            <input
              type="text"
              value={selectedFaculty?.facultyNumber}
              onChange={(e) =>
                setSelectedFaculty((prev: any) => ({
                  ...prev,
                  facultyNumber: e.target.value,
                }))
              }
            />
            <h5>Email:</h5>
            <input
              type="email"
              value={selectedFaculty?.email}
              onChange={(e) =>
                setSelectedFaculty((prev: any) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
            />
            <button type="submit">Save</button>
            <button
              type="button"
              onClick={() => setShowEditFacultyModal(false)}
            >
              Close
            </button>
          </form>
        </div>
      </div>
    )}

      {/* Delete Faculty Modal */}
      {showDeleteFacultyModal && selectedFaculty && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Faculty Account</h3>
            <FacultyAccountDeletion
              faculty={selectedFaculty} // Pass the selected faculty member
              onClose={() => setShowDeleteFacultyModal(false)}
            />
          </div>
        </div>
      )}

      {/* Add Faculty Modal */}
      {showAddFacultyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Add New Faculty</h3>
            <form onSubmit={handleAddFaculty}>
              <input
                type="text"
                placeholder="First Name"
                value={newFaculty.firstname}
                onChange={(e) =>
                  setNewFaculty((prev: any) => ({
                    ...prev,
                    firstname: e.target.value,
                  }))
                }
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={newFaculty.lastname}
                onChange={(e) =>
                  setNewFaculty((prev: any) => ({
                    ...prev,
                    lastname: e.target.value,
                  }))
                }
                required
              />
              <input
                type="text"
                placeholder="Department"
                value={newFaculty.department}
                onChange={(e) =>
                  setNewFaculty((prev: any) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
                required
              />
              <input
                type="text"
                placeholder="Faculty Number"
                value={newFaculty.facultyNumber}
                onChange={(e) =>
                  setNewFaculty((prev: any) => ({
                    ...prev,
                    facultyNumber: e.target.value,
                  }))
                }
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newFaculty.email}
                onChange={(e) =>
                  setNewFaculty((prev: any) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                required
              />
              <button type="submit">Add Faculty</button>
              <button
                type="button"
                onClick={() => setShowAddFacultyModal(false)}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  </div>
);
}
export default AdminManageUsers;
