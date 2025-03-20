import React, { useEffect, useState  } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc,updateDoc,query, arrayUnion, onSnapshot,collection,setDoc,getDocs } from "firebase/firestore";
import { firestore } from "../../services/firebaseConfig";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useParams } from "react-router-dom";
import Header from "../../components/Header";
import StudentPresidentSidebar from "./StudentPresidentSidebar";
import StudentMemberSidebar from "./StudentMemberSidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSync } from "@fortawesome/free-solid-svg-icons";
import '../../styles/TaskManagement.css';
import { showToast } from '../../components/toast';
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import DataTable from 'react-data-table-component';


interface Event {
  id: string;
  title?: string; // Make title optional if it might be missing
  startDate?: string;
  endDate?: string;
  [key: string]: any; // Allow other fields
}

interface Task {
  id: string;
  event?: string;
  title: string;
  description: string;
  assignedTo: string[]; 
  assignedToNames?: string[];
  assignedMembers: string[];
  assignedCommittees: string[]; 
  startDate: string;
  dueDate: string;
  taskStatus: 
  | 'In-Progress' 
  | 'Started' 
  | 'Completed' 
  | 'Overdue'
  | 'Extended' // New status for extended tasks
  | 'Extended-Overdue'; // New status for extended tasks that were overdue
  givenBy: string;
  attachments?: string[];
  submissions?: Submission[];
   notificationsSent: string[];
}

