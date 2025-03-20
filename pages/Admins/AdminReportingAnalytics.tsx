import React, { useState, useEffect } from 'react';
import { firestore } from '../../services/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import AdminSidebar from './AdminSidebar';
import { Line } from 'react-chartjs-2';
import '../../styles/AdminReportingAnalytics.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const AdminReportingAnalytics: React.FC = () => {
  const [userStats, setUserStats] = useState<any>({ labels: [], data: [] }); // User engagement statistics
  const [eventStats, setEventStats] = useState<any>({ labels: [], data: [] }); // Event stats

  useEffect(() => {
    fetchUserStats();
    fetchEventStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const usersCollection = collection(firestore, 'logs');
      const logsSnapshot = await getDocs(usersCollection);

      const userActivityData: any = {
        labels: [],
        data: [],
      };

      logsSnapshot.docs.forEach((doc) => {
        const log = doc.data();
        const date = new Date(log.timestamp.seconds * 1000).toLocaleDateString();

        if (!userActivityData.labels.includes(date)) {
          userActivityData.labels.push(date);
          userActivityData.data.push(1);
        } else {
          const index = userActivityData.labels.indexOf(date);
          userActivityData.data[index]++;
        }
      });

      setUserStats(userActivityData);
    } catch (err) {
      console.error('Error fetching user activity stats:', err);
    }
  };

  const fetchEventStats = async () => {
    try {
      const eventsCollection = collection(firestore, 'events');
      const eventsSnapshot = await getDocs(eventsCollection);

      const eventParticipationData: any = {
        labels: [],
        data: [],
      };

      eventsSnapshot.docs.forEach((doc) => {
        const event = doc.data();
        const eventDate = new Date(event.startDate.seconds * 1000).toLocaleDateString();

        if (!eventParticipationData.labels.includes(eventDate)) {
          eventParticipationData.labels.push(eventDate);
          eventParticipationData.data.push(event.participants ? event.participants.length : 0);
        } else {
          const index = eventParticipationData.labels.indexOf(eventDate);
          eventParticipationData.data[index] += event.participants ? event.participants.length : 0;
        }
      });

      setEventStats(eventParticipationData);
    } catch (err) {
      console.error('Error fetching event stats:', err);
    }
  };

  const userChartData = {
    labels: userStats.labels,
    datasets: [
      {
        label: 'User Activity',
        data: userStats.data,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
    ],
  };

  const eventChartData = {
    labels: eventStats.labels,
    datasets: [
      {
        label: 'Event Participation',
        data: eventStats.data,
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
      },
    ],
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-main">
        <AdminSidebar />
        <div className="admin-dashboard-content">
          <h2>Reporting & Analytics</h2>

          <div className="stats-overview">
            <div className="stats-card">
              <h3>User Engagement</h3>
              <p>{userStats.labels.length} Days of Activity</p>
            </div>
            <div className="stats-card">
              <h3>Event Participation</h3>
              <p>{eventStats.labels.length} Events Tracked</p>
            </div>
          </div>

          <div className="analytics-charts">
            <div className="chart-container">
              <h3>User Activity Over Time</h3>
              <Line data={userChartData} options={{ responsive: true }} />
            </div>
            <div className="chart-container">
              <h3>Event Participation Over Time</h3>
              <Line data={eventChartData} options={{ responsive: true }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReportingAnalytics;
