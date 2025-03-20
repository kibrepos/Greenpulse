import React, { useState, useEffect } from 'react';
import { firestore } from '../../services/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import AdminSidebar from './AdminSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import '../../styles/AdminEventsManagement.css';
import { useNavigate } from 'react-router-dom';
import ReactPaginate from 'react-paginate';

// Define the structure of an organization
interface Organization {
  id: string;
  name: string;
  profileImagePath: string;
}

// Define the structure of an event
interface Event {
  id: string;
  title: string;
  venue: string;
  imageUrl: string;
  eventDates: { startDate: string; endDate: string }[];
}
const AdminEventsManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [events, setEvents] = useState<{ [key: string]: Event[] }>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [appliedSearchInput, setAppliedSearchInput] = useState(''); 
  const [searchInput, setSearchInput] = useState('');
  const [filterSortBy, setFilterSortBy] = useState<'asc' | 'desc'>('desc');
  const [filterSelectedDate, setFilterSelectedDate] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(8); // Number of items per page
  
  const filterOrganizations = () => {
    let filtered = [...organizations];
  
    // Filter by search input (organization name or event title)
    if (appliedSearchInput) {
      filtered = filtered.filter((org) => {
        const orgNameMatches = org.name.toLowerCase().includes(appliedSearchInput.toLowerCase());
        const eventMatches = events[org.name]?.some((event) =>
          event.title.toLowerCase().includes(appliedSearchInput.toLowerCase())
        );
        return orgNameMatches || eventMatches;
      });
    }
  
    // Sort organizations
    if (filterSortBy === 'desc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name)); // Sort A-Z
    } else {
      filtered.sort((a, b) => b.name.localeCompare(a.name)); // Sort Z-A
    }
  
    setFilteredOrganizations(filtered);
  };
  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const orgCollection = collection(firestore, 'organizations');
      const orgSnapshot = await getDocs(orgCollection);
      const orgList = orgSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        profileImagePath: doc.data().profileImagePath,
      })) as Organization[];

      // Sort organizations A-Z by name
      orgList.sort((a, b) => a.name.localeCompare(b.name));

      setOrganizations(orgList);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch events for a selected organization
  const fetchEvents = async (orgName: string) => {
    setLoading(true);
    try {
      const eventsCollection = collection(firestore, `events/${orgName}/event`);
      const eventsSnapshot = await getDocs(eventsCollection);
      const eventList = eventsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];

      // Sort events by start date (nearest first)
      eventList.sort((a, b) => new Date(a.eventDates[0].startDate).getTime() - new Date(b.eventDates[0].startDate).getTime());

      setEvents((prevEvents) => ({ ...prevEvents, [orgName]: eventList }));
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchOrganizations();
  }, []);
  
  useEffect(() => {
    filterOrganizations(); // Trigger filtering when appliedSearchInput changes
  }, [appliedSearchInput, filterSortBy,organizations, events]);
  
  useEffect(() => {
    if (organizations.length > 0) {
      setFilteredOrganizations(organizations); // Initialize filteredOrganizations
      organizations.forEach((org) => fetchEvents(org.name));
    }
  }, [organizations]);
  // Handle applying filters
  const handleApplyFilters = () => {
    setAppliedSearchInput(searchInput); // Apply the search input
    setCurrentPage(0); // Reset to the first page
    filterOrganizations(); // Apply filters and sorting
  };
  // Handle resetting filters
  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearchInput('');
    setFilterSortBy('desc'); // Reset sorting to DESC
    setFilterSelectedDate('');
    setCurrentPage(0);
    setFilteredOrganizations(organizations); // Reset to all organizations
  };

  // Handle page change for pagination
  const handlePageClick = (selectedItem: { selected: number }) => {
    setCurrentPage(selectedItem.selected);
  };

  // Format event dates
  const formatEventDates = (dates: { startDate: string; endDate: string }[]): JSX.Element => {
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
          {dates.map((date, idx) => {
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

  // Filter and sort events
 // Filter and sort events to show the 4 most recent events (future or past)
const getFilteredAndSortedEvents = (orgName: string) => {
  let filteredEvents = events[orgName] || [];

  // Filter by applied search input (title or organization name)
  if (appliedSearchInput) {
    filteredEvents = filteredEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(appliedSearchInput.toLowerCase()) ||
        orgName.toLowerCase().includes(appliedSearchInput.toLowerCase())
    );
  }

  // Filter by selected date
  if (filterSelectedDate) {
    filteredEvents = filteredEvents.filter((event) =>
      event.eventDates.some(
        (date) =>
          new Date(date.startDate).toDateString() === new Date(filterSelectedDate).toDateString()
      )
    );
  }

  // Sort events by start date (nearest first)
  filteredEvents.sort((a, b) => new Date(a.eventDates[0].startDate).getTime() - new Date(b.eventDates[0].startDate).getTime());

  // Get the current date
  const currentDate = new Date();

  // Separate future and past events
  const futureEvents = filteredEvents.filter(event => new Date(event.eventDates[0].startDate) >= currentDate);
  const pastEvents = filteredEvents.filter(event => new Date(event.eventDates[0].startDate) < currentDate);

  // Prioritize future events, but if there are none, show past events
  const recentEvents = futureEvents.length > 0 ? futureEvents : pastEvents;

  // Limit to 4 events
  return recentEvents.slice(0, 4);
};

// Pagination logic for organizations
const pageCount = Math.ceil(filteredOrganizations.length / itemsPerPage);
 
  return (
    <div className="admin-dashboard">
      <AdminSidebar />
      <div className="admin-dashboard-content">
        <h2 className="page-title">Events Management</h2>
        <div className="filters-section">
          <input
            type="text"
            value={searchInput}
            placeholder="Search..."
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
          />
          <select
            value={filterSortBy}
            onChange={(e) => setFilterSortBy(e.target.value as 'asc' | 'desc')}
            className="sort-select"
          >
            <option value="desc">DESC</option>
            <option value="asc">ASC</option>
          </select>
          <input
            type="date"
            value={filterSelectedDate}
            onChange={(e) => setFilterSelectedDate(e.target.value)}
            className="date-input"
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
        <div className="admin-iscroll">
          {loading ? (

        <p>Loading organizations...</p>
      ) : (
        filteredOrganizations
          .slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
          .map((org) => (
            <div key={org.id} className="organization-section">
              <div className="org-header">
              {org.profileImagePath ? (
  <img
    src={org.profileImagePath}
    alt={org.name}
    className="org-logo"
    onError={(e) => {
      e.currentTarget.src = ''; // Prevent broken image icon
      e.currentTarget.style.backgroundColor = 'rgba(204,204,204,255)'; // Gray background
    }}
  />
) : (
  <div className="org-logo" style={{ backgroundColor: 'rgba(204,204,204,255)' }}></div>
)}

                <h3>{org.name}</h3>
              </div>
              <div className="events-container">
                {events[org.name]?.length ? (
                  getFilteredAndSortedEvents(org.name).map((event, index) => (
                    <div
                      key={event.id}
                      className={`event-card ${index === 0 ? 'latest-event' : ''}`}
                      onClick={() => navigate(`/organization/${org.name}/events/${encodeURIComponent(event.title)}`)}
                    >
                      <img src={event.imageUrl} alt={event.title} className="event-image" />
                      <h3 className="event-title">{event.title}</h3>
                      <p>
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="WAZAP-icon" />
                        {event.venue}
                      </p>
                      <p>
                        <FontAwesomeIcon icon={faCalendarAlt} className="WAZAP-icon" />
                        {formatEventDates(event.eventDates)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No ongoing or upcoming events available.</p>
                )}
              </div>
              <a 
  href={`/Admin/EventsManagement/${org.name}/All_events`} 
  className="view-all-events"
  onClick={(e) => {
    e.preventDefault(); // Prevent default anchor behavior
    navigate(`/Admin/EventsManagement/${org.name}/All_events`); // Use navigate to go to the new page
  }}
>
  View all events →
</a>
            </div>
          ))
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
  );
};

export default AdminEventsManagement;