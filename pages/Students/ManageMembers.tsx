import React, { useEffect, useState,useMemo  } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc,getDocs,updateDoc,collection,setDoc,where,query,arrayUnion,addDoc,arrayRemove,deleteDoc  } from 'firebase/firestore';
import { firestore } from '../../services/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';
import Header from '../../components/Header'; 
import StudentPresidentSidebar from "./StudentPresidentSidebar";
import StudentMemberSidebar from "./StudentMemberSidebar";
import '../../styles/ManageMembers.css'; 
import { showToast } from '../../components/toast';
import Swal from 'sweetalert2';

interface Member {
  id: string;
  name: string;
  profilePicUrl?: string;
  email?: string;
}

interface Officer {
  id: string;
  name: string;
  role: string;
  profilePicUrl?: string;
  email?: string;
}

interface FacultyAdviser {
  id: string;
  name: string;
  profilePicUrl?: string;
  email?: string;
}

interface Organization {
  facultyAdviser: FacultyAdviser;
  president: Officer;
  officers: Officer[];
  members: Member[];
  committees: Committee[];
}
interface Committee {
  id: string;
  name: string;
  head: Officer | null; // The head can be null if not assigned
  members: Member[]; // Array of members in the committee
}

const ManageMembers: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [organizationData, setOrganizationData] = useState<Organization | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navigate = useNavigate();
  const goToManageCommittees = () => {
    navigate(`/Organization/${organizationName}/manage-committees`);
  };
const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Manage edit modal state
const [officerToEdit, setOfficerToEdit] = useState<Officer | null>(null); // Holds selected officer
const [newRole, setNewRole] = useState<string>(''); // Holds the new role for the officer
const [roleError, setRoleError] = useState<string | null>(null);
const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
const [allStudents, setAllStudents] = useState<Member[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [invitedStudents, setInvitedStudents] = useState<string[]>([]);
const [availableStudents, setAvailableStudents] = useState<Member[]>([]);
const openInviteModal = () => setIsInviteModalOpen(true);
const closeInviteModal = () => setIsInviteModalOpen(false);
const [role, setRole] = useState<string>('');
const [userDetails, setUserDetails] = useState<any>(null);
const [imageLoadError, setImageLoadError] = useState<{ [key: string]: boolean }>({});
const auth = getAuth();


useEffect(() => {
  const fetchUserDetails = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser) {
      // Query students collection for matching userId
      const studentsRef = collection(firestore, 'students');
      const studentQuery = query(studentsRef, where('userId', '==', currentUser.uid));
      const studentSnapshot = await getDocs(studentQuery);

      if (!studentSnapshot.empty) {
        const studentDoc = studentSnapshot.docs[0];
        setUserDetails(studentDoc.data());
        return;
      }

      // Query faculty collection for matching userId
      const facultyRef = collection(firestore, 'faculty');
      const facultyQuery = query(facultyRef, where('userId', '==', currentUser.uid));
      const facultySnapshot = await getDocs(facultyQuery);

      if (!facultySnapshot.empty) {
        const facultyDoc = facultySnapshot.docs[0];
        setUserDetails(facultyDoc.data());
        return;
      }

      console.error("User not found in students or faculty collections.");
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
          setRole('faculty'); // Assign role as 'faculty'
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
    case 'faculty': // Add case for faculty
      return <StudentPresidentSidebar />;
    case 'member':
      return <StudentMemberSidebar />;
    default:
      return null; // No sidebar for guests
  }
};


useEffect(() => {
  const fetchAvailableStudents = async () => {
    try {
      const studentsRef = collection(firestore, 'students');
      const snapshot = await getDocs(studentsRef);

      const allStudents = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: `${doc.data().firstname} ${doc.data().lastname}`,
        profilePicUrl: doc.data().profilePicUrl || '/default-profile.png', // Fixed this line
      })) as Member[];

      const eligibleStudents = filterEligibleStudents(allStudents);
      setAvailableStudents(eligibleStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  fetchAvailableStudents();
}, [organizationData]);


useEffect(() => {
  const fetchStudents = async () => {
    const studentsSnapshot = await getDocs(collection(firestore, 'students'));
    const studentsList: Member[] = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: `${doc.data().firstname} ${doc.data().lastname}`,
      profilePicUrl: doc.data().profilePicUrl || '/default-profile.png', // Fetch profilePicUrl
    }));

    const filteredStudents = studentsList.filter(
      (student) =>
        !organizationData?.members.some((member) => member.id === student.id) &&
        !invitedStudents.includes(student.id)
    );

    setAllStudents(filteredStudents);
  };

  fetchStudents();
}, [organizationData, invitedStudents]);

