import React, { useEffect, useState } from 'react';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification,sendPasswordResetEmail } from 'firebase/auth';
import { firestore } from '../../services/firebaseConfig';
import { collection, doc, getDocs, deleteDoc, updateDoc, addDoc, onSnapshot } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { faKey, faBan, faTrashAlt, faPlus, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import SuperAdminSidebar from './SuperAdminSidebar';
import { ref, getDownloadURL } from "firebase/storage"; // Import storage functions
import { storage } from "../../services/firebaseConfig"; // Import storage instance
import DataTable from 'react-data-table-component';
import '../../styles/AdminManagement.css';

const auth = getAuth();

// ===== defines the admin object =====
interface Admin {
  firstName: string;
  lastName: string;
  email: string;
  userID: string;
  createdAt: any;
  disabled?: boolean;
  lastlogin?: any;
  activestatus?: string;
}

const AdminManagement: React.FC = () => {
  const [originalAdmins, setOriginalAdmins] = useState<Admin[]>([]); // Store the original data
  const [admins, setAdmins] = useState<Admin[]>([]); // Store the filtered data
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newAdmin, setNewAdmin] = useState({ firstName: '', lastName: '', email: '', password: '' });

  //====== hook for fetching the list of admin accounts on the database wowers =======
  useEffect(() => {
    const fetchAdmins = async () => {
      const adminDocs: Admin[] = [];
      const adminQuerySnapshot = await getDocs(collection(firestore, 'admin'));
  
      adminQuerySnapshot.forEach((doc) => {
        const adminData = doc.data();
        adminDocs.push({
          ...adminData,
          userID: doc.id,
          lastlogin: adminData.lastlogin || null,
        } as Admin);
      });
  
      // Sort admins: online (active) accounts first
      const sortedAdmins = adminDocs.sort((a, b) => {
        if (a.activestatus === 'active' && b.activestatus !== 'active') return -1; // a comes first
        if (a.activestatus !== 'active' && b.activestatus === 'active') return 1; // b comes first
        return 0; // no change in order
      });
  
      setOriginalAdmins(sortedAdmins); // Store the original data
      setAdmins(sortedAdmins); // Initialize filtered data with the original data
      setLoading(false);
    };
  
    fetchAdmins();
  }, []);
  
//===== reset password =====
  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      Swal.fire('Success', 'Password reset email sent!', 'success');
    } catch (error) {
      Swal.fire('Error', 'Failed to send reset email', 'error');
    }
  };
  
  //======= ENABLES and DISABLES the ADMIN ACCOUNTS ========
  const handleToggleAccount = async (uid: string, currentStatus: boolean | undefined) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to ${currentStatus ? 'enable' : 'disable'} this account.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#dc3545',
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
    });

    if (result.isConfirmed) {
      try {
        await updateDoc(doc(firestore, 'admin', uid), {
          disabled: !currentStatus,
        });
        Swal.fire('Success', `Account ${currentStatus ? 'enabled' : 'disabled'}`, 'success');
        setAdmins((prevAdmins) =>
          prevAdmins.map((admin) =>
            admin.userID === uid ? { ...admin, disabled: !currentStatus } : admin
          )
        );
      } catch (error) {
        Swal.fire('Error', 'Failed to update account status', 'error');
      }
    }
  };

  // ====== Last Login Column Timestamp Design ======
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Never';
  
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) + ' - ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };
  
  // ====== Delete Acc ======
  const handleDeleteAccount = async (uid: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'You are about to delete this account. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
    });
  
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(firestore, 'admin', uid));
        Swal.fire('Success', 'Account deleted', 'success');
  
        // Update both originalAdmins and admins states
        const updatedOriginalAdmins = originalAdmins.filter(admin => admin.userID !== uid);
        const updatedAdmins = admins.filter(admin => admin.userID !== uid);
  
        setOriginalAdmins(updatedOriginalAdmins);
        setAdmins(updatedAdmins);
      } catch (error) {
        Swal.fire('Error', 'Failed to delete account', 'error');
      }
    }
  };

  // ========== REAL TIME UPDATES ON LASTLOGIN FIELD ===========
  useEffect(() => {
    const adminsCollection = collection(firestore, 'admin');
  
    const unsubscribe = onSnapshot(adminsCollection, (snapshot) => {
      const updatedAdmins = snapshot.docs.map((doc) => ({
        ...doc.data(),
        userID: doc.id,
        lastlogin: doc.data().lastlogin || null,
      })) as Admin[];
  
      // Sort admins: online (active) accounts first
      const sortedAdmins = updatedAdmins.sort((a, b) => {
        if (a.activestatus === 'active' && b.activestatus !== 'active') return -1; // a comes first
        if (a.activestatus !== 'active' && b.activestatus === 'active') return 1; // b comes first
        return 0; // no change in order
      });
  
      setOriginalAdmins(sortedAdmins); // Update the original data
      setAdmins(sortedAdmins); // Update the filtered data
    });
  
    return () => unsubscribe();
  }, []);
  // =========== Create Admin Account ==============
  const handleCreateAdmin = async () => {
    const { firstName, lastName, email, password } = newAdmin;
  
    try {
      // Step 1: Create the admin user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
  
      // Step 2: Send email verification
      await sendEmailVerification(user);
  
      // Step 3: Get the default profile picture URL from Firebase Storage
      const defaultProfilePicRef = ref(storage, "adminprofilePics/profile-picture.jpg");
      const profilePicUrl = await getDownloadURL(defaultProfilePicRef);
  
      // Step 4: Add the admin document to Firestore with the profile picture URL
      await addDoc(collection(firestore, "admin"), {
        firstName,
        lastName,
        email,
        userID: user.uid,
        createdAt: new Date(),
        disabled: false,
        profilePicUrl, // Add the profile picture URL
      });
  
      // Step 5: Show success message and reset the form
      Swal.fire("Success", "Admin created successfully! Verification email sent.", "success");
      setIsModalOpen(false);
      setNewAdmin({ firstName: "", lastName: "", email: "", password: "" });
  
      // Step 6: Refresh the admin list
      const adminQuerySnapshot = await getDocs(collection(firestore, "admin"));
      const adminDocs: Admin[] = [];
      adminQuerySnapshot.forEach((doc) => {
        const adminData = doc.data();
        adminDocs.push({
          ...adminData,
          userID: doc.id,
          lastlogin: adminData.lastlogin || null,
        } as Admin);
      });
  
      // Sort admins: online (active) accounts first
      const sortedAdmins = adminDocs.sort((a, b) => {
        if (a.activestatus === "active" && b.activestatus !== "active") return -1; // a comes first
        if (a.activestatus !== "active" && b.activestatus === "active") return 1; // b comes first
        return 0; // no change in order
      });
  
      setOriginalAdmins(sortedAdmins); // Update the original data
      setAdmins(sortedAdmins); // Update the filtered data
    } catch (error) {
      console.error("Error creating admin:", error);
      Swal.fire("Error", "Failed to create admin", "error");
    }
  };
  
  // ========== Columns on the data table ============
  const columns = [
    {
      name: 'Online Status',
      selector: (row: Admin) => (row.activestatus === 'active' ? '🟢 Online' : '🔴 Offline'),
      sortable: true,
    },
    {
      name: 'First Name',
      selector: (row: Admin) => row.firstName,
      sortable: true,
    },
    {
      name: 'Last Name',
      selector: (row: Admin) => row.lastName,
      sortable: true,
    },
    {
      name: 'Email',
      cell: (row: Admin) => row.email,
      sortable: true,
    },
    {
      name: 'Status',
      selector: (row: Admin) => row.disabled ? 'Disabled' : 'Enabled',
      sortable: true,
    },
    {
      name: 'Last Login',
      cell: (row: Admin) => row.lastlogin ? formatTimestamp(row.lastlogin) : 'Never',
      sortable: true,
    },
    {
      name: 'Actions',
      cell: (row: Admin) => (
        <div className="action-buttons">
          <button
            className="addme-action-btn reset-password"
            onClick={() => handleResetPassword(row.email)}
            title="Reset Password" // Tooltip on hover
          >
            <FontAwesomeIcon icon={faKey} /> {/* Icon only */}
          </button>
          <button
            className={`addme-action-btn ${row.disabled ? 'enable-account' : 'disable-account'}`}
            onClick={() => handleToggleAccount(row.userID, row.disabled)}
            title={row.disabled ? 'Enable Account' : 'Disable Account'} // Tooltip on hover
          >
            <FontAwesomeIcon icon={row.disabled ? faCheckCircle : faBan} /> {/* Different icons for Enable/Disable */}
          </button>
          <button
            className="addme-action-btn delete-account"
            onClick={() => handleDeleteAccount(row.userID)}
            title="Delete Account" // Tooltip on hover
          >
            <FontAwesomeIcon icon={faTrashAlt} /> {/* Icon only */}
          </button>
        </div>
      ),
    },
  ];


  return (
    <div className="addme-admin-management-container">
      <SuperAdminSidebar />
  
      <div className="addme-superadmin-content">
        <h2>Admin Management</h2>
        <button className="addme-create-admin-btn" onClick={() => setIsModalOpen(true)}>
          <FontAwesomeIcon icon={faPlus} /> Create Admin
        </button>
  
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="table-container"> {/* Scrollable wrapper */}
            <DataTable
              columns={columns}
              data={admins}
              pagination
              highlightOnHover
    
              subHeader
              subHeaderComponent={
                <input
                  type="text"
                  placeholder="Search"
                  className="addme-form-control"
                  onChange={(e) => {
                    const query = e.target.value.toLowerCase();
                    const filteredAdmins = originalAdmins.filter(
                      admin =>
                        admin.firstName.toLowerCase().includes(query) ||
                        admin.lastName.toLowerCase().includes(query) ||
                        admin.email.toLowerCase().includes(query)
                    );
                    setAdmins(filteredAdmins); // Update the filtered data
                  }}
                />
              }
            />
          </div>
        )}
  
        {isModalOpen && (
          <div className="creates-modal-overlay">
            <div className="creates-modal-content">
              <h2>Create New Admin</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleCreateAdmin(); }}>
                <div className="creates-form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={newAdmin.firstName}
                    onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="creates-form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={newAdmin.lastName}
                    onChange={(e) => setNewAdmin({ ...newAdmin, lastName: e.target.value })}
                    required
                  />
                </div>
                <div className="creates-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    required
                  />
                </div>
                <div className="creates-form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    required
                  />
                </div>
                <div className="creates-form-actions">
                  <button type="button" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit">
                    Create Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminManagement;