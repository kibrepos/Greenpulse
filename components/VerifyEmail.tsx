import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth, applyActionCode, fetchSignInMethodsForEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../services/firebaseConfig"; // Adjust import path as needed

const VerifyEmail: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // To handle loading state
  const location = useLocation();
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const actionCode = queryParams.get('oobCode');

    if (actionCode) {
      applyActionCode(auth, actionCode)
        .then(async () => {
          setIsVerified(true);

          // Fetch the user info based on email to determine the role
          const userEmail = auth.currentUser?.email;
          if (userEmail) {
            const signInMethods = await fetchSignInMethodsForEmail(auth, userEmail);
            const userRole = await getUserRole(userEmail);

            // Redirect based on user role
            if (userRole === 'admin') {
              navigate("/admin-dashboard");
            } else if (userRole === 'faculty') {
              navigate("/Faculty/dashboard");
            } else if (userRole === 'student') {
              navigate("/Student/dashboard");
            } else {
              navigate("/login"); // Fallback route if role is unknown
            }
          } else {
            navigate("/login"); // Fallback route if user email is not available
          }
        })
        .catch((error) => {
          console.error("Error verifying email", error);
          setIsVerified(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      navigate("/login"); // Redirect if no action code present
    }
  }, [location.search, auth, navigate]);

  // Function to get user role from Firestore
  const getUserRole = async (email: string) => {
    const adminDoc = await getDoc(doc(firestore, "admin", email));
    if (adminDoc.exists()) return 'admin';

    const facultyDoc = await getDoc(doc(firestore, "faculty", email));
    if (facultyDoc.exists()) return 'faculty';

    const studentDoc = await getDoc(doc(firestore, "students", email));
    if (studentDoc.exists()) return 'student';

    return null;
  };

  return (
    <div>
      <h2>Email Verification</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : isVerified ? (
        <p>Your email has been verified successfully! Redirecting you...</p>
      ) : (
        <p>Verification failed or the link is invalid. Please try again.</p>
      )}
    </div>
  );
};

export default VerifyEmail;