const filteredStudents = useMemo(() => {
  return availableStudents.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [availableStudents, searchQuery]);

const filterEligibleStudents = (students: Member[]) => {
  if (!organizationData) return [];

  const { president, officers, members } = organizationData;

  const excludedIds = new Set([
    president.id,
    ...officers.map((officer) => officer.id),
    ...members.map((member) => member.id),
  ]);

  return students.filter((student) => !excludedIds.has(student.id));
};




const allRoles = [
  "Vice President",
  "Secretary",
  "Treasurer",
  "Auditor",
  "Public Relations Officer",
  "Sergeant-at-Arms",
];
const openEditModal = async (officer: Officer) => {
  const assignedRoles = organizationData?.officers.map((officer) => officer.role) || [];
  const remainingRoles = allRoles.filter((role) => !assignedRoles.includes(role) || role === officer.role);

  if (remainingRoles.length === 0) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'All officer roles are filled.',
    });
    return;
  }

  const { value: newRole } = await Swal.fire({
    title: `Edit Role for ${officer.name}`,
    input: 'select',
    inputOptions: remainingRoles.reduce((options, role) => {
      options[role] = role;
      return options;
    }, {} as { [key: string]: string }),
    inputPlaceholder: 'Select a role',
    showCancelButton: true,
    confirmButtonText: 'Update',
    confirmButtonColor: '#074034',
    cancelButtonText: 'Cancel',
    inputValidator: (value) => {
      if (!value) {
        return 'You need to select a role!';
      }
      return null;
    },
  });

  if (newRole) {
    await handleRoleUpdate(officer, newRole);
  }
};
useEffect(() => {
  const fetchInvitedStudents = async () => {
    try {
      const orgDocRef = doc(firestore, 'organizations', organizationName!);
      const orgDoc = await getDoc(orgDocRef);

      if (orgDoc.exists()) {
        const data = orgDoc.data();
        const invited = data.invitedStudents || [];
        setInvitedStudents(invited);
      }
    } catch (error) {
      console.error('Error fetching invited students:', error);
    }
  };

  fetchInvitedStudents();
}, [organizationName]);

const inviteStudent = async (studentId: string) => {
  try {
    // Fetch the student document using the studentId (document ID)
    const studentDocRef = doc(firestore, 'students', studentId);
    const studentDoc = await getDoc(studentDocRef);

    if (!studentDoc.exists()) {
      throw new Error('Student document not found');
    }

    const studentData = studentDoc.data();
    const studentUserId = studentData.userId; // Extract the userId from the student document
    const studentName = `${studentData.firstname} ${studentData.lastname}` || 'Unknown Student';

    // Fetch organization data from Firestore
    const orgDocRef = doc(firestore, 'organizations', organizationName!);
    const orgDoc = await getDoc(orgDocRef);

    let senderName = organizationName || 'Unknown Organization';
    let senderProfilePic = '/default-profile.png'; // Default profile picture

    if (orgDoc.exists()) {
      const orgData = orgDoc.data();
      senderName = orgData.name || senderName; // Use the organization name
      senderProfilePic = orgData.profileImagePath || senderProfilePic; // Use the organization's profile image
    }

    const notification = {
      subject: `You have been invited to join ${organizationName}.`,
      timestamp: new Date(),
      isRead: false,
      senderName,
      senderProfilePic,
      organizationName: organizationName,
      status: 'pending',
      type: 'invite',
    };

    // Save the notification to the invited student's notifications sub-collection
    const notificationRef = doc(
      firestore,
      `notifications/${studentUserId}/userNotifications`, // Use the student's userId as the document ID
      uuidv4() // Generate a unique ID for each notification
    );

    await setDoc(notificationRef, notification);

    // Add student to invited students in the organization document
    await updateDoc(orgDocRef, {
      invitedStudents: arrayUnion(studentId),
    });

    setInvitedStudents((prev) => [...prev, studentId]);

    // Log activity with the student's name
    await logActivity(`Invited ${studentName} to join the organization.`);
  } catch (error) {
    console.error('Error inviting student:', error);
    showToast("Failed to send the invite. Please try again.", "error");
  }
};
const cancelInvite = async (studentId: string) => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to cancel this invite?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f01202',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, cancel it!',
  });

  if (result.isConfirmed) {
    try {
      const orgDocRef = doc(firestore, 'organizations', organizationName!);
      const studentDocRef = doc(firestore, 'students', studentId);
      const studentDoc = await getDoc(studentDocRef);

      if (!studentDoc.exists()) {
        throw new Error('Student document not found');
      }

      const studentData = studentDoc.data();
      const studentUserId = studentData.userId; // Get the correct userId

      // Remove student from invitedStudents array
      await updateDoc(orgDocRef, {
        invitedStudents: arrayRemove(studentId),
      });

      // Delete the notification from the user's notifications sub-collection
      const notificationsRef = collection(
        firestore,
        `notifications/${studentUserId}/userNotifications`
      );
      const notificationsSnapshot = await getDocs(notificationsRef);

      const deletePromises = notificationsSnapshot.docs
        .filter((notificationDoc) => {
          const notificationData = notificationDoc.data();
          return (
            notificationData.type === 'invite' &&
            notificationData.organizationName === organizationName
          );
        })
        .map((notificationDoc) =>
          deleteDoc(doc(firestore, `notifications/${studentUserId}/userNotifications`, notificationDoc.id))
        );

      await Promise.all(deletePromises); // Ensure all notifications are deleted

      // Update the local state
      setInvitedStudents((prev) => prev.filter((id) => id !== studentId));

      Swal.fire('Cancelled!', 'The invite has been cancelled.', 'success');
    } catch (error) {
      console.error('Error cancelling invite:', error);
      Swal.fire('Error', 'Failed to cancel the invite. Please try again.', 'error');
    }
  }
};



