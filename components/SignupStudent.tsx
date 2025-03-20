import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal';
import { auth, firestore } from '../services/firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { arrayUnion, doc, setDoc, updateDoc } from 'firebase/firestore';
import '../styles/Login.css';

Modal.setAppElement('#root');

const departments = [
  'CEAT',
  'CBAA',
  'CLAC',
  'COSC',
  'CICS',
  'CTHM',
  'CCJE',
  'COED',
];

const SignupStudent: React.FC = () => {
  const navigate = useNavigate();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [department, setDepartment] = useState(departments[0]);
  const [year, setYear] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(""); 
  const [modalIsOpen, setModalIsOpen] = useState(false);



  const handleRegister = async (event: React.FormEvent) => {
      event.preventDefault();
      
      if (!email.endsWith('@dlsud.edu.ph')) {
      setError("Please use your school email");
      return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters long");
        return;
      }
    
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    
      try {
        // Register the student
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
    
        // Send email verification
        await sendEmailVerification(user);
    
        // Save student details to Firestore
        const studentDocRef = doc(firestore, 'students', user.uid);
        await setDoc(studentDocRef, {
          firstname,
          lastname,
          email,
          studentNumber,
          department,
          year,
          disabled: false, // This is explicitly set as a boolean
          userId: user.uid,
        });
    
        // Add the student to the "Sample Organization" members array
        const organizationDocRef = doc(firestore, 'organizations', 'Sample Organization');
        await updateDoc(organizationDocRef, {
          members: arrayUnion({
            id: user.uid, // Use the student's userId as the ID
            name: `${firstname} ${lastname}`, // Combine first and last name
          }),
        });
    
        // Open the success modal
        setModalIsOpen(true);
      } catch (error) {
        console.error('Error registering:', error);
        if (error instanceof Error) {
          if (error.message.includes('email-already-in-use')) {
            setError("This email is already associated with an account.");
          } else {
            setError(`Error registering: ${error.message}`);
          }
        } else {
          setError('An unknown error occurred.');
        }
      }
    };
    

  const handleCloseModal = () => {
    setModalIsOpen(false);
    navigate('/login'); // Redirect to login page when modal is closed
  };

  return (
    <div className="signup-container">
      <div className="signup-section">
        <h2>Sign Up</h2>
        <form onSubmit={handleRegister}>
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="first-name">First Name</label>
              <input
                type="text"
                id="first-name"
                name="first-name"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="last-name">Last Name</label>
              <input
                type="text"
                id="last-name"
                name="last-name"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
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
            <div className="input-group">
              <label htmlFor="student-number">Student Number</label>
              <input
                type="number"
                id="student-number"
                name="student-number"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="department">Department</label>
              <select
                id="department"
                name="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="year">Section and Year</label>
              <input
                type="text"
                id="year"
                name="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                name="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="signup-btn">SIGN UP</button>
          <div className="extra-links">
            <a href="/login">Already have an account? Log in</a>
          </div>
        </form>
        {error && <div className="errorsz">{error}</div>} {/* Error message display */}
      </div>
      <div className="logo-section">
        <h1>
          <span className="pulse">GREEN</span><span className="green">PULSE</span>
        </h1>
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={handleCloseModal}
        contentLabel="Registration Successful"
        className="modal"
        overlayClassName="overlay"
      >
        <h2>Registration Successful!</h2>
        <p>Please check your email for verification.</p>
        <div className="button-container">
          <button onClick={handleCloseModal}>Back to Login</button>
        </div>
      </Modal>
    </div>
  );
};

export default SignupStudent;
