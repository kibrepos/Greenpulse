import React, { useState, useEffect } from "react";
import { firestore } from "../../services/firebaseConfig";
import { collection, addDoc, getDocs, doc, where, setDoc,Timestamp,DocumentData,query, orderBy,deleteDoc, startAfter, limit,getCountFromServer  } from "firebase/firestore";
import AdminSidebar from './AdminSidebar';
import { auth } from "../../services/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL, } from "firebase/storage";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash,faSync,faFilePdf, faFileWord, faFilePowerpoint, faFileExcel, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import '../../styles/AdminAnnouncements.css';
import ReactPaginate from 'react-paginate';
import Swal from "sweetalert2";

const AdminAnnouncements: React.FC = () => {
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementSubject, setAnnouncementSubject] = useState("");
  const [audience, setAudience] = useState("everyone");
  const [announcements, setAnnouncements] = useState<any[]>([]);;
  const [image, setImage] = useState<File | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);
  const [filterSearchInput, setFilterSearchInput] = useState("");
const [filterSelectedDate, setFilterSelectedDate] = useState<string>("");
const [filterAudience, setFilterAudience] = useState("everyone");
const [filterSortBy, setFilterSortBy] = useState("desc");
const [allAnnouncements, setAllAnnouncements] = useState<any[]>([]); 
const [filteredAnnouncements, setFilteredAnnouncements] = useState<any[]>([]); 
const [lastLoadedIndex, setLastLoadedIndex] = useState(10); 
const [selectedAnnouncements, setSelectedAnnouncements] = useState<string[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [currentPage, setCurrentPage] = useState<number>(0);
const [pageCount, setPageCount] = useState<number>(0);
const itemsPerPage = 20; // Number of items per page

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

  const storage = getStorage();



  useEffect(() => {
    const fetchTotalDocumentCount = async () => {
      try {
        const announcementsCollection = collection(firestore, "notifications");
        const snapshot = await getCountFromServer(announcementsCollection);
        setPageCount(Math.ceil(snapshot.data().count / itemsPerPage));
      } catch (error) {
        console.error("Error fetching count:", error);
      }
    };
  
    fetchTotalDocumentCount();
  }, []);

  
  useEffect(() => {
    fetchSenderInfo();
    fetchAnnouncements();
  }, []);

  const fetchSenderInfo = async () => {
    const user = auth.currentUser;
    if (user) {
      const adminQuery = query(collection(firestore, "admin"), where("userID", "==", user.uid));
      const querySnapshot = await getDocs(adminQuery);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        return {
          senderName: `${userData.firstName} ${userData.lastName}`,
          senderProfilePic: userData.profilePicUrl || null,
        };
      }
      
    }
    return { senderName: "Unknown User", senderProfilePic: null };
  };
  
  

  const handleApplyFilters = () => {
    filterAnnouncements();
    setCurrentPage(0); // Reset to the first page when filters are applied
  };
  
  const filterAnnouncements = () => {
    let filtered = [...allAnnouncements];
  
    // Apply search filter
    if (filterSearchInput.trim()) {
      filtered = filtered.filter(
        (announcement) =>
          (announcement.subject && announcement.subject.toLowerCase().includes(filterSearchInput.toLowerCase())) ||
        (announcement.message && announcement.message.toLowerCase().includes(filterSearchInput.toLowerCase())) ||
        (announcement.senderName && announcement.senderName.toLowerCase().includes(filterSearchInput.toLowerCase()))
      );
    }
  
    // Apply audience filter
    if (filterAudience !== "everyone") {
      filtered = filtered.filter((announcement) => announcement.audience === filterAudience);
    }
  
    // Apply date filter
    if (filterSelectedDate) {
      filtered = filtered.filter((announcement) => {
        const announcementDate = new Date(announcement.timestamp);
        const filterDate = new Date(filterSelectedDate);
        return announcementDate.toDateString() === filterDate.toDateString();
      });
    }
  
    // Sort the filtered announcements
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return filterSortBy === "asc" ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });
  
    setFilteredAnnouncements(filtered);
    setAnnouncements(filtered.slice(0, 10)); // Display only first 10 after filtering
    setLastLoadedIndex(10); // Reset pagination index
  };

  const handleResetFilters = () => {
    setFilterSearchInput("");
    setFilterSelectedDate("");
    setFilterAudience("everyone");
    setFilterSortBy("desc");
  
    setFilteredAnnouncements(allAnnouncements);
    setCurrentPage(0); // Reset to the first page
    setAnnouncements(allAnnouncements.slice(0, itemsPerPage)); // Show the first page of unfiltered announcements
  };
  
  const fetchAnnouncements = async () => {
    const announcementCollection = collection(firestore, "notifications");
    const announcementsQuery = query(announcementCollection, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(announcementsQuery);
  
    const announcementList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || null,
      audience: doc.data().audience || "everyone",
    }));
  
    setAllAnnouncements(announcementList);
    setFilteredAnnouncements(announcementList);
    setPageCount(Math.ceil(announcementList.length / itemsPerPage)); // Calculate page count
    setAnnouncements(announcementList.slice(0, itemsPerPage)); // Initially show only the first page
  };
  const handlePageClick = async (selectedPage: { selected: number }) => {
    setCurrentPage(selectedPage.selected);
    const offset = selectedPage.selected * itemsPerPage;
    const newAnnouncements = filteredAnnouncements.slice(offset, offset + itemsPerPage);
    setAnnouncements(newAnnouncements);
  };
  const handleSelectAnnouncement = (announcementId: string) => {
    if (selectedAnnouncements.includes(announcementId)) {
      setSelectedAnnouncements(
        selectedAnnouncements.filter((id) => id !== announcementId)
      );
    } else {
      setSelectedAnnouncements([...selectedAnnouncements, announcementId]);
    }
  };
  
  const handleDeleteSelected = async () => {
    if (selectedAnnouncements.length === 0) {
      Swal.fire("No Selection", "Please select at least one announcement to delete.", "warning");
      return;
    }
  
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete them!",
      cancelButtonText: "Cancel",
    });
  
    if (result.isConfirmed) {
      try {
        const userIDs = await getAllUserIDs(); // Get all user IDs
        const deletedAnnouncements: string[] = [];
  
        for (const announcementId of selectedAnnouncements) {
          // Delete from main "notifications" collection
          await deleteDoc(doc(firestore, "notifications", announcementId));
          deletedAnnouncements.push(announcementId);
  
          // Delete from "userNotifications" subcollections
          await Promise.all(
            userIDs.map(async (userID) => {
              const userNotifRef = doc(firestore, "notifications", userID, "userNotifications", announcementId);
              await deleteDoc(userNotifRef);
            })
          );
        }
  
        // Log activity
        await logActivity(`Deleted ${deletedAnnouncements.length} announcement(s).`);
  
        setSelectedAnnouncements([]);
        fetchAnnouncements();
  
        Swal.fire("Deleted!", "The selected announcements have been deleted.", "success");
      } catch (error) {
        console.error("Error deleting announcements:", error);
        Swal.fire("Error", "Failed to delete announcements. Please try again.", "error");
      }
    }
  };
  
  const getAllUserIDs = async () => {
    const students = await getUserIDsByType("students");
    const faculty = await getUserIDsByType("faculty");
    return [...students, ...faculty];
  };
  

  const sendUserNotification = async (
    userID: string,
    notificationId: string,
    subject: string,
    message: string,
    senderName: string,
    senderProfilePic: string,
    audience: string,
    fileUrl: string | null = null,
    fileName: string | null = null,
    isImage: boolean = false,
    isVideo: boolean = false
  ) => {
    const userNotificationRef = doc(
      collection(firestore, "notifications", userID, "userNotifications"),
      notificationId
    );
  
    await setDoc(userNotificationRef, {
      senderName: `GPadmin ${senderName}`,
      subject,
      senderProfilePic,
      message,
      audience,
      fileUrl,
      fileName, 
      isImage,
      isVideo,
      timestamp: new Date(),
      isRead: false,
      type: "announcement",
    });
  };
  


   // Log activity to Firestore
    const logActivity = async (activity: string) => {
       const admin = auth.currentUser;
       if (!admin) return;
     
       try {
         const adminQuery = query(collection(firestore, "admin"), where("userID", "==", admin.uid));
         const querySnapshot = await getDocs(adminQuery);
     
         if (!querySnapshot.empty) {
           const adminDoc = querySnapshot.docs[0];
           const data = adminDoc.data();
           const adminName = `${data.firstName} ${data.lastName}`;
     
           await addDoc(collection(firestore, "logs"), {
             activity,
             userName: adminName,
             timestamp: Timestamp.now(),
             role: data.role || "admin",
           });
         }
       } catch (error) {
         console.error("Error logging activity:", error);
       }
     };
  
     
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    const { senderName, senderProfilePic } = await fetchSenderInfo();
  
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let isImage = false;
    let isVideo = false;
  
    if (image) {
      const storageRef = ref(storage, `announcements/${image.name}`);
      await uploadBytes(storageRef, image);
      fileUrl = await getDownloadURL(storageRef);
      fileName = image.name;
  
      // Check the file type
      const fileType = image.type;
      isImage = fileType.startsWith("image/");
      isVideo = fileType.startsWith("video/");
    }
  
    const announcementDocRef = await addDoc(collection(firestore, "notifications"), {
      subject: announcementSubject,
      text: announcementText,
      audience: "everyone", // Set audience to "everyone" by default
      timestamp: Timestamp.now(),
      senderName,
      senderProfilePic,
      fileUrl,
      fileName,
      isImage,
      isVideo,
    });
  
    const notificationId = announcementDocRef.id;
    const userIDs = await getAllUserIDs(); // Always get all user IDs
  
    // Send notifications to all users
    await Promise.all(
      userIDs.map((userID) =>
        sendUserNotification(
          userID,
          notificationId,
          announcementSubject,
          announcementText,
          senderName,
          senderProfilePic,
          "everyone", // Set audience to "everyone" by default
          fileUrl,
          fileName,
          isImage,
          isVideo
        )
      )
    );
  

    await logActivity(
      `Created a new announcement: "${announcementSubject}"
      `
    );

    setAnnouncementText("");
    setAnnouncementSubject("");
    setImage(null);
    fetchAnnouncements();
    setIsModalOpen(false);
    setIsLoading(false); 
  };
  