const handleRoleUpdate = async (officer: Officer, newRole: string) => {
  try {
    // Fetch organization data from Firestore
    const orgDocRef = doc(firestore, 'organizations', organizationName!);
    const orgDoc = await getDoc(orgDocRef);

    let senderName = organizationName || 'Unknown Organization';
    let senderProfilePic = '/default-profile.png'; // Default profile picture

    if (orgDoc.exists()) {
      const orgData = orgDoc.data();
      senderName = orgData.name || senderName; // Use the organization name
      senderProfilePic = orgData.profileImagePath || senderProfilePic; // Use the organization's profile image
    }

    // Update the officer's role in the officers list
    const updatedOfficers = organizationData!.officers.map((o) =>
      o.id === officer.id ? { ...o, role: newRole } : o
    );

    // Update Firestore with the new officer roles
    await updateDoc(orgDocRef, { officers: updatedOfficers });

    // Refresh the state with the updated officers
    setOrganizationData((prev) => ({
      ...prev!,
      officers: updatedOfficers,
    }));

    // Log the role update activity
    await logActivity(`Updated role of ${officer.name} to ${newRole}.`);

    // Send a notification to the officer about their updated role
    const notification = {
      subject: `Your role has been updated to ${newRole}`,
      timestamp: new Date(),
      isRead: false,
      senderName,
      senderProfilePic,
      organizationName: organizationName,
      status: 'role-updated',
      type: 'role-change',
    };

    const notificationRef = doc(
      firestore,
      `notifications/${officer.id}/userNotifications`,
      uuidv4()
    );

    await setDoc(notificationRef, notification);

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: `Role updated successfully to ${newRole}.`,
    });
  } catch (error) {
    console.error('Error updating officer role:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update the role. Please try again.',
    });
  }
};






