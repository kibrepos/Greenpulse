import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../services/firebaseConfig';

interface UserRole {
  role: 'president' | 'officer' | 'member' | 'faculty';
  id: string;
}

const ProtectedOrgRoute: React.FC<{ requiredRoles?: ('president' | 'officer' | 'member' | 'faculty')[] }> = ({
  requiredRoles,
}) => {
  const { organizationName } = useParams(); // Get the org name from the URL
  const [loading, setLoading] = useState(true); // Track loading state
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // Track if user is authorized
  const [error, setError] = useState<{ code: number; message: string } | null>(null); // Track error messages
  const auth = getAuth();

  useEffect(() => {
    const checkAccess = async () => {
      const user = auth.currentUser;
      if (!user) {
        setError({ code: 401, message: 'You must be logged in to access this page.' });
        setLoading(false);
        return;
      }

      try {
        const orgDoc = await getDoc(doc(firestore, 'organizations', organizationName!));
        if (!orgDoc.exists()) {
          setError({ code: 404, message: 'The organization does not exist.' });
          setLoading(false);
          return;
        }

        const data = orgDoc.data();
        const { status, president, officers = [], members = [] } = data;

        // Check if the organization is archived
        if (status === 'archived') {
          setError({ code: 403, message: 'The organization is archived and cannot be accessed.' });
          setLoading(false);
          return;
        }

        let role: UserRole | null = null;

        // Include president, officer, and faculty adviser as part of a unified group
        if (
          user.uid === president.id || // Check if user is the president
          officers.some((officer: any) => officer.id === user.uid) || // Check if user is an officer
          (data.facultyAdviser && user.uid === data.facultyAdviser.id) // Check if user is the faculty adviser
        ) {
          role = { role: 'officer', id: user.uid }; // Treat all as 'officer'
        } else if (members.some((member: any) => member.id === user.uid)) {
          role = { role: 'member', id: user.uid }; // Treat as member
        }
        

        if (!role) {
          setError({ code: 403, message: 'You are not authorized to access this organization.' });
          setLoading(false);
          return;
        }

        // Check if the user's role matches the required role for the route
        if (!role || (requiredRoles && !requiredRoles.includes(role.role))) {
          setError({ code: 403, message: 'You do not have the correct role to access this page.' });
          setLoading(false);
          return;
        }
        

        setIsAuthorized(true); // User is authorized
      } catch (error) {
        console.error('Error checking role or membership:', error);
        setError({ code: 500, message: 'An error occurred while checking your access.' });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [auth, organizationName, requiredRoles]);

  if (loading) return <div>Loading...</div>;

  // If there is an error, show the error message instead of redirecting
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '3rem', color: '#D9534F' }}>
          {error.code} - {error.code === 401 ? 'Unauthorized' : 'Forbidden'}
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#6C757D' }}>{error.message}</p>
        <button
          onClick={() => window.history.back()}
          style={{
            textDecoration: 'none',
            backgroundColor: '#007BFF',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
            marginTop: '20px',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return isAuthorized ? <Outlet /> : null;
};

export default ProtectedOrgRoute;