interface Submission {
  memberId: string;
  memberName: string; // The member's full name
  textContent?: string; // Optional field for text content
  fileAttachments?: string[]; // Array of file URLs for attachments
  date: string;
  comments?: { // Array of comments for the submission
    text: string;
    user: {
      name: string;
      profilePicUrl?: string;
    };
    timestamp: number;
  }[];
}
const MyTasks: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
const [taskToView, setTaskToView] = useState<Task | null>(null);
const [filterByEvent, setFilterByEvent] = useState("All");
const [filterByStatus, setFilterByStatus] = useState("All");
const [searchQuery, setSearchQuery] = useState("");
const [sortOrder, setSortOrder] = useState("asc");
const [selectedDate, setSelectedDate] = useState("");
const [comments, setComments] = useState<{ text: string; user: any; timestamp: number }[][]>([]);
const [commentText, setCommentText] = useState("");
const [activeTab, setActiveTab] = useState(0); // For tabs in submissions modal
const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
const [submissionsTask, setSubmissionsTask] = useState<Task | null>(null);
const [availableCommittees, setAvailableCommittees] = useState<any[]>([]);
const [availableMembers, setAvailableMembers] = useState<any[]>([]);
const [textContent, setTextContent] = useState("");
const [file, setFile] = useState<File[] | null>(null);
const [role, setRole] = useState<string>('');
const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
const [attachments, setAttachments] = useState<File[]>([]);
const navigate = useNavigate();
const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
const isTaskReadyForSubmission = (task: Task): boolean => {
  const currentDate = new Date();
  const taskStartDate = new Date(task.startDate);
  return currentDate >= taskStartDate; // Task is ready if the current date is on or after the start date
};
useEffect(() => {
  const fetchEvents = async () => {
    if (!organizationName) return;

    try {
      const eventCollectionRef = collection(firestore, `events/${organizationName}/event`);
      const querySnapshot = await getDocs(eventCollectionRef);
      const events: Event[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableEvents(events);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  fetchEvents();
}, [organizationName]);



const columns = [
 
  {
    name: 'Event',
    cell: (row: Task) => {
      if (!row.event) return "General Task"; // Ensure we return a string when event is undefined

      const event = availableEvents.find((ev) => ev.id === row.event);

      // Return the event title if found, otherwise fallback to "General Task"
      return event ? event.title : "General Task";
    },
    sortable: true,
  },
  {
    name: 'Tasks',
    cell: (row: Task) => (
      <div style={{ maxWidth: '200px', overflow: 'hidden' }}>
        <strong
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
            maxWidth: '100%',
          }}
        >
          {row.title}
        </strong>
        <p
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
            maxWidth: '100%',
          }}
        >
          {row.description}
        </p>
      </div>
    ),
    sortable: true,
    style: {
      maxWidth: '200px',
    },
  },
  {
    name: 'Given by',
    cell: (row: Task) => row.givenBy,
    sortable: true,
  },
  {
    name: 'Assigned to',
    cell: (row: Task) => {
      const memberNames = row.assignedMembers
        .map((id) => {
          const member = availableMembers.find((m) => m.id === id);
          return member?.name || "Unknown Member";
        })
        .filter(Boolean);

      const committeeNames = row.assignedCommittees
        .map((id) => {
          const committee = availableCommittees.find((c) => c.id === id);
          return committee?.name || "Unknown Committee";
        })
        .filter(Boolean);

      const allNames = [...memberNames, ...committeeNames];

      if (allNames.length <= 3) {
        return allNames.join(", ");
      } else {
        const visibleNames = allNames.slice(0, 3);
        const hiddenCount = allNames.length - 3;
        return `${visibleNames.join(", ")}, +${hiddenCount}`;
      }
    },
    sortable: true,
  },
  {
    name: 'Start Date',
    cell: (row: Task) =>
      new Date(row.startDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }),
    sortable: true,
  },
  {
    name: 'Due Date',
    cell: (row: Task) =>
      new Date(row.dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }),
    sortable: true,
  },
  {
    name: 'Status',
    cell: (row: Task) => (
      <span
        className={`status-badge ${
          row.taskStatus === "Extended"
            ? "extended"
            : row.taskStatus === "Extended-Overdue"
            ? "extended-overdue"
            : row.taskStatus.replace(" ", "-").toLowerCase()
        }`}
      >
        {row.taskStatus === "Extended-Overdue" ? "Extended (Overdue)" : row.taskStatus}
      </span>
    ),
    sortable: true,
  },
  {
    name: 'Action',
    cell: (row: Task) => (
      <div className="task-dropdown">
        <button className="action-btn">Action</button>
        <div className="task-dropdown-content">
          <button onClick={() => openViewModal(row)}>View</button>
          <button onClick={() => openSubmissionsModal(row)}>Submissions</button>
        </div>
      </div>
    ),
    width: '120px',
  },
];

  const auth = getAuth();

  const resetFilters = () => {
    setFilterByEvent("All");
    setFilterByStatus("All");
    setSearchQuery("");
    setSortOrder("asc");
    setSelectedDate("");
  };
  
  const openViewModal = async (task: Task) => {
    const updatedTask = await setSelectedTaskWithStatusUpdate(task); // Get the updated task
    setTaskToView(updatedTask); // Use the updated task for the modal
    setIsViewModalOpen(true); // Open the modal
  };
  
  
  const closeViewModal = () => {
    setTaskToView(null);
    setIsViewModalOpen(false);
  };
  const extractFileName = (url: string): string => {
    const fileNameWithPath = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Attachment');
    const fileName = fileNameWithPath.split('/').pop() || fileNameWithPath; // Remove folder structure like "tasks/"
    return fileName.replace(/^\d+-/, ''); // Remove leading numbers followed by a dash
  };
  
  const handleAddComment = async (submissionIndex: number) => {
    if (!commentText.trim()) {
      showToast("Comment cannot be empty!", "error");
      return;
    }
  
    const user = auth.currentUser;
    if (!user) {
      showToast("You must be logged in to comment.", "error");
      return;
    }
  
    // Fetch user data from Firestore
    const userDoc = await getDoc(doc(firestore, "students", user.uid));
    const userData = userDoc.exists() ? userDoc.data() : null;
  
    if (!userData) {
      showToast("User data not found.", "error");
      return;
    }
  
    const senderName = `${userData.firstname} ${userData.lastname}`;
    const senderProfilePic = userData.profilePicUrl;
  
    const newComment = {
      text: commentText,
      user: {
        name: senderName,
        profilePicUrl: senderProfilePic,
      },
      timestamp: Date.now(),
    };
  
    try {
      // Fetch the existing task
      const taskDocRef = doc(firestore, `tasks/${organizationName}/AllTasks/${submissionsTask?.id}`);
      const taskDoc = await getDoc(taskDocRef);
  
      if (!taskDoc.exists()) {
        throw new Error("Task document does not exist.");
      }
  
      const taskData = taskDoc.data();
      const submissions = taskData.submissions || [];
  
      // Add the comment to the correct submission
      if (!submissions[submissionIndex]) {
        throw new Error(`Submission at index ${submissionIndex} does not exist.`);
      }
  
      if (!submissions[submissionIndex].comments) {
        submissions[submissionIndex].comments = [];
      }
  
      submissions[submissionIndex].comments.push(newComment);
  
      // Update Firestore with the modified submissions array
      await updateDoc(taskDocRef, { submissions });
  
      // Update local state
      setComments((prev) => {
        const updatedComments = [...prev];
        if (!updatedComments[submissionIndex]) {
          updatedComments[submissionIndex] = [];
        }
        const isDuplicate = updatedComments[submissionIndex].some(
          (comment) => comment.timestamp === newComment.timestamp
        );
        if (!isDuplicate) {
          updatedComments[submissionIndex].push(newComment);
        }
        return updatedComments;
      });
  
      setSubmissionsTask((prev) =>
        prev ? { ...prev, submissions } : null
      );
  
      setCommentText("");
  
      // Send notifications
      const recipientIds = new Set<string>();
  
      // Task giver
      if (taskData.senderId) {
        recipientIds.add(taskData.senderId);
      }
  
      // Assigned members
      if (taskData.assignedMembers?.length > 0) {
        taskData.assignedMembers.forEach((id: string) => {
          if (id !== user.uid) recipientIds.add(id);
        });
      }
  
      // Committees and their members
      if (taskData.assignedCommittees?.length > 0 && organizationData?.committees) {
        taskData.assignedCommittees.forEach((committeeId: string) => {
          const committee = organizationData.committees.find(
            (c: any) => c.id === committeeId
          );
          if (committee) {
            if (committee.head?.id && committee.head.id !== user.uid) {
              recipientIds.add(committee.head.id);
            }
            committee.members?.forEach((member: any) => {
              if (member.id !== user.uid) recipientIds.add(member.id);
            });
          }
        });
      }
  
      // Send notifications to all recipients
      const notificationPromises = Array.from(recipientIds).map((recipientId) => {
        const notificationRef = doc(
          firestore,
          `notifications/${recipientId}/userNotifications`,
          uuidv4()
        );
        return setDoc(notificationRef, {
          subject: `commented on the task: "${taskData.title}".`,
          description: `${senderName} commented: "${commentText}"`,
          timestamp: new Date(),
          isRead: false,
          senderName,
          senderProfilePic,
          taskId: taskData.id,
          type: "task-comment",
        });
      });
  
      await Promise.all(notificationPromises);
  
      showToast("Comment added successfully", "success");
    } catch (error) {
      console.error("Error saving comment or sending notifications:", error);
      showToast("Failed to add the comment. Please try again.", "error");
    }
  };
  

  
