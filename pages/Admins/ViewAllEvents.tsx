import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firestore } from '../../services/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import DataTable from 'react-data-table-component';
import AdminSidebar from './AdminSidebar';
import '../../styles/AdminEventsManagement.css';

// Define the structure of an event
interface Event {
  id: string;
  title: string;
  venue: string;
  imageUrl: string;
  eventDates: { startDate: string; endDate: string }[];
  isArchived?: boolean; // Add a flag to distinguish archived events
  status?: 'ongoing' | 'completed' | 'cancelled' | 'upcoming'; // Add status field
}

const ViewAllEvents: React.FC = () => {
  const { orgName } = useParams<{ orgName: string }>(); // Get the organization name from the URL
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]); // State for filtered events
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // State for filters
  const [filterSearchInput, setFilterSearchInput] = useState('');
  const [filterSortBy, setFilterSortBy] = useState<'asc' | 'desc'>('desc');
  const [filterSelectedDate, setFilterSelectedDate] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // State for status filter
  const [filtersApplied, setFiltersApplied] = useState(false); // Track if filters are applied

  // Determine the status of an event based on its dates
  const getEventStatus = (event: Event): 'ongoing' | 'completed' | 'cancelled' | 'upcoming' => {
    const now = new Date();
    const startDate = new Date(event.eventDates[0].startDate);
    const endDate = new Date(event.eventDates[0].endDate);

    if (event.status === 'cancelled') {
      return 'cancelled'; // Explicitly cancelled events
    }

    if (now < startDate) {
      return 'upcoming'; // Event is in the future
    } else if (now >= startDate && now <= endDate) {
      return 'ongoing'; // Event is currently happening
    } else {
      return 'completed'; // Event is in the past
    }
  };

  // Fetch all events (active and archived) for the organization
  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch active events
      const activeEventsCollection = collection(firestore, `events/${orgName}/event`);
      const activeEventsSnapshot = await getDocs(activeEventsCollection);
      const activeEventList = activeEventsSnapshot.docs.map((doc) => {
        const eventData = doc.data() as Event;
        return {
          ...eventData, // Spread eventData first (includes all fields from Firestore)
          id: doc.id, // Add the id field explicitly
          isArchived: false, // Mark as not archived
          status: getEventStatus(eventData), // Determine status for each event
        };
      });

      // Fetch archived events
      const archivedEventsCollection = collection(firestore, `events/${orgName}/archivedEvents`);
      const archivedEventsSnapshot = await getDocs(archivedEventsCollection);
      const archivedEventList = archivedEventsSnapshot.docs.map((doc) => {
        const eventData = doc.data() as Event;
        return {
          ...eventData, // Spread eventData first (includes all fields from Firestore)
          id: doc.id, // Add the id field explicitly
          isArchived: true, // Mark as archived
          status: getEventStatus(eventData), // Determine status for each event
        };
      });

      // Combine active and archived events
      const allEvents = [...activeEventList, ...archivedEventList];

      // Sort all events by start date (nearest first)
      allEvents.sort((a, b) => 
        new Date(b.eventDates[0].startDate).getTime() - new Date(a.eventDates[0].startDate).getTime()
      );
      

      setEvents(allEvents);
      setFilteredEvents(allEvents); // Initialize filteredEvents with all events
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [orgName]);

  // Filter events based on search input, sort order, selected date, and status
  const filterEvents = () => {
    let filtered = [...events];

    // Filter by search input (title or venue)
    if (filterSearchInput) {
      const searchTerm = filterSearchInput.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(searchTerm) ||
          event.venue.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by selected date
    if (filterSelectedDate) {
      filtered = filtered.filter((event) =>
        event.eventDates.some(
          (date) =>
            new Date(date.startDate).toDateString() === new Date(filterSelectedDate).toDateString()
        )
      );
    }

    // Filter by status
    if (filterStatus) {
      filtered = filtered.filter((event) => event.status === filterStatus);
    }

    // Sort events
    if (filterSortBy === 'asc') {
      filtered.sort((a, b) => new Date(a.eventDates[0].startDate).getTime() - new Date(b.eventDates[0].startDate).getTime());
    } else {
      filtered.sort((a, b) => new Date(b.eventDates[0].startDate).getTime() - new Date(a.eventDates[0].startDate).getTime());
    }

    setFilteredEvents(filtered);
    setFiltersApplied(true); // Mark filters as applied
  };

  // Handle applying filters
  const handleApplyFilters = () => {
    filterEvents();
  };

  // Handle resetting filters
  const handleResetFilters = () => {
    setFilterSearchInput('');
    setFilterSortBy('desc');
    setFilterSelectedDate('');
    setFilterStatus(''); // Reset status filter
    setFilteredEvents(events); // Reset to all events
    setFiltersApplied(false); // Mark filters as not applied
  };

  // Format a single date as "Month Day, Year, HH:MM AM/PM"
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  };

  // Format event dates for display in the table
  const formatEventDates = (dates: { startDate: string; endDate: string }[]) => {
    return dates.map((date, idx) => ({
      day: idx + 1,
      startDate: formatDate(date.startDate),
      endDate: formatDate(date.endDate),
    }));
  };

  // Define columns for the data table
  const columns = [
    {
      name: 'Title',
      cell: (row: Event) => row.title,
      sortable: true,
    },
    {
      name: 'Venue',
      selector: (row: Event) => row.venue,
      sortable: true,
    },
    {
      name: 'Start Date',
      cell: (row: Event) => (
        <div>
          {formatEventDates(row.eventDates).map((date) => (
            <div key={date.day}>
              {row.eventDates.length > 1 ? <strong>Day {date.day}:</strong> : null} {date.startDate}
            </div>
          ))}
        </div>
      ),
      wrap: true, // Allow text wrapping for long date strings
    },
    {
      name: 'End Date',
      cell: (row: Event) => (
        <div>
          {formatEventDates(row.eventDates).map((date) => (
            <div key={date.day}>
              {row.eventDates.length > 1 ? <strong>Day {date.day}:</strong> : null} {date.endDate}
            </div>
          ))}
        </div>
      ),
      wrap: true, // Allow text wrapping for long date strings
    },
    {
      name: 'Status',
      cell: (row: Event) => (
        <span className={`event-status event-status-${row.status}`}>
          {row.status}
        </span>
      ),
    },
    {
      name: 'Actions',
      cell: (row: Event) => (
        <button
          onClick={() => {
            if (row.isArchived) {
              navigate(`/events/${orgName}/archivedEvents/${row.id}`); // Navigate to archived event details
            } else {
              navigate(`/organization/${orgName}/events/${encodeURIComponent(row.title)}`); // Navigate to active event details
            }
          }}
          className="view-event-button"
        >
          View Details
        </button>
      ),
    },
  ];

  return (
    <div className="admin-dashboard">
      <AdminSidebar />
      <div className="admin-dashboard-content">
        {/* <h2 className="page-title">All Events for {orgName}</h2> */}
        
        <div className="ql-announcements-heasder">
  <h2 className="ql-announcements-title">All Events for {orgName}</h2>
  <button className="ql-create-button">
Print
  </button>
</div>
        <div className="filters-section">
          <input
            type="text"
            value={filterSearchInput}
            placeholder="Search by title or venue..."
            onChange={(e) => setFilterSearchInput(e.target.value)}
          />
          <select
            value={filterSortBy}
            onChange={(e) => setFilterSortBy(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">DESC</option>
            <option value="asc">ASC</option>
          </select>
          <input
            type="date"
            value={filterSelectedDate}
            onChange={(e) => setFilterSelectedDate(e.target.value)}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option> {/* Placeholder for "All Statuses" */}
            <option value="ongoing">Ongoing</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={handleApplyFilters} className="apply-button">
            Apply
          </button>
          <button onClick={handleResetFilters} className="reset-button">
            Clear
          </button>
        </div>
        <div className="events-table-container">
          {loading ? (
            <p>Loading events...</p>
          ) : filteredEvents.length > 0 ? (
            <DataTable
              columns={columns}
              data={filteredEvents}
              pagination
              paginationPerPage={10}
              paginationRowsPerPageOptions={[10, 20, 30]}
              highlightOnHover
              striped
              responsive
              progressPending={loading}
              noDataComponent={<p>No events available for this organization.</p>}
            />
          ) : filtersApplied ? ( // Show fallback message if filters are applied and no events match
            <p>No events match your search criteria.</p>
          ) : (
            <p>No events available for this organization.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewAllEvents;