import React, { useState, useEffect,useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, storage, firestore } from '../services/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import '../styles/Header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faEnvelope,faFilePdf,faFileWord,faFilePowerpoint,faFileExcel,faFileAlt,faUser } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';
import { collection, updateDoc, doc, onSnapshot,getDoc,setDoc,writeBatch, arrayRemove,query,where,getDocs } from 'firebase/firestore';
import { showToast } from '../components/toast';

function formatMessageWithLinks(message: string): JSX.Element {
  // If message is undefined or null, return an empty span or fallback message
  if (!message) {
    return <span></span>;  // Or return nothing (empty <></>)
  }

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[a-z]{2,})/gi;
  const parts = message.split(urlRegex);

  return (
    <>
      {parts.map((part, index) =>
        urlRegex.test(part) ? (
          <a
            key={index}
            href={part.startsWith("http") ? part : `https://${part}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'blue', textDecoration: 'underline' }}
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}


const getFileIcon = (fileName: string) => {
  if (fileName.endsWith('.pdf')) return faFilePdf;
  if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return faFileWord;
  if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) return faFilePowerpoint;
  if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return faFileExcel;
  return faFileAlt;
};

const getFileIconClass = (fileName: string) => {
  if (fileName.endsWith('.pdf')) return 'pdf-icon';
  if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return 'word-icon';
  if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) return 'powerpoint-icon';
  if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return 'excel-icon';
  return 'file-icon';
};

const Header: React.FC = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
const [selectedNotification, setSelectedNotification] = useState<any>(null);
const [userName, setUserName] = useState<string>('');
const [isImageError, setIsImageError] = useState(false);
const [notificationButtonClicked, setNotificationButtonClicked] = useState(false);


  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Fetch student data where userID matches the user.uid
          const studentsRef = collection(firestore, 'students');
          const studentQuery = query(studentsRef, where('userId', '==', user.uid));
          const studentSnapshot = await getDocs(studentQuery);
  
          if (!studentSnapshot.empty) {
            const studentDoc = studentSnapshot.docs[0]; // Assuming only one document matches
            const studentData = studentDoc.data();
            const fullName = `${studentData.firstname} ${studentData.lastname}`;
            const profilePicRef = ref(storage, `profilePics/${user.uid}/profile-picture.jpg`);
            const profilePicUrl = await getDownloadURL(profilePicRef).catch(() => '/default-profile.png');
  
            setUserName(fullName);
            setProfilePicUrl(profilePicUrl);
            return;
          }
  
          // If not a student, fetch faculty data where userID matches the user.uid
          const facultyRef = collection(firestore, 'faculty');
          const facultyQuery = query(facultyRef, where('userId', '==', user.uid));
          const facultySnapshot = await getDocs(facultyQuery);
  
          if (!facultySnapshot.empty) {
            const facultyDoc = facultySnapshot.docs[0]; // Assuming only one document matches
            const facultyData = facultyDoc.data();
            const fullName = `${facultyData.firstname} ${facultyData.lastname}`;
            const profilePicRef = ref(storage, `profilePics/${user.uid}/profile-picture.jpg`);
            const profilePicUrl = await getDownloadURL(profilePicRef).catch(() => '/default-profile.png');
  
            setUserName(fullName);
            setProfilePicUrl(profilePicUrl);
            return;
          }
  
          // Default fallback if neither student nor faculty data is found
          setUserName('Unknown User');
          setProfilePicUrl('/default-profile.png');
        } catch (err) {
          console.error('Error fetching user data:', err);
          setUserName('Error fetching name');
          setProfilePicUrl('/default-profile.png');
        }
      } else {
        setUserName('');
        setProfilePicUrl('/default-profile.png');
      }
    });
  
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        if (!notificationButtonClicked) {
          setShowNotifications(false); // Close the notifications dropdown if clicked outside
        }
        setNotificationButtonClicked(false); // Reset the flag
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationButtonClicked]);
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const notificationsRef = collection(
          firestore,
          `notifications/${user.uid}/userNotifications`
        );
  
        const unsubscribeSnapshot = onSnapshot(notificationsRef, (snapshot) => {
          const fetchedNotifications = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            isRead: doc.data().isRead ?? false,
            timestamp: doc.data().timestamp || new Date(), // Ensure timestamp exists
          }));
  
          // Sort notifications by timestamp (newest first)
          const sortedNotifications = fetchedNotifications.sort(
            (a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)
          );
  
          setNotifications(sortedNotifications);
          setUnreadCount(sortedNotifications.filter((notif) => !notif.isRead).length);
        });
  
        return () => unsubscribeSnapshot(); // Cleanup listener on unmount
      }
    });
  
    return () => unsubscribe();
  }, []);
  
  const openNotificationModal = async (notif: any) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId || notif.isRead) {
        // If user is not logged in or notification is already read, skip updating
        setSelectedNotification(notif);
        setIsNotificationModalOpen(true);
        return;
      }
  
      // Mark the notification as read in Firestore
      const notifRef = doc(firestore, `notifications/${userId}/userNotifications`, notif.id);
      await updateDoc(notifRef, { isRead: true });
      console.log("Opening Notification: ", notif);
      // Update local state to reflect the change
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
  
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0)); // Decrement unread count
  
      // Open the modal with the selected notification
      setSelectedNotification(notif);
      setIsNotificationModalOpen(true);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };
  
  const closeNotificationModal = () => {
    setIsNotificationModalOpen(false);
    setSelectedNotification(null);
  };
  const openLogoutModal = () => {
    setIsLogoutModalOpen(true);
  };
  
  const closeLogoutModal = () => {
    setIsLogoutModalOpen(false);
  };
  
  const handleConfirmSignOut = async () => {
    try {
      await signOut(auth);
      console.log('User signed out');
    } catch (error) {
      console.error('Error signing out: ', error);
    } finally {
      setIsLogoutModalOpen(false);
    }
  };


  const handleAcceptInvite = async (notif: any) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const orgDocRef = doc(firestore, 'organizations', notif.organizationName);
    const orgDoc = await getDoc(orgDocRef);

    if (orgDoc.exists()) {
      const { members = [], invitedStudents = [], president, officers } = orgDoc.data();

      const studentDocRef = doc(firestore, 'students', userId);
      const studentDoc = await getDoc(studentDocRef);

      let studentName = 'Unknown';
      let studentProfilePicUrl = '/default-profile.png';

      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        studentName = `${studentData.firstname} ${studentData.lastname}`;
        studentProfilePicUrl = studentData.profilePicUrl || '/default-profile.png';
      }

      const newMember = {
        id: userId,
        name: studentName,
        email: auth.currentUser?.email || 'unknown@example.com',
        profilePicUrl: studentProfilePicUrl,
      };

      // Update members and remove from invitedStudents
      const updatedMembers = [...members, newMember];
      await updateDoc(orgDocRef, {
        members: updatedMembers,
        invitedStudents: arrayRemove(userId),
      });

      // Add activity log
      const activityLogRef = collection(
        firestore,
        `studentlogs/${notif.organizationName}/activitylogs`
      );
      await setDoc(doc(activityLogRef, uuidv4()), {
        description: `${studentName} has accepted the invite and joined the organization.`,
        timestamp: new Date(),
        profilePicture: studentProfilePicUrl,
        userName: studentName,
      });

      const subject = `${studentName} has accepted the invite and joined ${notif.organizationName}.`;

      // Prepare notification for president and officers
      const notificationsToSend = {
        subject,
        organizationName: notif.organizationName,
        timestamp: new Date(),
        isRead: false,
        status: 'new_member',
        type: 'general',
        senderProfilePic: studentProfilePicUrl,
        senderName: studentName,
      };

      // Send notifications to the president
      if (president) {
        const notifRef = doc(
          firestore,
          `notifications/${president.id}/userNotifications`,
          notif.id
        );
        await setDoc(notifRef, { ...notificationsToSend, recipient: 'President' });
      }

      // Send notifications to each officer
      for (const officer of officers) {
        const notifRef = doc(
          firestore,
          `notifications/${officer.id}/userNotifications`,
          notif.id
        );
        await setDoc(notifRef, { ...notificationsToSend, recipient: officer.role });
      }

      // Update original notification to 'accepted'
      const notifRef = doc(
        firestore,
        `notifications/${userId}/userNotifications`,
        notif.id
      );
      await updateDoc(notifRef, { status: 'accepted', isRead: true });

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, status: 'accepted' } : n
        )
      );


      showToast("You have successfully joined the organization.", "success");
      window.location.reload();
    }
  } catch (error) {
    console.error('Error accepting invite:', error);
  }
};

  
  const handleDeclineInvite = async (notif: any) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
  
      const orgDocRef = doc(firestore, 'organizations', notif.organizationName);
      const orgDoc = await getDoc(orgDocRef);
  
      if (orgDoc.exists()) {
        const { president, officers } = orgDoc.data();
  
        // Fetch student data to use in the notification and activity log
        const studentDocRef = doc(firestore, 'students', userId);
        const studentDoc = await getDoc(studentDocRef);
  
        let studentName = 'Unknown';
        let studentProfilePicUrl = '/default-profile.png';
  
        if (studentDoc.exists()) {
          const studentData = studentDoc.data();
          studentName = `${studentData.firstname} ${studentData.lastname}`;
          studentProfilePicUrl = studentData.profilePicUrl || '/default-profile.png';
        }
  
        const subject = `${studentName} has declined the invite to join ${notif.organizationName}.`;
  
        // Prepare notifications for president and officers
        const notificationsToSend = {
          subject,
          organizationName: notif.organizationName,
          timestamp: new Date(),
          isRead: false,
          status: 'invite_declined',
          type: 'general',
          senderProfilePic: studentProfilePicUrl,
          senderName: studentName,
        };
  
        // Notify president
        if (president) {
          const notifRef = doc(
            firestore,
            `notifications/${president.id}/userNotifications`,
            uuidv4()
          );
          await setDoc(notifRef, { ...notificationsToSend, recipient: 'President' });
        }
  
        // Notify each officer
        for (const officer of officers) {
          const notifRef = doc(
            firestore,
            `notifications/${officer.id}/userNotifications`,
            uuidv4()
          );
          await setDoc(notifRef, { ...notificationsToSend, recipient: officer.role });
        }
  
        // Remove the user from the invitedStudents list
        await updateDoc(orgDocRef, {
          invitedStudents: arrayRemove(userId),
        });
  
        // Add activity log
        const activityLogRef = collection(
          firestore,
          `studentlogs/${notif.organizationName}/activitylogs`
        );
        await setDoc(doc(activityLogRef, uuidv4()), {
          description: `${studentName} has declined the invite to join the organization.`,
          timestamp: new Date(),
          profilePicture: studentProfilePicUrl,
          userName: studentName,
        });
  
        // Update the original notification to 'declined'
        const notifRef = doc(
          firestore,
          `notifications/${userId}/userNotifications`,
          notif.id
        );
        await updateDoc(notifRef, { status: 'declined', isRead: true });
  
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, status: 'declined' } : n
          )
        );
  

      }
    } catch (error) {
      console.error('Error declining invite:', error);
    }
  };
  
  
  
  const toggleDropdown = () => {
    setShowDropdown((prev) => !prev);
  };

  const toggleNotifications = () => {
    setNotificationButtonClicked(true);
    setShowNotifications((prev) => !prev);
  };


  const handleProfileVisit = () => {
    navigate('/myprofile');
  };

  const handleNavigateToMessages = () => {
    navigate('/messages');
  };



  const markAllAsRead = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
  
      const batch = writeBatch(firestore); // Create a batch operation
  
      notifications.forEach((notif) => {
        const notifRef = doc(firestore, `notifications/${userId}/userNotifications`, notif.id);
        batch.update(notifRef, { isRead: true });
      });
  
      await batch.commit(); // Commit the batch
  
      // Update local state to reflect that all notifications are read
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0); // Reset unread count
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };
  

  const deleteAllNotifications = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
  
      const batch = writeBatch(firestore); // Create a batch operation
  
      notifications.forEach((notif) => {
        const notifRef = doc(firestore, `notifications/${userId}/userNotifications`, notif.id);
        batch.delete(notifRef);
      });
  
      await batch.commit(); // Commit the batch
  
      // Clear notifications from local state
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  const renderNotificationButton = () => {
    return unreadCount > 0 ? (
      <button className="notification-action-btn" onClick={markAllAsRead}>
      {unreadCount > 0 ? 'Mark All as Read' : 'All Notifications Read'}
    </button>
    ) : (
      <button className="notification-action-btn" onClick={deleteAllNotifications}>
        Delete All
      </button>
    );
  };

  return (
    <div className="header">
      <div className="header-left">
        <div className="logo" onClick={() => navigate('/dashboard')}>
          GreenPulse
        </div>
      </div>
      <div className="header-right">

        {/* Mobile Menu Button */}
<div className="mobile-menu-btn" onClick={() => setShowDropdown(!showDropdown)}>
  ☰
</div>

     
      <div className="icon notification-icon" onClick={toggleNotifications}>
  <FontAwesomeIcon icon={faBell} />
  {unreadCount > 0 && (
    <span className="notification-badge">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  )}
</div>


        {showNotifications && (
          <div className="notifications-dropdown" ref={notificationRef}>


        <ul className="notification-list">
  {notifications.length > 0 ? (
    notifications.map((notif) => (
      <li
        key={notif.id}
        className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
        onClick={() => openNotificationModal(notif)} // Open modal on click
      >
        <div className="notification-content">
          <div className="notification-header">
          <div className="notification-avatar">
  {notif.senderProfilePic ? (
    <img
      src={notif.senderProfilePic}
      alt="Profile"
      className="notification-profile-pic"
      onError={(e) => {
        e.currentTarget.src = ""; // Clear the broken image
        e.currentTarget.style.display = "none"; // Hide the broken image
        // Show the placeholder when the image fails to load
        const placeholder = e.currentTarget.nextElementSibling;
        if (placeholder) {
          placeholder.classList.remove("hidden");
        }
      }}
    />
  ) : null} {/* Don't render anything if senderProfilePic is null */}

  {/* Render the placeholder only if there's no image or if the image fails to load */}
  <div className={`notification-avatar-placeholder ${notif.senderProfilePic ? "hidden" : ""}`}>
    <FontAwesomeIcon icon={faUser} className="notification-placeholder-icon" />
  </div>
</div>
            {/* Notification Text */}
            <div className="notification-text">
              <p className="notification-title">
                <strong>{notif.senderName} :</strong>
              </p>
              {notif.subject}
              <span className="notification-timestamp">
                {new Date(notif.timestamp?.toDate()).toLocaleString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true,
                })}
              </span>
            </div>

            {/* Optional Actions */}
            {notif.type === 'invite' && notif.status === 'pending' && (
              <div className="notification-actions">
                <button
                  className="accept-btn"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening modal
                    handleAcceptInvite(notif);
                  }}
                >
                  Accept
                </button>
                <button
                  className="deny-btn"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening modal
                    handleDeclineInvite(notif);
                  }}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      </li>
    ))
  ) : (
    <li className="no-notifications">No notifications available.</li>
  )}
</ul>


{/* Notification Detail Modal */}
{isNotificationModalOpen && selectedNotification && (
  <div className="notification-modal-overlay">
    <div className="notification-modal-content">
      <span className="notification-modal-close" onClick={closeNotificationModal}>
        &times;
      </span>
{/* Sender Information */}
<div className="notification-modal-sender">
  <div className="notification-sender-avatar">
    {selectedNotification.senderProfilePic ? (
      <img
        src={selectedNotification.senderProfilePic}
        alt="Sender"
        className="notification-modal-profile-pic"
        onError={(e) => {
          e.currentTarget.src = ""; // Clear the broken image
          e.currentTarget.style.display = "none"; // Hide the broken image
          // Show the placeholder when the image fails to load
          const placeholder = e.currentTarget.nextElementSibling;
          if (placeholder) {
            placeholder.classList.remove("hidden");
          }
        }}
      />
    ) : null} {/* Don't render anything if senderProfilePic is null */}

    {/* Always render the placeholder */}
    <div className={`notification-sender-placeholder ${selectedNotification.senderProfilePic ? "hidden" : ""}`}>
      <FontAwesomeIcon icon={faUser} className="notification-placeholder-icon" />
    </div>
  </div>

  <div className="notification-modal-sender-info">
    <span className="notification-modal-sender-name">
      {selectedNotification.senderName || 'Unknown Sender'}
    </span>

    {/* Organization name appears right below sender's name */}
    {selectedNotification.organizationNameAnnouncement && (
      <span className="notification-modal-organization">
        via {selectedNotification.organizationNameAnnouncement}
      </span>
    )}
  </div>
</div>


      <p className="notification-modal-timestamp">
        {new Date(selectedNotification.timestamp?.toDate()).toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true,
        })}
      </p>
      <h2 className="notification-modal-header">{selectedNotification.subject}</h2>

      <div className="notification-modal-body">
  {formatMessageWithLinks(selectedNotification.message)}
</div>

      

   {/* Show attached file if available */}
   {selectedNotification.fileUrl && (
  <>
    {/* For Image Attachments */}
    {selectedNotification.isImage && (
      <div className="notification-modal-image-container">
        <img
          src={selectedNotification.fileUrl}
          alt="Attached Image"
          className="notification-modal-image"
        />
      </div>
    )}

    {/* For Video Attachments */}
    {selectedNotification.isVideo && (
      <div className="notification-modal-video-container">
        <video
          src={selectedNotification.fileUrl}
          controls
          className="notification-modal-video"
        />
      </div>
    )}

    {/* For Other File Types */}
    {!selectedNotification.isImage && !selectedNotification.isVideo && (
      <div className="notification-modal-file-container">
        <FontAwesomeIcon
          icon={getFileIcon(selectedNotification.fileName)}
          className={`notification-modal-file-icon ${getFileIconClass(selectedNotification.fileName)}`}
        />
        <a
          href={selectedNotification.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="notification-modal-file-link"
        >
          {selectedNotification.fileName}
        </a>
      </div>
    )}
  </>
)}


      {/* Optional Actions for invites */}
      {selectedNotification.type === 'invite' && selectedNotification.status === 'pending' && (
        <div className="notification-modal-actions">
          <button
            className="notification-modal-btn accept"
            onClick={() => handleAcceptInvite(selectedNotification)}
          >
            Accept
          </button>
          <button
            className="notification-modal-btn decline"
            onClick={() => handleDeclineInvite(selectedNotification)}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  </div>
)}

<div className="notification-button-container">
            {renderNotificationButton()}
            </div>
          </div>
        )}


<span className="profile-nameko">{userName}</span> 
<div className="profile" onClick={toggleDropdown}>
  {(profilePicUrl && !isImageError) ? (
    <img
      src={profilePicUrl}
      alt="Profile"
      className="profile-icon"
      onError={() => setIsImageError(true)} // Show placeholder on error
    />
  ) : (
    <div className="profile-icon-placeholder">
      <FontAwesomeIcon icon={faUser} className="profile-placeholder-icon" />
    </div>
  )}
</div>

          
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
        {showDropdown && (
  <div className={`header-dropdown ${showDropdown ? 'show' : ''}`} onMouseLeave={() => setShowDropdown(false)}>
    <ul>
      <li onClick={handleProfileVisit}>Visit Profile</li>
      <li onClick={openLogoutModal}>Logout</li>
    </ul>
  </div>
)}

        </div>
      </div>
   
  );
};

export default Header;
