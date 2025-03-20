import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail,setPersistence, browserSessionPersistence,browserLocalPersistence  } from "firebase/auth";
import { doc, getDoc,getDocs,where,query,collection,updateDoc, addDoc } from "firebase/firestore";
import { firestore } from "../services/firebaseConfig";
import '../styles/Login.css';
import Swal from "sweetalert2";



const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState(""); // State for error message
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear previous error message
  
    try {
      // Query Firestore to find the user's role using email
      const adminQuery = await getDocs(
        query(collection(firestore, "admin"), where("email", "==", email))
      );
  
      const studentQuery = await getDocs(
        query(collection(firestore, "students"), where("email", "==", email))
      );
  
      const facultyQuery = await getDocs(
        query(collection(firestore, "faculty"), where("email", "==", email))
      );
  
      const superadminQuery = await getDocs(
        query(collection(firestore, "SuperAdmin"), where("email", "==", email))
      );
  
      // Check if the user's account is disabled
      if (!adminQuery.empty) {
        const adminDoc = adminQuery.docs[0];
        if (adminDoc.data().disabled) {
          setError("Your account is disabled. Please contact support.");
          return;
        }
      }
  
      if (!studentQuery.empty) {
        const studentDoc = studentQuery.docs[0];
        if (studentDoc.data().disabled) {
          setError("Your account is disabled. Please contact support.");
          return;
        }
      }
  
      if (!facultyQuery.empty) {
        const facultyDoc = facultyQuery.docs[0];
        if (facultyDoc.data().disabled) {
          setError("Your account is disabled. Please contact support.");
          return;
        }
      }
  
      if (!superadminQuery.empty) {
        const superadminDoc = superadminQuery.docs[0];
        if (superadminDoc.data().disabled) {
          setError("Your account is disabled. Please contact support.");
          return;
        }
      }
  
      // If the account is not disabled, proceed with sign-in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
  
      await user.reload();
  
      if (!user.emailVerified) {
        setError("Please verify your email before logging in.");
        await auth.signOut();
        return;
      }
  
      const loginTimestamp = new Date();
  
      // Set persistence based on the user's role
      if (!superadminQuery.empty || !adminQuery.empty) {
        // Admin or SuperAdmin: Use session persistence
        await setPersistence(auth, browserSessionPersistence);
      } else if (!facultyQuery.empty || !studentQuery.empty) {
        // Faculty or Student: Use local persistence
        await setPersistence(auth, browserLocalPersistence);
      } else {
        setError("Your role could not be determined. Please contact support.");
        await auth.signOut();
        return;
      }
  
      // Navigate based on the user's role
      if (!superadminQuery.empty) {
        navigate("/Superadmin/dashboard");
      } else if (!adminQuery.empty) {
        const adminDocRef = doc(firestore, "admin", adminQuery.docs[0].id);
        await updateDoc(adminDocRef, {
          activestatus: "active",
          lastlogin: loginTimestamp,
        });
        await addDoc(collection(firestore, "adminlogs"), {
          userID: user.uid,
          email: user.email,
          action: "Logged in",
          timestamp: new Date(),
        });
        navigate("/Admin/dashboard");
      } else if (!facultyQuery.empty) {
        navigate("/dashboard");
      } else if (!studentQuery.empty) {
        navigate("/dashboard");
      } else {
        setError("Your role could not be determined. Please contact support.");
        await auth.signOut();
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Invalid email or password. Please try again.");
    }
  };
  
  const handleCreateAccount = async () => {
    const { value } = await Swal.fire({
      title: "Create Account",
      html: `
        <button id="swal-close-btn" style="
          position: absolute; 
          top: 10px; 
          right: 10px; 
          background: transparent; 
          border: none; 
          font-size: 20px; 
          cursor: pointer;
        ">&times;</button>
  
        <p style="margin-top: 30px;">Select your role to proceed with account creation.</p>
  
        <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px;">
          <div style="text-align: center; cursor: pointer;" id="student-option">
            <img src="https://cdn-icons-png.flaticon.com/512/4196/4196591.png" alt="Student" width="150">
            <br>
            <button style="
              margin-top: 10px;
              padding: 8px 15px;
                 background-color:rgb(0, 70, 58);
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            ">Student</button>
          </div>
  
          <div style="text-align: center; cursor: pointer;" id="faculty-option">
            <img src="https://media.istockphoto.com/id/1455786460/vector/the-person-giving-the-lecture-speech-silhouette-icon-vector.jpg?s=612x612&w=0&k=20&c=FXJxAXD0XsfnLGQE5ssBnwZ3NbrsgyUXspbx_FkaQds=" alt="Faculty" width="150">
            <br>
            <button style="
              margin-top: 10px;
              padding: 8px 15px;
              background-color:rgb(0, 70, 58);
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            ">Faculty</button>
          </div>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        document.getElementById("student-option")?.addEventListener("click", () => {
          Swal.close();
          navigate("/Createaccount/student");
        });
  
        document.getElementById("faculty-option")?.addEventListener("click", () => {
          Swal.close();
          navigate("/Createaccount/faculty");
        });
  
        document.getElementById("swal-close-btn")?.addEventListener("click", () => {
          Swal.close();
        });
      }
    });
  };
  
  
  const handleForgotPassword = async () => {
    const { value: email } = await Swal.fire({
      title: "Forgot Password?",
      text: "Enter your email address and we'll send you a password reset link.",
      input: "email",
      inputPlaceholder: "Enter your email",
      confirmButtonText: "Send Reset Link",
      showCancelButton: true,
      cancelButtonText: "Cancel",
      customClass: {
        confirmButton: "swal-confirm-green", // Custom class for confirm button
        cancelButton: "swal-cancel-gray",    // Optional: Custom class for cancel button
      },
      buttonsStyling: false, // Disable default SweetAlert styles
      inputValidator: (value) => {
        if (!value) {
          return "You need to enter an email!";
        }
      },
    });
  
    if (email) {
      try {
        await sendPasswordResetEmail(auth, email);
        Swal.fire("Success!", "Password reset email has been sent!", "success");
      } catch (error) {
        Swal.fire("Error", "Failed to send password reset email. Please try again.", "error");
      }
    }
  };
  
  return (
    <>
      <div className="login-container">
        <div className="logo-section">
          <h1><span className="green">GREEN</span><span className="pulse">PULSE</span></h1>
        </div>
        <div className="login-section">
        {error && <div className="errors">{error}</div>}
          <h2>LOGIN</h2>
          <form onSubmit={handleLogin}>
            <div className="input-groupz">
              <label htmlFor="email">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="input-groupz">
              <label htmlFor="password">Password</label>
              <input 
                type={passwordVisible ? "text" : "password"} 
                id="password" 
                name="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            
            </div>
          
            <button type="submit" className="login-btn">LOGIN</button>
            <div className="extra-links">
            <a href="#" onClick={handleCreateAccount}>Create Account</a>
              <a href="#" onClick={handleForgotPassword}>Forgot Password?</a>
            </div>
          </form>
        </div>
      </div>


     
  
    </>
  );
};

export default Login;
