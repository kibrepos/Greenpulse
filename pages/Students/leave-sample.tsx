import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, firestore } from '../../services/firebaseConfig';
import { doc, getDoc, updateDoc, arrayRemove, collection, getDocs, query, where } from 'firebase/firestore';
import StudentPresidentSidebar from './StudentPresidentSidebar';
import StudentMemberSidebar from './StudentMemberSidebar';
import Header from '../../components/Header';
import '../../styles/leave-sample.css';

const LeaveSample: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [userRole, setUserRole] = useState<"president" | "member" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;

        if (user) {
          setUserId(user.uid); // Set the logged-in user ID

          // Query the students collection for a document with the matching userId
          const studentsRef = collection(firestore, 'students');
          const studentQuery = query(studentsRef, where('userId', '==', user.uid));
          const studentSnapshot = await getDocs(studentQuery);

          let userData;

          if (!studentSnapshot.empty) {
            // If a student document is found, use its data
            const studentDoc = studentSnapshot.docs[0];
            userData = studentDoc.data();
          } else {
            // If no student document is found, query the faculty collection
            const facultyRef = collection(firestore, 'faculty');
            const facultyQuery = query(facultyRef, where('userId', '==', user.uid));
            const facultySnapshot = await getDocs(facultyQuery);

            if (!facultySnapshot.empty) {
              // If a faculty document is found, use its data
              const facultyDoc = facultySnapshot.docs[0];
              userData = facultyDoc.data();
            } else {
              console.error('User data not found in students or faculty collections.');
              return;
            }
          }

          // Fetch organization data
          const orgDocRef = doc(firestore, 'organizations', organizationName || '');
          const orgDoc = await getDoc(orgDocRef);

          if (orgDoc.exists()) {
            const orgData = orgDoc.data();

            // Determine the role of the logged-in user
            if (orgData.president?.id === user.uid) {
              setUserRole('president');
            } else if (orgData.members?.some((member: any) => member.id === user.uid)) {
              setUserRole('member');
            } else {
              setUserRole(null);
            }
          } else {
            console.error('Organization data not found.');
          }
        }
      } catch (error) {
        console.error('Error fetching organization or user data:', error);
      }
    };

    fetchUserData();
  }, [organizationName]);

  const handleExitOrganization = async () => {
    try {
      if (userId && organizationName) {
        const orgDocRef = doc(firestore, 'organizations', organizationName);
        const orgDoc = await getDoc(orgDocRef);

        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          const updatedMembers = orgData.members.filter((member: any) => member.id !== userId);

          await updateDoc(orgDocRef, {
            members: updatedMembers,
          });

          console.log(`User ${userId} removed from ${organizationName}`);
          navigate('/'); // Redirect to home or another page after leaving the organization
        } else {
          console.error('Organization data not found.');
        }
      }
    } catch (error) {
      console.error('Error removing user from organization:', error);
    }
  };

  return (
    <div>
      <Header />
      {userRole === "president" ? <StudentPresidentSidebar /> : <StudentMemberSidebar />}
      <div className="content">
        <h1>LEAVE SAMPLE ORGANIZATION?</h1>
        <p>Exiting this tutorial organization will remove you from Sample Organization. Are you sure?</p>

        <button onClick={handleExitOrganization}>Leave</button>
      </div>
    </div>
  );
};

export default LeaveSample;