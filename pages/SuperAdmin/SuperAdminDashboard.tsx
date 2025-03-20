import React, { useEffect, useState } from 'react';
import SuperAdminSidebar from './SuperAdminSidebar';
import { collection, getDocs, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../services/firebaseConfig';
import '../../styles/SuperAdminDashboard.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SuperAdminDashboard: React.FC = () => {
  const [totalAdmins, setTotalAdmins] = useState<number>(0);
  const [activeAdmins, setActiveAdmins] = useState<number>(0);
  const [adminActivity, setAdminActivity] = useState<any[]>([]);
  const [onlineAdmins, setOnlineAdmins] = useState<string[]>([]);
  const [dailyVisits, setDailyVisits] = useState<{ date: string; count: number }[]>([]);
  const DailyVisitsLineChart: React.FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };
  useEffect(() => {
    // Real-time listener for total and active admins
    const adminsCollection = collection(firestore, 'admin');

    const unsubscribe = onSnapshot(adminsCollection, (snapshot) => {
      setTotalAdmins(snapshot.size);

      // Filter admins who are online (activestatus: "active")
      const activeAdminsList = snapshot.docs
        .filter((doc) => doc.data().activestatus === 'active')
        .map((doc) => doc.data().email);

      setActiveAdmins(activeAdminsList.length);
      setOnlineAdmins(activeAdminsList);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Real-time listener for admin login/logout logs
    const logsCollection = collection(firestore, 'adminlogs');
    const logsQuery = query(logsCollection, orderBy('timestamp', 'desc'), limit(10));

    const unsubscribe = onSnapshot(logsQuery, async (logsSnapshot) => {
      const logsData = await Promise.all(
        logsSnapshot.docs.map(async (logDoc) => {
          const logData = logDoc.data();

          // Query admin collection to find the admin with the matching userID
          const adminQuery = query(collection(firestore, "admin"), where("userID", "==", logData.userID));
          const adminSnapshot = await getDocs(adminQuery);

          let adminName = "Unknown Admin";
          if (!adminSnapshot.empty) {
            const adminData = adminSnapshot.docs[0].data();
            adminName = `${adminData.firstName} ${adminData.lastName}`;
          }

          return {
            id: logDoc.id,
            adminName,
            action: logData.action,
            timestamp: logData.timestamp?.toDate
              ? logData.timestamp.toDate().toLocaleString()
              : "Unknown Time",
          };
        })
      );

      setAdminActivity(logsData);
    });

    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const fetchDailyVisits = async () => {
      const visitsCollection = collection(firestore, 'websiteVisits');
      const visitsQuery = query(visitsCollection, orderBy('timestamp', 'asc'));
  
      const visitsSnapshot = await getDocs(visitsQuery);
      const visitsData = visitsSnapshot.docs.map((doc) => ({
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));
  
      // Group visits by date
      const visitsByDate: { [date: string]: number } = {};
      visitsData.forEach((visit) => {
        const date = visit.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD format
        visitsByDate[date] = (visitsByDate[date] || 0) + 1;
      });
  
      // Format data for the line graph
      const formattedData = Object.keys(visitsByDate).map((date) => ({
        date,
        count: visitsByDate[date],
      }));
  
      setDailyVisits(formattedData);
    };
  
    fetchDailyVisits();
  }, []);


  return (
    <div className="super-admin-dashboard">
      <SuperAdminSidebar />
      <div className="super-admin-main">
      <div className="super-admin-grid">
          
          {/* Middle Section (Cards + Firestore Analytics) */}
          <div className="super-admin-dashboard-center">
            {/* Overview Cards */}
            <div className="super-admin-overview-cards">
              <div className="super-admin-card">
                
                <h3>Total Admins</h3>
                <p>{totalAdmins}</p>
              </div>

              <div className="super-admin-card">
                <h3>Online Admin/s</h3>
                <p>{activeAdmins}</p>
              </div>
            </div>

            <div className="super-admin-firestore-analytics">
  <h3>Daily Website Visits</h3>
  <DailyVisitsLineChart data={dailyVisits} />
</div>
          </div>

          {/* Admin Login Activity (Rightmost Side) */}
          <div className="super-admin-activity">
  <h2>Admin Login Activity</h2>
  <div className="super-admin-activity-container">
    {adminActivity.map((log, index) => {
      const isLogin = log.action.toLowerCase().includes("logged in");

      // Format the date as "March X, XXXX"
      const formattedDate = new Date(log.timestamp).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      return (
        <div key={log.id} className="super-admin-activity-entry">
          {/* Date Divider (Only show when the date changes) */}
          {(index === 0 || new Date(adminActivity[index - 1].timestamp).toDateString() !== new Date(log.timestamp).toDateString()) && (
            <div className="super-admin-activity-date">
              {formattedDate}
            </div>
          )}

          {/* Activity Entry */}
          <div className="super-admin-activity-content">
            <div className={`super-admin-activity-icon ${isLogin ? "green" : "red"}`}>
              ●
            </div>
            <div className="super-admin-activity-info">
              <strong>{log.adminName}</strong>
              <p>{log.action}</p>
              <small>{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}</small>
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>


        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;