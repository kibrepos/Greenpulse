import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, DocumentSnapshot,startAfter,Timestamp  } from 'firebase/firestore';
import {  firestore } from '../../services/firebaseConfig';
import '../../styles/OrganizationActivityLogs.css'; 
import Header from '../../components/Header'; 
import StudentPresidentSidebar from './StudentPresidentSidebar'; 

interface LogEntry {
  id: string;
  userName: string;
  description: string;
  timestamp: string;
}

const OrganizationActivityLogs: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [newLogCount, setNewLogCount] = useState<number>(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (organizationName) {
        // Reference the activitylogs subcollection
        const logsCollection = collection(firestore, `studentlogs/${organizationName}/activitylogs`);
        const q = query(logsCollection, orderBy('timestamp', 'desc'), limit(10));
  
        const logSnapshot = await getDocs(q);
        const fetchedLogs: LogEntry[] = logSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            userName: data.userName,
            description: data.description,
            timestamp: data.timestamp instanceof Timestamp
              ? data.timestamp.toDate().toLocaleString()
              : new Date(data.timestamp).toLocaleString(), // Fallback for unexpected format
          };
        });
  
        setLogs(fetchedLogs);
        setLastVisible(logSnapshot.docs[logSnapshot.docs.length - 1]); // Track the last document for pagination
      }
    } catch (error) {
      console.error("Error fetching logs: ", error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMoreLogs = async () => {
    if (!lastVisible || loadingMore) return;
  
    setLoadingMore(true);
    try {
      // Reference the activitylogs subcollection
      const logsCollection = collection(firestore, `studentlogs/${organizationName}/activitylogs`);
      const q = query(
        logsCollection,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible), // Fetch after the last visible document
        limit(10)
      );
  
      const logSnapshot = await getDocs(q);
      const fetchedLogs: LogEntry[] = logSnapshot.docs.map((doc) => ({
        id: doc.id,
        userName: doc.data().userName,
        description: doc.data().description,
        timestamp: doc.data().timestamp instanceof Timestamp
          ? doc.data().timestamp.toDate().toLocaleString()
          : new Date(doc.data().timestamp).toLocaleString(),
      }));
  
      setLogs((prevLogs) => [...prevLogs, ...fetchedLogs]);
      setLastVisible(logSnapshot.docs[logSnapshot.docs.length - 1]); // Update lastVisible for further pagination
    } catch (error) {
      console.error("Error fetching more logs: ", error);
    } finally {
      setLoadingMore(false);
    }
  };
  

  useEffect(() => {
    fetchLogs();
  }, [organizationName]);


  const formatDescription = (description: string) => {
    // Check if description contains a specific pattern for deleted files
    if (description.startsWith("Deleted")) {
      // Extract the number of files, path, and file names
      const match = description.match(/^Deleted (\d+) file\(s\) in ([^:]+):\s*(.*)$/);
  
      if (match) {
        const numberOfFiles = match[1]; // Extract the number of files
        const path = match[2]; // Extract the path where the files are deleted
        const filesDeleted = match[3]?.split(" • ").map(file => file.trim()) || []; // Files separated by " • "
  
        return (
          <div className="deleted-files-container">
            {/* Display the message with the number of files and path */}
            <p>Deleted {numberOfFiles} file(s) in {path}:</p>
  
            {/* Display each file on a new line */}
            <ul>
              {filesDeleted.map((file, index) => (
                <li key={index}>{file}</li>
              ))}
            </ul>
          </div>
        );
      }
    }
  
    // If it's not related to deleted files, just return the description text
    return <span>{description}</span>;
  };
  


  return (
    <div className="OAC-organization-dashboard-wrapper">
      <Header />

      <div className="OAC-dashboard-container">
        <div className="OAC-sidebar-section">
          <StudentPresidentSidebar />
        </div>
      </div>

        <div className="OAC-activity-logs-content">
        <div className="header-container">
        <h1 className="headtitle">{organizationName} Activity Logs</h1>
          </div>
          {loading ? (
            <p>Loading logs...</p>
          ) : (
            <div className="OAC-logs-container">
              <ul className="OAC-logs-list">
                {logs.length === 0 ? (
                  <p>No logs available for this organization.</p>
                ) : (
                  logs.map(log => (
                    <li key={log.id} className="OAC-log-item">
                      <div className="OAC-log-user-name">{log.userName}</div>
                    <div className="OAC-log-message-container">
  <p className="OAC-log-message">
    {log.description.includes('Deleted') ? formatDescription(log.description) : log.description}
  </p>
</div>

                      <span className="OAC-log-timestamp">{log.timestamp}</span>
                    </li>
                  ))
                )}
              </ul>
              {lastVisible ? (
  <div className="load-more-wrapper">
    <button
      onClick={fetchMoreLogs}
      disabled={loadingMore}
      className="load-more-button"
    >
      {loadingMore ? "Loading..." : "Load More Logs"}
    </button>
  </div>
) : (
  <div className="load-more-wrapper">
    <button disabled className="load-more-button">
      All logs loaded
    </button>
  </div>
)}
            </div>
          )}
        </div>
      </div>

  );
};

export default OrganizationActivityLogs;