const getUserIDsByType = async (userType: string) => {
  const userCollection = collection(firestore, userType);
  const snapshot = await getDocs(userCollection);
  const userIDs = snapshot.docs.map((doc) => doc.id);
  return userIDs;
};


  return (
      <div className="admin-dasasdhboard">
        <div className="admin-dashasdboard-main">
          <AdminSidebar />
          <div className="admin-dashboard-content">
         
            {/* Announcement Creation Modal */}
            {isModalOpen && (
              <div className="ql-modal-overlay">
                <div className="ql-modal-content">
                  <span className="ql-modal-close" onClick={() => setIsModalOpen(false)}>
                    &times;
                  </span>
                  <h2>Create New Announcement</h2>
                  <form onSubmit={handleSubmit}>
                    <input
                      type="text"
                      value={announcementSubject}
                      onChange={(e) => setAnnouncementSubject(e.target.value)}
                      required
                      placeholder="Subject"
                    />
                    <textarea
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      required
                      placeholder="Enter your announcement here..."
                    />
                    {/* <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                      <option value="everyone">Everyone</option>
                      <option value="students">Students Only</option>
                      <option value="faculty">Faculty Only</option>
                    </select> */}
                    <div className="ql-file-button-container">
  <label htmlFor="file-upload" className="ql-file-input-label">
    Add files (optional)
  </label>
  <input
  type="file"
  id="file-upload"
  className="ql-file-input"
  onChange={(e) => {
    const file = e.target.files?.[0];
    setImage(file || null); 
  }}
/>




  {image && (
  <div className="ql-file-display">
    <a
      href={URL.createObjectURL(image)}
      target="_blank"
      rel="noopener noreferrer"
      className="ql-file-link"
    >
      {image.name}
    </a>
    <button
      className="ql-file-remove-button"
      onClick={() => setImage(null)}
      aria-label="Remove file"
    >
      &times;
    </button>
  </div>
)}

  {/* Submit button */}
  <button
            type="submit"
            className="ql-modal-submit-button"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Announcement"}
          </button>
</div>

                  </form>
                </div>
              </div>
            )}
    
    
            {/* List of Announcements */}

            <div className="ql-announcements-heasder">
  <h2 className="ql-announcements-title">All Announcements</h2>
  <button className="ql-create-button" onClick={() => setIsModalOpen(true)}>
    Create New Announcement
  </button>
</div>

<div className="filters-section">
<input
  type="text"
  value={filterSearchInput}
  placeholder="Search by subject, message, or sender..."
  onChange={(e) => setFilterSearchInput(e.target.value)}
/>
{/* 
  <select value={filterAudience} onChange={(e) => setFilterAudience(e.target.value)}>
    <option value="everyone">Everyone</option>
    <option value="students">Students</option>
    <option value="faculty">Faculty</option>
  </select> */}
  <select value={filterSortBy} onChange={(e) => setFilterSortBy(e.target.value)}>
    <option value="desc">DESC</option>
    <option value="asc">ASC</option>
  </select>
  <input
    type="date"
    value={filterSelectedDate}
    onChange={(e) => setFilterSelectedDate(e.target.value)}
  />
  <button onClick={handleApplyFilters} className="apply-button">Apply</button>
  <button onClick={handleResetFilters} className="reset-button">
  <FontAwesomeIcon icon={faSync} className="reset-icon" /> Clear
</button>

  <button
        className="delete-all-button"
        onClick={handleDeleteSelected}
        disabled={selectedAnnouncements.length === 0}
      >
        <FontAwesomeIcon icon={faTrash} /> Delete Selected
      </button>
</div>
<div className="pagination-info">
            Page {currentPage + 1} of {pageCount}
          </div>
{isLoading && (
  <div className="loading-overlay">
    <div className="loading-spinner"></div>
  </div>
)}

<ul className="ql-announcements-list">


  {/* List of Announcements */}
  {announcements.map((announcement) => (
    <li key={announcement.id} className="ql-announcement-item">
      <div className="announcement-content">
        {/* Checkbox for each announcement */}
        <div className="checkbox-column">
          <input
            type="checkbox"
            checked={selectedAnnouncements.includes(announcement.id)}
            onChange={() => handleSelectAnnouncement(announcement.id)}
          />
        </div>

        {/* Left Section: Date */}
        <div className="announcement-date">
          <p className="announcement-date-text">
            {announcement.timestamp
              ? new Date(announcement.timestamp).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'No Date'}
          </p>
          <p className="announcement-time-text">
            {announcement.timestamp
              ? new Date(announcement.timestamp).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true,
                })
              : ''}
          </p>
        </div>

        {/* Right Section: Announcement Details */}
        <div className="announcement-details">
          <h4 className="announcement-sender">{announcement.senderName || "Unknown User"}</h4>
          <p className="announcement-subject">{announcement.subject}</p>
          <p
            className="announcement-message"
            title={announcement.text} // Tooltip with full text on hover
          >
            {announcement.text.length > 100
              ? `${announcement.text.substring(0, 90)}...`
              : announcement.text}
          </p>
        </div>

        {/* Details Button */}
        <button
          className="announcement-details-button"
          onClick={() => {
            setSelectedAnnouncement(announcement);
            setIsViewModalOpen(true);
          }}
        >
          Details
        </button>
      </div>
    </li>
  ))}

