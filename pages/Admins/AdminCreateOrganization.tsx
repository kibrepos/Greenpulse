import React, { useState, useEffect } from "react";
import { firestore, storage } from "../../services/firebaseConfig";
import { doc, setDoc, collection, getDocs,Timestamp,addDoc,query,where  } from "firebase/firestore";
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useNavigate } from "react-router-dom";
import AdminSidebar from './AdminSidebar';
import '../../styles/AdminCreateOrganization.css';
import { auth } from "../../services/firebaseConfig";
import { showToast } from '../../components/toast';
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import Swal from "sweetalert2";

interface Student {
  id: string;
  firstname: string;
  lastname: string;
  profilePicUrl?: string;
}

interface Faculty {
  id: string;
  firstname: string;
  lastname: string;
  profilePicUrl?: string;
}

const AdminCreateOrganization: React.FC = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [facultyAdviser, setFacultyAdviser] = useState<Faculty | null>(null);
  const [president, setPresident] = useState<Student | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Student[]>([]);
  const [officers, setOfficers] = useState<{ student: Student; role: string }[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isPresidentModalOpen, setIsPresidentModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isOfficersModalOpen, setIsOfficersModalOpen] = useState(false);
  const [facultySearch, setFacultySearch] = useState("");
  const [presidentSearch, setPresidentSearch] = useState("");
  const [membersSearch, setMembersSearch] = useState("");
  const [officerSearch, setOfficerSearch] = useState("");
  const [selectedStudentForOfficer, setSelectedStudentForOfficer] = useState<Student | null>(null);
  const [officerRole, setOfficerRole] = useState("");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const officerRoles = [
    "Vice President",
    "Secretary",
    "Treasurer",
    "Auditor",
    "Public Relations Officer",
    "Sergeant-at-Arms",
  ];
  
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
  
  const fetchData = async () => {
    try {
      const studentCollection = await getDocs(collection(firestore, "students"));
      const studentList = studentCollection.docs.map(doc => ({
        id: doc.id,
        firstname: doc.data().firstname,
        lastname: doc.data().lastname,
        profilePicUrl: doc.data().profilePicUrl || "",
      }));

      const facultyCollection = await getDocs(collection(firestore, "faculty"));
      const facultyList = facultyCollection.docs.map(doc => ({
        id: doc.id,
        firstname: doc.data().firstname,
        lastname: doc.data().lastname,
        profilePicUrl: doc.data().profilePicUrl || "",
      }));

      setStudents(studentList);
      setFaculties(facultyList);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!name || !description || !facultyAdviser || !president || selectedMembers.length === 0) {
      alert("All fields are required.");
      return;
    }
  
    setIsLoading(true); // Set loading state to true
  
    // Show SweetAlert loading spinner
    Swal.fire({
      title: 'Creating Organization...',
      text: 'Please wait while we create the organization.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  
    try {
      const updates: any = {
        name,
        description,
        facultyAdviser: {
          id: facultyAdviser.id,
          name: `${facultyAdviser.firstname} ${facultyAdviser.lastname}`,
        },
        president: {
          id: president.id,
          name: `${president.firstname} ${president.lastname}`,
        },
        members: selectedMembers.map(member => ({
          id: member.id,
          name: `${member.firstname} ${member.lastname}`,
        })),
        officers: officers.map(officer => ({
          id: officer.student.id,
          name: `${officer.student.firstname} ${officer.student.lastname}`,
          role: officer.role,
        })),
        status: "active",
      };
  
      // Upload profile image if selected
      if (profileImage) {
        const profileImageRef = ref(storage, `organizations/${name}/profile/${profileImage.name}`);
        await uploadBytes(profileImageRef, profileImage);
        const profileImageUrl = await getDownloadURL(profileImageRef);
        updates.profileImagePath = profileImageUrl;
      }
  
      // Upload cover image if selected
      if (coverImage) {
        const coverImageRef = ref(storage, `organizations/${name}/cover/${coverImage.name}`);
        await uploadBytes(coverImageRef, coverImage);
        const coverImageUrl = await getDownloadURL(coverImageRef);
        updates.coverImagePath = coverImageUrl;
      }
  
      await setDoc(doc(firestore, "organizations", name), updates);
  
      // Log the creation of the organization
      await logActivity(`Created organization "${name}".`);
  
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Organization Created!',
        text: 'The organization has been created successfully.',
        confirmButtonColor: '#005f47',
      }).then(() => {
        navigate("/Admin/ManageOrganizations");
      });
    } catch (error) {
      console.error("Error creating organization:", error);
  
      // Show error message
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'There was an error creating the organization. Please try again.',
        confirmButtonColor: '#d33',
      });
    } finally {
      setIsLoading(false); // Set loading state to false
    }
  }; 
  

  // Toggle member selection and prevent the president or officers from being selected as a member
  const toggleMemberSelection = (member: Student) => {
    if (member.id === president?.id || officers.some(officer => officer.student.id === member.id)) return;
    if (selectedMembers.some(selected => selected.id === member.id)) {
      setSelectedMembers(selectedMembers.filter(selected => selected.id !== member.id));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  // Remove officer
  const removeOfficer = (index: number) => {
    setOfficers(officers.filter((_, i) => i !== index));
  };

  // Filtering members who are not selected as the president or officers
  const availableMembers = students.filter(student =>
    student.id !== president?.id && !officers.some(officer => officer.student.id === student.id)
  );

  const availablePresidents = students.filter(student =>
    !selectedMembers.some(member => member.id === student.id) && !officers.some(officer => officer.student.id === student.id)
  );

  const availableOfficers = students.filter(student =>
    student.id !== president?.id && !selectedMembers.some(member => member.id === student.id) && !officers.some(officer => officer.student.id === student.id)
  );

  const filteredFaculties = faculties.filter(faculty =>
    (faculty.firstname + " " + faculty.lastname).toLowerCase().includes(facultySearch.toLowerCase())
  );

  const filteredPresidents = availablePresidents.filter(student =>
    (student.firstname + " " + student.lastname).toLowerCase().includes(presidentSearch.toLowerCase())
  );

  const filteredMembers = availableMembers.filter(student =>
    (student.firstname + " " + student.lastname).toLowerCase().includes(membersSearch.toLowerCase())
  );

  const filteredOfficers = availableOfficers.filter(student =>
    (student.firstname + " " + student.lastname).toLowerCase().includes(officerSearch.toLowerCase())
  );

  const renderProfilePic = (profilePicUrl?: string) => {
    return profilePicUrl ? (
      <img src={profilePicUrl} alt="Profile" className="CNO-p-pictures" />
    ) : (
      <FontAwesomeIcon icon={faUserCircle} className="CNO-default-icon" />
    );
  };

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-main">
        <AdminSidebar />
        <div className="admin-dashboard-content">
          <h2 className="PageTitle">Create New Organization</h2>
          <form onSubmit={createOrganization}>
            <div className="CNO-form-row">
              {/*LEFT COLUMN*/}
              <div className="CNO-form-column">
  
                <label>Organization Name</label>
                <input type="text" placeholder="Enter organization name" value={name} onChange={(e) => setName(e.target.value)} required className="CNO-input"/>
                <br></br><br></br>
  
                <label>Description</label>
                <textarea placeholder="Enter a description about this organization" value={description} onChange={(e) => setDescription(e.target.value)} required className="CNO-textarea"/>
                <br></br><br></br>
  
                <label>Faculty Adviser</label>
                <div onClick={() => setIsFacultyModalOpen(true)}>
                  <div className="CNO-head-member-container">
                    {facultyAdviser ? (
                      <>
                        {renderProfilePic(facultyAdviser.profilePicUrl)}
                        <span>{facultyAdviser.firstname + " " + facultyAdviser.lastname}</span>
                      </>
                    ) : (
                      <span className="CNO-add-officer-btn">Select Faculty Adviser</span>
                    )}
                  </div>
                </div>
                <br></br>
                
                <label>President</label>
                <div onClick={() => setIsPresidentModalOpen(true)}>
                  <div className="CNO-head-member-container">
                    {president ? (
                      <>
                        {renderProfilePic(president.profilePicUrl)}
                        <span>{president.firstname + " " + president.lastname}</span>
                      </>
                    ) : (
                      <span className="CNO-add-officer-btn">Select President</span>
                    )}
                  </div>
                </div>
                <br></br>
                <div className="CNO-image-upload-container">
  <div className="CNO-image-upload">
    <label>Profile Picture</label>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files?.[0] || null;
        setProfileImage(file);
      }}
    />
  </div>
  <div className="CNO-image-upload">
    <label>Cover Image</label>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files?.[0] || null;
        setCoverImage(file);
      }}
    />
  </div>
