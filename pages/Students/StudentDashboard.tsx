import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs,query,where } from 'firebase/firestore';
import { auth, firestore } from '../../services/firebaseConfig';
import '../../styles/StudentDashboard.css';
import Header from '../../components/Header';

import { showToast } from '../../components/toast';

interface Member {
  id: string;
}

interface Officer {
  role: string;
  id: string;
}

interface President {
  id: string;
}

interface Organization {
  name: string;
  description: string;
  head: string;
  members: Member[];
  officers: Officer[];
  president: President;
  facultyAdviser?: { id: string };
  department: string;
  status: string;
  coverImagePath?: string;
  profileImagePath?: string;
}

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Query the students collection for a document with the matching userId
          const studentsRef = collection(firestore, 'students');
          const studentQuery = query(studentsRef, where('userId', '==', user.uid));
          const studentSnapshot = await getDocs(studentQuery);
  
          let userData;
  
          if (!studentSnapshot.empty) {
            // If a student document is found, use its data
            const studentDoc = studentSnapshot.docs[0];
            userData = studentDoc.data();
            console.log("Student Data:", userData);
          } else {
            // If no student document is found, query the faculty collection
            const facultyRef = collection(firestore, 'faculty');
            const facultyQuery = query(facultyRef, where('userId', '==', user.uid));
            const facultySnapshot = await getDocs(facultyQuery);
  
            if (!facultySnapshot.empty) {
              // If a faculty document is found, use its data
              const facultyDoc = facultySnapshot.docs[0];
              userData = facultyDoc.data();
              console.log("Faculty Data:", userData);
            } else {
              // If no document is found in either collection, set an error
              setError('No data found for this user.');
              return;
            }
          }
  
          // Set the user data in state
          setStudentData(userData);
  
          // Fetch organizations where the user is a member, president, officer, or faculty adviser
          const organizationsRef = collection(firestore, 'organizations');
          const organizationsDocs = await getDocs(organizationsRef);
  
          const orgList: Organization[] = [];
  
          organizationsDocs.forEach((orgDoc) => {
            const orgData = orgDoc.data() as Organization;
            console.log("Organization Data:", orgData);
  
            const isMember = orgData.members?.some((member) => member.id === user.uid);
            const isPresident = orgData.president.id === user.uid;
            const isOfficer = orgData.officers?.some((officer) => officer.id === user.uid);
            const isFacultyAdviser = orgData.facultyAdviser?.id === user.uid;
  
            console.log(
              `Checking org: ${orgData.name} - Member: ${isMember}, President: ${isPresident}, Officer: ${isOfficer}, Faculty Adviser: ${isFacultyAdviser}`
            );
  
            if (isMember || isPresident || isOfficer || isFacultyAdviser) {
              orgList.push(orgData);
            }
          });
  
          console.log("Filtered Organization List:", orgList);
  
          // Sort organizations by status (archived last)
          const sortedOrganizations = orgList.sort((a, b) => {
            if (a.status === 'archived' && b.status !== 'archived') return 1;
            if (a.status !== 'archived' && b.status === 'archived') return -1;
            return 0;
          });
  
          setOrganizations(sortedOrganizations);
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Error fetching user data.');
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/login');
      }
    });
  
    // Cleanup the subscription on unmount
    return () => unsubscribe();
  }, [navigate]);
  

  const handleOrganizationClick = (organization: Organization) => {
    if (organization.status === 'archived') {

      showToast('This organization is not available as it has been archived.', "error");
    } else {
      navigate(`/Organization/${organization.name}/dashboard`);
    }
  };


  const truncateText = (text: string, maxLength: number) => {
    if (text.length > maxLength) {
      return text.slice(0, maxLength) + '...';
    }
    return text;
  };
  return (
    <div className="dashboard-wrapper">
      <Header />

      <div className="my-dashboard-container">
        <div className="organizations-section">
        <div className="header-container">
        <h1 className="headtitle">Your Organizations</h1>
        </div>
          {organizations.length > 0 ? (
            <div className="organization-list">
              {organizations.map((org) => (
                <div
                  key={org.name}
                  className={`organization-card ${org.status === 'archived' ? 'organization-card-archived' : ''}`}
                  onClick={() => handleOrganizationClick(org)}
                >
                 <div className="organization-card-image">
  {/* Cover Photo */}
  {org.coverImagePath ? (
    <img
      src={org.coverImagePath}
      alt={`${org.name} Cover`}
      className="organization-cover-image"
    />
  ) : (
    <div className="organization-placeholder"></div> // Just a gray placeholder
  )}

  {/* Profile Picture */}
  <div className="organization-profile-pic">
    {org.profileImagePath ? (
      <img
        src={org.profileImagePath}
        alt={`${org.name} Profile`}
        className="organization-profile-image"
      />
    ) : (
      <div className="profile-organization-placeholder"></div> // Another gray placeholder
    )}
  </div>
</div>


                  <div className="organization-card-details">
                    <h4>{org.name}</h4>
                    {org.status === 'archived' ? (
                      <p className="organization-archived-message">
                        This organization is no longer available.
                      </p>
                    ) : (
                      <>
                       <p>{truncateText(org.description, 80)}</p>
                        <p className="org-department">{org.department}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>You are not a part of any student organizations.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
