import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { firestore, storage } from "../../services/firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection
} from "firebase/firestore";
import "../../styles/CreateEvent.css"; // Shared CSS for styling
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Header from "../../components/Header";
import StudentPresidentSidebar from "./StudentPresidentSidebar";
import { getAuth } from 'firebase/auth';
import { showToast } from '../../components/toast';
import Swal from"sweetalert2";

interface Event {
  title: string;
  description: string;
  eventDates: { startDate: string; endDate: string }[];
  imageUrl: string;
  eventHead: string;
  venue: string;
}

interface User {
  id: string;
  name: string;
}

const EditEvent: React.FC = () => {
  const { organizationName, eventId } = useParams<{
    organizationName: string;
    eventId: string;
  }>();
  const navigate = useNavigate();
  const [eventDetails, setEventDetails] = useState<Event | null>(null);
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
const [userDetails, setUserDetails] = useState<any>(null);
const [originalEventDetails, setOriginalEventDetails] = useState<Event | null>(null);
const auth = getAuth();
const user = auth.currentUser;

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

  // Fetch event details
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (organizationName && eventId) {
        const eventRef = doc(
          firestore,
          "events",
          organizationName,
          "event",
          eventId
        );
        const eventDoc = await getDoc(eventRef);
        if (eventDoc.exists()) {
          const eventData = eventDoc.data() as Event;
          setEventDetails(eventData);
          setOriginalEventDetails(eventData);
          setImagePreview(eventData.imageUrl || null); // Load existing image preview
        }
      }
    };

    const fetchOrganizationData = async () => {
      if (organizationName) {
        const orgRef = doc(firestore, "organizations", organizationName);
        const orgDoc = await getDoc(orgRef);
        if (orgDoc.exists()) {
          setOrganizationData(orgDoc.data());
        }
      }
    };

    fetchEventDetails();
    fetchOrganizationData();
  }, [organizationName, eventId]);
  const handleDateChange = (index: number, field: "startDate" | "endDate", value: string) => {
    const now = new Date().toISOString();
    const updatedDates = [...eventDetails!.eventDates];
    updatedDates[index][field] = value;
  
    // Ensure no past dates
    if (value < now) {
      showToast("Date and time cannot be in the past.", "error");
      return;
    }
  
    // Ensure end date is not earlier than start date
    const startDate = updatedDates[index].startDate;
    const endDate = updatedDates[index].endDate;
    if (startDate && endDate && endDate < startDate) {
      showToast("End date cannot be earlier than start date.", "error");
      return;
    }
  
    // Ensure no overlaps
    if (index > 0) {
      const prevEndDate = updatedDates[index - 1].endDate;
      if (prevEndDate && startDate && startDate < prevEndDate) {
        showToast(`Start date for Day ${index + 1} cannot overlap with the previous day's end date.`, "error");
        return;
      }
    }
    if (index < updatedDates.length - 1) {
      const nextStartDate = updatedDates[index + 1].startDate;
      if (endDate && nextStartDate && endDate > nextStartDate) {
        showToast(`End date for Day ${index + 1} cannot overlap with the next day's start date.`, "error");

        return;
      }
    }
  
    const updatedEventDetails = { ...eventDetails!, eventDates: updatedDates };
    setEventDetails(updatedEventDetails);
  };
  
  const handleAddDateRange = () => {
    if (eventDetails) {
      const updatedDates = [
        ...eventDetails.eventDates,
        { startDate: "", endDate: "" },
      ];
      setEventDetails({ ...eventDetails, eventDates: updatedDates });
    }
  };
  
  const handleRemoveDateRange = (index: number) => {
    if (eventDetails) {
      const updatedDates = eventDetails.eventDates.filter((_, i) => i !== index);
      setEventDetails({ ...eventDetails, eventDates: updatedDates });
    }
  };
  const handleSave = async () => {
    if (!organizationName || !eventId || !eventDetails || !originalEventDetails) return;
  
    // Validate all fields
    if (
      !eventDetails.title ||
      !eventDetails.description ||
      !eventDetails.venue ||
      eventDetails.eventDates.some(
        (date) => !date.startDate || !date.endDate
      ) ||
      !eventDetails.eventHead
    ) {
      showToast("All fields must be filled out.", "error");
      return;
    }
  
    // Show confirmation alert
    Swal.fire({
      title: "Are you sure?",
      text: "Do you want to save the changes made to this event?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, save changes",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const eventRef = doc(
          firestore,
          "events",
          organizationName,
          "event",
          eventId
        );
  
        try {
          // Upload new image if changed
          let imageUrl = eventDetails.imageUrl;
          if (imageFile) {
            const imageRef = ref(
              storage,
              `organizations/${organizationName}/Events/${eventId}/eventBG`
            );
            await uploadBytes(imageRef, imageFile);
            imageUrl = await getDownloadURL(imageRef);
          }
  
          await updateDoc(eventRef, {
            ...eventDetails,
            imageUrl, // Updated image URL
          });
  
          // Log changes
          const changes: string[] = [];
  
          if (eventDetails.title !== originalEventDetails.title) {
            changes.push(`changed the title to "${eventDetails.title}"`);
          }
          if (eventDetails.description !== originalEventDetails.description) {
            changes.push(`updated the description`);
          }
          if (eventDetails.venue !== originalEventDetails.venue) {
            changes.push(`updated the venue to "${eventDetails.venue}"`);
          }
          if (JSON.stringify(eventDetails.eventDates) !== JSON.stringify(originalEventDetails.eventDates)) {
            changes.push(`updated the event dates`);
          }
          if (eventDetails.eventHead !== originalEventDetails.eventHead) {
            changes.push(`changed the event head`);
          }
  
          if (changes.length > 0) {
            const changesDescription = changes.join(", ");
            await logActivity(`Updated event "${originalEventDetails.title}": ${changesDescription}.`);
          } else {
            await logActivity(`Updated event "${originalEventDetails.title}" with no significant changes.`);
          }
  
          showToast("Event updated successfully", "success");
          navigate(`/organization/${organizationName}/events`);
        } catch (error) {
          console.error("Error updating event:", error);
          showToast("Failed to update event", "error");
        }
      }
    });
  };
  
  

  const handleCancel = () => navigate(-1);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSelectEventHead = (id: string) => {
    if (eventDetails) {
      setEventDetails({ ...eventDetails, eventHead: id });
    }
    setIsModalOpen(false);
  };

  if (!eventDetails) return;

  return (
    <div className="organization-announcements-page">
    <Header />
    <div className="organization-announcements-container">
    <div className="sidebar-section">
    
          <StudentPresidentSidebar />
        </div>
  
        <div className="main-content">
          <div className="header-container">
            <h1 className="headtitle">Edit Event</h1>
          </div>
          <div className="FESTANOBRAZIL">
            <form className="CCC-create-event-form">
              <div className="CCC-form-left">
                <div className="CCC-create-event-form-group">
                  <label className="CCC-create-event-label">Event Title</label>
                  <input
                    type="text"
                    value={eventDetails.title}
                    onChange={(e) =>
                      setEventDetails({
                        ...eventDetails,
                        title: e.target.value,
                      })
                    }
                    className="CCC-create-event-input"
                  />
                </div>
                <div className="CCC-create-event-form-group">
                  <label className="CCC-create-event-label">Description</label>
                  <textarea
                    value={eventDetails.description}
                    onChange={(e) =>
                      setEventDetails({
                        ...eventDetails,
                        description: e.target.value,
                      })
                    }
                    className="CCC-create-event-textarea"
                  />
                </div>
                <div className="CCC-create-event-form-group">
                  <label className="CCC-create-event-label">Venue</label>
                  <input
                    type="text"
                    value={eventDetails.venue}
                    onChange={(e) =>
                      setEventDetails({ ...eventDetails, venue: e.target.value })
                    }
                    className="CCC-create-event-input"
                  />
                </div>
                <div className="CCC-date-time-section">
  {eventDetails.eventDates.map((date, index) => (
    <div key={index} className="CCC-date-time-group">
      <label className="CCC-create-event-label">
        Start Date & Time (Day {index + 1})
      </label>
      <input
        type="datetime-local"
        value={
          date.startDate
            ? new Date(date.startDate).toISOString().slice(0, 16)
            : ""
        }
        min={new Date().toISOString().slice(0, 16)} // Prevent past dates
        onChange={(e) => handleDateChange(index, "startDate", e.target.value)}
        className="CCC-create-event-input"
        required
      />
      <label className="CCC-create-event-label">
        End Date & Time (Day {index + 1})
      </label>
      <input
        type="datetime-local"
        value={
          date.endDate
            ? new Date(date.endDate).toISOString().slice(0, 16)
            : ""
        }
        min={
          date.startDate
            ? new Date(date.startDate).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16)
        } // Ensure end date is after start date
        onChange={(e) => handleDateChange(index, "endDate", e.target.value)}
        className="CCC-create-event-input"
        required
      />
      {eventDetails.eventDates.length > 1 && (
        <button
          type="button"
          onClick={() => handleRemoveDateRange(index)}
          className="CCC-remove-date-btn"
        >
          Remove Day
        </button>
      )}
    </div>
  ))}
  <button
    type="button"
    onClick={handleAddDateRange}
    className="CCC-add-date-btn"
  >
    Add Day
  </button>