const openDemoteModal = async (officer: Officer) => {
  const result = await Swal.fire({
    title: `Demote ${officer.name}`,
    text: `Are you sure you want to demote ${officer.name} to a member?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, demote',
    confirmButtonColor: '#f01202',
    cancelButtonText: 'Cancel',
  });

  if (result.isConfirmed) {
    await handleDemote(officer);
  }
};

const handleDemote = async (officer: Officer) => {
  if (!organizationData || !organizationName) return;

  try {
    // Filter out the demoted officer from the officers list
    const updatedOfficers = organizationData.officers.filter(
      (o) => o.id !== officer.id
    );

    // Add the demoted officer to the members list
    const updatedMembers = [
      ...organizationData.members,
      {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        profilePicUrl: officer.profilePicUrl,
      },
    ];

    // Fetch organization data from Firestore
    const orgDocRef = doc(firestore, 'organizations', organizationName);
    const orgDoc = await getDoc(orgDocRef);

    let senderName = organizationName || 'Unknown Organization';
    let senderProfilePic = '/default-profile.png'; // Default profile picture

    if (orgDoc.exists()) {
      const orgData = orgDoc.data();
      senderName = orgData.name || senderName; // Use the organization name
      senderProfilePic = orgData.profileImagePath || senderProfilePic; // Use the organization's profile image
    }

    // Update Firestore with the new officers and members lists
    await updateDoc(orgDocRef, {
      officers: updatedOfficers,
      members: updatedMembers,
    });

    // Refresh the state with the updated organization data
    setOrganizationData((prev) => ({
      ...prev!,
      officers: updatedOfficers,
      members: updatedMembers,
    }));

    // Log the demotion activity
    await logActivity(`Demoted ${officer.name} to a member.`);

    // Send a notification to the demoted officer
    const notification = {
      subject: `You have been demoted to a member.`,
      timestamp: new Date(),
      isRead: false,
      senderName,
      senderProfilePic,
      organizationName: organizationName,
      status: 'demoted',
      type: 'role-change',
    };

    const notificationRef = doc(
      firestore,
      `notifications/${officer.id}/userNotifications`,
      uuidv4()
    );

    await setDoc(notificationRef, notification);

    Swal.fire('Success', `${officer.name} has been demoted to a member.`, 'success');
  } catch (error) {
    console.error('Error demoting officer:', error);
    Swal.fire('Error', 'Failed to demote the officer. Please try again.', 'error');
  }
};


const openPromoteModal = async (member: Member) => {
  const assignedRoles = organizationData?.officers.map((officer) => officer.role) || [];
  const remainingRoles = allRoles.filter((role) => !assignedRoles.includes(role));

  if (remainingRoles.length === 0) {
    Swal.fire('Error', 'All officer roles are filled.', 'error');
    return;
  }

  const { value: selectedRole } = await Swal.fire({
    title: `Promote ${member.name} to Officer`,
    input: 'select',
    inputOptions: remainingRoles.reduce((options, role) => {
      options[role] = role;
      return options;
    }, {} as { [key: string]: string }),
    inputPlaceholder: 'Select a role',
    showCancelButton: true,
    confirmButtonText: 'Promote',
    confirmButtonColor: '#074034',
    cancelButtonText: 'Cancel',
    inputValidator: (value) => {
      if (!value) {
        return 'You need to select a role!';
      }
      return null;
    },
  });

  if (selectedRole) {
    await handlePromote(member, selectedRole);
  }
};

const handlePromote = async (member: Member, selectedRole: string) => {
  try {
    // Update the list of officers
    const updatedOfficers = [
      ...organizationData!.officers,
      {
        id: member.id,
        name: member.name,
        role: selectedRole,
        email: member.email,
        profilePicUrl: member.profilePicUrl,
      },
    ];

    // Remove the promoted member from the members list
    const updatedMembers = organizationData!.members.filter(
      (m) => m.id !== member.id
    );

    // Fetch organization data from Firestore
    const orgDocRef = doc(firestore, 'organizations', organizationName!);
    const orgDoc = await getDoc(orgDocRef);

    let senderName = organizationName || 'Unknown Organization';
    let senderProfilePic = '/default-profile.png'; // Default profile picture

    if (orgDoc.exists()) {
      const orgData = orgDoc.data();
      senderName = orgData.name || senderName; // Use the organization name
      senderProfilePic = orgData.profileImagePath || senderProfilePic; // Use the organization's profile image
    }

    // Update Firestore with the new officer and member lists
    await updateDoc(orgDocRef, {
      officers: updatedOfficers,
      members: updatedMembers,
    });

    // Refresh the state with the updated organization data
    setOrganizationData((prev) => ({
      ...prev!,
      officers: updatedOfficers,
      members: updatedMembers,
    }));

    // Log the promotion activity
    await logActivity(`Promoted ${member.name} to the role of ${selectedRole}.`);

    // Send a notification to the promoted member
    const notification = {
      subject: `Congratulations! You have been promoted to ${selectedRole}.`,
      timestamp: new Date(),
      isRead: false,
      senderName,
      senderProfilePic,
      organizationName: organizationName,
      status: 'promoted',
      type: 'role-change',
    };

    const notificationRef = doc(
      firestore,
      `notifications/${member.id}/userNotifications`,
      uuidv4()
    );

    await setDoc(notificationRef, notification);

    Swal.fire('Success', `${member.name} has been promoted to ${selectedRole}.`, 'success');
  } catch (error) {
    console.error('Error promoting member:', error);
    Swal.fire('Error', 'Failed to promote the member. Please try again.', 'error');
  }
};



const openKickModal = async (userId: string, userName: string) => {
  const { value: reason } = await Swal.fire({
    title: `Kick ${userName}`,
    html: `
      <p>Are you sure you want to kick ${userName}?</p>
      <select id="kick-reason" class="swal2-select">
        <option value="Not Participating">Not Participating</option>
        <option value="Violation of Rules">Violation of Rules</option>
        <option value="Inactive Member">Inactive Member</option>
        <option value="Other">Other</option>
      </select>
    `,
    showCancelButton: true,
    confirmButtonText: 'Yes, kick',
    confirmButtonColor: '#f01202',
    cancelButtonText: 'Cancel',
    focusConfirm: false,
    preConfirm: () => {
      const reason = (document.getElementById('kick-reason') as HTMLSelectElement).value;
      if (!reason) {
        Swal.showValidationMessage('Please select a reason');
      }
      return reason;
    },
  });

  if (reason) {
    await handleKick(userId, userName, reason);
  }
};

const handleKick = async (userId: string, userName: string, reason: string) => {
  if (!organizationData || !organizationName) return;

  try {
    const orgDocRef = doc(firestore, 'organizations', organizationName);
    const orgDoc = await getDoc(orgDocRef);

    let orgProfilePic = '/default-profile.png';
    let orgDisplayName = organizationName;

    // Fetch organization profile data
    if (orgDoc.exists()) {
      const orgData = orgDoc.data();
      orgProfilePic = orgData?.profileImagePath || '/default-profile.png';
      orgDisplayName = orgData?.name || organizationName;
    }

    // Remove the user from members and officers
    const updatedMembers = organizationData.members.filter(
      (member) => member.id !== userId
    );
    const updatedOfficers = organizationData.officers.filter(
      (officer) => officer.id !== userId
    );

    // Update committees: remove user as head or member
    const updatedCommittees = organizationData.committees.map((committee) => ({
      ...committee,
      head: committee.head?.id === userId ? null : committee.head, // Remove as head
      members: committee.members.filter((member) => member.id !== userId), // Remove from members
    }));

    // Update Firestore
    const updatedData = {
      ...organizationData,
      members: updatedMembers,
      officers: updatedOfficers,
      committees: updatedCommittees,
    };

    await updateDoc(orgDocRef, updatedData);

    // Notify the kicked user
    const notification = {
      subject: `You have been removed from ${orgDisplayName} for the following reason: ${reason}.`,
      organizationName: orgDisplayName,
      timestamp: new Date(),
      isRead: false,
      status: 'kicked',
      type: 'general',
      senderProfilePic: orgProfilePic,
      senderName: orgDisplayName,
    };

    const notifRef = doc(
      firestore,
      `notifications/${userId}/userNotifications`,
      uuidv4()
    );

    await setDoc(notifRef, notification);

    // Log the action
    await logActivity(`Kicked ${userName} from the organization for the following reason: ${reason}.`);

    // Update the local state
    setOrganizationData(updatedData);

    Swal.fire('Success', `${userName} has been successfully removed from the organization.`, 'success');
  } catch (error) {
    console.error('Error kicking user:', error);
    Swal.fire('Error', 'Failed to kick the user. Please try again.', 'error');
  }
};


  const toggleDropdown = (id: string) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };
  const fetchUserData = async (userId: string) => {
    try {
      // Query the students collection for a document with the matching userId
      const studentsRef = collection(firestore, 'students');
      const studentQuery = query(studentsRef, where('userId', '==', userId));
      const studentSnapshot = await getDocs(studentQuery);
  
      if (!studentSnapshot.empty) {
        const studentDoc = studentSnapshot.docs[0]; // Get the first matching document
        const data = studentDoc.data();
        return {
          email: data.email || 'N/A',
          name: `${data.firstname} ${data.lastname}` || 'Unknown', // Combine first and last names
          profilePicUrl: data.profilePicUrl || null,
        };
      }
  
      // Query the faculty collection for a document with the matching userId
      const facultyRef = collection(firestore, 'faculty');
      const facultyQuery = query(facultyRef, where('userId', '==', userId));
      const facultySnapshot = await getDocs(facultyQuery);
  
      if (!facultySnapshot.empty) {
        const facultyDoc = facultySnapshot.docs[0]; // Get the first matching document
        const data = facultyDoc.data();
        return {
          email: data.email || 'N/A',
          name: `${data.firstname} ${data.lastname}` || 'Unknown', // Combine first and last names for faculty
          profilePicUrl: data.profilePicUrl || null,
        };
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  
    // Return default values if no data is found
    return { email: 'N/A', name: 'Unknown', profilePicUrl: null };
  };

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!organizationName) return;

      try {
      
        const orgDocRef = doc(firestore, 'organizations', organizationName);
        const orgDoc = await getDoc(orgDocRef);

        if (orgDoc.exists()) {
          const orgData = orgDoc.data() as Organization;

          const updatedPresident = {
            ...orgData.president,
            ...(await fetchUserData(orgData.president.id)),
          };

          const updatedFacultyAdviser = {
            ...orgData.facultyAdviser,
            ...(await fetchUserData(orgData.facultyAdviser.id)),
          };

          const updatedOfficers = await Promise.all(
            orgData.officers.map(async (officer) => ({
              ...officer,
              ...(await fetchUserData(officer.id)),
            }))
          );

          const updatedMembers = await Promise.all(
            orgData.members.map(async (member) => ({
              ...member,
              ...(await fetchUserData(member.id)),
            }))
          );

          setOrganizationData({
            ...orgData,
            president: updatedPresident,
            facultyAdviser: updatedFacultyAdviser,
            officers: updatedOfficers,
            members: updatedMembers,
          });
        } else {
          console.error('Organization not found');
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      } 
    };

    fetchOrganization();
  }, [organizationName]);

  const renderProfilePic = (profilePicUrl?: string) => (
    profilePicUrl ? (
      <img src={profilePicUrl} alt="Profile" className="member-profile-pic" />
    ) : (
      <FontAwesomeIcon icon={faUserCircle} className="default-profile-icon" />
    )
  );

return (
  <div className="organization-announcements-page">
    <Header />
    <div className="organization-announcements-container">
      <div className="sidebar-section">
        {renderSidebar()}
      </div>
      <div className="organization-announcements-content">
        {organizationData ? (
          <>
            <div className="header-container">
              <h1 className="headtitle">Organization Members</h1>
              <button
                className="create-new-btn"
                onClick={goToManageCommittees}
              >
                {role === 'member' ? 'View Committees' : 'Manage Committees'}
              </button>
            </div>

            {role !== 'member' && (
              <button className="invite-btn" onClick={() => setIsInviteModalOpen(true)}>
  + Invite a new member
</button>

            )}


{isInviteModalOpen && (
  <div className="MM-modal-overlay">
    <div className="MM-modal-content">
      <button onClick={closeInviteModal} className="close-btn">
        &times; {/* This is the "X" symbol */}
      </button>
      <h3>Invite a Member</h3>
      <input
        type="text"
        placeholder="Search for a student..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="MM-search-bar"
      />
      <div className="invite-modal-sections">
        {/* Left Side: Students to Invite */}
        <div className="students-to-invite">
          <h4>Students to Invite</h4>
          <ul className="student-list">
            {filteredStudents
              .filter((student) => !invitedStudents.includes(student.id)) // Only show non-invited students
              .map((student) => (
                <li key={student.id} className="student-item">
             <div className="profile-wrapper">
  {!imageLoadError[student.id] ? (
    <img
      src={student.profilePicUrl || '/default-profile.png'}
      alt={student.name}
      className="MM-student-profile-pic"
      onError={() => setImageLoadError((prev) => ({ ...prev, [student.id]: true }))}
    />
  ) : (
    <div className="MM-profile-placeholder">
      <FontAwesomeIcon icon={faUserCircle} className="MM-profile-icon" />
    </div>
  )}
</div>
               
                  <span>{student.name}</span>
                  <button
                    onClick={() => inviteStudent(student.id)}
                    style={{
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Invite
                  </button>
                </li>
              ))}
          </ul>
        </div>

        {/* Right Side: Invited Students */}
        <div className="invited-students">
          <h4>Invited Students</h4>
          <ul className="student-list">
            {filteredStudents
              .filter((student) => invitedStudents.includes(student.id)) // Only show invited students
              .map((student) => (
                <li key={student.id} className="student-item">
                  <div className="profile-wrapper">
                  {!imageLoadError[student.id] ? (
    <img
      src={student.profilePicUrl || '/default-profile.png'}
      alt={student.name}
      className="MM-student-profile-pic"
      onError={() => setImageLoadError((prev) => ({ ...prev, [student.id]: true }))}
    />
  ) : (
    <div className="MM-profile-placeholder">
      <FontAwesomeIcon icon={faUserCircle} className="MM-profile-icon" />
    </div>
  )}
</div>
               
                  <span>{student.name}</span>
                  <button
                    onClick={() => cancelInvite(student.id)}
                    style={{
                      backgroundColor: '#d33',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel Invite
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
)}

            {/* Faculty Adviser Table */}
            <div className="MM-table-wrapper">
              <h3>Faculty Adviser</h3>
              <table className="MM-table">
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>Name</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{renderProfilePic(organizationData.facultyAdviser.profilePicUrl)}</td>
                    <td>{organizationData.facultyAdviser.name}</td>
                    <td>{organizationData.facultyAdviser.email}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Officers Table */}
           {/* Officers Table */}
<div className="MM-table-wrapper">
  <h3>Officers</h3>
  <table className="MM-table">
    <thead>
      <tr>
        <th>Profile</th>
        <th>Name</th>
        <th>Role</th>
        <th>Email</th>
        {(role === 'president' || role === 'Vice President') && <th>Actions</th>}
      </tr>
    </thead>
    <tbody>
      {/* President Row */}
      <tr>
        <td>{renderProfilePic(organizationData.president.profilePicUrl)}</td>
        <td>{organizationData.president.name}</td>
        <td>President</td>
        <td>{organizationData.president.email}</td>
        {(role === 'president' || role === 'Vice President') && <td></td>}
      </tr>

      {/* Officers Rows */}
      {organizationData.officers
        .sort((a, b) => (a.role === 'Vice President' ? -1 : 1))
        .map((officer) => (
          <tr key={officer.id}>
            <td>{renderProfilePic(officer.profilePicUrl)}</td>
            <td>{officer.name}</td>
            <td>{officer.role}</td>
            <td>{officer.email}</td>
            {(role === 'president' || role === 'Vice President') && (
              <td>
                {/* Only show actions for officers below the Vice President */}
                {officer.role !== 'President' && officer.role !== 'Vice President' && (
                  <div className={`MM-dropdown ${openDropdown === officer.id ? 'open' : ''}`}>
                    <button className="action-btn" onClick={() => toggleDropdown(officer.id)}>
                      Action
                    </button>
                    <div className="MM-dropdown-content">
                      <button onClick={() => openEditModal(officer)}>Edit</button>
                      <button onClick={() => openDemoteModal(officer)}>Demote</button>
                      <button onClick={() => openKickModal(officer.id, officer.name)}>Kick</button>
                    </div>
                  </div>
                )}
              </td>
            )}
          </tr>
        ))}
    </tbody>
  </table>
</div>

            {/* Members Table */}
            <div className="MM-table-wrapper">
              <h3>Members</h3>
              <table className="MM-table">
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>Name</th>
                    <th>Email</th>
                    {role !== 'member' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {organizationData.members.map((member) => (
                    <tr key={member.id}>
                      <td>{renderProfilePic(member.profilePicUrl)}</td>
                      <td>{member.name}</td>
                      <td>{member.email}</td>
                      {role !== 'member' && (
                        <td>
                          <div className={`MM-dropdown ${openDropdown === member.id ? 'open' : ''}`}>
                            <button className="action-btn" onClick={() => toggleDropdown(member.id)}>
                              Action
                            </button>
                            <div className="MM-dropdown-content">
                            <button onClick={() => openPromoteModal(member)}>Promote</button>
                              <button onClick={() => openKickModal(member.id, member.name)}>Kick</button>
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

       


         
          </>
        ) : null}
      </div>
    </div>
  </div>
);

};

export default ManageMembers;
