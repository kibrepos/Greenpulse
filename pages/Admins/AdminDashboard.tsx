import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, firestore } from "../../services/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, Timestamp, onSnapshot } from "firebase/firestore";
import '../../styles/AdminDashboard.css'; 
import AdminSidebar from './AdminSidebar';

const AdminDashboard: React.FC = () => {
  const [lastName, setLastName] = useState<string | null>(null);
  const [eventStats, setEventStats] = useState({
    upcoming: 0,
    ongoing: 0,
    completed: 0,
  });
  const [registeredUsers, setRegisteredUsers] = useState<number>(0);
  const [recentActivities, setRecentActivities] = useState<
    Array<{ activity: string; userName: string; role: string; timestamp: string }>
  >([]);
  const [todayDate, setTodayDate] = useState<string>("");

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!user.emailVerified) {
          navigate("/verify-email");
        } else {
          try {
            const adminQuery = query(collection(firestore, "admin"), where("userID", "==", user.uid));
            const querySnapshot = await getDocs(adminQuery);
            
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const userData = userDoc.data();
              setLastName(userData.lastName);
            }
            
            
            // Fetch event statistics
            await fetchEventStats();

            // Fetch registered users count
            await fetchRegisteredUsers();

            // Fetch recent activities or logs for today
            await fetchRecentActivities();

          } catch (err) {
            console.error("Error fetching data:", err);
          }
        }
      } else {
        navigate("/login");
      }
    });

    // Set today's date
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    setTodayDate(`${currentDate} - today`);

    return () => unsubscribe();
  }, [navigate]);


  const fetchEventStats = () => {
    if (!firestore) return;
  
    let upcoming = 0;
    let ongoing = 0;
    let completed = 0;
  
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
  
    try {
      // Fetch all organizations in real-time
      const organizationsCollection = collection(firestore, "organizations");
  
      return onSnapshot(organizationsCollection, async (orgSnapshot) => {
        upcoming = 0;
        ongoing = 0;
        completed = 0;
  
        const fetchEventsForOrg = (orgId: string) => {
          const eventsCollection = collection(firestore, `events/${orgId}/event`);
          const archivedEventsCollection = collection(firestore, `events/${orgId}/archivedEvents`);
  
          // Listen for real-time changes in both collections
          const eventUnsub = onSnapshot(eventsCollection, (eventSnapshot) => {
            processEvents(eventSnapshot);
          });
  
          const archivedEventUnsub = onSnapshot(archivedEventsCollection, (archivedSnapshot) => {
            processEvents(archivedSnapshot);
          });
  
          return () => {
            eventUnsub();
            archivedEventUnsub();
          };
        };
  
        const processEvents = (snapshot: any) => {
          snapshot.forEach((doc: any) => {
            const event = doc.data();
            if (!event.eventDates || event.eventDates.length === 0) return;
  
            const eventStartDates = event.eventDates.map((date: any) => new Date(date.startDate));
            const eventEndDates = event.eventDates.map((date: any) => new Date(date.endDate));
  
            const eventMonth = eventStartDates[0].getMonth();
            const eventYear = eventStartDates[0].getFullYear();
  
            if (eventYear === currentYear && eventMonth === currentMonth) {
              const isCompleted = eventEndDates.every((date: Date) => date < now);
              const isUpcoming = eventStartDates.every((date: Date) => date > now);
              const isOngoing = eventStartDates.some((startDate: Date, index: number) => {
                const endDate = eventEndDates[index];
                return startDate <= now && endDate >= now;
              });
  
              if (isCompleted) {
                completed++;
              } else if (isUpcoming) {
                upcoming++;
              } else if (isOngoing) {
                ongoing++;
              }
            }
          });
  
          // Update state with latest event counts
          setEventStats({ upcoming, ongoing, completed });
        };
  
        // Set up listeners for all organizations
        const unsubscribers = orgSnapshot.docs.map((org) => fetchEventsForOrg(org.id));
  
        return () => {
          unsubscribers.forEach((unsub) => unsub());
        };
      });
    } catch (error) {
      console.error("Error fetching event statistics:", error);
    }
  };
  
  

  const fetchRegisteredUsers = async () => {
    try {
      const studentsCollection = collection(firestore, "students");
      const facultyCollection = collection(firestore, "faculty");
  
      const studentsSnapshot = await getDocs(studentsCollection);
      const facultySnapshot = await getDocs(facultyCollection);
  
      const totalRegisteredUsers = studentsSnapshot.size + facultySnapshot.size;
      setRegisteredUsers(totalRegisteredUsers);
    } catch (error) {
      console.error("Error fetching registered users:", error);
    }
  };

  const fetchRecentActivities = async () => {
    const logsCollection = collection(firestore, "logs");

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to the beginning of the day
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Set to the beginning of tomorrow

    const todayStart = Timestamp.fromDate(today);
    const tomorrowStart = Timestamp.fromDate(tomorrow);

    const logsQuery = query(logsCollection, where("timestamp", ">=", todayStart), where("timestamp", "<", tomorrowStart));
    const logsSnapshot = await getDocs(logsQuery);

    if (!logsSnapshot.empty) {
      const activities = logsSnapshot.docs.map((doc) => {
        const activityData = doc.data();
        return {
          activity: activityData.activity,
          userName: activityData.userName,
          role: activityData.role || "student", // Default role to "student" if not found
          timestamp: activityData.timestamp.toDate().toLocaleTimeString(),
        };
      });

      setRecentActivities(activities);
    } else {
      console.log("No activities found for today.");
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-main">
        <AdminSidebar />
        <div className="admin-dashboard-content">
        <h2 className="PageTitle"> Welcome Admin {lastName}</h2>
            
          {/* Event Stats Overview */}
          <div className="stats-overview">
            <Link to="/Admin/EventsManagement" className="stats-card">
              <h3>Upcoming Events</h3>
              <p>{eventStats.upcoming}</p>
            </Link>
            <Link to="/Admin/EventsManagement" className="stats-card">
              <h3>Ongoing Events</h3>
              <p>{eventStats.ongoing}</p>
            </Link>
            <Link to="/Admin/EventsManagement" className="stats-card">
          
            <h3>
  Completed Events  
  <br></br>
  <span style={{ color: "gray", fontSize: "1rem", }}>
    ({new Date().toLocaleString("en-US", { month: "long", year: "numeric" })})
  </span>
</h3>


  <p>{eventStats.completed}</p>
</Link>

            <Link to="/Admin/Manage-Students" className="stats-card">
              <h3>Registered Users</h3>
              <p>{registeredUsers}</p>
            </Link>
          </div>

          {/* Date (fixed, does not scroll) */}
          <div className="activities-date">{todayDate}</div>

          {/* Scrollable Recent Activities (this will scroll) */}
          <div className="recent-activities">
            <ul className={`activity-timeline ${recentActivities.length === 0 ? 'no-activities' : ''}`}>
              {recentActivities.length > 0 ? (
                recentActivities
                  .slice()
                  .reverse()
                  .map((activity, index) => (
                    <li key={index} className="activity-item">
                      <span className="activity-timestamp">{activity.timestamp}</span>
                      <div className="activity-details">
                        <div className="activity-user-name-role">
                          <p className="activity-user-name">{activity.userName}</p>
                          <p className="activity-user-roleq">{activity.role}</p>
                        </div>
                        <p className="activity-description">{activity.activity}</p>
                      </div>
                    </li>
                  ))
              ) : (
                <p>No activities for today.</p>
              )}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
