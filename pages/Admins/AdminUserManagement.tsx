import React, { useState, useEffect } from 'react';
import { firestore } from '../../services/firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import AdminSidebar from './AdminSidebar';
import '../../styles/AdminUserManagement.css';

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]); // Store users data
  const [searchTerm, setSearchTerm] = useState(''); // Search input
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]); // Filtered users based on search
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', role: '' });
  const [editingUser, setEditingUser] = useState<any>(null); // Store user data for editing

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter((user) =>
        `${user.firstName} ${user.lastName} ${user.email} ${user.role}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  // Fetch users from Firestore
  const fetchUsers = async () => {
    try {
      const usersCollection = collection(firestore, 'users');
      const userSnapshot = await getDocs(usersCollection);
      const userList = userSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
      setFilteredUsers(userList); // Initialize filtered users
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // Handle form submission for adding or editing users
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      // Edit user
      const userDoc = doc(firestore, 'users', editingUser.id);
      await updateDoc(userDoc, newUser);
      setEditingUser(null); // Reset editing state
    } else {
      // Add new user
      await addDoc(collection(firestore, 'users'), newUser);
    }

    // Reset new user state and fetch updated users
    setNewUser({ firstName: '', lastName: '', email: '', role: '' });
    fetchUsers();
  };

  // Handle delete user
  const handleDelete = async (id: string) => {
    try {
      const userDoc = doc(firestore, 'users', id);
      await deleteDoc(userDoc);
      fetchUsers(); // Fetch updated users list
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  // Handle edit user
  const handleEdit = (user: any) => {
    setEditingUser(user);
    setNewUser({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-main">
        <AdminSidebar />
        <div className="admin-dashboard-content">
          <h2>Manage Users</h2>

          {/* Search Bar */}
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* User Form for Add/Edit */}
          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={newUser.firstName}
                onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={newUser.lastName}
                onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                required
              >
                <option value="">Select Role</option>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="submit-button">
              {editingUser ? 'Update User' : 'Add User'}
            </button>
          </form>

          {/* Users List */}
          <div className="users-list">
            <table className="user-table">
              <thead>
                <tr>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.firstName}</td>
                      <td>{user.lastName}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>
                        <button onClick={() => handleEdit(user)} className="edit-button">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="delete-button">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;
