import React, { useEffect, useState } from 'react';
import { firestore, auth } from '../../services/firebaseConfig';
import {
  collection,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  query,
  where,
  getDocs,startAfter,
  addDoc,orderBy,limit,  QueryDocumentSnapshot, // Add this import
  DocumentData, getCountFromServer 
} from 'firebase/firestore';
import ReactPaginate from 'react-paginate';
import '../../styles/AdminFeedback.css';
import AdminSidebar from './AdminSidebar';
import { showToast } from '../../components/toast';
import Modal from 'react-modal';

// Set the app element for accessibility (required by react-modal)
Modal.setAppElement('#root');

interface Feedback {
  id: string;
  userId: string;
  feedbackText: string;
  timestamp: string;
  student?: Student | null;
  replies?: number; // Make this field optional
}

interface Student {
  firstname: string;
  lastname: string;
  profilePicUrl: string;
  email: string;
}

interface Admin {
  firstName: string;
  lastName: string;
  profilePicUrl: string;
}

interface Reply {
  message: string;
  timestamp: Timestamp;
  adminName: string;
}

const AdminFeedback: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [replyMessage, setReplyMessage] = useState<string>('');
  const [replySubject, setReplySubject] = useState<string>('Replied to your feedback'); // New state for subject
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isRepliesModalOpen, setIsRepliesModalOpen] = useState<boolean>(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isSending, setIsSending] = useState(false); // Prevent multiple clicks
  const [filterSortBy, setFilterSortBy] = useState("desc");
const [filterSelectedDate, setFilterSelectedDate] = useState("");
const [searchInput, setSearchInput] = useState(""); // Stores the input
const [appliedSearchTerm, setAppliedSearchTerm] = useState(""); // Stores the actual search term used for filtering
const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
const [pageCount, setPageCount] = useState(0);
const itemsPerPage = 20; // Number of items per page



