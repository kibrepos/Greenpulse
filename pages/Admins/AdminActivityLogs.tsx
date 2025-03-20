import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  getCountFromServer,
} from "firebase/firestore";
import { firestore } from "../../services/firebaseConfig";
import "../../styles/AdminActivityLogs.css";
import AdminSidebar from "./AdminSidebar";
import ReactPaginate from 'react-paginate';

// Define the type for a log entry
type LogEntry = {
  id: string;
  activity: string;
  userName: string;
  role: string; // Add role
  timestamp: string;
};

const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const logsPerPage = 20; // Number of logs per page
  const [filterSearchInput, setFilterSearchInput] = useState("");
  const [filterSortBy, setFilterSortBy] = useState("desc");
  const [filterSelectedDate, setFilterSelectedDate] = useState("");

  useEffect(() => {
    const fetchTotalDocumentCount = async () => {
      try {
        const logsCollection = collection(firestore, "logs");
        const snapshot = await getCountFromServer(logsCollection);
        setPageCount(Math.ceil(snapshot.data().count / logsPerPage));
      } catch (error) {
        console.error("Error fetching count:", error);
      }
    };

    fetchTotalDocumentCount();
  }, []);

  const fetchLogs = async (page: number, lastDoc: QueryDocumentSnapshot<DocumentData> | null) => {
    setLoading(true);
    try {
      let logsQuery = query(
        collection(firestore, "logs"),
        orderBy("timestamp", filterSortBy === "desc" ? "desc" : "asc"),
        limit(logsPerPage)
      );

      // Apply filters
      if (filterSearchInput) {
        logsQuery = query(
          logsQuery,
          where("activity", ">=", filterSearchInput),
          where("activity", "<=", filterSearchInput + "\uf8ff")
        );
      }

      if (filterSelectedDate) {
        const startDate = Timestamp.fromDate(new Date(filterSelectedDate));
        const endDate = Timestamp.fromDate(new Date(filterSelectedDate + "T23:59:59"));
        logsQuery = query(
          logsQuery,
          where("timestamp", ">=", startDate),
          where("timestamp", "<=", endDate)
        );
      }

      // Apply pagination (fetch only next batch)
      if (page > 0 && lastDoc) {
        logsQuery = query(logsQuery, startAfter(lastDoc));
      }

      const logsSnapshot = await getDocs(logsQuery);
      const logsData = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        activity: doc.data().activity,
        userName: doc.data().userName,
        role: doc.data().role || "student",
        timestamp: doc.data().timestamp.toDate().toLocaleString(),
      }));

      setLogs(logsData);
      setLastVisible(logsSnapshot.docs[logsSnapshot.docs.length - 1] || null);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageClick = (selectedPage: { selected: number }) => {
    setCurrentPage(selectedPage.selected);
  };


  useEffect(() => {
    fetchLogs(currentPage, lastVisible);
  }, [currentPage, filterSortBy, filterSearchInput, filterSelectedDate]);

  const handleApplyFilters = () => {
    setCurrentPage(0);
    setLastVisible(null);
  };
  

  const handleResetFilters = async () => {
    setFilterSearchInput("");
    setFilterSortBy("desc");
    setFilterSelectedDate("");
    setCurrentPage(0); // Reset to first page
    setLastVisible(null); // Reset last visible document
    await fetchLogs(0, null);
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-main">
        <AdminSidebar />
        <div className="admin-dashboard-content">
          <h2>Activity Logs</h2>
          <div className="filters-section">
            <input
              type="text"
              value={filterSearchInput}
              placeholder="Search..."
              onChange={(e) => setFilterSearchInput(e.target.value)}
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
          <div className="logs-list">
            {loading ? (
              <p>Loading...</p>
            ) : logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="log-item">
                  <p className="log-user-name">
                    {log.userName} ({log.role})
                  </p>
                  <p>
                    {log.activity}
                    <span className="log-timestamp">{log.timestamp}</span>
                  </p>
                </div>
              ))
            ) : (
              <p>No recent activities found.</p>
            )}
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
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;