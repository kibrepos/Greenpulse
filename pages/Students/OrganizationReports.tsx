import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import ReactPaginate from "react-paginate";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { firestore } from "../../services/firebaseConfig";
import Header from "../../components/Header";
import StudentPresidentSidebar from "./StudentPresidentSidebar";
import "../../styles/OrganizationReports.css";
import { Chart } from "chart.js/auto";
import { useParams } from "react-router-dom";
import { ChartConfiguration } from 'chart.js';

const OrganizationReports: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationData, setOrganizationData] = useState<any | null>(null);
  const navigate = useNavigate(); // Initialize navigate
  const chartInstances: { [key: string]: Chart } = {};
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visibleActiveEvents, setVisibleActiveEvents] = useState(5); // Tracks how many active events to show
  const [visibleArchivedEvents, setVisibleArchivedEvents] = useState(5); // Tracks how many archived events to show
  const [archivedSearchQuery, setArchivedSearchQuery] = useState<string>(""); // State for archived events search query
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>(""); // State for active events search query
  const [activeCurrentPage, setActiveCurrentPage] = useState(0);
  const [archivedCurrentPage, setArchivedCurrentPage] = useState(0);
  const itemsPerPage = 5;
  
  const getPaginatedEvents = (events: any[], page: number) => {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return events.slice(startIndex, endIndex);
  };
  
  
  const handleSearchActiveEvents = (query: string) => {
    setActiveSearchQuery(query.toLowerCase()); // Update the search query state
  };
  
  const handleSearchArchivedEvents = (query: string) => {
    setArchivedSearchQuery(query.toLowerCase()); // Update the search query state
  };
  
  const filteredMembers = organizationData?.members?.filter((member: any) =>
    member.name.toLowerCase().startsWith(searchQuery.toLowerCase())
  );
  
  const filteredOfficers = organizationData?.officers?.filter((officer: any) =>
    officer.name.toLowerCase().startsWith(searchQuery.toLowerCase())
  );
  
  const isPresidentMatching = organizationData?.president?.name
    ?.toLowerCase()
    .startsWith(searchQuery.toLowerCase());
  
  

  useEffect(() => {
    if (organizationData) {
      const membersToRender = [
        ...(organizationData.members || []), // Include regular members
        ...(organizationData.officers || []), // Include officers
        ...(organizationData.president ? [organizationData.president] : []), // Include the president
      ];
  
      batchRenderCharts(membersToRender);
    }
  }, [organizationData, tasks, events, organizationName]);
  
  
  
  useEffect(() => {
    return () => {
      Object.values(chartInstances).forEach((chart) => {
        if (chart) {
          chart.destroy();
        }
      });
    };
  }, []);
  
  
  const renderChart = (
    chartKey: string,
    canvasId: string,
    config: ChartConfiguration
  ) => {
    const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
  
    if (ctx) {
      // Destroy any existing chart tied to the canvas
      const existingChart = Chart.getChart(ctx);
      if (existingChart) existingChart.destroy();
  
      const updatedConfig = {
        ...config,
        options: {
          ...config.options,
          plugins: {
            ...config.options?.plugins,
            legend: {
              display: false, // Disable legend
            },
          },
          scales: {
            y: {
              ticks: {
                stepSize: 1, // Display only whole numbers
              },
            },
          },
        },
      };
  
      // Create and store a new chart instance
      chartInstances[chartKey] = new Chart(ctx, updatedConfig);
    }
  };
  
  
  const batchRenderCharts = async (members: any[]) => {
    const batchSize = 10; // Render 10 charts at a time
    let currentBatchIndex = 0;
  
    const renderNextBatch = async () => {
      const batch = members.slice(
        currentBatchIndex,
        currentBatchIndex + batchSize
      );
  
      for (const member of batch) {
        if (!member.id) continue;
  
        let tasksAssigned = 0;
        let tasksCompleted = 0;
        let tasksOverdue = 0;
  
        // Calculate task statistics
        tasks.forEach((task) => {
          if (task.assignedMembers?.includes(member.id)) {
            tasksAssigned++;
            if (task.taskStatus === "Completed") tasksCompleted++;
            if (task.taskStatus === "Overdue") tasksOverdue++;
          }
        });
  
        let eventsAttended = 0;
        let eventsAbsent = 0;
        let eventsLate = 0;
  
        // Calculate event attendance statistics
        for (const event of events) {
          const attendanceCollection = collection(
            firestore,
            `events/${organizationName}/${event.isArchived ? "archivedEvents" : "event"}/${event.id}/attendance`
          );
  
          const attendanceSnapshot = await getDocs(attendanceCollection);
  
          attendanceSnapshot.docs.forEach((doc) => {
            const attendees = doc.data()?.attendees || [];
            const attendanceRecord = attendees.find(
              (attendee: any) => attendee.userId === member.id
            );
  
            if (attendanceRecord) {
              if (attendanceRecord.status === "Present") eventsAttended++;
              if (attendanceRecord.status === "Absent") eventsAbsent++;
              if (attendanceRecord.status === "Late") eventsLate++;
            }
          });
        }
  
        // Render Event Attendance Chart
        renderChart(
          `eventStatsChart-${member.id}`,
          `eventStatsChart-${member.id}`,
          {
            type: "bar",
            data: {
              labels: ["Events Attended", "Events Absent", "Events Late"],
              datasets: [
                {
                  label: `${member.name}'s Event Attendance`,
                  data: [eventsAttended, eventsAbsent, eventsLate],
                  backgroundColor: ["#63df63", "#ff8282", "#efaf6f"],
                },
              ],
            },
          }
        );
  
        // Render Task Statistics Chart
        renderChart(
          `taskStatsChart-${member.id}`,
          `taskStatsChart-${member.id}`,
          {
            type: "bar",
            data: {
              labels: ["Tasks Assigned", "Tasks Completed", "Tasks Overdue"],
              datasets: [
                {
                  label: `${member.name}'s Task Statistics`,
                  data: [tasksAssigned, tasksCompleted, tasksOverdue],
                  backgroundColor: ["#36A2EB", "#63df63", "#ff8282"],
                },
              ],
            },
          }
        );
      }
  
      currentBatchIndex += batchSize;
  
      if (currentBatchIndex < members.length) {
        setTimeout(renderNextBatch, 100); // Render next batch after 100ms
      }
    };
  
    await renderNextBatch();
  };
  
  

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!organizationName) return;
      try {
        const organizationDoc = doc(
          firestore,
          `organizations/${organizationName}`
        );
        const organizationSnapshot = await getDoc(organizationDoc);
        setOrganizationData(organizationSnapshot.data() || {});
      } catch (error) {
        console.error("Error fetching organization data:", error);
      }
    };
  
    fetchOrganizationData();
  }, [organizationName]);
  

  useEffect(() => {
    const fetchEvents = async () => {
      if (!organizationName) return;
    
      try {
        // Fetch active events
        const eventCollection = collection(
          firestore,
          `events/${organizationName}/event`
        );
        const eventSnapshot = await getDocs(eventCollection);
        const fetchedEvents = eventSnapshot.docs.map((doc) => ({
          id: doc.id,
          isArchived: false, // Mark as active event
          ...doc.data(),
        }));
    
        // Fetch archived events
        const archivedEventCollection = collection(
          firestore,
          `events/${organizationName}/archivedEvents`
        );
        const archivedEventSnapshot = await getDocs(archivedEventCollection);
        const fetchedArchivedEvents = archivedEventSnapshot.docs.map((doc) => ({
          id: doc.id,
          isArchived: true, // Mark as archived event
          ...doc.data(),
        }));
    
        // Combine active and archived events
        setEvents([...fetchedEvents, ...fetchedArchivedEvents]);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };
    

    const fetchTasks = async () => {
      if (!organizationName) return;
      try {
        // Fetch tasks from AllTasks
        const allTasksCollection = collection(
          firestore,
          `tasks/${organizationName}/AllTasks`
        );
        const allTasksSnapshot = await getDocs(allTasksCollection);
        const fetchedAllTasks = allTasksSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          isArchived: false, 
        }));
    
        const archivedTasksCollection = collection(
          firestore,
          `tasks/${organizationName}/archivedTasks`
        );
        const archivedTasksSnapshot = await getDocs(archivedTasksCollection);
        const fetchedArchivedTasks = archivedTasksSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          isArchived: true, // Mark tasks as archived
        }));
    
        // Combine both fetched tasks
        setTasks([...fetchedAllTasks, ...fetchedArchivedTasks]);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };
    

    fetchEvents();
    fetchTasks();
  }, [organizationName]);

 
  
  const handleEventClick = (event: any) => {
    if (!event || !event.id) {
      console.error("Invalid event object:", event);
      return;
    }
    // Navigate to the specific event page
    navigate(`/Organization/${organizationName}/report/${event.id}`);
  };
 
  


  return (
    <div className="organization-announcements-page">
      <Header />
      <div className="organization-announcements-container">
        <div className="sidebar-section">
          <StudentPresidentSidebar />
        </div>

        <div className="organization-announcements-content">
       <div className="header-container">
         <h1 className="headtitle">organization Reports</h1>
       
      
           </div>



        <div className="okokok-active-events">
  <h3 className="okokok-event-category">Active Events</h3>
  <input
    type="text"
    className="okokok-search-input"
    placeholder="Search Active Events..."
    onChange={(e) => handleSearchActiveEvents(e.target.value)}
  />
  <div className="okokok-event-scrollable">
    {getPaginatedEvents(
      events.filter(
        (event) =>
          !event.isArchived &&
          event.title.toLowerCase().startsWith(activeSearchQuery)
      ),
      activeCurrentPage
    ).length === 0 ? (
      <p className="okokok-no-events">No event found</p>
    ) : (
      getPaginatedEvents(
        events.filter(
          (event) =>
            !event.isArchived &&
            event.title.toLowerCase().startsWith(activeSearchQuery)
        ),
        activeCurrentPage
      ).map((event) => (
        <div
          key={event.id}
          className="okokok-event-item"
          onClick={() => handleEventClick(event)}
        >
          {event.title}
        </div>
      ))
    )}

    {/* Pagination Controls for Active Events */}
    <ReactPaginate
      previousLabel={"Previous"}
      nextLabel={"Next"}
      breakLabel={"..."}
      pageCount={Math.ceil(
        events.filter(
          (event) =>
            !event.isArchived &&
            event.title.toLowerCase().startsWith(activeSearchQuery)
        ).length / itemsPerPage
      )}
      marginPagesDisplayed={2}
      pageRangeDisplayed={3}
      onPageChange={({ selected }) => setActiveCurrentPage(selected)}
      containerClassName={"pagination-controls"}
      activeClassName={"active"}
      disabledClassName={"disabled"}
    />
  </div>
</div>


<div className="okokok-archived-events">
  <h3 className="okokok-event-category">Archived Events</h3>
  <input
    type="text"
    className="okokok-search-input"
    placeholder="Search Archived Events..."
    onChange={(e) => handleSearchArchivedEvents(e.target.value)}
  />
  <div className="okokok-event-scrollable">
    {getPaginatedEvents(
      events.filter(
        (event) =>
          event.isArchived &&
          event.title.toLowerCase().startsWith(archivedSearchQuery)
      ),
      archivedCurrentPage
    ).length === 0 ? (
      <p className="okokok-no-events">No event found</p>
    ) : (
      getPaginatedEvents(
        events.filter(
          (event) =>
            event.isArchived &&
            event.title.toLowerCase().startsWith(archivedSearchQuery)
        ),
        archivedCurrentPage
      ).map((event) => (
        <div
          key={event.id}
          className="okokok-event-item okokok-event-archived"
          onClick={() => handleEventClick(event)}
        >
          {event.title}
        </div>
      ))
    )}

    {/* Pagination Controls for Archived Events */}
    <ReactPaginate
      previousLabel={"Previous"}
      nextLabel={"Next"}
      breakLabel={"..."}
      pageCount={Math.ceil(
        events.filter(
          (event) =>
            event.isArchived &&
            event.title.toLowerCase().startsWith(archivedSearchQuery)
        ).length / itemsPerPage
      )}
      marginPagesDisplayed={2}
      pageRangeDisplayed={3}
      onPageChange={({ selected }) => setArchivedCurrentPage(selected)}
      containerClassName={"pagination-controls"}
      activeClassName={"active"}
      disabledClassName={"disabled"}
    />
  </div>
</div>







       
<div id="oraoramember-analytics">
  <h2 className="oraora-title">Member Analytics</h2>

  <div id="oraoramember-search">
    <input
      type="text"
      className="eventoreporto-search-input"
      placeholder="Search member"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>

  {/* Safeguard against undefined values */}
  {(!isPresidentMatching && (!filteredOfficers || filteredOfficers.length === 0) && (!filteredMembers || filteredMembers.length === 0)) ? (
    <p className="oraora-no-results">No one matched your search.</p>
  ) : (
    <>
      {/* President Section */}
      {isPresidentMatching && organizationData?.president && (
        <div className="oraora-section">
          <h3 className="oraora-subtitle">Officers</h3>
          <div key={organizationData.president.id} className="oraoramember-item">
            <div className="oraoramember-info">
              <img
                src={organizationData.president.profilePicUrl || "https://via.placeholder.com/50"}
                alt={`${organizationData.president.name}'s profile`}
                className="oraoramember-image"
              />
              <div>
                <h4 className="oraoramember-name">{organizationData.president.name}</h4>
                <p className="oraoramember-role">President</p>
              </div>
            </div>
            <div className="oraoramember-charts-container">
              <div className="oraoramember-chart-box">
                <h4 className="oraoramember-chart-title">Task Statistics</h4>
                <canvas id={`taskStatsChart-${organizationData.president.id}`}></canvas>
              </div>
              <div className="oraoramember-chart-box">
                <h4 className="oraoramember-chart-title">Event Attendance</h4>
                <canvas id={`eventStatsChart-${organizationData.president.id}`}></canvas>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Officers Section */}
      {filteredOfficers && filteredOfficers.length > 0 && (
        <div className="oraora-section">
       
          {filteredOfficers.map((officer: any) => (
            <div key={officer.id} className="oraoramember-item">
              <div className="oraoramember-info">
                <img
                  src={officer.profilePicUrl || "https://via.placeholder.com/50"}
                  alt={`${officer.name}'s profile`}
                  className="oraoramember-image"
                />
                <div>
                  <h4 className="oraoramember-name">{officer.name}</h4>
                  <p className="oraoramember-role">{officer.role}</p>
                </div>
              </div>
              <div className="oraoramember-charts-container">
                <div className="oraoramember-chart-box">
                  <h4 className="oraoramember-chart-title">Task Statistics</h4>
                  <canvas id={`taskStatsChart-${officer.id}`}></canvas>
                </div>
                <div className="oraoramember-chart-box">
                  <h4 className="oraoramember-chart-title">Event Attendance</h4>
                  <canvas id={`eventStatsChart-${officer.id}`}></canvas>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members Section */}
      {filteredMembers && filteredMembers.length > 0 && (
        <div className="oraora-section">
          <h3 className="oraora-subtitle">Members</h3>
          {filteredMembers.map((member: any) => (
            <div key={member.id} className="oraoramember-item">
              <div className="oraoramember-info">
                <img
                  src={member.profilePicUrl || "https://via.placeholder.com/50"}
                  alt={`${member.name}'s profile`}
                  className="oraoramember-image"
                />
                <div>
                  <h4 className="oraoramember-name">{member.name}</h4>
                  <p className="oraoramember-role">Member</p>
                </div>
              </div>
              <div className="oraoramember-charts-container">
                <div className="oraoramember-chart-box">
                  <h4 className="oraoramember-chart-title">Task Statistics</h4>
                  <canvas id={`taskStatsChart-${member.id}`}></canvas>
                </div>
                <div className="oraoramember-chart-box">
                  <h4 className="oraoramember-chart-title">Event Attendance</h4>
                  <canvas id={`eventStatsChart-${member.id}`}></canvas>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )}
</div>




        </div>
      </div>
    </div>
  );
};

export default OrganizationReports;
