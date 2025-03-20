import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { auth, firestore } from "../../services/firebaseConfig";
import "../../styles/StudentDashboard.css";
import Header from "../../components/Header";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserCircle, faBuilding } from "@fortawesome/free-solid-svg-icons";

interface Organization {
  name: string;
  description: string;
  department: string;
  status: string;
  coverImagePath?: string;
  profileImagePath?: string;
  facultyAdviser?: {
    id: string;
    name: string;
    email: string;
    profilePicUrl?: string | null;
  };
}

const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [facultyData, setFacultyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const facultyDocRef = doc(firestore, "faculty", user.uid);
          const facultyDoc = await getDoc(facultyDocRef);

          if (facultyDoc.exists()) {
            const faculty = facultyDoc.data();
            setFacultyData(faculty);
            console.log("Faculty Data:", faculty);

            const organizationsRef = collection(firestore, "organizations");
            const organizationsDocs = await getDocs(organizationsRef);

            const orgList: Organization[] = [];

            organizationsDocs.forEach((orgDoc) => {
              const orgData = orgDoc.data() as Organization;
              console.log("Organization Data:", orgData);

              // Check if the faculty is the adviser of the organization
              const isFacultyAdviser = orgData.facultyAdviser?.id === user.uid;

              if (isFacultyAdviser) {
                orgList.push(orgData);
              }
            });

            console.log("Filtered Organization List:", orgList);

            const sortedOrganizations = orgList.sort((a, b) => {
              if (a.status === "archived" && b.status !== "archived") return 1;
              if (a.status !== "archived" && b.status === "archived") return -1;
              return 0;
            });

            setOrganizations(sortedOrganizations);
          } else {
            setError("No faculty data found.");
          }
        } catch (err) {
          console.error("Error fetching faculty data:", err);
          setError("Error fetching faculty data.");
        } finally {
          setLoading(false);
        }
      } else {
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleOrganizationClick = (organization: Organization) => {
    if (organization.status === "archived") {
      alert("This organization is not available as it has been archived.");
    } else {
      navigate(`/Organization/${organization.name}/dashboard`);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length > maxLength) {
      return text.slice(0, maxLength) + "...";
    }
    return text;
  };

  return (
    <div className="dashboard-wrapper">
      <Header />

      <div className="dashboard-container">
        <div className="organizations-section">
          <h3>Organizations</h3>
          {organizations.length > 0 ? (
            <div className="organization-list">
              {organizations.map((org) => (
                <div
                  key={org.name}
                  className={`organization-card ${
                    org.status === "archived" ? "organization-card-archived" : ""
                  }`}
                  onClick={() => handleOrganizationClick(org)}
                >
                  <div className="organization-card-image">
                    {/* Cover Photo */}
                    {org.coverImagePath ? (
                      <img
                        src={org.coverImagePath}
                        alt={`${org.name} Cover`}
                        className="organization-cover-image"
                      />
                    ) : (
                      <div className="organization-placeholder">
                        <FontAwesomeIcon
                          icon={faBuilding}
                          className="organization-placeholder-icon"
                        />
                      </div>
                    )}

                    {/* Profile Picture */}
                    <div className="organization-profile-pic">
                      {org.profileImagePath ? (
                        <img
                          src={org.profileImagePath}
                          alt={`${org.name} Profile`}
                          className="organization-profile-image"
                        />
                      ) : (
                        <FontAwesomeIcon
                          icon={faUserCircle}
                          className="organization-placeholder-icon"
                        />
                      )}
                    </div>
                  </div>

                  <div className="organization-card-details">
                    <h4>{org.name}</h4>
                    {org.status === "archived" ? (
                      <p className="organization-archived-message">
                        This organization is no longer available.
                      </p>
                    ) : (
                      <>
                        <p>{truncateText(org.description, 80)}</p>
                        <p className="org-department">{org.department}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>You are not an adviser of any organizations.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;
