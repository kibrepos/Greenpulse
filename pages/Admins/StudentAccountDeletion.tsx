import React, { useState } from "react";
import { collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { firestore } from "../../services/firebaseConfig"; // Adjust the path if needed
import { FirebaseError } from "firebase/app";

interface StudentAccountDeletionProps {
  student: {
    userId: string; // Ensure we use userId, not just id
    firstname: string;
    lastname: string;
    email: string;
  };
  onClose: () => void;
}

//TODO: STUDENT ACCOUNT DELETION !!!!!!!
//Change it so that instead of deleting the student account, it will just be flagged as deleted
// All the data on the student will be deleted tho, such as the orgs it is part of and the files it has saved
//But, if the student wants to create a new account with the same email,
// it needs to be detected on the signup student tsx that the flag is set to deleted, and update the data based on thhe new input from the student
// then send a new verification email, and after verification, the student can now acess the account again.
const StudentAccountDeletion: React.FC<StudentAccountDeletionProps> = ({ student, onClose }) => {
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const handleDelete = async () => {
    if (confirmationEmail !== student.email) {
      alert("Email confirmation does not match. Please try again.");
      return;
    }

    try {
      if (!student.userId) {
        alert("Invalid student userId. Cannot proceed with deletion.");
        console.error("Error: Student userId is missing:", student);
        return;
      }

      console.log("Searching for student with userId:", student.userId);

      // Query Firestore for the student document
      const studentsRef = collection(firestore, "students");
      const studentQuery = query(studentsRef, where("userId", "==", student.userId));
      const querySnapshot = await getDocs(studentQuery);

      if (querySnapshot.empty) {
        alert("No student record found.");
        console.warn("No Firestore document found for userId:", student.userId);
        return;
      }

      // Delete all matching documents
      querySnapshot.forEach(async (docSnap) => {
        console.log("Deleting Firestore document with ID:", docSnap.id);
        await deleteDoc(docSnap.ref);
      });

      alert(`Student ${student.firstname} ${student.lastname} has been deleted.`);
      console.log(`Successfully deleted student: ${student.firstname} ${student.lastname}`);
      onClose();
    } catch (error) {
      console.error("Error during student deletion:", error);
      if (error instanceof FirebaseError) {
        alert(`Firebase error: ${error.message}`);
      } else {
        alert("An unknown error occurred. Please try again.");
      }
    }
  };

  return (
    <div>
      <p>
        Are you sure you want to permanently delete the student account for {student.firstname}{" "}
        {student.lastname}?
      </p>
      <p>
        Please type the student's email to confirm: <strong>{student.email}</strong>
      </p>
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
          boxSizing: "border-box",
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

export default StudentAccountDeletion;
