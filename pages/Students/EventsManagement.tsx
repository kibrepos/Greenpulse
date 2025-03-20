import React, { useState, useEffect } from "react";
import { firestore, auth } from "../../services/firebaseConfig"; // Firebase setup
import ReactPaginate from "react-paginate";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useParams,useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import StudentPresidentSidebar from "./StudentPresidentSidebar";
import StudentMemberSidebar from "./StudentMemberSidebar";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faCalendarAlt } from '@fortawesome/free-solid-svg-icons'
import "../../styles/EventsManagement.css";

interface Event {
  title: string;
  description: string;
  eventDates: { startDate: string; endDate: string }[];
  imageUrl: string;
  eventHead: string;
  venue: string;
  createdAt: any;
}
type EventDate = {
  startDate: string; // ISO string format
  endDate: string; // ISO string format
};

const EventsManagement: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [ongoingEvents, setOngoingEvents] = useState<Event[]>([]);
  const [completedEvents, setCompletedEvents] = useState<Event[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [viewType, setViewType] = useState<"active" | "archived">("active"); // Toggle between Active and Archived
const [activeView, setActiveView] = useState<"upcoming" | "ongoing" | "completed">("upcoming"); // Tabs within Active
const [archivedEvents, setArchivedEvents] = useState<Event[]>([]); // Store archived events
const [searchTerm, setSearchTerm] = useState<string>(""); // Search term state
const [currentPage, setCurrentPage] = useState(0);
const itemsPerPage = 8;

const getPaginatedEvents = (events: Event[], page: number) => {
  const startIndex = page * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return events.slice(startIndex, endIndex);
};


  const navigate = useNavigate();
  useEffect(() => {
    const fetchArchivedEvents = async () => {
      if (!organizationName) return;
  
      try {
        const archivedEventsRef = collection(
          firestore,
          `events/${organizationName}/archivedEvents`
        );
        const querySnapshot = await getDocs(archivedEventsRef);
  
        const events: Event[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            createdAt: data.createdAt?.toDate(), // Convert Firestore timestamp to JS Date
          } as Event;
        });
  
        setArchivedEvents(events);
      } catch (error) {
        console.error("Error fetching archived events:", error);
      }
    };
  
    fetchArchivedEvents();
  }, [organizationName]);
  
  useEffect(() => {
    const fetchEvents = async () => {
      if (!organizationName) return;
    
      try {
        const eventsRef = collection(firestore, "events", organizationName, "event");
        const querySnapshot = await getDocs(eventsRef);
    
        const upcoming: Event[] = [];
        const ongoing: Event[] = [];
        const completed: Event[] = [];
    
        const currentDate = new Date();
    
        querySnapshot.forEach((doc) => {
          const eventData = doc.data() as Event;
    
          // Check event dates
          const isCompleted = eventData.eventDates.every(
            (date) => new Date(date.endDate) < currentDate
          );
          const isUpcoming = eventData.eventDates.every(
            (date) => new Date(date.startDate) > currentDate
          );
          const isOngoing = eventData.eventDates.some((date, index, dates) => {
            const startDate = new Date(date.startDate);
            const endDate = new Date(date.endDate);
    
            // Check if the current date is within this event's date range
            if (startDate <= currentDate && endDate >= currentDate) {
              return true;
            }
    
            // Check if there is a gap between consecutive dates
            if (index < dates.length - 1) {
              const nextStartDate = new Date(dates[index + 1].startDate);
              if (endDate < currentDate && nextStartDate > currentDate) {
                return true; // Current date falls in the vacant day
              }
            }
    
            return false;
          });
    
          if (isCompleted) {
            completed.push(eventData);
          } else if (isUpcoming) {
            upcoming.push(eventData);
          } else if (isOngoing) {
            ongoing.push(eventData);
          }
        });
    
        setUpcomingEvents(upcoming);
        setOngoingEvents(ongoing);
        setCompletedEvents(completed);
    
        console.log("Ongoing Events:", ongoing); // Add logging to check
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };
    
  
    fetchEvents();
  
    const interval = setInterval(fetchEvents, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval); // Cleanup on unmount
  }, [organizationName]);
  
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const user = auth.currentUser;
        if (user && organizationName) {
          const orgDocRef = doc(firestore, "organizations", decodeURIComponent(organizationName));
          const orgDoc = await getDoc(orgDocRef);

          if (orgDoc.exists()) {
            const orgData = orgDoc.data();
            setOrganizationData(orgData);

            if (orgData.president?.id === user.uid) {
              setUserRole("president");
            } else if (orgData.officers?.some((officer: any) => officer.id === user.uid)) {
              setUserRole("officer");
            } else if (orgData.facultyAdviser?.id === user.uid) {
              setUserRole("faculty");
            } else if (orgData.members?.some((member: any) => member.id === user.uid)) {
              setUserRole("member");
            } else {
              setUserRole(null);
            }
            
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user) fetchUserRole();
    });
  }, [organizationName]);

  const getSidebarComponent = () => {
    switch (userRole) {
      case "president":
        return <StudentPresidentSidebar />;
      case "officer":
        return <StudentPresidentSidebar  />;
        case "faculty":
          return <StudentPresidentSidebar  />;
      case "member":
        return <StudentMemberSidebar />;
      default:
        return null;
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value); // Keeps the search term as entered (case-sensitive)
  };
  
  const filterEvents = (events: Event[]) =>
    events.filter((event) =>
      event.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
    const formatEventDates = (dates: EventDate[]): JSX.Element => {
      if (dates.length === 1) {
        // Single date range: no "Day 1"
        const startDate = new Date(dates[0].startDate);
        const endDate = new Date(dates[0].endDate);
    
        if (startDate.toDateString() === endDate.toDateString()) {
          // Same-day event
          return (
            <span>
              {startDate.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              - {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })} to{" "}
              {endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })}
            </span>
          );
        } else {
          // Event spans multiple days
          return (
            <span>
              {startDate.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              - {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })} to{" "}
              {endDate.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              - {endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })}
            </span>
          );
        }
      } else {
        // Multiple date ranges: include "Day X" with bold styling, and each day on a new line
        return (
          <>
            {dates.map((date: EventDate, idx: number) => {
              const startDate = new Date(date.startDate);
              const endDate = new Date(date.endDate);
    
              if (startDate.toDateString() === endDate.toDateString()) {
                // Same-day event
                return (
                  <div key={idx}>
                    <strong>Day {idx + 1}:</strong>{" "}
                    {startDate.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    - {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })}{" "}
                    to {endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })}
                  </div>
                );
              } else {
                // Event spans multiple days
                return (
                  <div key={idx}>
                    <strong>Day {idx + 1}:</strong>{" "}
                    {startDate.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    - {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })}{" "}
                    to {endDate.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    - {endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })}
                  </div>
                );
              }
            })}
          </>
        );
      }
    };

    
  return (
    <div className="organization-announcements-page">
      <Header />
      <div className="organization-announcements-container">
      <div className="sidebar-section">
        
        
        {getSidebarComponent()}</div>
        <div className="organization-announcements-content">
          <div className="header-container">
            <h1 className="headtitle">Events</h1>
            {/* Only President and Officers can see the Create Event button */}
            {(userRole === "president" || userRole === "officer") && (
              <button
                className="create-new-btn"
                onClick={() =>
                  navigate(`/organization/${organizationName}/create-event`)
                }
              >
                + Create Event
              </button>
            )}
          </div>
  
          {/* Top Buttons for Active and Archived */}
          {(userRole === "president" || userRole === "officer" || userRole === "faculty") && (
            <div className="top-buttons">
              <button
                className={`top-btn ${viewType === "active" ? "active" : ""}`}
                onClick={() => setViewType("active")}
              >
                Active
              </button>
              <button
                className={`top-btn ${viewType === "archived" ? "active" : ""}`}
                onClick={() => setViewType("archived")}
              >
                Archived
              </button>
            </div>
          )}
       
       <input
  type="text"
  className="tksks-search-input"
  placeholder="Search events..."
  value={searchTerm}
  onChange={handleSearch}
/>

<div className="WAZAP-event-section-wrapper">
  {/* Upcoming Events Section */}
  {viewType === "active" && (
    <div className="WAZAP-event-section">
      <h3>Upcoming Events</h3>
      {upcomingEvents.length === 0 ? (
        <p>No upcoming events.</p>
      ) : (
        <ul className="WAZAP-event-list">
          {filterEvents(upcomingEvents).map((event, index) => (
            <li
              key={index}
              className="WAZAP-event-item"
              onClick={() =>
                navigate(
                  `/organization/${organizationName}/events/${encodeURIComponent(
                    event.title
                  )}`
                )
              }
            >
              <img
                src={event.imageUrl || "https://via.placeholder.com/800x400"}
                alt={event.title}
                className="WAZAP-event-image"
              />
              <h3>{event.title}</h3>
       
              <p>
                <FontAwesomeIcon icon={faMapMarkerAlt} className="WAZAP-icon" />
                {event.venue}
              </p>
              <p>
                <FontAwesomeIcon icon={faCalendarAlt} className="WAZAP-icon" />
                {formatEventDates(event.eventDates)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3>Ongoing Events</h3>
      {ongoingEvents.length === 0 ? (
        <p>No ongoing events.</p>
      ) : (
        <ul className="WAZAP-event-list">
          {filterEvents(ongoingEvents).map((event, index) => (
            <li
              key={index}
              className="WAZAP-event-item"
              onClick={() =>
                navigate(
                  `/organization/${organizationName}/events/${encodeURIComponent(
                    event.title
                  )}`
                )
              }
            >
              <img
                src={event.imageUrl || "https://via.placeholder.com/800x400"}
                alt={event.title}
                className="WAZAP-event-image"
              />
            <h3>{event.title}</h3>
  
              <p>
                <FontAwesomeIcon icon={faMapMarkerAlt} className="WAZAP-icon" />
                {event.venue}
              </p>
              <p>
                <FontAwesomeIcon icon={faCalendarAlt} className="WAZAP-icon" />
                {formatEventDates(event.eventDates)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3>Completed Events</h3>
      {completedEvents.length === 0 ? (
        <p>No completed events.</p>
      ) : (
        <ul className="WAZAP-event-list">
          {filterEvents(completedEvents).map((event, index) => (
            <li
              key={index}
              className="WAZAP-event-item"
              onClick={() =>
                navigate(
                  `/organization/${organizationName}/events/${encodeURIComponent(
                    event.title
                  )}`
                )
              }
            >
              <img
                src={event.imageUrl || "https://via.placeholder.com/800x400"}
                alt={event.title}
                className="WAZAP-event-image"
              />
              <h3>{event.title}</h3>
  
              <p>
                <FontAwesomeIcon icon={faMapMarkerAlt} className="WAZAP-icon" />
                {event.venue}
              </p>
              <p>
                <FontAwesomeIcon icon={faCalendarAlt} className="WAZAP-icon" />
                {formatEventDates(event.eventDates)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )}

{viewType === "archived" && (
  <div className="WAZAP-event-section">
    {archivedEvents.length === 0 ? (
      <p>No archived events found.</p>
    ) : (
      <>
        <ul className="WAZAP-event-list">
          {getPaginatedEvents(filterEvents(archivedEvents), currentPage).map((event, index) => (
            <li
              key={index}
              className="WAZAP-event-item"
              onClick={() =>
                navigate(
                  `/organization/${organizationName}/archived-events/${encodeURIComponent(
                    event.title
                  )}`
                )
              }
            >
              <img
                src={event.imageUrl || "https://via.placeholder.com/800x400"}
                alt={event.title}
                className="WAZAP-event-image"
              />
              <h3>{event.title}</h3>
              <p>
                <FontAwesomeIcon icon={faMapMarkerAlt} className="WAZAP-icon" />
                {event.venue}
              </p>
              <p>
                <FontAwesomeIcon icon={faCalendarAlt} className="WAZAP-icon" />
                {formatEventDates(event.eventDates)}
              </p>
            </li>
          ))}
        </ul>

        {/* Pagination Controls */}
        <ReactPaginate
          previousLabel={"Previous"}
          nextLabel={"Next"}
          breakLabel={"..."}
          pageCount={Math.ceil(filterEvents(archivedEvents).length / itemsPerPage)}
          marginPagesDisplayed={2}
          pageRangeDisplayed={3}
          onPageChange={({ selected }) => setCurrentPage(selected)}
          containerClassName={"pagination-controls"}
          activeClassName={"active"}
          disabledClassName={"disabled"}
        />
      </>
    )}
  </div>
)}


</div>


      </div>
    </div>
    </div>
  );
  
  
};

export default EventsManagement;


       