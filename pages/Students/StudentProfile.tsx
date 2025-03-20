  import React, { useState, useEffect } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
  import { doc, getDoc,getDocs, updateDoc, collection, addDoc, Timestamp,writeBatch,query,where } from 'firebase/firestore';
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import { auth, firestore, storage } from '../../services/firebaseConfig';
  import '../../styles/StudentProfile.css';
  import Header from '../../components/Header';
  import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
  import Locker from '../../components/Locker';
  import { showToast } from '../../components/toast';


  const StudentProfile: React.FC = () => {
    const [studentData, setStudentData] = useState<any>(null);
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newProfilePic, setNewProfilePic] = useState<File | null>(null);
    const [previewProfilePicUrl, setPreviewProfilePicUrl] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPicModalOpen, setIsPicModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [modalData, setModalData] = useState<any>(null);
    const [isImageError, setIsImageError] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [isModalImageError, setIsModalImageError] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const navigate = useNavigate();
    const [cooldown, setCooldown] = useState(false); // Track cooldown status
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // Track if the feedback is being submitted
    const [cooldownWarning, setCooldownWarning] = useState<string | null>(null); // Track cooldown warning message


    const handleFeedbackSubmit = async (): Promise<void> => {
      if (feedbackText.trim().length === 0) {
        setFeedbackError('You can\'t send a blank feedback.');
        return;
      }
      if (feedbackText.trim().length > 128) {
        setFeedbackError('Feedback must be no more than 128 characters long.');
        return;
      }
    
      const lastSubmissionTime = localStorage.getItem('lastSubmissionTime');
      const attemptsCount = parseInt(localStorage.getItem('attemptsCount') || '0');
      const now = new Date().getTime();
      const threeMinutesInMs = 3 * 60 * 1000; // 3 minutes in milliseconds
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
      // Check if it's been less than 3 minutes since the last attempt
      if (lastSubmissionTime && (now - parseInt(lastSubmissionTime)) < threeMinutesInMs) {
        const remainingTimeInMs = threeMinutesInMs - (now - parseInt(lastSubmissionTime));
        const remainingSeconds = Math.ceil(remainingTimeInMs / 1000); // Convert to seconds
        setFeedbackError(`Please wait ${remainingSeconds} seconds before submitting again.`);
        return;
      }
    
      // If there have been 3 attempts, apply the 24-hour cooldown
      if (attemptsCount >= 3 && lastSubmissionTime && (now - parseInt(lastSubmissionTime)) < twentyFourHoursInMs) {
        const remainingTimeInMs = twentyFourHoursInMs - (now - parseInt(lastSubmissionTime));
        const remainingHours = Math.floor(remainingTimeInMs / (1000 * 60 * 60)); // Convert to hours
        const remainingMinutes = Math.floor((remainingTimeInMs % (1000 * 60 * 60)) / (1000 * 60)); // Convert to minutes
        setFeedbackError(`You have reached the limit of 3 attempts. Please wait ${remainingHours} hours and ${remainingMinutes} minutes before submitting again.`);
        return;
      }
    
      // If 24 hours have passed, reset the attempt count
      if (lastSubmissionTime && (now - parseInt(lastSubmissionTime)) >= twentyFourHoursInMs) {
        localStorage.setItem('attemptsCount', '1'); // Reset attempts count
        localStorage.setItem('lastSubmissionTime', now.toString()); // Update the last submission time
      } else {
        // Otherwise, increment the attempt count
        localStorage.setItem('attemptsCount', (attemptsCount + 1).toString());
      }
    
      if (auth.currentUser) {
        setIsSubmitting(true); 
        setFeedbackError(null); 
    
        try {
          await addDoc(collection(firestore, 'feedback'), {
            userId: auth.currentUser.uid,
            feedbackText: feedbackText.trim(),
            timestamp: Timestamp.now(),
          });
    
          setFeedbackSuccess('Thank you for your feedback!');
          setFeedbackText('');
    
          // Update the last submission time in local storage after successful submission
          localStorage.setItem('lastSubmissionTime', now.toString());
    
        } catch (error) {
          console.error('Error submitting feedback:', error);
          setFeedbackError('Error submitting feedback. Please try again.');
        } finally {
          setIsSubmitting(false); // Re-enable the button after submission
        }
      }
    };
        

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            // Fetch student data where userId matches the user.uid
            const studentsRef = collection(firestore, 'students');
            const studentQuery = query(studentsRef, where('userId', '==', user.uid));
            const studentSnapshot = await getDocs(studentQuery);
    
            if (!studentSnapshot.empty) {
              const studentDoc = studentSnapshot.docs[0]; // Assuming only one document matches
              const data = studentDoc.data();
              setStudentData(data);
              setModalData(data);
              setFirstName(data.firstname || '');
              setLastName(data.lastname || '');
    
              const profilePicRef = ref(storage, `profilePics/${user.uid}/profile-picture.jpg`);
              const url = await getDownloadURL(profilePicRef).catch(() => '/default-profile.png');
              setProfilePicUrl(url);
              setPreviewProfilePicUrl(url);
              return;
            }
    
            // If not a student, fetch faculty data where userId matches the user.uid
            const facultyRef = collection(firestore, 'faculty');
            const facultyQuery = query(facultyRef, where('userId', '==', user.uid));
            const facultySnapshot = await getDocs(facultyQuery);
    
            if (!facultySnapshot.empty) {
              const facultyDoc = facultySnapshot.docs[0]; // Assuming only one document matches
              const data = facultyDoc.data();
              setStudentData(data); // Use the same state for faculty data
              setModalData(data);
              setFirstName(data.firstname || '');
              setLastName(data.lastname || '');
    
              const profilePicRef = ref(storage, `profilePics/${user.uid}/profile-picture.jpg`);
              const url = await getDownloadURL(profilePicRef).catch(() => '/default-profile.png');
              setProfilePicUrl(url);
              setPreviewProfilePicUrl(url);
              return;
            }
    
            // If no data found, show an error
            setError('No user data found.');
          } catch (err) {
            console.error('Error fetching user data:', err);
            setError('Error fetching user data.');
          } finally {
            setLoading(false);
          }
        } else {
          navigate('/login');
        }
      });
    
      return () => unsubscribe();
    }, [navigate]);
    

    const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const validTypes = ['image/jpeg', 'image/png'];

        if (validTypes.includes(file.type)) {
          setNewProfilePic(file);
          setPreviewProfilePicUrl(URL.createObjectURL(file));
          setIsModalImageError(false); // Reset error state
        } else {
          showToast("Please select a JPG or PNG file.");
        }
      }
    };

    const handleProfilePicUpload = async () => {
      if (newProfilePic && auth.currentUser) {
        const userId = auth.currentUser.uid;
        const profilePicRef = ref(storage, `profilePics/${userId}/profile-picture.jpg`);
        const collectionName = studentData?.studentNumber ? 'students' : 'faculty'; // Determine user type
    
        try {
          // Upload the new profile picture to Firebase Storage
          await uploadBytes(profilePicRef, newProfilePic);
    
          // Get the new download URL
          const newProfilePicUrl = await getDownloadURL(profilePicRef);
    
          // Update the user's profile picture URL in their Firestore document
          await updateDoc(doc(firestore, collectionName, userId), {
            profilePicUrl: newProfilePicUrl,
          });
    
          // Update the profile picture in the `organizations` collection
          await updateProfilePicInOrganizations(userId, newProfilePicUrl);
    
          const userName = `${studentData?.firstname || ''} ${studentData?.lastname || ''}`.trim();
      
    
          // Update local state
          setProfilePicUrl(newProfilePicUrl);
          setPreviewProfilePicUrl(newProfilePicUrl);
          showToast("Profile picture updated successfully!");
        } catch (err) {
          console.error('Error uploading profile picture:', err);
          setError('Error uploading profile picture.');
        }
      }
    };
    
    const updateProfilePicInOrganizations = async (userId: string, newProfilePicUrl: string) => {
      try {
        const orgsSnapshot = await getDocs(collection(firestore, 'organizations'));
        const batch = writeBatch(firestore);
    
        orgsSnapshot.forEach((orgDoc) => {
          const orgData = orgDoc.data();
    
          // Check and update profile picture for the president
          if (orgData.president?.id === userId) {
            batch.update(doc(firestore, 'organizations', orgDoc.id), {
              'president.profilePicUrl': newProfilePicUrl,
            });
          }
    
          // Check and update profile picture for officers
          const updatedOfficers = orgData.officers?.map((officer: any) => {
            if (officer.id === userId) {
              return { ...officer, profilePicUrl: newProfilePicUrl };
            }
            return officer;
          });
    
          // Check and update profile picture for members
          const updatedMembers = orgData.members?.map((member: any) => {
            if (member.id === userId) {
              return { ...member, profilePicUrl: newProfilePicUrl };
            }
            return member;
          });
    
          // Check and update profile picture for the faculty adviser
          const updatedFacultyAdviser =
            orgData.facultyAdviser?.id === userId
              ? { ...orgData.facultyAdviser, profilePicUrl: newProfilePicUrl }
              : orgData.facultyAdviser;
    
          // Apply updates to the Firestore document
          batch.update(doc(firestore, 'organizations', orgDoc.id), {
            officers: updatedOfficers,
            members: updatedMembers,
            facultyAdviser: updatedFacultyAdviser,
          });
        });
    
        await batch.commit();
        console.log('Organizations updated with new profile picture');
      } catch (error) {
        console.error('Error updating profile picture in organizations:', error);
      }
    };
    
    const handleSaveChanges = async () => {
      const user = auth.currentUser; // Store the current user in a variable for clarity
      if (modalData && user) {
        const collectionName = studentData?.studentNumber ? 'students' : 'faculty'; // Determine user type
    
        try {
          // Find the document ID based on the userId field
          const querySnapshot = await getDocs(query(collection(firestore, collectionName), where('userId', '==', user.uid)));
          if (querySnapshot.empty) {
            setError('No document found for the current user.');
            return;
          }
    
          // Get the document ID
          const docId = querySnapshot.docs[0].id;
    
          // Update the document using the correct document ID
          const userDocRef = doc(firestore, collectionName, docId);
          await updateDoc(userDocRef, {
            firstname: firstName,
            lastname: lastName,
            ...(studentData?.studentNumber && {
              department: modalData.department,
              year: modalData.year,
              studentNumber: modalData.studentNumber,
            }),
            ...(studentData?.facultyNumber && {
              department: modalData.department,
              facultyNumber: modalData.facultyNumber,
            }),
          });
    
          if (newProfilePic) {
            await handleProfilePicUpload();
          }
    
          setStudentData({
            ...modalData,
            firstname: firstName,
            lastname: lastName,
          });
    
          setIsModalOpen(false);
          window.location.reload();
        } catch (err) {
          console.error('Error saving changes:', err);
          setError('Error saving changes.');
        }
      } else {
        console.error('User is not authenticated.');
        setError('You must be logged in to save changes.');
      }
    };


    

    const handlePasswordChange = async () => {
      let hasError = false;
      setPasswordError('');
      setPasswordSuccess(null);

      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError('All fields are required.');
        hasError = true;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError('New password and confirm password do not match.');
        hasError = true;
      }

      if (hasError) return;

      const user = auth.currentUser;
      if (user && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);

        try {
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, newPassword);
          setPasswordSuccess('Password updated successfully.');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } catch (err) {
          console.error('Error changing password:', err);
          setPasswordError('The current password is incorrect.');
        }
      }
    };

    const handleProfilePicClick = () => {
      setIsPicModalOpen(true);
    };

    const handlePicModalClose = () => {
      setIsPicModalOpen(false);
    };

 

    return (
      <>
      
        <div className='asd'>
          <Header />
        </div>
        <div className="page-container">
          <div className="content-wrapper">
            <div className="profile-content">
              <div className="profile-left">
               <div className="profile-pic-container" onClick={handleProfilePicClick}>
               {(profilePicUrl && !isImageError) ? (
    <img
      src={profilePicUrl}
      alt="Profile"
      className="profile-pic"
      onError={() => setIsImageError(true)} // If image fails, show placeholder
    />
  ) : (
    <div className="student-profile-icon-placeholder">
      <FontAwesomeIcon icon={faUser} className="student-profile-placeholder-icon" />
    </div>
  )}
</div>

                <h2>{studentData?.firstname} {studentData?.lastname}</h2>
                <hr></hr>
                <p>{studentData?.department}</p>
                {studentData?.studentNumber ? (
            <>
              <p>{studentData?.year} - {studentData?.studentNumber}</p>
            </>
          ) : (
            <>
              <p>Employee ID: {studentData?.facultyNumber}</p>
            </>
          )}
                <p>{studentData?.email}</p>
                <button onClick={() => setIsModalOpen(true)}>Edit Profile</button>
                <button onClick={() => setIsPasswordModalOpen(true)}>Change Password</button>
                <button onClick={() => setIsFeedbackModalOpen(true)}>Send Feedback</button>
              </div>
              <div className="locker">
                <Locker />
              </div>
            </div>
          </div>
        </div>
        
        {/* Feedback Modal */}
        {isFeedbackModalOpen && (
          <div className="modal-overlay">
            <div className="modal-contents">
              <h2>Send Feedback</h2>
              <textarea
                placeholder="Enter your feedback here..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
              />
              {feedbackError && <p className="error">{feedbackError}</p>}
              {feedbackSuccess && <p className="success">{feedbackSuccess}</p>}
              {cooldownWarning && <p className="warning">{cooldownWarning}</p>} {/* Display warning message */}
              <button onClick={handleFeedbackSubmit} disabled={isSubmitting || cooldown}>
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>

              <button className="cancelB" onClick={() => setIsFeedbackModalOpen(false)}>Cancel</button>

            </div>
          </div>
        )}

        {/* Modal Component for Editing Profile */}
        {isModalOpen && (
    <div className="edit-modal-overlay">
      <div className="modal-contents">
        <h2>Edit Profile</h2>
        <div className="modal-profile-pic">
  <div className="modal-centerpic">
    {(previewProfilePicUrl && !isModalImageError) ? (
      <img
        src={previewProfilePicUrl}
        alt="Profile"
        className="modal-profile-pic-img"
        onError={() => setIsModalImageError(true)} // Show placeholder if image fails
      />
    ) : (
      <div className="modal-profile-icon-placeholder">
        <FontAwesomeIcon icon={faUser} className="modal-profile-placeholder-icon" />
      </div>
    )}
  </div>
</div>
          <label htmlFor="file-upload" className="file-input-label">
            Choose File
          </label>
          <input
            type="file"
            id="file-upload"
            accept=".jpg,.jpeg,.png"
            onChange={handleProfilePicChange}
            className="file-input"
          />
      

        <label>
          First Name:
          <input
            type="text"
            name="firstname"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>

        <label>
          Last Name:
          <input
            type="text"
            name="lastname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </label>

        <label>
          Department:
          <select
            name="department"
            value={modalData?.department || ''}
            onChange={(e) =>
              setModalData({
                ...modalData,
                department: e.target.value,
              })
            }
          >
            <option value="CEAT">CEAT</option>
            <option value="CICS">CICS</option>
            <option value="CBAA">CBAA</option>
            <option value="COCS">COCS</option>
            <option value="COED">COED</option>
            <option value="CCJE">CCJE</option>
            <option value="CLAC">CLAC</option>
            {/* Add more options as needed */}
          </select>
        </label>

        {/* Conditional rendering for student and faculty fields */}
        {modalData?.studentNumber ? (
          <>
            <label>
              Year and Section:
              <input
                type="text"
                name="year"
                value={modalData?.year || ''}
                onChange={(e) =>
                  setModalData({
                    ...modalData,
                    year: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Student ID:
              <input
                type="text"
                name="studentNumber"
                value={modalData?.studentNumber || ''}
                onChange={(e) =>
                  setModalData({
                    ...modalData,
                    studentNumber: e.target.value,
                  })
                }
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Employee ID:
              <input
                type="text"
                name="facultyNumber"
                value={modalData?.facultyNumber || ''}
                onChange={(e) =>
                  setModalData({
                    ...modalData,
                    facultyNumber: e.target.value,
                  })
                }
              />
            </label>
          </>
        )}

        <button onClick={handleSaveChanges}>Save</button>
        <button className="cancelB" onClick={() => { 
  setIsModalOpen(false); 
  setNewProfilePic(null); // Reset selected file
  setPreviewProfilePicUrl(null); // Reset selected image preview
  setIsModalImageError(false); // Reset error state

  // Reset the file input field
  const fileInput = document.getElementById("file-upload") as HTMLInputElement;
  if (fileInput) fileInput.value = "";
}}>
  Cancel
</button>
      </div>
    </div>
  )}


        {/* Modal Component for Enlarged Profile Picture */}
        {isPicModalOpen && (
          <div className="pic-modal-overlay" onClick={handlePicModalClose}>
            <div className="pic-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="pic-modal-close" onClick={handlePicModalClose}>×</button>
              <img src={profilePicUrl || '/default-profile.png'} alt="Profile" className="pic-modal-img" />
            </div>
          </div>
        )}

        {/* Modal Component for Changing Password */}
        {isPasswordModalOpen && (
          <div className="modal-overlay">
            <div className="modal-contents">
              <h2>Change Password</h2>
              <label>
                Current Password:
                <input
                  type="password"
                  name="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label>
                New Password:
                <input
                  type="password"
                  name="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label>
                Confirm Password:
                <input
                  type="password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              {passwordError && <p className="error">{passwordError}</p>}
              {passwordSuccess && <p className="success">{passwordSuccess}</p>}
              <button onClick={handlePasswordChange}>Change Password</button>
              <button className="cancelB" onClick={() => setIsPasswordModalOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </>
    );
  };

  export default StudentProfile;
