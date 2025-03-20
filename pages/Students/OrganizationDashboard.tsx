import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, firestore } from '../../services/firebaseConfig';
import { faSync,faUser,faFileAlt, faFilePdf, faFileWord, faFilePowerpoint, faFileExcel   } from '@fortawesome/free-solid-svg-icons';
import { doc, getDoc, collection, getDocs,query,where } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import StudentPresidentSidebar from './StudentPresidentSidebar';
import StudentMemberSidebar from './StudentMemberSidebar';
import '../../styles/OrganizationDashboard.css';

interface Announcement {
  id: string;
  subject: string;
  message: string;
  timestamp: {
    seconds: number;
  };
  fileUrl?: string;
  fileName?: string;
  senderName?: string; // Add this
  senderProfilePic?: string; // Add this
  organizationNameAnnouncement?: string; // Add this
}
interface Task {
  id: string;
  title: string;
  dueDate: string;
  taskStatus: string;
  assignedCommittees: string[];
  assignedMembers: string[];
  assignedTo: string[];
}

interface Announcement {
  id: string;
  subject: string;
  timestamp: {
    seconds: number;
  };
}

const OrganizationDashboard: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // Store user ID
  const navigate = useNavigate();
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAnnouncementDetails, setSelectedAnnouncementDetails] = useState<Announcement | null>(null);
  const limitedTasks = tasks.slice(0, 3);
  const limitedEvents = events.slice(0, 3);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});


  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        // Dynamically fetch events from Firestore for the current organization
        const eventsCollectionRef = collection(firestore, `events/${organizationName}/event`);
        const eventsSnapshot = await getDocs(eventsCollectionRef);
        
        // Extract event data and filter for upcoming events
        const currentDate = new Date();
        const upcomingEvents = eventsSnapshot.docs
          .map(doc => doc.data())
          .filter((event: any) => {
            // Check if event has a startDate and if it is in the future
            return event.eventDates && event.eventDates.some((date: any) => new Date(date.startDate) > currentDate);
          });
        
        setEvents(upcomingEvents);
      } catch (error) {
        console.error('Error fetching upcoming events:', error);
      }
    };

    if (organizationName) {
      fetchUpcomingEvents();
    }
  }, [organizationName]);
  // Fetch Organization Data and User Role
  useEffect(() => {
    const fetchOrganizationData = async () => {
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
            setOrganizationData(orgData);
  
            // Determine the role of the logged-in user
            if (orgData.president?.id === user.uid) {
              setUserRole('president');
            } else if (orgData.officers?.some((officer: any) => officer.id === user.uid)) {
              setUserRole('officer');
            } else if (orgData.members?.some((member: any) => member.id === user.uid)) {
              setUserRole('member');
            } else if (orgData.facultyAdviser?.id === user.uid) {
              setUserRole('faculty');
            } else {
              setUserRole(null);
            }
  
            if (organizationName) {
              navigate(`/Organization/${organizationName}/dashboard`);
            }
          } else {
            console.error('Organization data not found.');
          }
        }
      } catch (error) {
        console.error('Error fetching organization or user data:', error);
      }
    };
  
    fetchOrganizationData();
  }, [organizationName, navigate]);

  // Fetch Tasks for the Organization and filter by assignedTo, assignedCommittees, and assignedMembers
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        if (!organizationName || !userId || !organizationData) return;  // Ensure orgData is loaded
  
 
  
        const tasksCollectionRef = collection(firestore, `tasks/${organizationName}/AllTasks`);
        const snapshot = await getDocs(tasksCollectionRef);
  
        const fetchedTasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Task[];
  
        // Filter tasks based on the user’s role and assigned members/committees
        const filteredTasks = fetchedTasks.filter(task => {
          // Check if the user is assigned to this task
          return (
            task.assignedTo.includes(userId) || 
            task.assignedCommittees.some((committee: string) => organizationData?.committees?.includes(committee)) || 
            task.assignedMembers.includes(userId)
          );
        });
  
        // Filter incomplete tasks and tasks that are not overdue
        const currentDate = new Date();
        const incompleteTasks = filteredTasks
          .filter(task => task.taskStatus !== "Completed")
          .filter(task => new Date(task.dueDate) >= currentDate); // Exclude overdue tasks
  
        // Sort tasks by dueDate in descending order (newest tasks first)
        const sortedTasks = incompleteTasks.sort((a, b) => {
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          return dateB - dateA; // Sort in descending order
        });
  
        setTasks(sortedTasks);
      
      } catch (error) {
        console.error("Error fetching tasks:", error);
   
      }
    };
  
    if (organizationName && userId && organizationData) {
      fetchTasks();
    }
  }, [organizationName, userId, organizationData]);
  

  // Fetch Announcements for the Organization
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        if (!organizationName) return;

     
        const orgNotificationsRef = doc(firestore, "notifications", organizationName);
        const subCollectionRef = collection(orgNotificationsRef, "organizationAnnouncements");

        const snapshot = await getDocs(subCollectionRef);

        const fetchedAnnouncements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Announcement[];

        const sortedAnnouncements = fetchedAnnouncements.sort((a, b) => {
          const dateA = new Date(a.timestamp.seconds * 1000).getTime();
          const dateB = new Date(b.timestamp.seconds * 1000).getTime();
          return dateB - dateA;
        });

        const latestAnnouncements = sortedAnnouncements.slice(0, 3);

        setAnnouncements(latestAnnouncements);
   
      } catch (error) {
        console.error("Error fetching announcements:", error);
  
      }
    };

    if (organizationName) {
      fetchAnnouncements();
    }
  }, [organizationName]);

 
  const openDetailsModal = (announcement: Announcement) => {
    setSelectedAnnouncementDetails(announcement);
    setIsDetailsModalOpen(true);
  };
  
  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedAnnouncementDetails(null);
  };
  

  let SidebarComponent = null;
  if (userRole === 'president') {
    SidebarComponent = <StudentPresidentSidebar />;
  } else if (userRole === 'officer') {
    SidebarComponent = <StudentPresidentSidebar />;
  } else if (userRole === 'faculty') { // Faculty uses the same sidebar as president
    SidebarComponent = <StudentPresidentSidebar />;
  } else if (userRole === 'member') {
    SidebarComponent = <StudentMemberSidebar />;
  }
  

  return (
    <div className="organization-announcements-page">
      <Header />

      <div className="organization-announcements-container">
        <div className="sidebar-section">{SidebarComponent}</div>



        <div className="organization-announcements-content">
  <div className="header-container">
  <h1 className="headtitle">Dashboard</h1>
</div>
<div className="dashboard-container">
  {/* Background Image Section */}
  <div className="dashboard-background-image-container">
  <div
    className="dashboard-org-cover"
    style={{
      backgroundImage: `url(${organizationData?.coverImagePath || '/default-background.jpg'})`,
      backgroundColor: '#f0f0f0', // Optional: Add a background color as a fallback
    }}
  ></div>

  {/* Profile Info Section */}
  <div className="dashboard-org-profile-container">
    {organizationData?.profileImagePath ? (
      <img
        src={organizationData.profileImagePath}
        alt="Profile"
        className="dashboard-org-profile"
        onError={(e) => {
          // Fallback to plain gray if the image fails to load
          e.currentTarget.src = '/default-profile.jpg';
        }}
      />
    ) : (
      <div
        className="dashboard-org-profile"
        style={{ backgroundColor: 'rgba(204,204,204,255)' }}
      ></div>
    )}

    {/* Organization Name */}
    <div className="dashboard-organization-name">
      <h1>{organizationData?.name}</h1>
    </div>
  </div>

  <p>{organizationData?.description}</p>
</div>

    {/* Right Section for To-do, Announcements, and Events */}
    <div className="dashboard-right-section">
      {/* To-do Box */}
      <div className="todo-box">
  <h4>To-do</h4>
  <ul>
    {limitedTasks.length > 0 ? (
      limitedTasks.map((task, index) => (
        <li
          key={index}
          className="todo-item"
          onClick={() => navigate(`/Organization/${organizationName}/mytasks`)} // Add onClick handler
        >
          <strong>{task.title}</strong>
        </li>
      ))
    ) : (
      <p>No to-dos available.</p>
    )}
  </ul>
  {tasks.length > 3 && (
    <Link
      to={`/organization/${organizationName}/mytasks`}
      className="view-all-link"
    >
      View All Tasks
    </Link>
  )}
</div>





      {isDetailsModalOpen && selectedAnnouncementDetails && (
  <div className="notification-modal-overlay">
    <div className="notification-modal-content">
      <span className="notification-modal-close" onClick={closeDetailsModal}>&times;</span>

      <div className="notification-modal-sender">
  <div className="profile">
    {selectedAnnouncementDetails.senderProfilePic && !imageErrors[selectedAnnouncementDetails.senderProfilePic] ? (
      <img
        src={selectedAnnouncementDetails.senderProfilePic}
        alt="Sender"
        className="notification-modal-profile-pic"
        onError={() => {
          if (selectedAnnouncementDetails.senderProfilePic) {
            setImageErrors((prev) => ({
              ...prev,
              [String(selectedAnnouncementDetails.senderProfilePic)]: true,
            }));
          }
        }}
         // Track error for this specific image
      />
    ) : (
      <div className="org-profile-icon-placeholder">
        <FontAwesomeIcon icon={faUser} className="profile-placeholder-icon" />
      </div>
    )}
  </div>
  <div className="orgy-announcy-sender-info">
    <strong>{selectedAnnouncementDetails.senderName || "Unknown Sender"}</strong>
    {selectedAnnouncementDetails.organizationNameAnnouncement && (
      <span className="notification-modal-organization">
        via {selectedAnnouncementDetails.organizationNameAnnouncement}
      </span>
    )}
  </div>
</div>
      {/* Announcement Date and Time */}
      <p className="orgy-announcy-timestamp">
        {new Date(selectedAnnouncementDetails.timestamp.seconds * 1000).toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true,
        })}
      </p>

      {/* Announcement Subject */}
      <h2 className="orgy-announcy-subject">{selectedAnnouncementDetails.subject}</h2>

      {/* Announcement Message */}
      <div className="orgy-announcy-message" style={{ whiteSpace: 'pre-wrap' }}>
        {selectedAnnouncementDetails.message}
      </div>

      {/* Display Attached File */}
      {selectedAnnouncementDetails.fileUrl && (
        <div className="orgy-announcy-file-container">
          <FontAwesomeIcon
            icon={
              selectedAnnouncementDetails.fileName?.endsWith('.pdf') ? faFilePdf :
              selectedAnnouncementDetails.fileName?.endsWith('.doc') || selectedAnnouncementDetails.fileName?.endsWith('.docx') ? faFileWord :
              selectedAnnouncementDetails.fileName?.endsWith('.ppt') || selectedAnnouncementDetails.fileName?.endsWith('.pptx') ? faFilePowerpoint :
              selectedAnnouncementDetails.fileName?.endsWith('.xls') || selectedAnnouncementDetails.fileName?.endsWith('.xlsx') ? faFileExcel :
              faFileAlt
            }
            className={
              selectedAnnouncementDetails.fileName?.endsWith('.pdf') ? 'pdf-icon' :
              selectedAnnouncementDetails.fileName?.endsWith('.doc') || selectedAnnouncementDetails.fileName?.endsWith('.docx') ? 'word-icon' :
              selectedAnnouncementDetails.fileName?.endsWith('.ppt') || selectedAnnouncementDetails.fileName?.endsWith('.pptx') ? 'powerpoint-icon' :
              selectedAnnouncementDetails.fileName?.endsWith('.xls') || selectedAnnouncementDetails.fileName?.endsWith('.xlsx') ? 'excel-icon' :
              'file-icon'
            }
          />
          <a
            href={selectedAnnouncementDetails.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="orgy-announcy-file-link"
          >
            {selectedAnnouncementDetails.fileName}
          </a>
        </div>
      )}
    </div>
  </div>
)}






















      {/* Announcements Box */}
      <div className="announcements-box">
  <h4>Latest Announcements</h4>
  <ul>
    {announcements.length > 0 ? (
      announcements.map((announcement) => (
        <li
          key={announcement.id}
          className="announcement-item-box"
          onClick={() => openDetailsModal(announcement)} // Open modal on click
        >
          <strong>{announcement.subject}</strong>
        </li>
      ))
    ) : (
      <p>No announcements available.</p>
    )}
  </ul>
</div>

      <div className="upcoming-events-box">
    <h4>Upcoming Events</h4>
    <ul>
      {limitedEvents.length > 0 ? (
        limitedEvents.map((event, index) => (
          <li key={index} className="wadapman">
            <Link
              to={`/organization/${organizationName}/events/${event.title}`}
              className="clickable-box"
            >
              <span>{event.title}</span>
            </Link>
          </li>
        ))
      ) : (
        <p>No upcoming events.</p>
      )}
    </ul>
    {events.length > 3 && (
      <Link
        to={`/organization/${organizationName}/events`}
        className="view-all-link"
      >
        View All Events
      </Link>
    )}
  </div>


  </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationDashboard;
