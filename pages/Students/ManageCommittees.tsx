import React, { useEffect, useState,useRef  } from 'react';
import { doc, getDoc, updateDoc, arrayUnion,setDoc,addDoc,collection } from 'firebase/firestore';
import { firestore,auth } from '../../services/firebaseConfig';
import Header from '../../components/Header';
import StudentPresidentSidebar from './StudentPresidentSidebar';
import StudentMemberSidebar from "./StudentMemberSidebar";
import '../../styles/ManageCommittees.css';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2';
import { getAuth } from "firebase/auth";
import { showToast } from '../../components/toast';
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface Committee {
  id: string;
  name: string;
  head: Officer;
  members: Member[];
}
// Define the structure for a student or member
interface Member {
  email: string;
  id: string;
  name: string;
  profilePicUrl: string | null; // It can be null
}

// Define the structure for an officer
interface Officer {
  email: string;
  id: string;
  name: string;
  profilePicUrl: string | null; // It can be null
  role: string;
}

// Define the structure for the faculty adviser
interface FacultyAdviser {
  email: string;
  id: string;
  name: string;
  profilePicUrl: string | null; // It can be null
}

// Define the structure for the president
interface President {
  email: string;
  id: string;
  name: string;
  profilePicUrl: string | null; // It can be null
}

// Define the structure for the organization
interface Organization {
  coverImagePath: string; // URL to the cover image
  description: string;     // Description of the organization
  facultyAdviser: FacultyAdviser; // Faculty adviser details
  id: string;             // Unique identifier for the organization
  name: string;           // Name of the organization
  invitedStudents: string[]; // Array of invited student IDs
  members: Member[];      // Array of members
  officers: Officer[];    // Array of officers
  president: President;   
  committees: Committee[];
}

