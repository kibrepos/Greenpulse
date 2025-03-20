import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, firestore } from '../services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { authStateListener } from '../services/auth';
import "../styles/NotFound.css";


interface PrivateRouteProps {
  requiredRoles: Array<'student' | 'faculty' | 'admin' | 'superadmin'>; // Added 'superadmin'
}


const PrivateRoute: React.FC<PrivateRouteProps> = ({ requiredRoles }) => {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: number; message: string } | null>(null);
  const navigate = useNavigate();
  

  useEffect(() => {
    const unsubscribe = authStateListener((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user role based on UID
        fetchUserRole(currentUser.uid);
      } else {
        window.location.href = '/login'; // Redirect to the login page
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserRole = async (uid: string) => {
    try {
      let userDoc = await getDoc(doc(firestore, 'students', uid));
      if (userDoc.exists()) {
        setUserRole('student');
      } else {
        userDoc = await getDoc(doc(firestore, 'faculty', uid));
        if (userDoc.exists()) {
          setUserRole('faculty');
        } else {
          userDoc = await getDoc(doc(firestore, 'admin', uid));
          if (userDoc.exists()) {
            setUserRole('admin');
          } else {
            userDoc = await getDoc(doc(firestore, 'SuperAdmin', uid)); // Check SuperAdmin collection
            if (userDoc.exists()) {
              setUserRole('superadmin');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user role: ', error);
      setError({ code: 500, message: 'An error occurred while checking your access.' });
    }
    setLoading(false);
  };

  if (loading) return <p>Loading...</p>;

  // Display error if the user is not logged in or has the wrong role
  if (error || (userRole && !requiredRoles.includes(userRole as 'student' | 'faculty' | 'admin' | 'superadmin'))) {
    const errorCode = error?.code || 403;
    const errorMessage =
      error?.message || `You are not authorized to access this page.`;

      return (
        <div className="not-found-container">
          <div className="not-found-box">
            <h1 className="not-found-title">
              {errorCode} Error
            </h1>
            <p className="not-found-description">
              {errorMessage}
            </p>
            <button className="not-found-back-button" onClick={() => navigate('/')}>
              Go Back
            </button>
          </div>
        </div>
      );
    }

  return <Outlet />;
};

export default PrivateRoute;
