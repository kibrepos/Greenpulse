import React, { useState, useEffect } from "react";
import { collection, getDocs, setDoc, addDoc, getDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut } from "firebase/auth"; // Firebase auth imports
import { firestore, auth } from "../../services/firebaseConfig"; // Assuming Firebase is configured here
import { CSVLink } from "react-csv";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserCircle } from "@fortawesome/free-solid-svg-icons";
import AdminSidebar from "./AdminSidebar";
import "../../styles/AdminManageStudent.css";
import StudentAccountDeletion from "./StudentAccountDeletion";

const AdminManageStudent: React.FC = () => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [newStudent, setNewStudent] = useState({
    firstname: "",
    lastname: "",
    department: "",
    studentNumber: "",
    year: "",
    email: "",
    password: "DLSUD123", // Default password
    userId: "" // Initialize userId
  });

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

  // Log activity to Firestore
  const logActivity = async (activity: string) => {
    const admin = auth.currentUser;
    if (!admin) return;

    try {
      const adminDoc = await getDoc(doc(firestore, "admin", admin.uid));
      if (adminDoc.exists()) {
        const data = adminDoc.data();
        const adminName = `${data.firstName} ${data.lastName}`;
        await addDoc(collection(firestore, "logs"), {
          activity: activity,
          userName: adminName,
          timestamp: Timestamp.now(),
          role: data.role || "admin"
        });
      }
    } catch (error) {
      console.error("Error logging activity: ", error);
    }
  };

  // Handle search input
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);
    const filtered = students.filter((student) =>
      student.firstname.toLowerCase().includes(query) ||
      student.lastname.toLowerCase().includes(query) ||
      student.studentNumber.includes(query) ||
      student.department.toLowerCase().includes(query) ||
      student.year.toLowerCase().includes(query)
    );
    setFilteredStudents(filtered);
  };

  // Handle add student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    const adminUser = auth.currentUser;

    try {
      const { email, password, firstname, lastname, studentNumber, department, year } = newStudent;

      // Step 1: Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Step 2: Send email verification
      await sendEmailVerification(newUser);
      alert("Verification email sent to the student.");


      // Step 4: Add student to Firestore
      const studentDocRef = doc(firestore, "students", newUser.uid);
      await setDoc(studentDocRef, {
        firstname,
        lastname,
        email,
        studentNumber,
        department,
        year,
        userId: newUser.uid
      });

      // Step 5: Log activity
      await logActivity(`Added new student: ${firstname} ${lastname}`);

      // Close modal and refresh UI
      setShowAddModal(false);
      window.location.reload();
    } catch (error) {
      console.error("Error adding student: ", error);
      alert("Failed to add student. Please try again.");
    }
  };

  // Handle edit student
  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudent) {
      try {
        await updateDoc(doc(firestore, "students", selectedStudent.id), selectedStudent);
        await logActivity(`Edited student: ${selectedStudent.firstname} ${selectedStudent.lastname}`);
        alert("Student updated successfully.");
        setShowEditModal(false);
        window.location.reload();
      } catch (error) {
        console.error("Error updating student: ", error);
        alert("Failed to update student.");
      }
    }
  };

  const handleCSVExport = () => {
    logActivity("Exported students as CSV");
  };

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
      {/* Header Actions */}
      <div className="header-actions">
        <CSVLink
          data={filteredStudents}
          filename="students.csv"
          className="export-btn"
          onClick={handleCSVExport}
        >
          Export as CSV
        </CSVLink>
        <button className="add-student-btn" onClick={() => setShowAddModal(true)}>
          Add Student
        </button>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search by name, student number, department, etc."
        value={searchQuery}
        onChange={handleSearch}
        className="search-input"
      />

      {/* Student Table */}
      <div className="student-table-wrapper">
        <table className="student-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Full Name</th>
              <th>Student Number</th>
              <th>Department</th>
              <th>Year Level</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.id}>
                <td>
                  {student.profilePicUrl ? (
                    <img
                      src={student.profilePicUrl}
                      alt={student.firstname}
                      className="profilepicture"
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={faUserCircle}
                      className="default-profilepicture"
                    />
                  )}
                </td>
                <td>{student.firstname} {student.lastname}</td>
                <td>{student.studentNumber}</td>
                <td>{student.department}</td>
                <td>{student.year}</td>
                <td>{student.email}</td>
                <td>
                  <button
                    onClick={() => {
                      setSelectedStudent(student);
                      setShowEditModal(true);
                    }}
                    className="edit-btn">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      console.log("Selected student for deletion:", student); // Log the student object
                      setSelectedStudent(student);
                      setShowDeleteModal(true);
                    }}
                    className="delete-btn">
                    Delete
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Student</h3>
            <form onSubmit={handleEditStudent}>
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
              <input
                type="email"
                value={selectedStudent?.email}
                onChange={(e) =>
                  setSelectedStudent((prev: any) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />
              <button type="submit">Save</button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
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
                onClick={() => setShowAddModal(false)}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

{showDeleteModal && selectedStudent && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Delete Student Account</h3>
      <StudentAccountDeletion
      student={selectedStudent} // Ensure this contains the correct student object
      onClose={() => setShowDeleteModal(false)}
      
      />
    </div>
  </div>
)}

    </div>
  </div>
);
}
export default AdminManageStudent;