useEffect(() => {
  const fetchTotalDocumentCount = async () => {
    try {
      const feedbackCollection = collection(firestore, "feedback");
      const snapshot = await getCountFromServer(feedbackCollection);
      setPageCount(Math.ceil(snapshot.data().count / itemsPerPage));
    } catch (error) {
      console.error("Error fetching total document count:", error);
    }
  };

  fetchTotalDocumentCount();
}, []);

  const fetchFeedback = async (page: number) => {
  setLoading(true);
  try {
    let feedbackQuery = query(
      collection(firestore, "feedback"),
      orderBy("timestamp", filterSortBy === "desc" ? "desc" : "asc"),
      limit(itemsPerPage)
    );

    // Apply search filter
    if (appliedSearchTerm) {
      feedbackQuery = query(
        feedbackQuery,
        where("feedbackText", ">=", appliedSearchTerm),
        where("feedbackText", "<=", appliedSearchTerm + "\uf8ff")
      );
    }

    // Apply date filter
    if (filterSelectedDate) {
      const startDate = Timestamp.fromDate(new Date(filterSelectedDate));
      const endDate = Timestamp.fromDate(new Date(filterSelectedDate + "T23:59:59"));
      feedbackQuery = query(
        feedbackQuery,
        where("timestamp", ">=", startDate),
        where("timestamp", "<=", endDate)
      );
    }

    // Pagination
    if (page > 0 && lastVisible) {
      feedbackQuery = query(feedbackQuery, startAfter(lastVisible));
    }

    const feedbackSnapshot = await getDocs(feedbackQuery);
    const feedbackData = await Promise.all(
      feedbackSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const timestamp = (data.timestamp as Timestamp).toDate().toLocaleString();
        const student = await fetchStudentDetails(data.userId);

        // Fetch replies count using getCountFromServer
        const repliesCollection = collection(firestore, "feedback", doc.id, "replies");
        const repliesSnapshot = await getCountFromServer(repliesCollection);
        const repliesCount = repliesSnapshot.data().count;

        return {
          id: doc.id,
          userId: data.userId,
          feedbackText: data.feedbackText,
          timestamp,
          student,
          replies: repliesCount > 0 ? repliesCount : undefined,
        };
      })
    );

    setFeedbackList(feedbackData);
    setLastVisible(feedbackSnapshot.docs[feedbackSnapshot.docs.length - 1] || null);
  } catch (error) {
    console.error("Error fetching feedback:", error);
  } finally {
    setLoading(false);
  }
};



  const fetchStudentDetails = async (userId: string): Promise<Student | null> => {
    try {
      const studentRef = doc(firestore, 'students', userId);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        return studentSnap.data() as Student;
      } else {
        console.warn(`No student found with ID: ${userId}`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching student details:', error);
      return null;
    }
  };
  const handleApplyFilters = async () => {
    setAppliedSearchTerm(searchInput.trim().toLowerCase()); // Ensure lowercase search
    setCurrentPage(0);
    setLastVisible(null);
    setFeedbackList([]);
    await fetchFeedback(0);
  };
  
  
  const handleResetFilters = async () => {
    setSearchInput("");
    setAppliedSearchTerm("");
    setFilterSortBy("desc");
    setFilterSelectedDate("");
    setCurrentPage(0); // Reset to first page
    setLastVisible(null); // Reset last visible document
    setFeedbackList([]); // Reset feedback list
    await fetchFeedback(0);
  };
  
  const fetchSenderInfo = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.error("No authenticated user found.");
      return { senderName: "GPadmin Unknown User", senderProfilePic: null };
    }

    try {
      const adminQuery = query(
        collection(firestore, "admin"),
        where("userID", "==", user.uid)
      );
      const querySnapshot = await getDocs(adminQuery);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        return {
          senderName: `GPadmin ${userData.firstName} ${userData.lastName}`,
          senderProfilePic: userData.profilePicUrl || null,
        };
      } else {
        console.error("No admin document found for the current user.");
        return { senderName: "GPadmin Unknown User", senderProfilePic: null };
      }
    } catch (error) {
      console.error("Error fetching admin details:", error);
      return { senderName: "GPadmin Unknown User", senderProfilePic: null };
    }
  };

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

  const handlePageClick = async (selectedPage: { selected: number }) => {
    setCurrentPage(selectedPage.selected);
    await fetchFeedback(selectedPage.selected);
  };

  const openReplyModal = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setIsModalOpen(true);
  };

  const closeReplyModal = () => {
    setIsModalOpen(false);
    setReplyMessage('');
    setReplySubject('Replied to your feedback'); // Reset subject to default
    setSelectedFeedback(null);
  };

  const handleReplySubmit = async () => {
    if (!selectedFeedback || !replyMessage.trim()) return;
    setIsSending(true); // Disable button to prevent spamming

    try {
        // Fetch admin details
        const { senderName, senderProfilePic } = await fetchSenderInfo();

        // Log the activity
        await logActivity(`Replied to feedback: ${selectedFeedback.feedbackText}`);

        // Store the reply in Firestore under the feedback document
        const replyData = {
            message: replyMessage,
            timestamp: Timestamp.now(),
            adminName: senderName,
        };
        await addDoc(
            collection(firestore, "feedback", selectedFeedback.id, "replies"),
            replyData
        );

        // Send the reply as a notification to the user
        const userNotificationRef = collection(
            firestore,
            "notifications",
            selectedFeedback.userId,
            "userNotifications"
        );

        await addDoc(userNotificationRef, {
            subject: replySubject, // Use the subject from state
            message: `${replyMessage}`,
            senderName: senderName,
            senderProfilePic: senderProfilePic || null,
            timestamp: Timestamp.now(),
            isRead: false,
            type: "feedback-reply",
        });

        // Update the state to show the "View Replies" button without refresh
        setFeedbackList(prevFeedbackList =>
            prevFeedbackList.map(feedback =>
                feedback.id === selectedFeedback.id
                    ? { ...feedback, replies: (feedback.replies || 0) + 1 }
                    : feedback
            )
        );

        // Close the modal and reset the reply message and subject
        closeReplyModal();
        setIsSending(false); // Re-enable button

        showToast("Reply sent successfully!", "success");
    } catch (error) {
        console.error('Error sending reply:', error);
    }
};