const ManageCommittees: React.FC = () => {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [availableOfficers, setAvailableOfficers] = useState<Officer[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [isCreateCommitteeModalOpen, setIsCreateCommitteeModalOpen] = useState(false);
  const [isHeadModalOpen, setIsHeadModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedHead, setSelectedHead] = useState<Officer | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const { organizationName } = useParams<{ organizationName: string }>();
  const [organizationData, setOrganizationData] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');
    const auth = getAuth();
const [userDetails, setUserDetails] = useState<any>(null);
const [expandedCommitteeId, setExpandedCommitteeId] = useState<string | null>(null);
const [headSearchQuery, setHeadSearchQuery] = useState<string>(""); // For head search
const [memberSearchQuery, setMemberSearchQuery] = useState<string>(""); // For member search


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



const toggleCommitteeExpansion = (id: string) => {
  setExpandedCommitteeId((prevId) => (prevId === id ? null : id));
};

  const sendNotification = async (userId: string, subject: string, description: string) => {
    try {
      const notificationRef = doc(
        firestore,
        `notifications/${userId}/userNotifications`,
        uuidv4() // Use unique ID for each notification
      );
  
      await setDoc(notificationRef, {
        subject,
        description,
        timestamp: new Date(),
        isRead: false,
        senderName: organizationData?.name || "Organization",
        senderProfilePic: organizationData?.coverImagePath || "/default-org.png",
        type: "committee-notification",
      });
  
      console.log(`Notification sent to ${userId}`);
    } catch (error) {
      console.error(`Failed to send notification to ${userId}:`, error);
    }
  };

  useEffect(() => {
    const fetchRole = async () => {
      if (!organizationName) return;
  
      try {
        const orgDocRef = doc(firestore, 'organizations', organizationName);
        const orgDoc = await getDoc(orgDocRef);
  
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          const userId = auth.currentUser?.uid;
  
          if (orgData.president?.id === userId) {
            setRole('president');
          } else if (orgData.officers.some((officer: any) => officer.id === userId)) {
            setRole('officer');
          } else if (orgData.facultyAdviser?.id === userId) {
            setRole('faculty'); // Add faculty role
          } else if (orgData.members.some((member: any) => member.id === userId)) {
            setRole('member');
          } else {
            setRole('guest');
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };
  
    fetchRole();
  }, [organizationName]);
  
  const renderSidebar = () => {
    switch (role) {
      case 'president':
        return <StudentPresidentSidebar />;
      case 'officer':
        return <StudentPresidentSidebar />;
      case 'faculty': // Add sidebar for faculty
        return <StudentPresidentSidebar />;
      case 'member':
        return <StudentMemberSidebar />;
      default:
        return null; // No sidebar for guests
    }
  };
  
  const toggleDropdown = (id: string) => {
    setOpenDropdownId((prev) => (prev === id ? null : id));
  };
  
  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!organizationName) return;
  
      try {
        const orgDoc = await getDoc(doc(firestore, 'organizations', organizationName));
        if (orgDoc.exists()) {
          const data = orgDoc.data() as Organization;
          setOrganizationData(data);
  
          // Fetch and set officers
          const officers: Officer[] = data.officers.map(officer => ({
            id: officer.id,
            name: officer.name,
            email: officer.email,
            profilePicUrl: officer.profilePicUrl,
            role: officer.role,
          }));
          setAvailableOfficers(officers);
  
          // Fetch and set members (combine officers and members for selection)
          const members: Member[] = data.members.map(member => ({
            id: member.id,
            name: member.name,
            email: member.email,
            profilePicUrl: member.profilePicUrl,
          }));
  
          const combinedSelectableMembers: Member[] = [
            ...members,
            ...officers.map(officer => ({
              id: officer.id,
              name: officer.name,
              email: officer.email,
              profilePicUrl: officer.profilePicUrl,
            })),
          ];
  
          setAvailableMembers(combinedSelectableMembers);
  
          // Fetch and set committees
          if (data.committees) {
            setCommittees(
              data.committees.map((committee: any) => ({
                id: committee.id,
                name: committee.name,
                head: committee.head,
                members: committee.members,
              }))
            );
          }
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchOrganizationData();
  }, [organizationName]);
  
  
  const handleCreateCommittee = async () => {
    if (!newCommitteeName || !selectedHead || selectedMembers.length < 1) {
          showToast("Please provide all details and select at least one member.", "error");
      return;
    }
  
    const newCommittee: Committee = {
      id: Date.now().toString(),
      name: newCommitteeName,
      head: selectedHead,
      members: selectedMembers,
    };
  
    try {
      const orgDocRef = doc(firestore, 'organizations', organizationName!);
      await updateDoc(orgDocRef, {
        committees: arrayUnion(newCommittee),
      });
  
      setCommittees((prev) => [...prev, newCommittee]); // Only if Firestore update is successful
      closeCreateCommitteeModal();
          showToast("Commitee created successfully.", "success");
  
      // Notify the head
      await sendNotification(
        selectedHead.id,
        `You are now the head of the committee "${newCommitteeName}".`,
        `You have been assigned as the head of the "${newCommitteeName}" committee in ${organizationData?.name}.`
      );
  
      // Notify the members
      const notificationPromises = selectedMembers.map((member) =>
        sendNotification(
          member.id,
          `You have been added to the committee "${newCommitteeName}".`,
          `You are now a member of the "${newCommitteeName}" committee in ${organizationData?.name}.`
        )
      );
      await Promise.all(notificationPromises);
      await logActivity(`Created a Commitee called "${newCommitteeName}" `);
    } catch (error) {
      console.error('Failed to create the committee:', error);
      showToast("Failed to create the committee. Please try again.", "error");
    }
  };
  

  const toggleMemberSelection = (member: Member) => {
    setSelectedMembers((prev) =>
      prev.some((m) => m.id === member.id)
        ? prev.filter((m) => m.id !== member.id)
        : [...prev, member]
    );
  };

  const openCreateCommitteeModal = () => setIsCreateCommitteeModalOpen(true);
  const closeCreateCommitteeModal = () => {
    setIsCreateCommitteeModalOpen(false);
    setNewCommitteeName(''); // Clear committee name
    setSelectedHead(null); // Clear selected head
    setSelectedMembers([]); // Clear selected members
  };
  
  const openHeadModal = () => setIsHeadModalOpen(true);
  const closeHeadModal = () => setIsHeadModalOpen(false);
  const openMemberModal = () => setIsMemberModalOpen(true);
  const closeMemberModal = () => setIsMemberModalOpen(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null);

  const openEditModal = (committee: Committee) => {
    setSelectedCommittee(committee);
    setSelectedHead(committee.head); // Prepopulate with current head
    setSelectedMembers(committee.members); // Prepopulate members
    setNewCommitteeName(committee.name); // Prepopulate name
    setIsEditModalOpen(true);
  };


  const handleEditCommittee = async () => {
    if (!selectedCommittee) return;
  
    const updatedCommittee: Committee = {
      ...selectedCommittee,
      name: newCommitteeName,
      head: selectedHead!,
      members: selectedMembers,
    };
  
    try {
      const orgDocRef = doc(firestore, 'organizations', organizationName!);
      const updatedCommittees = committees.map((c) =>
        c.id === selectedCommittee.id ? updatedCommittee : c
      );
  
      await updateDoc(orgDocRef, { committees: updatedCommittees });
      setCommittees(updatedCommittees);
      closeEditModal();
      showToast("Committee updated successfully!", "success");
  
      // Identify added and removed members
      const existingMemberIds = selectedCommittee.members.map((m) => m.id);
      const updatedMemberIds = selectedMembers.map((m) => m.id);
  
      const addedMembers = selectedMembers.filter((m) => !existingMemberIds.includes(m.id));
      const removedMembers = selectedCommittee.members.filter((m) => !updatedMemberIds.includes(m.id));
  
      // Log changes to members
      if (addedMembers.length > 0) {
        await logActivity(
          `Added members to the committee "${selectedCommittee.name}": ${addedMembers
            .map((m) => m.name)
            .join(', ')}.`
        );
      }
      if (removedMembers.length > 0) {
        await logActivity(
          `Removed members from the committee "${selectedCommittee.name}": ${removedMembers
            .map((m) => m.name)
            .join(', ')}.`
        );
      }
  
      // Log the changes to the committee name or head
      if (newCommitteeName !== selectedCommittee.name) {
        await logActivity(
          `Updated the committee name from "${selectedCommittee.name}" to "${newCommitteeName}".`
        );
      }
  
      if (selectedHead?.id !== selectedCommittee.head.id) {
        await logActivity(
          `Changed the head of the committee "${newCommitteeName}" from "${selectedCommittee.head.name}" to "${selectedHead?.name}".`
        );
      }
  
      // Notify newly added members
      const addMemberNotifications = addedMembers.map((member) =>
        sendNotification(
          member.id,
          `You have been added to the committee "${newCommitteeName}".`,
          `You are now a member of the "${newCommitteeName}" committee in the ${organizationData?.name} organization.`
        )
      );
  
      // Notify removed members
      const removeMemberNotifications = removedMembers.map((member) =>
        sendNotification(
          member.id,
          `You have been removed from the committee "${newCommitteeName}".`,
          `You are no longer a member of the "${newCommitteeName}" committee in the ${organizationData?.name} organization.`
        )
      );
  
      await Promise.all([...addMemberNotifications, ...removeMemberNotifications]);
    } catch (error) {
      console.error('Error updating committee:', error);
      showToast("Failed to update the committee.", "error");
    }
  };
  


  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setNewCommitteeName(''); // Clear committee name
    setSelectedHead(null); // Clear selected head
    setSelectedMembers([]); // Clear selected members
  };
  
  const openDeleteModal = (committee: Committee) => {
    setSelectedCommittee(committee);
    setIsDeleteModalOpen(true);
  };
  const handleDeleteCommittee = async (committee: Committee) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete the committee "${committee.name}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      try {
        const orgDocRef = doc(firestore, 'organizations', organizationName!);
        const updatedCommittees = committees.filter((c) => c.id !== committee.id);

        await updateDoc(orgDocRef, { committees: updatedCommittees });
        setCommittees(updatedCommittees);

        showToast("Committee deleted successfully!", "success");

        await logActivity(`Deleted the committee "${committee.name}"`);

        // Notify all members and the head
        const notificationPromises = [
          sendNotification(
            committee.head.id,
            `The committee "${committee.name}" has been deleted.`,
            `You were the head of the "${committee.name}" committee in the ${organizationData?.name} organization.`
          ),
          ...committee.members.map((member) =>
            sendNotification(
              member.id,
              `The committee "${committee.name}" has been deleted.`,
              `You were a member of the "${committee.name}" committee in the ${organizationData?.name} organization.`
            )
          ),
        ];

        await Promise.all(notificationPromises);
      } catch (error) {
        console.error('Error deleting committee:', error);
        showToast("Failed to delete the committee.", "error");
      }
    }
  };
  


  return (
    <div className="organization-announcements-page"> 
        <Header />
        <div className="organization-announcements-container">
        <div className="sidebar-section">{renderSidebar()}</div>
          <div className="main-content">
          <div className="header-container">
            <h1 className="headtitle">Manage Commitees</h1>
              {(role === 'president' || role === 'officer' || role === 'faculty') && (
                <button
                  className="create-new-btn"
                  onClick={openCreateCommitteeModal}
                >
                  Create New Committee
                </button>
              )}
            </div>
    
            <div className="custom-table-container">
  <table className="custom-table">
    <thead>
      <tr>
        <th>Committee Name</th>
        <th>Head (Officer)</th>
        <th>Members</th>
        {(role === 'president' || role === 'officer' || role === 'faculty') && <th>Actions</th>}
      </tr>
    </thead>
    <tbody>
      {committees.map((committee) => (
        <React.Fragment key={committee.id}>
          <tr
            onClick={() => toggleCommitteeExpansion(committee.id)}
            className="custom-table-row"
          >
            <td>{committee.name}</td>
            <td>
              {committee.head ? (
                <div className="head-info">
                  <img
                    src={committee.head.profilePicUrl || "default-pic.png"}
                    alt={committee.head.name}
                    className="head-avatar"
                  />
                  <span>{committee.head.name}</span>
                </div>
              ) : (
                "No head"
              )}
            </td>
            <td>{committee.members.length} members</td>
            {(role === 'president' || role === 'officer' || role === 'faculty') && (
  <td>
    <button className="action-btn" onClick={(event) => { event.stopPropagation(); toggleDropdown(committee.id); }}>
      Actions
    </button>
    {openDropdownId === committee.id && (
      <div className="dropdown-menu">
        <button onClick={() => openEditModal(committee)}>Edit</button>
        <button onClick={() => handleDeleteCommittee(committee)}>Delete</button>
      </div>
    )}
  </td>
)}
          </tr>
          {expandedCommitteeId === committee.id && (
  <tr>
    <td colSpan={4}>
      <div className="members-section">
        <strong className="members-title">Members:</strong> {/* Added Members title */}
        <ul className="custom-member-list">
          {committee.members.length > 0 ? (
            committee.members.map((member) => (
              <li key={member.id}>
                <div className="head-info">
                  <img
                    src={member.profilePicUrl || "default-pic.png"}
                    alt={member.name}
                    className="head-avatar"
                  />
                  <span>{member.name}</span>
                </div>
              </li>
            ))
          ) : (
            <li className="no-members">No member/s</li>
          )}
        </ul>
      </div>
    </td>
  </tr>
)}

        </React.Fragment>
      ))}
    </tbody>
  </table>
</div>

            {(isCreateCommitteeModalOpen || isEditModalOpen) && (
  <div className="lebrone-custom-modal-overlay">
    <div className="lebrone-committee-modal">
      <button className="lebrone-modal-close-btn" onClick={isCreateCommitteeModalOpen ? closeCreateCommitteeModal : closeEditModal}>
        ×
      </button>
      <h3 className="lebrone-modal-title">{isCreateCommitteeModalOpen ? "Create Committee" : "Edit Committee"}</h3>

   
      <div className="lebrone-committee-form">
        {/* Committee Name */}
        <div className="lebrone-committee-name">
          <label>Committee Name</label>
          <input
            type="text"
            placeholder="Enter committee name"
            value={newCommitteeName}
            onChange={(e) => setNewCommitteeName(e.target.value)}
            className="lebrone-input-field"
          />
        </div>

        {/* Committee Head */}
        <div className="lebrone-committee-head">
          <label>Committee Head</label>
          {selectedHead ? (
            <div className="lebrone-head-item" onClick={openHeadModal}>
              <img
                src={selectedHead.profilePicUrl || "default-pic.png"}
                alt={selectedHead.name}
                className="profile-icon"
              />
              <span>{selectedHead.name}</span>
              <button className="lebrone-remove-btn" onClick={(e) => { e.stopPropagation(); setSelectedHead(null); }}>×</button>
            </div>
          ) : (
            <button className="lebrone-action-btn" onClick={openHeadModal}>
              Select Head
            </button>
          )}
        </div>
      </div>
      <button className="lebrone-add-member-btn" onClick={openMemberModal}>
          Add Member
        </button>
      {/* Committee Members */}
      <div className="lebrone-committee-members">
        <label>Committee Members</label>
        <ul className="lebrone-member-list">
          {selectedMembers.map((member) => (
            <li key={member.id} className="lebrone-member-item">
              <img
                src={member.profilePicUrl || "default-pic.png"}
                alt={member.name}
                className="profile-icon"
              />
              <span>{member.name}</span>
              <button className="lebrone-remove-btn" onClick={() => setSelectedMembers((prev) => prev.filter((m) => m.id !== member.id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
     
      </div>

      {/* Save Button */}
      <div className="lebrone-modal-footer">
        <button
          className="lebrone-btn-primary"
          onClick={isCreateCommitteeModalOpen ? handleCreateCommittee : handleEditCommittee}
        >
          Save
        </button>
      </div>
    </div>
  </div>  
)}


{isHeadModalOpen && (
  <div className="lebrone-custom-modal-overlay">
    <div className="lebrone-select-modal">
      <button className="lebrone-modal-close-btn" onClick={closeHeadModal}>
        ×
      </button>
      <h3 className="lebrone-modal-title">Choose Head</h3>
      <input
        type="text"
        placeholder="Search..."
        className="lebrone-search-input"
        onChange={(e) => setHeadSearchQuery(e.target.value)}
      />
      <ul className="lebrone-member-list">
        {availableOfficers
          // Exclude selected members from the head list
          .filter(
            (officer) =>
              !selectedMembers.some((member) => member.id === officer.id) &&
              officer.name.toLowerCase().includes(headSearchQuery.toLowerCase())
          )
          .map((officer) => (
            <li key={officer.id} className="lebrone-member-item">
              <img
                src={officer.profilePicUrl || "default-pic.png"}
                alt={officer.name}
                className="profile-icon"
              />
              <span>{officer.name}</span>
              <button
                className={`lebrone-select-btn ${
                  selectedHead?.id === officer.id ? "selected" : ""
                }`}
                onClick={() => {
                  setSelectedHead(officer);
                  closeHeadModal();
                }}
              >
                {selectedHead?.id === officer.id ? "Selected" : "Select"}
              </button>
            </li>
          ))}
      </ul>
    </div>
  </div>
)}

{isMemberModalOpen && (
  <div className="lebrone-custom-modal-overlay">
    <div className="lebrone-select-modal">
      <button className="lebrone-modal-close-btn" onClick={closeMemberModal}>
        ×
      </button>
      <h3 className="lebrone-modal-title">Choose Members</h3>
      <input
        type="text"
        placeholder="Search..."
        className="lebrone-search-input"
        onChange={(e) => setMemberSearchQuery(e.target.value)}
      />
      <ul className="lebrone-member-list">
        {availableMembers
          // Exclude the selected head from the members list
          .filter(
            (member) =>
              selectedHead?.id !== member.id &&
              member.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
          )
          .map((member) => (
            <li key={member.id} className="lebrone-member-item">
              <img
                src={member.profilePicUrl || "default-pic.png"}
                alt={member.name}
                className="profile-icon"
              />
              <span>{member.name}</span>
              <button
                className={`lebrone-select-btn ${
                  selectedMembers.some((m) => m.id === member.id)
                    ? "selected"
                    : ""
                }`}
                onClick={() => toggleMemberSelection(member)}
              >
                {selectedMembers.some((m) => m.id === member.id)
                  ? "Selected"
                  : "Select"}
              </button>
            </li>
          ))}
      </ul>
    </div>
  </div>
)}





          </div>
        </div>
      </div>
    );
    
};

export default ManageCommittees;