</div>

              </div>
  
              <div className="CCC-form-right">
                <div className="CCC-create-event-form-group">
                  <label className="CCC-create-event-label">
                    Upload Event Image
                  </label>
                  <div className="CCC-image-upload">
                    <img
                      src={imagePreview || "https://via.placeholder.com/150"}
                      alt="Event"
                      className="CCC-uploaded-image"
                    />
                    <input
                      type="file"
                      onChange={handleImageChange}
                      className="CCC-create-event-input"
                      accept="image/*"
                    />
                  </div>
                </div>
                <div className="CCC-create-event-form-group">
                  <label className="CCC-create-event-label">
                    Select Event Head
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="CCC-dropdown-toggle"
                  >
                    {organizationData?.president?.id === eventDetails.eventHead
                      ? organizationData?.president?.name
                      : organizationData?.officers.find(
                          (officer: any) =>
                            officer.id === eventDetails.eventHead
                        )?.name || "Select Event Head"}
                  </button>
                </div>
              </div>
            </form>
  
            <div className="CCC-buttons">
              <button
                type="button"
                onClick={handleCancel}
                className="CCC-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="CCC-create-event-submit-btn"
              >
                Save Changes
              </button>
            </div>
          </div>
  
          {isModalOpen && (
            <div className="CCC-modal">
              <div className="CCC-modal-content">
                <h3>Select Event Head</h3>
                <div>
                  <div
                    className="CCC-dropdown-item"
                    onClick={() =>
                      handleSelectEventHead(organizationData?.president?.id)
                    }
                  >
                    <img
                      src={
                        organizationData?.president?.profilePicUrl ||
                        "default-profile.png"
                      }
                      alt="President"
                      className="CCC-dropdown-profile-pic"
                    />
                    {organizationData?.president?.name} (President)
                  </div>
                  {organizationData?.officers?.map((officer: any) => (
                    <div
                      key={officer.id}
                      className="CCC-dropdown-item"
                      onClick={() => handleSelectEventHead(officer.id)}
                    >
                      <img
                        src={officer.profilePicUrl || "default-profile.png"}
                        alt={officer.name}
                        className="CCC-dropdown-profile-pic"
                      />
                      {officer.name} ({officer.role})
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="CCC-close-modal-btn"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  
  
};

export default EditEvent;
