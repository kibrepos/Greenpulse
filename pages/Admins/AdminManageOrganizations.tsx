import React, { useState, useEffect } from "react";
import Swal from 'sweetalert2'; // Import SweetAlert
import { auth } from "../../services/firebaseConfig";
import { firestore } from "../../services/firebaseConfig";
import { collection, getDocs, updateDoc, deleteDoc, doc, Timestamp, addDoc, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../../styles/AdminManageOrganizations.css";
import AdminSidebar from './AdminSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';
import DataTable from 'react-data-table-component';

interface Organization {
  id: string;
  name: string;
  description: string;
  facultyAdviser: { id: string; name: string, profilePicUrl?: string };
  president: { id: string; name: string, profilePicUrl?: string };
  status: string;
}

const AdminManageOrganizations: React.FC = () => {
  const [activeOrganizations, setActiveOrganizations] = useState<Organization[]>([]);
  const [archivedOrganizations, setArchivedOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // Toggle between 'active' and 'archived'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [organizationToModify, setOrganizationToModify] = useState<Organization | null>(null);
  const [actionType, setActionType] = useState<string>(''); // 'delete', 'archive', 'unarchive'
  const navigate = useNavigate();

  const truncate = (str: string, maxLength: number) => {
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
  };

  const logActivity = async (activity: string) => {
    const admin = auth.currentUser;
    if (!admin) return;

    try {
      const adminQuery = query(collection(firestore, "admin"), where("userID", "==", admin.uid));
      const querySnapshot = await getDocs(adminQuery);

      if (!querySnapshot.empty) {
        const adminDoc = querySnapshot.docs[0];
        const data = adminDoc.data();
        const adminName = `${data.firstName} ${data.lastName}`;

        await addDoc(collection(firestore, "logs"), {
          activity,
          userName: adminName,
          timestamp: Timestamp.now(),
          role: data.role || "admin",
        });
      }
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  const fetchOrganizations = async () => {
    setLoading(true);
    const orgCollection = collection(firestore, "organizations");
    const orgSnapshot = await getDocs(orgCollection);
    const orgList = orgSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Organization[];

    // Filter active and archived organizations
    setActiveOrganizations(orgList.filter((org) => org.status === 'active'));
    setArchivedOrganizations(orgList.filter((org) => org.status === 'archived'));

    setLoading(false);
  };

  // Archive an organization
  const archiveOrganization = async () => {
    if (!organizationToModify) return;
    const orgDoc = doc(firestore, "organizations", organizationToModify.id);
    await updateDoc(orgDoc, { status: "archived" });
    await logActivity(`Archived organization "${organizationToModify.name}".`);
    fetchOrganizations(); // Refresh the list after archiving
    closeModal(); // Close the modal after action
  };

  // Unarchive an organization
  const unarchiveOrganization = async () => {
    if (!organizationToModify) return;
    const orgDoc = doc(firestore, "organizations", organizationToModify.id);
    await updateDoc(orgDoc, { status: "active" });
    await logActivity(`Unarchived organization "${organizationToModify.name}".`);
    fetchOrganizations(); // Refresh the list after unarchiving
    closeModal(); // Close the modal after action
  };

  // Delete an organization
  const deleteOrganization = async () => {
    if (!organizationToModify) return;
    try {
      const orgDoc = doc(firestore, "organizations", organizationToModify.id);
      await deleteDoc(orgDoc);
      await logActivity(`Deleted organization "${organizationToModify.name}".`);
      fetchOrganizations(); // Refresh the list after deletion
      closeModal(); // Close the modal after action
    } catch (error) {
      console.error("Error deleting organization:", error);
    }
  };

  // Open SweetAlert and set the organization and action to be performed
  const confirmAction = (organization: Organization, type: 'delete' | 'archive' | 'unarchive') => {
    setOrganizationToModify(organization);
    setActionType(type);

    Swal.fire({
      title: `Are you sure you want to ${type} this organization?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: type === 'archive' ? '#28a745' : '#3085d6', // Green for archive, blue for others
      cancelButtonColor: '#d33',
      confirmButtonText: `Yes, ${type}`,
    }).then((result) => {
      if (result.isConfirmed) {
        if (type === 'delete') {
          deleteOrganization();
        } else if (type === 'archive') {
          archiveOrganization();
        } else {
          unarchiveOrganization();
        }
      }
    });
  };

  // Close the modal
  const closeModal = () => {
    setShowConfirmModal(false);
    setOrganizationToModify(null);
  };

  // Navigate to view organization page
  const handleViewOrganization = (organizationName: string) => {
    navigate(`/Admin/Organizations/${organizationName}`);
  };

  // Navigate to create new organization page
  const handleCreateOrganization = () => {
    navigate("/Admin/CreateOrganization");
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Define columns for DataTables
  const columns = [
    {
      name: 'Name',
      selector: (row: Organization) => truncate(row.name, 30),
      sortable: true,
    },
    {
      name: 'Description',
      selector: (row: Organization) => truncate(row.description, 50),
      sortable: true,
    },
    {
      name: 'Faculty Adviser',
      cell: (row: Organization) => (
        <div className="profile-cell">
          {row.facultyAdviser?.profilePicUrl ? (
            <img
              src={`${row.facultyAdviser.profilePicUrl}?t=${new Date().getTime()}`}
              alt={row.facultyAdviser.name}
              className="faculty-pic"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            <FontAwesomeIcon icon={faUserCircle} className="default-icon" style={{ color: '#ccc' }} />
          )}
          <span>{row.facultyAdviser?.name || 'Not Assigned'}</span>
        </div>
      ),
    },
    {
      name: 'President',
      cell: (row: Organization) => (
        <div className="profile-cell">
          {row.president?.profilePicUrl ? (
            <img
              src={row.president.profilePicUrl}
              alt={row.president.name}
              className="president-pic"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            <FontAwesomeIcon icon={faUserCircle} className="default-icon" style={{ color: '#ccc' }} />
          )}
          <span>{row.president?.name || 'Not Assigned'}</span>
        </div>
      ),
    },
    {
      name: 'Actions',
      cell: (row: Organization) => (
        <div className="actions-column">
          <button onClick={() => handleViewOrganization(row.name)} className="MO-view-btn">View</button>
          {activeTab === 'active' ? (
            <button onClick={() => confirmAction(row, 'archive')} className="MO-archive-btn">Archive</button>
          ) : (
            <>
              <button onClick={() => confirmAction(row, 'unarchive')} className="MO-unarchive-btn">Unarchive</button>
              <button onClick={() => confirmAction(row, 'delete')} className="MO-delete-btn">Delete</button>
            </>
          )}
        </div>
      ),
    },
  ];


  // Search Bar Function
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value.toLowerCase());
  };
  const filteredOrganizations = (activeTab === 'active' ? activeOrganizations : archivedOrganizations).filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery) ||
      org.description.toLowerCase().includes(searchQuery) ||
      org.facultyAdviser?.name.toLowerCase().includes(searchQuery) ||
      org.president?.name.toLowerCase().includes(searchQuery)
  );

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-main">
        <AdminSidebar />
        <div className="admin-dashboard-content">
          <h2 className="PageTitle">Manage Organizations</h2>
          <div className="MO-organization-header">
            {/* Create New Organization Button */}
            <button onClick={handleCreateOrganization} className="MO-create-btn">Create New Organization</button>

              {/* Search Input */}
              <input
                type="text"
                placeholder="Search by name, description, faculty adviser, or president"
                value={searchQuery}
                onChange={handleSearch}
                className="search-input"
              />

            {/* Tabs for Active and Archived Organizations */}
            <div className="MO-tabs">
              <button
                className={activeTab === 'active' ? 'MO-tab MO-active' : 'MO-tab'}
                onClick={() => setActiveTab('active')}
              >
                Active
              </button>
              <button
                className={activeTab === 'archived' ? 'MO-tab MO-active' : 'MO-tab'}
                onClick={() => setActiveTab('archived')}
              >
                Archived
              </button>
            </div>
          </div>

          {/* DataTables for Active and Archived Organizations */}
          {loading ? (
            <p>Loading organizations...</p>
          ) : (
            <div className="table-container">
              <DataTable
                columns={columns}
                data={filteredOrganizations}
                pagination
                paginationPerPage={8}
                paginationRowsPerPageOptions={[8, 10, 15, 20]} // Set rows per page options
                highlightOnHover
                striped
                responsive
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminManageOrganizations;