import React, { useState, useEffect } from "react";
import { firestore } from "../../services/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from './AdminSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';
import '../../styles/AdminViewOrganization.css';

interface Officer {
  role: string;
  student: string;
  name: string;
  profilePicUrl?: string;  // Profile picture URL for officers
}

interface Organization {
  name: string;
  description: string;
  facultyAdviser: { id: string; name: string; profilePicUrl: string | null };
  status: string;
  members: { id: string; name: string; profilePicUrl?: string }[];
  officers: Officer[];
  president: { id: string; name: string; profilePicUrl?: string };
  coverImagePath?: string;
  profileImagePath?: string;
}

const AdminViewOrganization: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>(); 
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchOrganization = async () => {
    if (!organizationName) {
      console.error("Organization name is undefined");
      navigate("/Admin/ManageOrganizations");
      return;
    }

    setLoading(true);
    const orgDoc = doc(firestore, "organizations", organizationName);
    const orgSnapshot = await getDoc(orgDoc);

    if (orgSnapshot.exists()) {
      setOrganization(orgSnapshot.data() as Organization);
    } else {
      console.error("Organization does not exist");
    }
    setLoading(false);
  };

  // Navigate to the Edit Organization page
  const handleEditOrganization = () => {
    navigate(`/Admin/EditOrganization/${organizationName}`);
  };

  useEffect(() => {
    fetchOrganization();
  }, [organizationName]);


  return (
    <div className="VW-admin-dashboard">
  <div className="VW-admin-dashboard-main">
    <AdminSidebar />
    <div className="admin-dashboard-content">
      {loading ? (
        <p>Loading organization details...</p>
      ) : (
        <>
        <div className="VW-org-header">
  <img 
    src={organization?.coverImagePath || '/default-cover.jpg'} 
    alt="Organization Cover" 
    className="VW-org-cover"
  />
  
  <div className="VW-org-profile-container">
    <img 
      src={organization?.profileImagePath || '/default-profile.jpg'} 
      alt="Organization Profile" 
      className="VW-org-profile"
    />
    <div className="VW-org-info">
      <h2 className="VW-org-name">{organization?.name}</h2>
      <button onClick={handleEditOrganization} className="VW-edit-button">
        Edit Organization
      </button>
    </div>
    <button 
            onClick={() => navigate(-1)} 
            className="VW-return-button"
          >
            &larr; Return
          </button>
  </div>
</div>

<div className="VW-org-details">
  <p>{organization?.description}</p>
</div>


          <h3>Faculty Adviser</h3>
<div className="profile-grid">
  {/* Faculty Adviser Section */}
  <div className="profile-card">
    <div className="role-title">FACULTY ADVISER</div>
    {organization?.facultyAdviser.profilePicUrl ? (
      <img 
        src={organization.facultyAdviser.profilePicUrl} 
        alt="Faculty Adviser" 
        className="VW-member-pic"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    ) : (
      <FontAwesomeIcon icon={faUserCircle} className="VW-default-icon" />
    )}
    <p>{organization?.facultyAdviser.name}</p>
  </div>

  {/* President Section */}
</div>

<h3>Officers</h3>
<div className="profile-grid">
  {/* President Section as part of Officers */}
  <div className="profile-card">
    <div className="role-title">PRESIDENT</div>
    {organization?.president.profilePicUrl ? (
      <img 
        src={organization.president.profilePicUrl} 
        alt="President" 
        className="VW-member-pic"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    ) : (
      <FontAwesomeIcon icon={faUserCircle} className="VW-default-icon" />
    )}
    <p>{organization?.president.name}</p>
  </div>

  {/* Remaining Officers */}
  {organization?.officers.map((officer, index) => (
    <div className="profile-card" key={index}>
      <div className="role-title">{officer.role.toUpperCase()}</div>
      {officer.profilePicUrl ? (
        <img 
          src={officer.profilePicUrl} 
          alt={officer.name} 
          className="VW-member-pic"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        <FontAwesomeIcon icon={faUserCircle} className="VW-default-icon" />
      )}
      <p>{officer.name}</p>
    </div>
  ))}
</div>
{/* Members Section */}
<h3>Members</h3>
<div className="profile-grid">
  {organization?.members.map((member) => (
    <div className="profile-card" key={member.id}>
      {member.profilePicUrl ? (
        <img 
          src={member.profilePicUrl} 
          alt={member.name} 
          className="VW-member-pic"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        <FontAwesomeIcon icon={faUserCircle} className="VW-default-icon" />
      )}
      <p>{member.name}</p>
    </div>
  ))}
</div>

        
        </>
      )}
    </div>
  </div>
</div>


  );
};

export default AdminViewOrganization;