const fetchAvailableMembersAndCommittees = async () => {
  if (!organizationName) return;

  try {
    const orgDocRef = doc(firestore, "organizations", decodeURIComponent(organizationName));
    const orgDoc = await getDoc(orgDocRef);

    if (orgDoc.exists()) {
      const data = orgDoc.data();
      setAvailableMembers([...(data?.members || []), ...(data?.officers || [])]);
      setAvailableCommittees(data?.committees || []);
    }
  } catch (error) {
    console.error("Error fetching members and committees:", error);
  }
};
const fetchMyTasks = async () => {
  if (!currentUser || !organizationName) return;

  try {
    const decodedOrgName = decodeURIComponent(organizationName).trim();
    console.log("Decoded Organization Name:", decodedOrgName);

    // Fetch organization data
    const orgDocRef = doc(firestore, "organizations", decodedOrgName);
    const orgDoc = await getDoc(orgDocRef);

    if (!orgDoc.exists()) {
      console.error("Organization not found.");
      setError("Organization not found.");
      return;
    }

    const orgData = orgDoc.data();
    setOrganizationData(orgData);

    // Determine the user's role in the organization
    if (orgData.president?.id === currentUser.uid) {
      setUserRole("president");
    } else if (orgData.officers?.some((officer: any) => officer.id === currentUser.uid)) {
      setUserRole("officer");
    } else if (orgData.facultyAdviser?.id === currentUser.uid) { 
      setUserRole("faculty");
    } else if (orgData.members?.some((member: any) => member.id === currentUser.uid)) {
      setUserRole("member");
    } else {
      setUserRole(null);
    }

    // Extract committees
    const committees = orgData?.committees || [];
    const userId = currentUser.uid;

    // Get committees where the user is either the head or a member
    const userCommittees = committees.filter((committee: any) =>
      committee.head?.id === userId || committee.members?.some((member: any) => member.id === userId)
    );

    // Collect all committee IDs where the user is involved
    const userCommitteeIds = userCommittees.map((committee: any) => committee.id);

    // Set up real-time listener for tasks
    const tasksCollectionPath = `tasks/${decodedOrgName}/AllTasks`;
    const taskQuery = query(collection(firestore, tasksCollectionPath));

    const unsubscribe = onSnapshot(taskQuery, async (querySnapshot) => {
      if (querySnapshot.empty) {
        console.log("No tasks found.");
        setTasks([]);
        return;
      }

      const userTasks: Task[] = [];
      const notificationPromises: Promise<void>[] = [];
      const currentDate = new Date();

      // Iterate through all tasks
      const handleDueNotifications = querySnapshot.docs.map(async (docSnapshot) => {
        const taskData = docSnapshot.data() as Task;
        const taskDueDate = new Date(taskData.dueDate);

        // Ensure the task is assigned to the current user
        const isAssignedToUser =
          taskData.assignedMembers?.includes(userId) ||
          taskData.assignedCommittees?.some((committeeId: string) => userCommitteeIds.includes(committeeId));

        if (!isAssignedToUser) return;

        // Add to My Tasks
        userTasks.push({ ...taskData, id: docSnapshot.id });

        // Skip notifications for completed tasks
        if (taskData.taskStatus === "Completed") return;

        if (!taskData.notificationsSent) taskData.notificationsSent = [];
        const hoursToDue = (taskDueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);

        // Collect recipients only once
        const recipientIds = new Set<string>();
        taskData.assignedMembers?.forEach((id: string) => recipientIds.add(id));
        taskData.assignedCommittees?.forEach((committeeId: string) => {
          const committee = orgData?.committees?.find((c: any) => c.id === committeeId);
          if (committee) {
            if (committee.head?.id) recipientIds.add(committee.head.id);
            committee.members?.forEach((member: any) => recipientIds.add(member.id));
          }
        });

        // Notify 24 hours before due date
        const notifId24h = `${taskData.id}-24h`;
        if (!taskData.notificationsSent.includes(notifId24h) && hoursToDue <= 24 && hoursToDue > 6) {
          recipientIds.forEach((recipientId) => {
            const notificationRef = doc(
              firestore,
              `notifications/${recipientId}/userNotifications`,
              notifId24h
            );
            notificationPromises.push(
              setDoc(notificationRef, {
                subject: `Task "${taskData.title}" is due in 24 hours!`,
                description: `The task is due on ${taskDueDate.toLocaleString()}.`,
                timestamp: new Date(),
                isRead: false,
                senderName: orgData?.name || "Organization",
                senderProfilePic: orgData?.profileImagePath || "",
                taskId: taskData.id,
                type: "task-reminder",
              })
            );
          });

          await updateDoc(docSnapshot.ref, {
            notificationsSent: arrayUnion(notifId24h),
          });
        }

        // Notify 6 hours before due date
        const notifId6h = `${taskData.id}-6h`;
        if (!taskData.notificationsSent.includes(notifId6h) && hoursToDue <= 6 && hoursToDue > 0) {
          recipientIds.forEach((recipientId) => {
            const notificationRef = doc(
              firestore,
              `notifications/${recipientId}/userNotifications`,
              notifId6h
            );
            notificationPromises.push(
              setDoc(notificationRef, {
                subject: `Task "${taskData.title}" is almost due!`,
                description: `The task is due on ${taskDueDate.toLocaleString()}.`,
                timestamp: new Date(),
                isRead: false,
                senderName: orgData?.name || "Organization",
                senderProfilePic: orgData?.profileImagePath || "",
                taskId: taskData.id,
                type: "task-reminder",
              })
            );
          });

          await updateDoc(docSnapshot.ref, {
            notificationsSent: arrayUnion(notifId6h),
          });
        }
      });

      await Promise.all([...handleDueNotifications, ...notificationPromises]);

      setTasks(userTasks);
      setError(null);
    });

    return () => unsubscribe();
  } catch (error) {
    console.error("Error fetching tasks:", error);
    setError("Failed to fetch tasks. Please try again.");
  } finally {
    setLoading(false);
  }
};




  useEffect(() => {
  if (isSubmissionsModalOpen) {
    setActiveTab(1); // Reset to Submission 1 when modal opens
  }
}, [isSubmissionsModalOpen]);




