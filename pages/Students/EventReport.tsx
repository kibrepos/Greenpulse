import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, getDocs, doc, getDoc,addDoc } from "firebase/firestore";
import { firestore } from "../../services/firebaseConfig";
import Header from "../../components/Header";
import StudentPresidentSidebar from "./StudentPresidentSidebar";
import { Chart } from "chart.js/auto"; 
import "../../styles/EventReport.css";
import jsPDF from "jspdf";
import { getAuth } from 'firebase/auth';

const EventReport: React.FC = () => {
  const { organizationName, eventId } = useParams<{
    organizationName: string;
    eventId: string;
  }>();

  const [eventDetails, setEventDetails] = useState<any>(null);
  const [attendeesByDay, setAttendeesByDay] = useState<any>({});
  const [attendanceByDay, setAttendanceByDay] = useState<any>({});
  const [eventHead, setEventHead] = useState<string>("N/A");
  const [loading, setLoading] = useState(true);
  const [searchQueries, setSearchQueries] = useState<{ [key: string]: { attendees: string; attendance: string } }>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [organizationDetails, setOrganizationDetails] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>(''); // Store search input
  const [filteredTasks, setFilteredTasks] = useState<any[]>(tasks);  // Store filtered tasks based on the query
  const [userDetails, setUserDetails] = useState<any>(null);
  
 useEffect(() => {
   const fetchUserDetails = async () => {
     const auth = getAuth();
     const currentUser = auth.currentUser;
 
     if (currentUser) {
       let userDocRef = doc(firestore, "students", currentUser.uid);
       let userDoc = await getDoc(userDocRef);
 
       if (!userDoc.exists()) {
         // If the user is not found in the "students" collection, check "faculty"
         userDocRef = doc(firestore, "faculty", currentUser.uid);
         userDoc = await getDoc(userDocRef);
       }
 
       if (userDoc.exists()) {
         setUserDetails(userDoc.data());
       } else {
         console.error("User not found in students or faculty collections.");
       }
     }
   };
 
   fetchUserDetails();
 }, []);
 
 const logActivity = async (description: string) => {
   if (organizationName && userDetails) {
     try {
       const logEntry = {
         userName: `${userDetails.firstname} ${userDetails.lastname}`,
         description,
         organizationName,
         timestamp: new Date(),
       };
 
       await addDoc(
         collection(firestore, `studentlogs/${organizationName}/activitylogs`),
         logEntry
       );
       console.log("Activity logged:", logEntry);
     } catch (error) {
       console.error("Error logging activity:", error);
     }
   }
 };
 
  

  type EventDate = {
    startDate: string;
    endDate: string;
  };

  type Attendee = {
    fullName: string;
    section: string;
  };
  
  
  const printPDF = () => {
    const doc = new jsPDF();
  
    // Path to the logo in the public folder
    const logoPath = `${window.location.origin}/Logo.png`;
  
    // Load the logo from the public folder and generate the PDF
    const img = new Image();
    img.src = logoPath;
  
    img.onload = () => {
      const logoWidth = 100;
      const logoHeight = 40;
  
      // Page Header
      const addHeader = (pageTitle: string) => {
        doc.addImage(
          img,
          "PNG",
          (doc.internal.pageSize.getWidth() - logoWidth) / 2,
          10,
          logoWidth,
          logoHeight
        );
        doc.setFontSize(14); // Smaller font for headers
        doc.text(pageTitle, doc.internal.pageSize.getWidth() / 2, 55, {
          align: "center",
        });
      };
  
      // First Page: Event Details
      addHeader("Event Report");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${organizationDetails?.name || "Organization Name"}`, 20, 70);
      doc.setFont("helvetica", "normal");
      doc.text(`Event Name: ${eventDetails?.title || "N/A"}`, 20, 80);
      doc.text(`Description: ${eventDetails?.description || "N/A"}`, 20, 90);
      doc.text(`Venue: ${eventDetails?.venue || "N/A"}`, 20, 100);
  
      // Add event dates
      doc.text("Dates:", 20, 110);
      eventDetails?.eventDates?.forEach((date: EventDate, index: number) => {
        const startDate = new Date(date.startDate);
        const endDate = new Date(date.endDate);
  
        const formattedDate =
          startDate.toDateString() === endDate.toDateString()
            ? `${startDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })} ${startDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })} - ${endDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}`
            : `${startDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })} ${startDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })} - ${endDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })} ${endDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}`;
  
        doc.text(
          eventDetails.eventDates.length > 1
            ? `Day ${index + 1}: ${formattedDate}`
            : formattedDate,
          30,
          120 + index * 10
        );
      });
  
      doc.text(`Event Head: ${eventHead || "N/A"}`, 20, 140);
  
      // Subsequent Pages: Attendees for Each Day
      Object.keys(attendeesByDay).forEach((day, dayIndex) => {
        doc.addPage(); // Start a new page for each day
        addHeader(
          eventDetails.eventDates.length > 1
            ? `Day ${dayIndex + 1} - Attendees`
            : "Attendees"
        );
  
        const dayAttendees = attendeesByDay[day] || [];
        doc.setFontSize(12);
  
        const startDate = new Date(
          eventDetails?.eventDates?.[dayIndex]?.startDate || "N/A"
        );
        const endDate = new Date(
          eventDetails?.eventDates?.[dayIndex]?.endDate || "N/A"
        );
        const formattedDate =
          startDate.toDateString() === endDate.toDateString()
            ? `${startDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })} ${startDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })} - ${endDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}`
            : `${startDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })} ${startDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })} - ${endDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })} ${endDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}`;
  
        doc.text(`Date: ${formattedDate}`, 20, 70);
        doc.text(`Total Attendees: ${dayAttendees.length}`, 20, 80);
  
        // Add attendee list
        let yOffset = 90;
        const leftColumn = 20;
        const rightColumn = 100;
  
        doc.text("Name:", leftColumn, yOffset);
        doc.text("Section:", rightColumn, yOffset);
        yOffset += 10;
  
        dayAttendees.forEach((attendee: Attendee, idx: number) => {
          doc.text(`${idx + 1}. ${attendee.fullName}`, leftColumn, yOffset);
          doc.text(`${attendee.section}`, rightColumn, yOffset);
          yOffset += 10;
  
          if (yOffset > 280) {
            doc.addPage(); // Add a new page if the list overflows
            addHeader(""); // No "Day Attendees"
            yOffset = 70;
            doc.text("Name:", leftColumn, yOffset);
            doc.text("Section:", rightColumn, yOffset);
            yOffset += 10;
          }
        });
      });
  
      // Save the PDF
      doc.save(`${eventDetails?.title || "Event_Report"}.pdf`);
// Log the activity with the event name
logActivity(`Printed the event report for event: "${eventDetails?.title || "Unknown Event"}" as a PDF`);

    };
  
    img.onerror = (error) => {
      console.error("Error loading the logo:", error);
    };
  };
  
  
  
  useEffect(() => {
    const fetchOrganizationDetails = async () => {
      try {
        const organizationDoc = doc(firestore, `organizations/${organizationName}`);
        const organizationSnapshot = await getDoc(organizationDoc);
  
        if (organizationSnapshot.exists()) {
          setOrganizationDetails(organizationSnapshot.data());
        } else {
          console.error("Organization not found.");
        }
      } catch (error) {
        console.error("Error fetching organization details:", error);
      }
    };
  
    if (organizationName) {
      fetchOrganizationDetails();
    }
  }, [organizationName]);

  
  const handleSearchChange = (day: string, type: "attendees" | "attendance", value: string) => {
    setSearchQueries((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: value,
      },
    }));
  };


  
  useEffect(() => {
    if (!tasks.length) return;
  
    const ctx = document.getElementById("taskStatusChart") as HTMLCanvasElement;
  
    if (ctx) {
      const existingChart = Chart.getChart(ctx);
      if (existingChart) existingChart.destroy();
  
      // Predefined statuses to ensure they're always present
      const predefinedStatuses = ["In Progress", "Completed", "Overdue"];
      const statusColors: { [key: string]: string } = {
        Started: "#ffcc00", // Yellow
        "In Progress": "#007bff", // Blue
        Completed: "#28a745", // Green
        Overdue: "#dc3545", // Red
        "Overdue Extended": "#8b0000", // Dark Red
        Extended: "#007bff", // Blue (for extended)
      };
  
      // Explicitly type taskStatusCounts as a dictionary of string keys and number values
      const taskStatusCounts: Record<string, number> = predefinedStatuses.reduce(
        (acc, status) => {
          acc[status] = 0; // Set default count to 0
          return acc;
        },
        {} as Record<string, number>
      );
  
      // Count the occurrences of each task status
      tasks.forEach((task) => {
        taskStatusCounts[task.taskStatus] =
          (taskStatusCounts[task.taskStatus] || 0) + 1;
      });
  
      // Prepare the data for the chart
      const pieData = {
        labels: Object.keys(taskStatusCounts),
        datasets: [
          {
            data: Object.values(taskStatusCounts),
            backgroundColor: Object.keys(taskStatusCounts).map(
              (status) => statusColors[status] || "#6c757d" // Default gray if status not found
            ),
          },
        ],
      };
  
      // Render the chart
      new Chart(ctx, {
        type: "pie",
        data: pieData,
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                font: {
                  family: "Arial, sans-serif", // Ensure consistent font
                  size: 12,
                },
              },
            },
          },
        },
      });
    }
  }, [tasks]);
  

  const handleSearchTask = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
  
    // Filter tasks based on the search query, including title, status, assigned members, and committees
    const filtered = tasks.filter((task) => {
      const assignedMemberNames = task.assignedMembers
        ?.map((memberId: string) => {
          const member = organizationDetails?.members?.find((m: any) => m.id === memberId);
          if (member) return member.name.toLowerCase();
  
          const officer = organizationDetails?.officers?.find((o: any) => o.id === memberId);
          if (officer) return officer.name.toLowerCase();
  
          const committeeHead = organizationDetails?.committees?.find(
            (c: any) => c.head.id === memberId
          );
          if (committeeHead) return committeeHead.head.name.toLowerCase();
  
          return null;
        })
        .filter((name: string | null) => name !== null)
        .join(", ");
  
      const assignedCommitteeNames = task.assignedCommittees
        ?.map((committeeId: string) => {
          const committee = organizationDetails?.committees?.find((c: any) => c.id === committeeId);
          return committee ? committee.name.toLowerCase() : null;
        })
        .filter((name: string | null) => name !== null)
        .join(", ");
  
      // Check if the task, member, or committee name matches the search query
      return (
        task.title.toLowerCase().includes(query) ||
        task.taskStatus.toLowerCase().includes(query) ||
        (assignedMemberNames && assignedMemberNames.includes(query)) ||
        (assignedCommitteeNames && assignedCommitteeNames.includes(query))
      );
    });
  
    setFilteredTasks(filtered);  // Store the filtered tasks for rendering
  };
  
  
  
  useEffect(() => {
    if (loading || !Object.keys(attendeesByDay).length) return; // Ensure data is loaded
  
    const chartInstances: any[] = [];
  
    Object.keys(attendeesByDay).forEach((day, index) => {
      const canvasId = `attendeesChart-${index}`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
  
      if (ctx) {
        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy(); // Destroy existing chart
  
        const attendees = attendeesByDay[day];
        if (attendees.length > 0) {
          const sectionCounts = attendees.reduce(
            (acc: any, attendee: any) => {
              acc[attendee.section] = (acc[attendee.section] || 0) + 1;
              return acc;
            },
            {}
          );
  
          const randomColors = Object.keys(sectionCounts).map(() =>
            `#${Math.floor(Math.random() * 16777215).toString(16)}`
          );
  
          const newChart = new Chart(ctx, {
            type: "pie",
            data: {
              labels: Object.keys(sectionCounts),
              datasets: [
                {
                  data: Object.values(sectionCounts),
                  backgroundColor: randomColors,
                },
              ],
            },
            options: {
              responsive: false,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: true,
                  position: "top",
                  onClick: () => {}, // Disable legend label clicks
                },
              },
            },
          });
  
          chartInstances.push(newChart);
        }
      }
    });
  
    return () => {
      chartInstances.forEach((chart) => chart.destroy());
    };
  }, [attendeesByDay, loading]);
  
  
  useEffect(() => {
    if (loading || !Object.keys(attendanceByDay).length) return; // Ensure data is loaded
  
    const chartInstances: any[] = [];
  
    Object.keys(attendanceByDay).forEach((day, index) => {
      const canvasId = `attendanceChart-${index}`;
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
  
      if (ctx) {
        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();
  
        const attendance = attendanceByDay[day];
        const statusCounts = attendance.reduce(
          (acc: any, record: any) => {
            acc[record.status] = (acc[record.status] || 0) + 1;
            return acc;
          },
          {}
        );
  
        const allStatuses = ["Present", "Absent", "Late"];
        const fullStatusCounts = allStatuses.reduce((acc: any, status) => {
          acc[status] = statusCounts[status] || 0;
          return acc;
        }, {});
  
        const colors = allStatuses.map((status) => {
          switch (status) {
            case "Present":
              return "#63df63";
            case "Absent":
              return "#ff8282";
            case "Late":
              return "#efaf6f";
            default:
              return "#9E9E9E";
          }
        });
  
        const newChart = new Chart(ctx, {
          type: "pie",
          data: {
            labels: allStatuses,
            datasets: [
              {
                data: Object.values(fullStatusCounts),
                backgroundColor: colors,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: true,
                position: "top",
                onClick: () => {}, // Disable legend label clicks
              },
            },
          },
        });
  
        chartInstances.push(newChart);
      }
    });
  
    return () => {
      chartInstances.forEach((chart) => chart.destroy());
    };
  }, [attendanceByDay, loading]);
  
  

  
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!organizationName || !eventId) return;
  
      try {
        setLoading(true); // Start loading
  
        // Fetch the event document
        const eventDoc = doc(firestore, `events/${organizationName}/event/${eventId}`);
        const eventSnapshot = await getDoc(eventDoc);
  
        let eventData: any = eventSnapshot.exists()
          ? { ...eventSnapshot.data(), isArchived: false }
          : null;
  
        if (!eventData) {
          // If not found in active events, fetch from archivedEvents
          const archivedEventDoc = doc(firestore, `events/${organizationName}/archivedEvents/${eventId}`);
          const archivedEventSnapshot = await getDoc(archivedEventDoc);
  
          eventData = archivedEventSnapshot.exists()
            ? { ...archivedEventSnapshot.data(), isArchived: true }
            : null;
        }
  
        if (!eventData) {
          console.error("Event not found");
          return;
        }
  
        setEventDetails(eventData);
  
        // Fetch attendees by day
        const attendeesCollection = collection(
          firestore,
          `events/${organizationName}/${eventData.isArchived ? "archivedEvents" : "event"}/${eventId}/attendees`
        );
        const attendeesSnapshot = await getDocs(attendeesCollection);
  
        const attendeesData: any = {};
        attendeesSnapshot.docs.forEach((doc) => {
          attendeesData[doc.id] = doc.data().attendees || [];
        });
        setAttendeesByDay(attendeesData);
  
        // Fetch attendance by day
        const attendanceCollection = collection(
          firestore,
          `events/${organizationName}/${eventData.isArchived ? "archivedEvents" : "event"}/${eventId}/attendance`
        );
        const attendanceSnapshot = await getDocs(attendanceCollection);
  
        const attendanceData: any = {};
        attendanceSnapshot.docs.forEach((doc) => {
          attendanceData[doc.id] = doc.data().attendees || [];
        });
        setAttendanceByDay(attendanceData);
  
        // Fetch Event Head details from the `students` collection
        if (eventData.eventHead) {
          const headDoc = doc(firestore, `students/${eventData.eventHead}`);
          const headSnapshot = await getDoc(headDoc);
  
          if (headSnapshot.exists()) {
            const headData = headSnapshot.data();
            setEventHead(`${headData.firstname} ${headData.lastname}`);
          } else {
            console.warn("Event Head not found");
            setEventHead("N/A");
          }
        } else {
          setEventHead("N/A");
        }
  
        setLoading(false); // End loading after all data is fetched
      } catch (error) {
        console.error("Error fetching event details:", error);
        setLoading(false);
      }
    };
  
    fetchEventDetails();
  }, [organizationName, eventId]);
  
  
  // Fetch tasks for the event
