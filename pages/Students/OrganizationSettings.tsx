import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc,Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firestore, storage } from '../../services/firebaseConfig';
import Header from '../../components/Header'; 
import StudentPresidentSidebar from './StudentPresidentSidebar'; 
import { getAuth } from 'firebase/auth';
import '../../styles/OrganizationSettings.css'; 
import { showToast } from '../../components/toast';
import Swal from 'sweetalert2';

const OrganizationSettings: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [newProfileImage, setNewProfileImage] = useState<File | null>(null);
  const [newCoverImage, setNewCoverImage] = useState<File | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
const [originalDescription, setOriginalDescription] = useState<string>("");

// 🖼️ Modal state for image preview
const [imageModal, setImageModal] = useState<string | null>(null);

const handleOpenModal = (imageUrl: string) => {
  setImageModal(imageUrl);
};

// ❌ Function to close the modal
const handleCloseModal = () => {
  setImageModal(null);
};
  const auth = getAuth();
  const user = auth.currentUser;
  const [isEditing, setIsEditing] = useState(false);
  const enterEditMode = () => {
    setIsEditing(true);
  };
  
  const exitEditMode = () => {
    setIsEditing(false);
  
    setOrganizationData((prevData: any) => ({
      ...prevData,
      description: originalDescription, // Reset to the original description
    }));
    // Reset the selected images and previews to original database values
    setNewProfileImage(null);
    setNewCoverImage(null);
    setProfileImagePreview(organizationData?.profileImagePath || null);
    setCoverImagePreview(organizationData?.coverImagePath || null);
  };
  

const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
  const file = e.target.files?.[0]; // Get the selected file
  if (file) {
    const previewUrl = URL.createObjectURL(file); // Create a local URL

    if (type === 'profile') {
      setProfileImagePreview(previewUrl); // Update profile preview
      setNewProfileImage(file); // Update profile file state
    } else if (type === 'cover') {
      setCoverImagePreview(previewUrl); // Update cover preview
      setNewCoverImage(file); // Update cover file state
    }
  }
};





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


