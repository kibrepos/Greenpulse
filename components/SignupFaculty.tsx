import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal'; // Import react-modal
import { auth, firestore } from '../services/firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import '../styles/Login.css';

Modal.setAppElement('#root'); // Set the app element for accessibility

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

const SignupFaculty: React.FC = () => {
  const navigate = useNavigate();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [facultyNumber, setFacultyNumber] = useState('');
  const [department, setDepartment] = useState(departments[0]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.endsWith('@dlsud.edu.ph')) {
      alert("Please use your school email.");
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await sendEmailVerification(user);

      const facultyDocRef = doc(firestore, 'faculty', facultyNumber);
      await setDoc(facultyDocRef, {
        firstname,
        lastname,
        email,
        facultyNumber,
        department,
        disabled: false, // This is explicitly set as a boolean
        userId: user.uid,  
      });

      setModalIsOpen(true); 
    } catch (error) {
      console.error('Error registering:', error);
      if (error instanceof Error) {
        setError(`Error registering: ${error.message}`);
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
              <label htmlFor="faculty-number">Employee Number</label>
              <input
                type="number"
                id="faculty-number"
                name="faculty-number"
                value={facultyNumber}
                onChange={(e) => setFacultyNumber(e.target.value)}
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
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <i
                className="fas fa-eye-slash password-toggle"
                onClick={() => togglePasswordVisibility('password')}
              ></i>
            </div>
          </div>
          <div className="form-row">
            <div className="input-group solo">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                name="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <i
                className="fas fa-eye-slash password-toggle"
                onClick={() => togglePasswordVisibility('confirm-password')}
              ></i>
            </div>
          </div>
          <button type="submit" className="signup-btn">SIGN UP</button>
          <div className="extra-links">
            <a href="/login">Already have an account? Log in</a>
          </div>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
      <div className="logo-section">
        <h1>
          <span className="pulse">GREEN</span><span className="green">PULSE</span>
        </h1>
      </div>

      {/* Modal for registration success */}
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

// Toggle password visibility
const togglePasswordVisibility = (id: string) => {
  const input = document.getElementById(id) as HTMLInputElement;
  const isPasswordVisible = input.type === 'text';
  input.type = isPasswordVisible ? 'password' : 'text';
  const icon = document.querySelector(`#${id} + .password-toggle`) as HTMLElement;
  icon.classList.toggle('fa-eye-slash', !isPasswordVisible);
  icon.classList.toggle('fa-eye', isPasswordVisible);
};

export default SignupFaculty;