useEffect(() => {
  const fetchRole = async () => {
    if (!organizationName) return;

    try {
      const orgDocRef = doc(firestore, 'organizations', organizationName);
      const orgDoc = await getDoc(orgDocRef);

      if (orgDoc.exists()) {
        const orgData = orgDoc.data();
        const userId = auth.currentUser?.uid;

        if (orgData.president?.id === userId) {
          setRole('president');
        } else if (orgData.officers.some((officer: any) => officer.id === userId)) {
          setRole('officer');
        } else if (orgData.facultyAdviser?.id === userId) {
          setRole('faculty'); // Assign role as 'faculty'
        } else if (orgData.members.some((member: any) => member.id === userId)) {
          setRole('member');
        } else {
          setRole('guest');
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  fetchRole();
}, [organizationName]);
  
const renderSidebar = () => {
  switch (role) {
    case 'president':
      return <StudentPresidentSidebar />;
    case 'officer':
      return <StudentPresidentSidebar />;
    case 'faculty': // Add case for faculty
      return <StudentPresidentSidebar />;
    case 'member':
      return <StudentMemberSidebar />;
    default:
      return null; // No sidebar for guests
  }
};
  
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setTasks([]); // Clear tasks if the user logs out
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await fetchAvailableMembersAndCommittees(); // Fetch members and committees first
      fetchMyTasks(); // Fetch tasks after ensuring member and committee data is ready
    };
  
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, organizationName]);



  
  const filteredTasks = tasks
  .filter((task) => {
    // Filter by event
    if (filterByEvent === "All") return true;
    return task.event === filterByEvent;
  })
  .filter((task) => {
    // Filter by status
    if (filterByStatus === "All") return true;
    return task.taskStatus === filterByStatus;
  })
  .filter((task) => {
    // Filter by search query
    if (!searchQuery) return true;
    return (
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  })
  .filter((task) => {
    if (!selectedDate) return true;
    return task.dueDate === selectedDate || task.startDate === selectedDate;
  })
  .sort((a, b) => {
    // Define the order of task statuses
    const statusOrder = {
      "In-Progress": 0,
      "Started": 1,
      "Extended": 2,
      "Extended-Overdue": 3,
      "Completed": 4,
      "Overdue": 5,
    };

    // First, compare by task status
    let statusComparison = statusOrder[a.taskStatus] - statusOrder[b.taskStatus];

    // If we're sorting in descending order, reverse the status comparison
    if (sortOrder === "desc") {
      statusComparison = statusOrder[b.taskStatus] - statusOrder[a.taskStatus];
    }

    if (statusComparison !== 0) return statusComparison;

    // If statuses are the same, sort by due date
    const dateA = new Date(a.dueDate).getTime();
    const dateB = new Date(b.dueDate).getTime();

    // Sort by due date, either ascending or descending
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });


  const openSubmissionsModal = (task: Task) => {
    setSubmissionsTask(task);
    setIsSubmissionsModalOpen(true);
  
    try {
      // Set up real-time listener for the specific task document
      const taskDocRef = doc(firestore, `tasks/${organizationName}/AllTasks/${task.id}`);
      
      // Listen for real-time updates using onSnapshot
      const unsubscribe = onSnapshot(taskDocRef, (taskDoc) => {
        if (taskDoc.exists()) {
          const taskData = taskDoc.data();
          const submissionsComments = taskData.submissions?.map((submission: any) => submission.comments || []);
          setComments(submissionsComments || []); // Initialize comments
        } else {
          console.error("Task document does not exist.");
          setComments([]); // Ensure comments are cleared if the task doesn't exist
        }
      });
  
      // Clean up the listener when the modal is closed or when no longer needed
      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching comments:", error);
      setComments([]); // Fallback in case of error
    }
  };
  
  
  const handleSubmission = async (
    taskId: string,
    textContent: string,
    attachments: File[] | null
  ) => {
    const user = auth.currentUser;
  
    if (!user) {
      showToast("You must be signed in to submit.", "error");
      return;
    }
  
    const userDoc = await getDoc(doc(firestore, "students", user.uid));
    const userData = userDoc.exists() ? userDoc.data() : null;
  
    if (!userData) {
      showToast("Unable to fetch user details.", "error");
      return;
    }
  
    const memberName = `${userData.firstname} ${userData.lastname}`;
    const senderName = memberName;
    const senderProfilePic = userData.profilePicUrl;
  
    if (!taskId) {
      showToast("Task ID is missing. Please try again.", "error");
      return;
    }
  
    try {
      // Get the task document
      const taskDocRef = doc(
        firestore,
        `tasks/${organizationName}/AllTasks/${taskId}`
      );
      const taskDoc = await getDoc(taskDocRef);
  
      if (!taskDoc.exists()) {
        showToast("Task not found. Please try again.", "error");
        return;
      }
  
      const taskData = taskDoc.data();
  
      if (taskData.taskStatus === "Overdue") {
        showToast(
          "This task is overdue. Submissions are no longer accepted.",
          "error"
        );
        return;
      }
  
      // Check user submission limit
      const userSubmissions = taskData.submissions?.filter(
        (submission: any) => submission.memberId === user.uid
      );
      if (userSubmissions?.length >= 3) {
        showToast("You can only submit up to 3 times for this task.", "error");
        return;
      }
  
      // Handle file uploads
      const fileURLs: string[] = [];
      if (attachments && attachments.length > 0) {
        const storage = getStorage();
        for (const file of attachments) {
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const storageRef = ref(
            storage,
            `submissions/${Date.now()}-${sanitizedFileName}`
          );
          const snapshot = await uploadBytes(storageRef, file);
          const fileURL = await getDownloadURL(snapshot.ref);
          fileURLs.push(fileURL);
        }
      }
  
      // Prepare submission object
      const submission = {
        memberId: user.uid,
        memberName,
        textContent: textContent || null,
        fileAttachments: fileURLs,
        date: new Date().toISOString(),
      };
  
      // Update Firestore task
      await updateDoc(taskDocRef, {
        submissions: arrayUnion(submission),
        taskStatus: "Completed",
      });
  
      // Collect unique recipient IDs
      const recipientIds = new Set<string>();
  
      // Task giver
      if (taskData.senderId) {
        recipientIds.add(taskData.senderId);
      }
  
      // Assigned members
      if (taskData.assignedMembers) {
        taskData.assignedMembers.forEach((id: string) => {
          if (id !== user.uid) recipientIds.add(id);
        });
      }
  
      // Committees and their members
      if (taskData.assignedCommittees?.length > 0 && organizationData?.committees) {
        taskData.assignedCommittees.forEach((committeeId: string) => {
          const committee = organizationData.committees.find(
            (c: any) => c.id === committeeId
          );
          if (committee) {
            if (committee.head?.id && committee.head.id !== user.uid) {
              recipientIds.add(committee.head.id);
            }
            committee.members?.forEach((member: any) => {
              if (member.id !== user.uid) recipientIds.add(member.id);
            });
          }
        });
      }
  
      // Send notifications
      const notificationPromises = Array.from(recipientIds).map((recipientId) => {
        const notificationRef = doc(
          firestore,
          `notifications/${recipientId}/userNotifications`,
          uuidv4()
        );
        return setDoc(notificationRef, {
          subject: `submitted work for the task: "${taskData.title}".`,
          description: `${memberName} has submitted their work.`,
          timestamp: new Date(),
          isRead: false,
          senderName,
          senderProfilePic,
          taskId,
          type: "task-submission",
        });
      });
  
      await Promise.all(notificationPromises);
  
      showToast("Submission successful", "success");
  
      // Reset UI state
      setIsSubmitModalOpen(false);
      resetSubmissionForm();
    } catch (error) {
      console.error("Error submitting task:", error);
      showToast("Failed to submit. Please try again.", "error");
    }
  };
  
  
  const resetSubmissionForm = () => {
    setTextContent(""); // Clear the text submission
    setAttachments([]); // Clear the selected files
  };
  

const closeSubmissionsModal = () => {
  setSubmissionsTask(null);
  setIsSubmissionsModalOpen(false);
};

  const setSelectedTaskWithStatusUpdate = async (task: Task): Promise<Task> => {
    const currentDate = new Date();
    const taskStartDate = new Date(task.startDate);
    let updatedTask = task;
  
    if (task.taskStatus === "Started" && currentDate >= taskStartDate) {
      try {
        const normalizedOrgName = decodeURIComponent(organizationName || "").trim();
  
        const taskDocRef = doc(
          firestore,
          `tasks/${normalizedOrgName}/AllTasks/${task.id}`
        );
  
        await updateDoc(taskDocRef, {
          taskStatus: "In-Progress",
        });
  
        // Fetch the updated task data
        const updatedTaskDoc = await getDoc(taskDocRef);
        if (updatedTaskDoc.exists()) {
          updatedTask = { ...updatedTaskDoc.data(), id: task.id } as Task;
        }
  
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, taskStatus: "In-Progress" } : t
          )
        );
  
        console.log(`Task ${task.id} marked as "In-Progress"`);
      } catch (error) {
        console.error("Error updating task status:", error);
      }
    }
  
    return updatedTask; // Return the updated task
  };
  

  return (
    <div className="organization-announcements-page">
      <Header />
      <div className="organization-announcements-container">
      <div className="sidebar-section">
        {renderSidebar()}
      </div>
<div className="main-content">
        <div className="header-container">
        <h1 className="headtitle">My Tasks</h1>
        {userRole === "president" || userRole === "officer" || userRole === "faculty" ? (
    <button
      className="create-new-btn"
      onClick={() => navigate(`/Organization/${organizationName}/Alltasks`)}
    >
      View All Tasks
    </button>
  ) : null}
</div>
          <div className="tksks-filters">
          <select
  value={filterByEvent}
  onChange={(e) => setFilterByEvent(e.target.value)}
  className="tksks-event-dropdown"
>
  <option value="All">All Events</option>
  <option value="General Task">General Task</option>
  {availableEvents.map((event) => (
    <option key={event.id} value={event.id}>
      {event.title}
    </option>
  ))}
</select>

  <select
    value={filterByStatus}
    onChange={(e) => setFilterByStatus(e.target.value)}
    className="tksks-status-dropdown"
  >
      <option value="All">All Statuses</option>
    <option value="Started">Started</option>
    <option value="In-Progress">In Progress</option>
    <option value="Completed">Completed</option>
    <option value="Overdue">Overdue</option>
    <option value="Extended">Extended</option>
    <option value="Extended-Overdue">Extended-Overdue</option>
  </select>
  <input
  type="date"
  className="tksks-date-dropdown"
  value={selectedDate} // Bind to selectedDate
  onChange={(e) => setSelectedDate(e.target.value)} // Update selectedDate state
  placeholder="Filter by Date"
/>
  <select
    value={sortOrder}
    onChange={(e) => setSortOrder(e.target.value)}
    className="tksks-sort-dropdown"
  >
    <option value="asc">ASC</option>
    <option value="desc">DESC</option>
  </select>

  <input
    type="text"
    placeholder="Search..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="tksks-search-input"
  />

 <button className="tksks-reset-btn" onClick={resetFilters}>
  <FontAwesomeIcon icon={faSync} />
  Reset
</button>
</div>

{isViewModalOpen && taskToView && (
  <div className="task-details-modal-overlay">
    <div className="task-details-modal-content">
    <button
        className="modalers-close-btn"
        onClick={closeViewModal}
        aria-label="Close"
      >
        &times;
      </button>
      <h3>Task Details</h3>
      <div className="task-details-info">
        <div className="task-details-row">
          <p><strong>Event:</strong> {taskToView.event || 'General Task'}</p>
        </div>
        <div className="task-details-row">
          <p><strong>Title:</strong> {taskToView.title}</p>
        </div>
        <div className="task-details-row">
          <p><strong>Description:</strong> {taskToView.description}</p>
        </div>
        <div className="task-details-row">
          <p><strong>Given by:</strong> {taskToView.givenBy}</p>
          <div>
            <strong>Assigned to:</strong>
          
            <ul>
              <li><strong>Members:</strong></li>
              {taskToView.assignedMembers.map((id) => {
                const member = availableMembers.find((m) => m.id === id);
                return <li key={id}>{member?.name || 'Unknown Member'}</li>;
              })}

              <li><strong>Committees:</strong></li>
              {taskToView.assignedCommittees.map((id) => {
                const committee = availableCommittees.find((c) => c.id === id);
                return <li key={id}>{committee?.name || 'Unknown Committee'}</li>;
              })}
            </ul>
          </div>
        </div>
        <div className="task-details-row">
          <p><strong>Start Date:</strong> 
            {new Date(taskToView.startDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            })}
          </p>
          <p><strong>Due Date:</strong> 
            {new Date(taskToView.dueDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            })}
          </p>
        </div>
        <div className="task-details-row">
          <p><strong>Status:</strong> 
            <span className={`status-badge ${taskToView.taskStatus.replace(' ', '-').toLowerCase()}`}>
              {taskToView.taskStatus}
            </span>
          </p>
        </div>
        <div className="task-details-row">
          <ul>
          <p><strong>File Attachments:</strong></p>
          {taskToView?.attachments && taskToView.attachments.length > 0 ? (
            taskToView.attachments.map((url, index) => {
              const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || `Attachment ${index + 1}`);
              return (
                <li key={index}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {fileName}
                  </a>
                </li>
              );
            })
          ) : (
            <p>No attachments</p>
          )}
        </ul>
        </div>
      </div>
      <div className="task-details-modal-actions">
  {isTaskReadyForSubmission(taskToView) && (
    <button
      onClick={() => {
        setSubmissionsTask(taskToView); // Ensure the selected task is set
        setIsSubmitModalOpen(true); // Open the modal
      }}
    >
      + Prepare Submission
    </button>
  )}
