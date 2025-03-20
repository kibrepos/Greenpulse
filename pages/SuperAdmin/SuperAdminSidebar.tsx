import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import Swal from 'sweetalert2';
import '../../styles/SuperAdminSidebar.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

const SuperAdminSidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Prevent body scroll when SweetAlert is active
    document.body.style.overflow = 'hidden';
  
    // Show SweetAlert confirmation before logging out
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you really want to log out?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, log out!',
      didClose: () => {
        // Restore body scroll after SweetAlert closes
        document.body.style.overflow = 'auto';
      }
    });
  
    if (result.isConfirmed) {
      try {
        await signOut(auth);
        navigate('/login');
      } catch (error) {
        console.error('Error logging out:', error);
        Swal.fire('Error!', 'An error occurred while logging out.', 'error');
      }
    }
  };
  
  return (
    <div className="superadmin-layout">
      <div className="superadmin-sidebar">
      <div className="superadmin-sidebar-header">GreenPulse</div>
        <div className="superadmin-sidebar-sideheader">Super Admin</div>
        <nav className="superadmin-sidebar-nav">
          <NavLink to="/Superadmin/dashboard" className="superadmin-sidebar-link">
            Dashboard
          </NavLink>
          <NavLink to="/superadmin/admins-management" className="superadmin-sidebar-link">
          Admin Management
          </NavLink>
        </nav>
        <a className="superadmin-sidebar-logout" onClick={handleLogout}>
  <FontAwesomeIcon icon={faSignOutAlt} /> Logout
</a>


      </div>
    </div>
  );
};

export default SuperAdminSidebar;