</div>
              </div>  
  
              {/*RIGHT COLUMN*/}
              <div className="CNO-form-column">
                <label>Officers</label>
                <button type="button" className="CNO-add-officer-btn" onClick={() => setIsOfficersModalOpen(true)} disabled={isLoading}>
                  {officers.length > 0 ? `${officers.length} officers selected` : "Add Officer"}
                </button>
                <div className="CNO-selected-officers-container">
                  <div className="CNO-selected-officers">
                    {officers.map((officer, index) => (
                      <div key={index} className="CNO-officer-card">
                        {renderProfilePic(officer.student.profilePicUrl)}
                        <span>{officer.student.firstname} {officer.student.lastname} - {officer.role}</span>
                        <button className="CNO-removebtn" onClick={() => removeOfficer(index)} disabled={isLoading}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
  
                <label>Members</label>
                <div onClick={() => setIsMembersModalOpen(true)}>
                  <button type="button" className="CNO-add-officer-btn" disabled={isLoading}>
                    {selectedMembers.length > 0 ? `${selectedMembers.length} members selected` : "Add Members"}
                  </button>
                </div>
  
                <div className="CNO-selected-members-container">
                  <div className="CNO-selected-members">
                    {selectedMembers.map((member, index) => (
                      <div key={index} className="CNO-member-card">
                        {renderProfilePic(member.profilePicUrl)}
                        <div className="CNO-member-info">
                          <span>{member.firstname} {member.lastname}</span>
                        </div>
                        <button className="CNO-removebtn" onClick={() => toggleMemberSelection(member)} disabled={isLoading}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
  
            <div className="CNO-button-container">
              <button type="submit" className="CNO-submit-btn" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Organization"}
              </button>
              <button type="button" className="CNO-submit-btn" onClick={() => navigate('/Admin/ManageOrganizations')} disabled={isLoading}>
                Cancel
              </button>
            </div>
          </form>
  
          {/* Faculty Adviser Modal */}
          {isFacultyModalOpen && (
            <div className="CNO-modal-overlay">
              <div className="CNO-modal-content">
                <button className="CNO-close-icon" onClick={() => setIsFacultyModalOpen(false)}>×</button>
                <h3 className="PageTitle" style={{ color: '#0B6B57'}}>Select Faculty Adviser</h3>
                <input
                  type="text"
                  placeholder="Search faculty..."
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
                  className="CNO-search-input"
                />
                <div className="CNO-modal-body">
                  <ul>
                    {filteredFaculties.length > 0 ? (
                      filteredFaculties.map(faculty => (
                        <li key={faculty.id}>
                          {renderProfilePic(faculty.profilePicUrl)}
                          {faculty.firstname} {faculty.lastname}
                          <button
                            className={facultyAdviser?.id === faculty.id ? "CNO-selected-btn" : ""}
                            onClick={() => {
                              setFacultyAdviser(faculty);
                              setIsFacultyModalOpen(false);
                            }}
                          >
                            {facultyAdviser?.id === faculty.id ? "Selected" : "Select"}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li>No names found</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
  
          {/* President Modal */}
          {isPresidentModalOpen && (
            <div className="CNO-modal-overlay">
              <div className="CNO-modal-content">
                <button className="CNO-close-icon" onClick={() => setIsPresidentModalOpen(false)}>×</button>
                <h3 className="PageTitle" style={{ color: '#0B6B57'}}>Select President</h3>
                <input
                  type="text"
                  placeholder="Search presidents..."
                  value={presidentSearch}
                  onChange={(e) => setPresidentSearch(e.target.value)}
                  className="CNO-search-input"
                />
                <div className="CNO-modal-body">
                  <ul>
                    {filteredPresidents.length > 0 ? (
                      filteredPresidents.map(student => (
                        <li key={student.id}>
                          {renderProfilePic(student.profilePicUrl)}
                          {student.firstname} {student.lastname}
                          <button
                            className={president?.id === student.id ? "CNO-selected-btn" : ""}
                            onClick={() => {
                              setPresident(student);
                              setIsPresidentModalOpen(false);
                            }}
                          >
                            {president?.id === student.id ? "Selected" : "Select"}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li>No names found</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
  
          {/* Members Modal */}
          {isMembersModalOpen && (
            <div className="CNO-modal-overlay">
              <div className="CNO-modal-content">
                <button className="CNO-close-icon" onClick={() => setIsMembersModalOpen(false)}>×</button>
                <h3 className="PageTitle" style={{ color: '#0B6B57'}}>Add Members</h3>
                <input
                  type="text"
                  placeholder="Search members..."
                  value={membersSearch}
                  onChange={(e) => setMembersSearch(e.target.value)}
                  className="CNO-search-input"
                />
                <div className="CNO-modal-body">
                  <ul>
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(student => (
                        <li key={student.id}>
                          {renderProfilePic(student.profilePicUrl)}
                          {student.firstname} {student.lastname}
                          <button
                            className={selectedMembers.some(member => member.id === student.id) ? "CNO-selected-btn" : ""}
                            onClick={() => toggleMemberSelection(student)}
                          >
                            {selectedMembers.some(member => member.id === student.id) ? "Unselect" : "Select"}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li>No names found</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
  
          {/* Officers Modal */}
          {isOfficersModalOpen && (
            <div className="CNO-modal-overlay">
              <div className="CNO-modal-content">
                <button className="CNO-close-icon" onClick={() => setIsOfficersModalOpen(false)}>×</button>
                <h3 className="PageTitle" style={{ color: '#0B6B57'}}>Select Officer</h3>
                <div className="CNO-officer-role-input">
                  <select
                    value={officerRole}
                    onChange={(e) => setOfficerRole(e.target.value)}
                    required
                  >
                    <option value="">Select a Role</option>
                    {officerRoles.map((role, index) => (
                      <option key={index} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Search officers..."
                  value={officerSearch}
                  onChange={(e) => {
                    setOfficerSearch(e.target.value);
                    setSelectedStudentForOfficer(null); // Clear the selected student while searching
                  }}
                  className="CNO-search-input"
                />
                <div className="CNO-modal-body-officer">
                  <ul>
                    {filteredOfficers.length > 0 ? (
                      filteredOfficers.map(student => (
                        <li key={student.id}>
                          {renderProfilePic(student.profilePicUrl)}
                          <span>{student.firstname} {student.lastname}</span>
                          <button
                            className="CNO-submit-officer-btn"
                            onClick={() => {
                              if (!officerRole) {
                                showToast("Please select a role before adding an officer.", "error");
                                return;
                              }
                              setOfficers([
                                ...officers,
                                {
                                  student,
                                  role: officerRole,
                                },
                              ]);
                              setOfficerRole(""); // Reset the role selection
                              setIsOfficersModalOpen(false);
                            }}
                          >
                            Add Officer
                          </button>
                        </li>
                      ))
                    ) : (
                      <li>No names found</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCreateOrganization;