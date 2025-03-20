import React, { useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { firestore } from "../../services/firebaseConfig"; // Adjust the path if needed
import { FirebaseError } from "firebase/app";

// Props for the component
interface FacultyAccountDeletionProps {
  faculty: {
    id: string; // Firestore document ID
    uid: string; // Firebase Authentication UID
    userId?: string; // Optional: Include userId if it exists in Firestore
    firstname: string;
    lastname: string;
    email: string; // Add email to the faculty object
  };
  onClose: () => void; // Function to close the dialog/modal
}

const FacultyAccountDeletion: React.FC<FacultyAccountDeletionProps> = ({ faculty, onClose }) => {
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const handleDelete = async () => {
    if (confirmationEmail !== faculty.email) {
      alert("Email confirmation does not match. Please try again.");
      return;
    }

    try {
      const uid = faculty.uid || faculty.userId;
      if (!uid) {
        alert("Invalid faculty UID. Cannot proceed with deletion.");
        console.error("Error: Faculty UID is missing:", faculty);
        return;
      }

      console.log("Attempting to delete faculty with UID:", uid);

      // Send request to your backend server to delete the user using Firebase Admin SDK
      const response = await fetch('/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      console.log("User deleted in Firebase Authentication");

      // Optionally, delete the faculty's Firestore document
      console.log("Deleting Firestore document for faculty ID:", faculty.id);
      await deleteDoc(doc(firestore, "faculty", faculty.id));

      alert(`Faculty ${faculty.firstname} ${faculty.lastname} has been deleted.`);
      console.log(`Successfully deleted faculty: ${faculty.firstname} ${faculty.lastname}`);
      onClose(); // Close the modal or dialog
    } catch (error) {
      console.error("Error during faculty deletion:", error);
      if (error instanceof FirebaseError) {
        alert(`Firebase error: ${error.message}`);
      } else if (error instanceof Error) {
        alert(`Unexpected error: ${error.message}`);
      } else {
        alert("An unknown error occurred. Please try again.");
      }
    }
  };

  return (
    <div>
      <p>Are you sure you want to permanently delete the faculty account for {faculty.firstname} {faculty.lastname}?</p>
      <p>Please type the faculty's email to confirm: <strong>{faculty.email}</strong></p>
      <input
  type="text"
  value={confirmationEmail}
  onChange={(e) => setConfirmationEmail(e.target.value)}
  placeholder="Type email to confirm"
  style={{
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "5px",
    marginBottom: "10px",
    width: "100%",
    boxSizing: "border-box", // Add this line
  }}
/>
      <button
        onClick={handleDelete}
        style={{
          backgroundColor: "red",
          color: "white",
          padding: "10px",
          border: "none",
          borderRadius: "5px",
        }}
      >
        Yes, Delete
      </button>
      <button
        onClick={onClose}
        style={{
          marginLeft: "10px",
          padding: "10px",
          border: "none",
          borderRadius: "5px",
        }}
      >
        Cancel
      </button>
    </div>
  );
};

export default FacultyAccountDeletion;