</div>
    </div>
  </div>
)}

{isSubmitModalOpen && submissionsTask && (
  <div className="Susz-modal-overlay">
    <div className="Susz-modal-content">
      <button
        className="Susz-modal-close-btn"
        onClick={() => {
          resetSubmissionForm(); // Reset form on close
          setIsSubmitModalOpen(false);
        }}
        aria-label="Close"
      >
        &times;
      </button>
      <h3>Submit Your Work for {submissionsTask.title}</h3>

      {/* Text Submission */}
      <textarea
        placeholder="Enter your text submission"
        value={textContent}
        onChange={(e) => setTextContent(e.target.value)}
        className="Susz-submission-textarea"
      />

 {/* File Upload */}
<div className="file-upload-container">
  <label htmlFor="file-upload" className="altask-file-bt">
    + Add File
  </label>
  <input
  id="file-upload"
  type="file"
  multiple
  onChange={(e) => {
    setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
  }}
  className="file-input-hidden"
/>

</div>

{/* Preview Selected Files */}
{attachments && attachments.length > 0 && (
  <div className="Susz-file-preview">
    <ul className="Susz-file-list">
      {attachments.map((attachment, index) => (
        <li key={index} className="Susz-file-item">
          {attachment.name}
          <button
            type="button"
            className="altask-file-remove-btn"
            onClick={() => {
              setAttachments((prev) => prev.filter((_, i) => i !== index));
            }}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  </div>
)}


      {/* Actions */}
      <div className="Susz-modal-actions">
        <button
          onClick={() => {
            handleSubmission(submissionsTask.id, textContent, attachments);
            setIsSubmitModalOpen(false);
            resetSubmissionForm();
            closeViewModal();
          }}
          className="Susz-submit-btn"
        >
          Submit
        </button>
        
      </div>
    </div>
  </div>
)}




{isSubmissionsModalOpen && submissionsTask && (
  <div className="submitmeninja-modal-overlay">
    <div className="submitmeninja-modal-content">
      {/* Modal Header */}
      <div className="submitmeninja-modal-header">
        <h3>Submissions for Task: {submissionsTask.title}</h3>
        <button
          className="submitmeninja-modal-close"
          onClick={closeSubmissionsModal}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      {submissionsTask.submissions &&
Array.isArray(submissionsTask.submissions) &&
submissionsTask.submissions.length > 0 ? (
  <>
   <div className="submitmeninja-tabs">
  {/* Navigation Buttons */}
  <button
    className="tab-navigation-button"
    onClick={() => {
      const newTab = Math.max(activeTab - 3, 1);
      setActiveTab(newTab);
    }}
    disabled={activeTab === 1}
  >
    &lt;
  </button>

  {/* Visible Tabs */}
  {submissionsTask.submissions
    .slice(
      Math.floor((activeTab - 1) / 3) * 3,
      Math.floor((activeTab - 1) / 3) * 3 + 3
    ) // Show 3 submissions at a time
    .map((_, index) => {
      const tabIndex = Math.floor((activeTab - 1) / 3) * 3 + index + 1; // Calculate the actual tab index
      return (
        <div
          key={tabIndex}
          className={`submitmeninja-tab ${
            activeTab === tabIndex ? "active" : ""
          }`}
          onClick={() => setActiveTab(tabIndex)} // Set the clicked tab as active
        >
          Submission {tabIndex}
        </div>
      );
    })}

  {/* Next Button */}
  <button
    className="tab-navigation-button"
    onClick={() => {
      // Move to the next set of tabs and set the first tab of that set as active
      const newTab = Math.floor((activeTab - 1) / 3) * 3 + 3 + 1; // First tab of the next set
      setActiveTab(newTab);
    }}
    disabled={Math.floor((activeTab - 1) / 3) * 3 + 3 >= submissionsTask.submissions.length} // Disable if there are no next tabs
  >
    &gt;
  </button>
</div>


 


          {/* Tab Content */}
          <div className="submitmeninja-tab-content">
            {(() => {
              const submission = submissionsTask.submissions?.[activeTab - 1];
              return submission ? (
                <div>
                  <p>
                    <strong>Submitted by:</strong> {submission.memberName}
                  </p>
                  <p className="submission-time">
                    {(() => {
                      const submissionDate = new Date(submission.date);
                      const now = new Date();
                      const diffMs = now.getTime() - submissionDate.getTime(); // Difference in ms
                      const diffMinutes = Math.floor(diffMs / (1000 * 60));
                      const diffHours = Math.floor(diffMinutes / 60);

                      if (diffMinutes < 60) {
                        return `${diffMinutes} minutes ago`;
                      } else if (diffHours < 24) {
                        return `${diffHours} hours ago`;
                      } else {
                        return submissionDate.toLocaleString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          hour12: true,
                        });
                      }
                    })()}
                  </p>
                  {/* Display text content */}
        {submission.textContent && (
          <div>
            <p>
    
            </p>
            <p>{submission.textContent}</p>
          </div>
        )}

                  {/* Display file attachments */}
        {submission.fileAttachments && submission.fileAttachments.length > 0 && (
             <div className="file-attachmentsKOKO">
            <p>
              <strong>File Attachments:</strong>
            </p>
            <ul>
              {submission.fileAttachments.map((fileUrl, index) => (
                 <li className="altask-file-item">
                  <span>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="altask-file-link"
                  >
                    {extractFileName(fileUrl)}
                  </a>
                  </span>
                </li>
              ))}
            </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p>No submission yet in Submission {activeTab}.</p>
              );
            })()}
          </div>

         {/* Comments Section */}
         <div className="submitmeninja-comments-section">
  <h4>Comments</h4>
  <div className="submitmeninja-comments-list">
    {comments[activeTab - 1]?.map((comment, index) => (
      <div key={index} className="submitmeninja-comment">
        <img
          src={comment.user.profilePicUrl}
          alt={`${comment.user.name}'s profile`}
          className="submitmeninja-comment-avatar"
        />
        <div className="submitmeninja-comment-content">
          <p className="submitmeninja-comment-author">
            {comment.user.name}
          </p>
          <p className="submitmeninja-comment-time">
            {(() => {
               const commentDate = new Date(comment.timestamp); // Parse timestamp
              const now = new Date();
              const diffMs = now.getTime() - commentDate.getTime();
              const diffMinutes = Math.floor(diffMs / (1000 * 60));
              const diffHours = Math.floor(diffMinutes / 60);

              if (diffMinutes < 60) {
                return `${diffMinutes} minutes ago`;
              } else if (diffHours < 24) {
                return `${diffHours} hours ago`;
              } else {
                return commentDate.toLocaleString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                  hour12: true,
                });
              }
            })()}
          </p>
          <p>{comment.text}</p>
        </div>
      </div>
    ))}
  </div>
  <textarea
    placeholder="Add a comment..."
    value={commentText}
    onChange={(e) => setCommentText(e.target.value)}
    className="submitmeninja-comment-box"
  ></textarea>
  <button
    className="submitmeninja-comment-submit"
    onClick={() => handleAddComment(activeTab - 1)}
  >
    Submit Comment
  </button>
</div>

        </>
      ) : (
        <p>No submissions found for this task.</p>
      )}
    </div>
  </div>
)}



      </div>
      
    </div>
    
    <div className="tablers-content">
    <div className="table-container">
              <DataTable
              columns={columns}
              data={filteredTasks}
              pagination
              highlightOnHover
              striped
              responsive
              noHeader
              defaultSortFieldId={1}
              defaultSortAsc={sortOrder === "asc"}
              onSort={(column, sortDirection) => setSortOrder(sortDirection)}
               />
              </div>  </div></div>
  );
};

export default MyTasks;