<div className="pagination-container">
  <ReactPaginate
    previousLabel={"Previous"}
    nextLabel={"Next"}
    breakLabel={"..."}
    pageCount={pageCount}
    marginPagesDisplayed={2}
    pageRangeDisplayed={3}
    onPageChange={handlePageClick}
    containerClassName={"pagination-controls"}
    activeClassName={"active"}
    disabledClassName={"disabled"}
    forcePage={currentPage} // Ensure the current page is highlighted
  />
</div>

</ul>




    
            {/* View Modal for Individual Announcements */}
         {/* View Modal for Individual Announcements */}
         {isViewModalOpen && selectedAnnouncement && (
  <div className="ql-modal-overlay">
    <div className="ql-modal-content">
      {/* Close Button */}
      <span className="ql-modal-close" onClick={() => setIsViewModalOpen(false)}>
        &times;
      </span>

      {/* Sender Information */}
      <p className="ql-modal-sender">Sent by: {selectedAnnouncement.senderName || "Admin"}</p>
      <h2>{selectedAnnouncement.subject}</h2>

      {/* Display Timestamp */}
      <p className="ql-announcement-date-modal">
        {selectedAnnouncement.timestamp
          ? new Date(
              selectedAnnouncement.timestamp.seconds
                ? selectedAnnouncement.timestamp.seconds * 1000 // Firestore Timestamp
                : selectedAnnouncement.timestamp // JavaScript Date
            ).toLocaleString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: true,
            })
          : 'No Date Available'}
      </p>

      {/* Display Message */}
      <div className="ql-announcement-message">{selectedAnnouncement.text}</div>

      {/* Display Attached File */}
      {selectedAnnouncement.fileUrl && (
        <>
          {selectedAnnouncement.isImage ? (
            <div className="ql-announcement-image-container">
              <img
                src={selectedAnnouncement.fileUrl}
                alt="Attached Image"
                className="ql-announcement-image"
              />
            </div>
          ) : selectedAnnouncement.isVideo ? (
            <div className="ql-announcement-video-container">
              <video controls src={selectedAnnouncement.fileUrl} className="ql-announcement-video" />
            </div>
          ) : (
            // For other file types, display the icon and filename
            <div className="ql-announcement-file-container">
              <FontAwesomeIcon
                icon={getFileIcon(selectedAnnouncement.fileName)}
                className={`ql-file-icon ${getFileIconClass(selectedAnnouncement.fileName)}`}
              />
              <a
                href={selectedAnnouncement.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ql-file-link"
              >
                {selectedAnnouncement.fileName}
              </a>
            </div>
          )}
        </>
      )}
    </div>
  </div>
)}


          </div>
        </div>
      </div>
    );
    
};

export default AdminAnnouncements;