const fetchTasksForEvent = async () => {
  try {
    // Try fetching tasks from the AllTasks collection
    const allTasksCollection = collection(firestore, `tasks/${organizationName}/AllTasks`);
    const allTasksSnapshot = await getDocs(allTasksCollection);

    let eventTasks = allTasksSnapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }))
      .filter((task: any) => task.event === eventId);

    // If no tasks are found in AllTasks, fetch from archivedTasks
    if (eventTasks.length === 0) {
      const archivedTasksCollection = collection(firestore, `tasks/${organizationName}/archivedTasks`);
      const archivedTasksSnapshot = await getDocs(archivedTasksCollection);

      eventTasks = archivedTasksSnapshot.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }))
        .filter((task: any) => task.event === eventId);
    }

    setTasks(eventTasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
  }
};

// Call fetchTasksForEvent inside your existing useEffect
useEffect(() => {
  if (!organizationName || !eventId) return;
  fetchTasksForEvent();
}, [organizationName, eventId]);


const renderTaskTimeline = (organizationDetails: any, searchQuery: string) => {
  const filteredTasks = tasks.filter((task) => {
    const assignedMemberNames = task.assignedMembers
      ?.map((memberId: string) => {
        const member = organizationDetails?.members?.find((m: any) => m.id === memberId);
        if (member) return member.name.toLowerCase();

        const officer = organizationDetails?.officers?.find((o: any) => o.id === memberId);
        if (officer) return officer.name.toLowerCase();

        const committeeHead = organizationDetails?.committees?.find(
          (c: any) => c.head.id === memberId
        );
        if (committeeHead) return committeeHead.head.name.toLowerCase();

        return null;
      })
      .filter((name: string | null) => name !== null)
      .join(", ");

    const assignedCommitteeNames = task.assignedCommittees
      ?.map((committeeId: string) => {
        const committee = organizationDetails?.committees?.find((c: any) => c.id === committeeId);
        return committee ? committee.name.toLowerCase() : null;
      })
      .filter((name: string | null) => name !== null)
      .join(", ");

    return (
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.taskStatus.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (assignedMemberNames && assignedMemberNames.includes(searchQuery.toLowerCase())) ||
      (assignedCommitteeNames && assignedCommitteeNames.includes(searchQuery.toLowerCase()))
    );
  });

  const sortedTasks = [...filteredTasks].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return sortedTasks.map((task, index) => {
    const startDate = new Date(task.startDate);
    const dueDate = new Date(task.dueDate);

    // Assign colors based on task status
    let titleColor;
    switch (task.taskStatus) {
      case "Overdue":
        titleColor = "#dc3545"; // Red
        break;
      case "Overdue Extended":
        titleColor = "#8b0000"; // Dark Red
        break;
      case "In Progress":
        titleColor = "#007bff"; // Blue
        break;
      case "Started":
        titleColor = "#ffcc00"; // Yellow
        break;
      case "Completed":
        titleColor = "#28a745"; // Green
        break;
      case "Extended":
        titleColor = "#007bff"; // Blue
        break;
      default:
        titleColor = "#6c757d"; // Gray for unknown
    }

    // Resolve assigned member names
    const assignedMemberNames = task.assignedMembers
      ?.map((memberId: string) => {
        const member = organizationDetails?.members?.find((m: any) => m.id === memberId);
        if (member) return member.name;

        const officer = organizationDetails?.officers?.find((o: any) => o.id === memberId);
        if (officer) return officer.name;

        const committeeHead = organizationDetails?.committees?.find(
          (c: any) => c.head.id === memberId
        );
        if (committeeHead) return committeeHead.head.name;

        return null;
      })
      .filter((name: string | null) => name !== null)
      .join(", ");

    // Resolve assigned committee names
    const assignedCommitteeNames = task.assignedCommittees
      ?.map((committeeId: string) => {
        const committee = organizationDetails?.committees?.find((c: any) => c.id === committeeId);
        return committee ? committee.name : null;
      })
      .filter((name: string | null) => name !== null)
      .join(", ");

    return (
      <div
        key={index}
        className="eventoreporto-task-timeline-item"
        style={{ borderLeftColor: titleColor }}
      >
        <p>
          <strong style={{ color: titleColor }}>{task.title}</strong>
        </p>

        {/* Conditionally render assigned members if they exist */}
        {assignedMemberNames && (
          <p>
            <strong>Assigned Members:</strong> {assignedMemberNames}
          </p>
        )}

        {/* Conditionally render assigned committees if they exist */}
        {assignedCommitteeNames && (
          <p>
            <strong>Assigned Committees:</strong> {assignedCommitteeNames}
          </p>
        )}

        <p>
          <span>
            Start:{" "}
            {startDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            - {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <br />
          <span>
            Due:{" "}
            {dueDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            - {dueDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </p>
      </div>
    );
  });
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
       <h1 className="headtitle">Event Report</h1>
       <button className="create-new-btn" onClick={printPDF}>
              Print Event
            </button>
    
         </div>
    <div>

    {eventDetails && (
      <div className="eventoreporto-attendee-list-container">
 <div id="event-details" className="eventoreporto-event-details-container">
 <div className="eventoreporto-event-details">
   <div className="eventoreporto-event-details-left">
     <p className="eventoreporto-event-details-item">
       <strong>Event Name</strong> <br />
       {eventDetails.title}
     </p>
     <p className="eventoreporto-event-details-item">
       <strong>Description</strong> <br />
       {eventDetails.description}
     </p>
     <p className="eventoreporto-event-details-item">
       <strong>Venue</strong> <br />
       {eventDetails.venue}
     </p>
   </div>
   <div className="eventoreporto-event-details-right">
     <p className="eventoreporto-event-details-dates-title">
       <strong>Dates:</strong>
     </p>
     {eventDetails.eventDates.map((date: any, index: number) => {
       const startDate = new Date(date.startDate);
       const endDate = new Date(date.endDate);

       const sameDay = startDate.toDateString() === endDate.toDateString();

       return (
         <p key={index} className="eventoreporto-event-details-date">
           <strong>Day {index + 1}:</strong>{" "}
           {startDate.toLocaleDateString("en-US", {
             month: "long",
             day: "numeric",
             year: "numeric",
           })}{" "}
           -{" "}
           <span style={{ color: "green" }}>
             {startDate.toLocaleTimeString("en-US", {
               hour: "numeric",
               minute: "2-digit",
               hour12: true,
             })}
           </span>{" "}
           to{" "}
           {sameDay ? (
             <span style={{ color: "green" }}>
               {endDate.toLocaleTimeString("en-US", {
                 hour: "numeric",
                 minute: "2-digit",
                 hour12: true,
               })}
             </span>
           ) : (
             <>
               {endDate.toLocaleDateString("en-US", {
                 month: "long",
                 day: "numeric",
                 year: "numeric",
               })}{" "}
               -{" "}
               <span style={{ color: "green" }}>
                 {endDate.toLocaleTimeString("en-US", {
                   hour: "numeric",
                   minute: "2-digit",
                   hour12: true,
                 })}
               </span>
             </>
           )}
         </p>
       );
     })}
     <p className="eventoreporto-event-details-manager">
       <strong>Head Event Manager</strong> <br />
       
       {eventHead}
     </p>
   </div>
 </div>
</div> </div>

)}
<div id="attendee-list" className="eventoreporto-attendee-list-container">
  <h3 className="eventoreporto-attendee-list-title">Attendees</h3>
  {Object.keys(attendeesByDay).length > 0 ? (
    Object.keys(attendeesByDay).map((day, index) => (
      <div key={day} className="eventoreporto-attendee-day-section">
        <h4 className="eventoreporto-attendee-day-title">Day {index + 1}</h4>
        {attendeesByDay[day]?.length > 0 ? (
          <div className="eventoreporto-attendee-chart-section">
            <div className="eventoreporto-attendee-chart">
              <canvas
                id={`attendeesChart-${index}`}
                className="eventoreporto-chart-canvas"
              ></canvas>
              <p className="eventoreporto-total-attendees">
                Total Attendees: {attendeesByDay[day]?.length || 0}
              </p>
            </div>
            <div className="eventoreporto-attendee-names-section">
              <input
                type="text"
                placeholder="Search attendees..."
                value={searchQueries[day]?.attendees || ""}
                onChange={(e) => handleSearchChange(day, "attendees", e.target.value)}
                className="eventoreporto-search-input"
              />
              <table className="eventoreporto-attendee-table">
                <thead>
                  <tr>
                    <th className="eventoreporto-attendee-table-header">Name</th>
                    <th className="eventoreporto-attendee-table-header">Section</th>
                  </tr>
                </thead>
                <tbody>
                  {attendeesByDay[day]
                    .filter((attendee: any) => {
                      const query = searchQueries[day]?.attendees?.toLowerCase() || "";
                      return (
                        !query ||
                        attendee.fullName.toLowerCase().includes(query) ||
                        attendee.section.toLowerCase().includes(query)
                      );
                    })
                    .map((attendee: any, idx: number) => (
                      <tr key={idx} className="eventoreporto-attendee-row">
                        <td className="eventoreporto-attendee-name">{attendee.fullName}</td>
                        <td className="eventoreporto-attendee-section">{attendee.section}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="eventoreporto-no-data">No data available for Day {index + 1}</p>
        )}
      </div>
    ))
  ) : (
    <p className="eventoreporto-no-data">No attendee data available.</p>
  )}
</div>

<div id="attendance" className="eventoreporto-attendance-container">
  <h3 className="eventoreporto-attendance-title">Attendance of Organization Members</h3>
  {Object.keys(attendanceByDay).length > 0 ? (
    Object.keys(attendanceByDay).map((day, index) => (
      <div key={day} className="eventoreporto-attendance-day-section">
        <h4 className="eventoreporto-attendance-day-title">Day {index + 1}</h4>
        {attendanceByDay[day]?.length > 0 ? (
          <div className="eventoreporto-attendance-chart-section">
            <div className="eventoreporto-attendee-chart">
              <canvas
                id={`attendanceChart-${index}`}
                className="eventoreporto-chart-canvas"
              ></canvas>
            </div>
            <div className="eventoreporto-attendance-names-section">
              <input
                type="text"
                placeholder="Search attendance..."
                value={searchQueries[day]?.attendance || ""}
                onChange={(e) => handleSearchChange(day, "attendance", e.target.value)}
                className="eventoreporto-search-input"
              />
              <table className="eventoreporto-attendance-table">
                <thead>
                  <tr>
                    <th className="eventoreporto-attendee-table-header">Name</th>
                    <th className="eventoreporto-attendee-table-header">Role</th>
                    <th className="eventoreporto-attendee-table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceByDay[day]
                    .filter((record: any) => {
                      const query = searchQueries[day]?.attendance?.toLowerCase() || "";
                      return (
                        !query ||
                        record.name.toLowerCase().includes(query) ||
                        record.role.toLowerCase().includes(query) ||
                        record.status.toLowerCase().includes(query)
                      );
                    })
                    .map((record: any, idx: number) => (
                      <tr key={idx} className="eventoreporto-attendee-row">
                        <td className="eventoreporto-attendee-name">{record.name}</td>
                        <td className="eventoreporto-attendance-section">{record.role}</td>
                        <td className="eventoreporto-attendee-status">{record.status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="eventoreporto-no-data">No data available for Day {index + 1}</p>
        )}
      </div>
    ))
  ) : (
    <p className="eventoreporto-no-data">No attendance data available.</p>
  )}
</div>



<div className="eventoreporto-attendance-container">
  <div id="tasks-summary" className="eventoreporto-tasks-container">
    <div className="eventoreporto-header-row">
      <h3 className="eventoreporto-tasks-title">Task Summary</h3>
    </div>
    {tasks.length > 0 ? (
      <div className="eventoreporto-tasks-content">
        {/* Task Status Chart */}
        <div className="eventoreporto-attendee-chart">
          <canvas id="taskStatusChart" className="eventoreporto-chart-canvas"></canvas>
        </div>

        {/* Task Timeline */}
        <div id="taskTimeline" className="eventoreporto-task-timeline">
          <div className="eventoreporto-attendance-names-sectionz">
            <h4 className="eventoreporto-task-timeline-title">Task Timeline</h4>
            <input
  type="text"
  value={searchQuery}
  onChange={handleSearchTask}
placeholder="Search tasks, members, or committees..."
  className="eventoreporto-search-input"
/>

            {tasks.length > 0 ? (
              renderTaskTimeline(organizationDetails, searchQuery)
            ) : (
              <p className="eventoreporto-no-data">No tasks available for this event.</p>
            )}
          </div>
        </div>
      </div>
    ) : (
      <p className="eventoreporto-no-data">No tasks available for this event.</p>
    )}
  </div>
</div>


</div>
  </div>   </div>  </div>
    
  );
};

export default EventReport;