useEffect(() => {
  const fetchOrganizationData = async () => {
    const orgDocRef = doc(firestore, "organizations", organizationName || "");
    const orgDoc = await getDoc(orgDocRef);
    if (orgDoc.exists()) {
      const data = orgDoc.data();
      setOrganizationData(data);
      setOriginalDescription(data.description); // Store the original description

      // Set initial image previews from existing paths
      setProfileImagePreview(data.profileImagePath || null);
      setCoverImagePreview(data.coverImagePath || null);
    }
  };
  fetchOrganizationData();
}, [organizationName]);

  


  const handleSaveChanges = async () => {
    // Show SweetAlert confirmation before proceeding
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to save these changes?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#005f47',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, save it!',
      cancelButtonText: 'Cancel'
    });
  
    // If user cancels, stop execution
    if (!result.isConfirmed) {
      return;
    }
  
    try {
      const updates: any = {};
      const changes: string[] = []; // Track which fields have changed
  
      // Ensure organizationData exists
      if (!organizationData) {
        console.error("No organization data available.");
        return;
      }
  
      // Check if the description has changed
      if (organizationData.description !== organizationData?.originalDescription) {
        updates.description = organizationData.description;
        changes.push('Updated organization description');
      }
  
      // Check if the profile image has changed
      if (newProfileImage) {
        const profileImageRef = ref(
          storage,
          `organizations/${organizationName}/profile/${newProfileImage.name}`
        );
        await uploadBytes(profileImageRef, newProfileImage);
        const profileImageUrl = await getDownloadURL(profileImageRef);
        updates.profileImagePath = profileImageUrl;
        changes.push('Updated profile picture');
      }
  
      // Check if the cover image has changed
      if (newCoverImage) {
        const coverImageRef = ref(
          storage,
          `organizations/${organizationName}/cover/${newCoverImage.name}`
        );
        await uploadBytes(coverImageRef, newCoverImage);
        const coverImageUrl = await getDownloadURL(coverImageRef);
        updates.coverImagePath = coverImageUrl;
        changes.push('Updated cover photo');
      }
  
      // Only update Firestore if there are changes
      if (Object.keys(updates).length > 0) {
        const orgDocRef = doc(firestore, 'organizations', organizationName || '');
        await updateDoc(orgDocRef, updates);
        console.log("Firestore updated successfully.");
      } else {
        console.log("No changes detected.");
      }
  
      // Log each change separately
      for (const change of changes) {
        await logActivity(change);
      }
  
      // 🎉 Show SweetAlert Success Message
      Swal.fire({
        icon: 'success',
        title: 'Changes Saved!',
        text: 'Your organization settings have been updated successfully.',
        confirmButtonColor: '#005f47',
      }).then(() => {
        window.location.reload(); // Reload after closing alert
      });
  
    } catch (error) {
      console.error('Error saving changes:', error);
  
      // ❌ Show SweetAlert Error Message
      Swal.fire({
        icon: 'error',
        title: 'Save Failed!',
        text: 'Something went wrong while saving changes.',
        confirmButtonColor: '#d33',
      });
    }
  };
  
  
  
  if (!organizationData) return <div></div>;

  return (
    
    <div className="settings-page">
      <Header />

      <div className="settings-container">
        <div className="sidebar-section">
          <StudentPresidentSidebar />
        </div>
        <div className="settings-content">
  <div className="settings-wrapper">
    <div className="header-container">
      <h1 className="headtitle">Settings</h1>
      {isEditing ? (
        <button className="create-new-btn" onClick={exitEditMode}>Cancel</button>
      ) : (
        <button className="create-new-btn" onClick={enterEditMode}>Edit</button>
      )}
    </div>

    {/* Organization Name */}
    <div className="org-form-group">
      <label>Organization Name</label>
      <span>{organizationData.name}</span>
    </div>

    {/* Description */}
    <div className="org-form-group">
      <label>Description</label>
      {isEditing ? (
        <textarea
          value={organizationData.description}
          onChange={(e) =>
            setOrganizationData({ ...organizationData, description: e.target.value })
          }
        />
      ) : (
        <p>{organizationData.description}</p>
      )}
    </div>


      {imageModal && (
                <div className="pic-modal-overlay" onClick={handleCloseModal}>
                    <div className="pic-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="pic-modal-close" onClick={handleCloseModal}>×</button>
                        <img src={imageModal} alt="Preview" className="pic-modal-img" />
                    </div>
                </div>
            )}







    {/* Profile and Cover Photos */}
    <div className="image-upload-section">
    <div className="image-container">
  <label>Profile Picture</label>
  {isEditing ? (
    <>
      <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, "profile")} />
      {profileImagePreview ? (
        <img src={profileImagePreview} alt="Profile Preview" className="clickable-image" />
      ) : (
        <img src="" alt="" className="clickable-image default-profile-placeholderz" />
      )}
    </>
  ) : (
    <img
      src={organizationData.profileImagePath || ""}
      alt=""
      onClick={() => handleOpenModal(organizationData.profileImagePath || "")}
      className={`clickable-image ${!organizationData.profileImagePath ? "default-profile-placeholderz" : ""}`}
    />
  )}
</div>

<div className="image-container">
  <label>Cover Photo</label>
  {isEditing ? (
    <>
      <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, "cover")} />
      {coverImagePreview ? (
        <img src={coverImagePreview} alt="Cover Preview" className="clickable-image" />
      ) : (
        <img src="" alt="" className="clickable-image default-cover-placeholderz" />
      )}
    </>
  ) : (
    <img
      src={organizationData.coverImagePath || ""}
      alt=""
      onClick={() => handleOpenModal(organizationData.coverImagePath || "")}
      className={`clickable-image ${!organizationData.coverImagePath ? "default-cover-placeholderz" : ""}`}
    />
  )}
</div>
    </div>
  </div>

  {/* Save Button */}
  {isEditing && <button className="save-btn" onClick={handleSaveChanges}>Save Changes</button>}

</div>

  </div>
</div>
  );
};

export default OrganizationSettings;