useEffect(() => {
  fetchFeedback(currentPage);
}, [currentPage, appliedSearchTerm, filterSelectedDate, filterSortBy]);


  const fetchReplies = async (feedbackId: string) => {
    try {
      const repliesCollection = collection(firestore, "feedback", feedbackId, "replies");
      const snapshot = await getDocs(repliesCollection);
      const repliesData = snapshot.docs.map((doc) => doc.data() as Reply);
  
      // Sort replies by timestamp (newest first)
      const sortedReplies = repliesData.sort((a, b) => 
        b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
      );
  
      setReplies(sortedReplies); // Set the sorted replies
      setIsRepliesModalOpen(true);
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  };

  const closeRepliesModal = () => {
    setIsRepliesModalOpen(false);
    setReplies([]);
  };

  
  
  
  



  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-main">
        <AdminSidebar />
        <div className="admin-dashboard-content">
          <h2>Issues & Feedback</h2>
          <div className="filters-section">
          <input
  type="text"
  value={searchInput}
  placeholder="Search..."
  onChange={(e) => setSearchInput(e.target.value)}
/>

  <select
    value={filterSortBy}
    onChange={(e) => setFilterSortBy(e.target.value)}
  >
    <option value="desc">DESC</option>
    <option value="asc">ASC</option>
  </select>
  <input
    type="date"
    value={filterSelectedDate}
    onChange={(e) => setFilterSelectedDate(e.target.value)}
  />
  <button onClick={handleApplyFilters} className="apply-button">
    Apply
  </button>
  <button onClick={handleResetFilters} className="reset-button">
    Clear
  </button>
</div>
          <div className="pagination-info">
  Page {currentPage + 1} of {pageCount}
</div>
          {loading ? (
            <p>Loading feedback...</p>
          ) : feedbackList.length === 0 ? (
            <p>No feedback available.</p>
          ) : (
            <>
            
  <div className="wazzapbruh-feedback-list-container">
  <ul className="wazzapbruh-feedback-list">
  {feedbackList.map((feedback) => (
    <li key={feedback.id} className="wazzapbruh-feedback-item wazzapbruh-fade-in">
                    <div className="wazzapbruh-feedback-header">
                      {feedback.student ? (
                        <div className="wazzapbruh-student-info">
                          <img
                            src={feedback.student.profilePicUrl || "/default-profile.png"}
                            alt={`${feedback.student.firstname} ${feedback.student.lastname}`}
                            className="wazzapbruh-student-profile-pic"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                          <div className="wazzapbruh-student-details">
                            <p className="wazzapbruh-student-name">
                              <strong>{feedback.student.firstname} {feedback.student.lastname}</strong>
                            </p>
                            <p className="wazzapbruh-feedback-timestamp">
                              Submitted on: {new Date(feedback.timestamp).toLocaleString()}
                            </p>
                            <p className="wazzapbruh-feedback-message">
                              <strong>Message:</strong> {feedback.feedbackText}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p>User information not available</p>
                      )}
                    </div>
                    <div className="wazzapbruh-feedback-actions">
                      <button className="wazzapbruh-reply-btn" onClick={() => openReplyModal(feedback)}>
                        Reply
                      </button>
                      {feedback.replies && feedback.replies > 0 && (
                        <button className="wazzapbruh-view-replies-btn" onClick={() => fetchReplies(feedback.id)}>
                          View Replies
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
        
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
  forcePage={currentPage} 
/>
  </div>
            </>
          )}
        </div>
      </div>

      {isModalOpen && selectedFeedback && (
      <div className="wazzup-modal-overlay">
        <div className="wazzup-modal-content">
          <h2>Reply to Feedback</h2>
          <input
            type="text"
            placeholder="Subject"
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            className="wazzup-modal-input"
          />
          <textarea
            placeholder="Type your reply here..."
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            className="wazzup-modal-textarea"
          />
          <div className="wazzup-modal-buttons">
          <button onClick={handleReplySubmit} disabled={isSending}>
    {isSending ? "Sending..." : "Send Reply"}
</button>

            <button onClick={closeReplyModal}>Cancel</button>
          </div>
        </div>
      </div>
    )}

{isRepliesModalOpen && (
  <div className="wazzups-modal-overlay">
    <div className="wazzups-modal-content">
      {/* X Button */}
      <button onClick={closeRepliesModal} className="wazzups-close-btn">&times;</button>


      <ul className="wazzups-replies-list">
        {replies.map((reply, index) => (
          <li key={index} className="wazzups-reply-item">
            {/* Admin Name */}
            <p className="wazzups-reply-admin"><strong>{reply.adminName}</strong></p>
            
            {/* Date and Time */}
            <p className="wazzups-reply-timestamp">
              {reply.timestamp.toDate().toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </p>

            {/* Message (Now under the date & time) */}
            <p className="wazzups-reply-message">{reply.message}</p>
          </li>
        ))}
      </ul>
    </div>
  </div>
)}


    </div>
  );
};

export default AdminFeedback;