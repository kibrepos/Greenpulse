import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThLarge, faUser, faBuilding, faCalendar, faUsers, faComments, faChartPie, faClipboardList, faStar, faBars, faSignOutAlt, faCog } from '@fortawesome/free-solid-svg-icons';
import { signOut } from 'firebase/auth';
import { auth, firestore, storage } from '../../services/firebaseConfig';
import { doc, addDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { NavLink, useLocation } from 'react-router-dom';
import '../../styles/AdminSidebar.css';

const AdminSidebar: React.FC = () => {
  const [adminName, setAdminName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [profilePicUrl, setProfilePicUrl] = useState<string>('https://via.placeholder.com/150'); // Default profile picture
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const location = useLocation();

  const isManageOrganizationsActive = () => {
    return (
      location.pathname.startsWith('/Admin/ManageOrganizations') ||
      location.pathname.startsWith('/Admin/CreateOrganization') ||
      location.pathname.startsWith('/Admin/EditOrganization') ||
      location.pathname.startsWith('/Admin/Organizations')
    );
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerHeight > window.innerWidth) {
        setCollapsed(true); // Collapse sidebar when the height is greater than width
      } else {
        setCollapsed(false); // Expand sidebar when the width is greater than height
      }
    };

    // Initial check
    handleResize();

    // Add event listener on resize
    window.addEventListener('resize', handleResize);

    // Check if sidebar state is stored in localStorage
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState) {
      setCollapsed(JSON.parse(savedState)); // Restore the collapsed state
    }

    const fetchAdminData = async () => {
      try {
        // Get the current user's UID
        const uid = auth.currentUser?.uid;
        if (!uid) {
          console.error("No user is currently logged in.");
          return;
        }

        // Query Firestore to find the document where `userID` matches the current user's UID
        const adminQuery = query(collection(firestore, 'admin'), where('userID', '==', uid));
        const querySnapshot = await getDocs(adminQuery);

        if (!querySnapshot.empty) {
          // Assuming there's only one document per userID
          const adminDoc = querySnapshot.docs[0];
          const data = adminDoc.data();
          setAdminName(`${data.firstName} ${data.lastName}`);
          setAdminEmail(data.email);

          // Fetch profile picture if available
          if (data.profilePicUrl) {
            setProfilePicUrl(data.profilePicUrl); // Use the URL from Firestore
          } else {
            // If profile picture is not found in Firestore, fetch it from storage
            const profilePicRef = ref(storage, `adminprofilePics/profile-picture.jpg`);
            try {
              const url = await getDownloadURL(profilePicRef);
              setProfilePicUrl(url); // Set the default profile picture URL
            } catch (error) {
              console.error("Error fetching profile picture from storage: ", error);
            }
          }
        } else {
          console.log('No matching admin document found.');
        }
      } catch (error) {
        console.error("Error fetching admin data: ", error);
      }
    };

    // Call the function
    fetchAdminData();
  }, []);

  const openLogoutModal = () => {
    setIsLogoutModalOpen(true);
  };

  const closeLogoutModal = () => {
    setIsLogoutModalOpen(false);
  };

  const handleConfirmSignOut = async () => {
    try {
      const user = auth.currentUser;

      if (user) {
        const uid = user.uid;

        // Query the admin collection to find the document where 'userID' matches the current user's UID
        const adminQuery = query(collection(firestore, 'admin'), where('userID', '==', uid));
        const querySnapshot = await getDocs(adminQuery);

        if (!querySnapshot.empty) {
          const adminDoc = querySnapshot.docs[0]; // Get the first matching admin document
          const adminRef = doc(firestore, 'admin', adminDoc.id);

          // Update active status to 'inactive'
          await updateDoc(adminRef, { activestatus: 'inactive' });

          // Log the sign-out action in 'adminlogs'
          await addDoc(collection(firestore, 'adminlogs'), {
            userID: uid,
            email: user.email || "No Email",
            action: "Logged out",
            timestamp: new Date(),
          });
        } else {
          console.error('No matching document found for the userID:', uid);
        }
      }

      await signOut(auth);
      console.log('User signed out');
    } catch (error) {
      console.error('Error signing out: ', error);
    } finally {
      setIsLogoutModalOpen(false);
    }
  };

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };


  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <h3>GreenPulse</h3>
        <FontAwesomeIcon icon={faBars} className="toggle-button" onClick={toggleCollapse} />
      </div>
  
      <ul className="nav-list">
        <li className="nav-item">
          <NavLink to="/Admin/dashboard" className={({ isActive }) => (isActive ? 'active nav-link' : 'nav-link')}>
            <FontAwesomeIcon icon={faThLarge} />
            <span> Dashboard Overview</span>
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/Admin/ManageUsers" className={({ isActive }) => (isActive ? 'active nav-link' : 'nav-link')}>
            <FontAwesomeIcon icon={faUsers} />
            <span> Manage Users</span>
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/Admin/ManageOrganizations" className={isManageOrganizationsActive() ? 'active nav-link' : 'nav-link'}>
            <FontAwesomeIcon icon={faBuilding} />
            <span> Manage Organizations</span>
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink key={location.pathname} to="/Admin/EventsManagement" className={({ isActive }) => (isActive ? 'active nav-link' : 'nav-link')}>
            <FontAwesomeIcon icon={faCalendar} />
            <span> Events Management</span>
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/Admin/Announcements" className={({ isActive }) => (isActive ? 'active nav-link' : 'nav-link')}>
            <FontAwesomeIcon icon={faComments} />
            <span> Announcements</span>
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/Admin/ReportingAnalytics" className={({ isActive }) => (isActive ? 'active nav-link' : 'nav-link')}>
            <FontAwesomeIcon icon={faChartPie} />
            <span> Reports & Analytics</span>
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/Admin/Activity-Logs" className={({ isActive }) => (isActive ? 'active nav-link' : 'nav-link')}>
            <FontAwesomeIcon icon={faClipboardList} />
            <span> Activity Logs</span>
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/Admin/feedback-support" className={({ isActive }) => (isActive ? 'active nav-link' : 'nav-link')}>
            <FontAwesomeIcon icon={faStar} />
            <span> Issues & Feedback</span>
          </NavLink>
        </li>
      </ul>
  
      <div className="user-profile">
        <img src={profilePicUrl} alt="User profile" />
        <div className="user-info">
          <h4>{adminName}</h4>
          <p>{adminEmail}</p>
        </div>
        <FontAwesomeIcon icon={faSignOutAlt} className="sign-out-icon" onClick={openLogoutModal} />
        {isLogoutModalOpen && (
          <div className="modal-overlaysadmin">
            <div className="modal-contentsadmin">
              <h3>Confirm Logout</h3>
              <p>Are you sure you want to log out?</p>
              <button className="confirm-buttonzx" onClick={handleConfirmSignOut}>
                Yes, Log Out
              </button>
              <button className="cancel-buttonzx" onClick={closeLogoutModal}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  
};

export default AdminSidebar;