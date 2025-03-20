import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { firestore, storage, auth } from '../../services/firebaseConfig';
import '../../styles/OrganizationResources.css';
import { ref, listAll, uploadBytes, deleteObject, getDownloadURL, getMetadata, StorageReference,uploadBytesResumable} from 'firebase/storage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft ,faFileAlt,faImage,faVideo,faFilePdf,faFileWord,faFilePowerpoint,faFileExcel,faFolder,} from '@fortawesome/free-solid-svg-icons';
import { collection, query, where, getDocs,getDoc,doc,addDoc } from 'firebase/firestore';
import Header from '../../components/Header';
import StudentPresidentSidebar from './StudentPresidentSidebar'; 
import StudentMemberSidebar from './StudentMemberSidebar'; 
import { getAuth } from 'firebase/auth';
import Swal from "sweetalert2";
import { showToast } from '../../components/toast';

interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size?: string;
  uploadedBy?: string;
  dateUploaded?: string;
}
interface Folder {
  name: string;
  uploadedBy: string;
  dateUploaded: string;
}



const OrganizationResources: React.FC = () => {
  const { organizationName } = useParams<{ organizationName: string }>();
  const [role, setRole] = useState<string>(''); // User's role: 'president', 'officer', 'member', 'guest'
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [folderType, setFolderType] = useState<'public' | 'private'>('public');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set()); // Track selected files for deletion
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Track sorting order
  const [folderName, setFolderName] = useState<string>(''); // State for new folder name
  const [folders, setFolders] = useState<Folder[]>([]); // Update state type
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState<string>(''); // Tracks the current folder path
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ type: string; url: string } | null>(null);
  const [detailsContent, setDetailsContent] = useState<{name: string; type?: string;url?: string;size?: string;uploadedBy?: string;dateUploaded?: string;} | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortColumn, setSortColumn] = useState<'name' | 'size' | 'type' | 'uploadedBy' | 'dateUploaded'>('name');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  
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
 


  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
        return faImage;
    } else if (fileName.endsWith('.mp4') || fileName.endsWith('.avi') || fileName.endsWith('.mov') || fileName.endsWith('.webm')) {
        return faVideo;
    } else if (fileName.endsWith('.pdf')) {
        return faFilePdf;
    } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
        return faFileWord;
    } else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
        return faFilePowerpoint;
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        return faFileExcel;
    } else {
        return faFileAlt; // Default icon for other file types
    }
};
  useEffect(() => {
    if (organizationName) {
      fetchUserRole();
    }
  }, [organizationName]);

  useEffect(() => {
    if (role) {
      setCurrentPath(''); // Reset only when folderType changes
      fetchFilesAndFolders(); // Fetch files and folders for the new folderType
    }
  }, [folderType, role]);
  
  useEffect(() => {
    if (role) {
      fetchFilesAndFolders(); // Fetch files for the current path
    }
  }, [currentPath, role]);
  

  const fetchUserRole = async () => {
    if (!organizationName) {
      console.error('Error: organizationName is undefined.');
      setRole('guest');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('User is not authenticated.');
      setRole('guest');
      return;
    }

    try {
      const orgQuery = query(
        collection(firestore, 'organizations'),
        where('name', '==', organizationName)
      );
      const orgSnapshot = await getDocs(orgQuery);

      if (!orgSnapshot.empty) {
        const orgData = orgSnapshot.docs[0].data();
        console.log('Organization data:', orgData);

        if (orgData?.president?.id === user.uid) {
          setRole('president');
        } else if (orgData?.officers?.some((officer: { id: string }) => officer.id === user.uid)) {
          setRole('officer');
        } else if (orgData?.facultyAdviser?.id === user.uid) { // Check for faculty adviser
          setRole('faculty');
        } else if (orgData?.members?.some((member: { id: string }) => member.id === user.uid)) {
          setRole('member');
        } else {
          setRole('guest');
        }
        
      } else {
        console.error(`Organization with name '${organizationName}' does not exist.`);
        setRole('guest');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole('guest');
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) {
      showToast("Folder name cannot be empty.", "error");
      return;
    }
  
    try {
      const userName = await fetchUserFullName(); // Fetch uploader's name
      const folderPath = `organizations/${organizationName}/ORG_files/${folderType}${
        currentPath ? `/${currentPath}` : ''
      }/${folderName}/placeholder.txt`;
  
      const folderRef = ref(storage, folderPath);
  
      const metadata = {
        customMetadata: {
          uploadedBy: userName,
          dateUploaded: new Date().toISOString(),
        },
        cacheControl: 'no-cache'
      };
  
      // Upload a placeholder file with metadata
      await uploadBytes(folderRef, new Blob(['Placeholder file'], { type: 'text/plain' }), metadata);
  
      setFolders((prevFolders) => [
        ...prevFolders,
        { name: folderName, uploadedBy: userName, dateUploaded: new Date().toISOString() },
      ]);
      setFolderName(''); // Clear folder input
      setIsCreateFolderModalOpen(false); // Close modal if used with modal
      setIsCreateFolderModalOpen(false); // Close modal if used with modal
    showToast(`Folder '${folderName}' created successfully.`, "success");

    } catch (error) {
      console.error('Error creating folder:', error);
      showToast("'Error creating folder.'", "error");
    }
  };
  const formatFileSize = (sizeInBytes: number): string => {
    if (sizeInBytes >= 1024 * 1024) {
      // Convert to MB
      return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      // Convert to KB
      return `${(sizeInBytes / 1024).toFixed(2)} KB`;
    }
  };
  



  const fetchFilesAndFolders = async () => {
    try {
      const basePath = `organizations/${organizationName}/ORG_files/${folderType}`;
      const fullPath = currentPath ? `${basePath}/${currentPath}` : basePath;
      const storageRef = ref(storage, fullPath);
  
      const listResult = await listAll(storageRef);
  
      const filePromises = listResult.items.map(async (item: StorageReference) => {
        const url = await getDownloadURL(item);
        const metadata = await getMetadata(item); // Fetch file metadata
        return {
          name: item.name,
          url,
          type: metadata.contentType || 'Unknown',
          size: formatFileSize(metadata.size), // Format size dynamically
          uploadedBy: metadata.customMetadata?.uploadedBy || 'Unknown',
          dateUploaded: metadata.timeCreated || 'Unknown',
        };
      });
  
      const folderPromises = listResult.prefixes.map(async (prefix) => {
        const placeholderRef = ref(storage, `${prefix.fullPath}/placeholder.txt`);
        try {
          const metadata = await getMetadata(placeholderRef);
          return {
            name: prefix.name,
            uploadedBy: metadata.customMetadata?.uploadedBy || 'Unknown',
            dateUploaded: metadata.customMetadata?.dateUploaded || 'Unknown',
          };
        } catch {
          return {
            name: prefix.name,
            uploadedBy: 'Unknown',
            dateUploaded: 'Unknown',
          };
        }
      });
  
      const resolvedFiles = (await Promise.all(filePromises)).filter(
        (file) => file.name !== 'placeholder.txt' // Exclude placeholder.txt
      );
      const resolvedFolders = await Promise.all(folderPromises);
  
      setFolders(resolvedFolders); // Update folders state
      setFiles(resolvedFiles); // Update files state
    } catch (error) {
      console.error('Error fetching files and folders:', error);
    }
  };
  

;
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };
   
  const fetchUserFullName = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) return 'Unknown';
  
    try {
      const studentDoc = await getDoc(doc(firestore, 'students', user.uid));
      if (studentDoc.exists()) {
        const data = studentDoc.data();
        return `${data.firstname} ${data.lastname}`;
      }
  
      const facultyDoc = await getDoc(doc(firestore, 'faculty', user.uid));
      if (facultyDoc.exists()) {
        const data = facultyDoc.data();
        return `${data.firstname} ${data.lastname}`;
      }
    } catch (error) {
      console.error('Error fetching user full name:', error);
    }
  
    return 'Unknown';
  };
  


  const DetailsModal: React.FC<{
    content: { name: string; type?: string; url?: string; size?: string; uploadedBy?: string; dateUploaded?: string } | null;
    onClose: () => void;
  }> = ({ content, onClose }) => {
    if (!content) return null;
  
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Details</h3>
          <p><strong>Name:</strong> {content.name}</p>
          {content.type && <p><strong>Type:</strong> {content.type}</p>}
          {content.size && <p><strong>Size:</strong> {content.size}</p>}
          {content.uploadedBy && <p><strong>Uploaded By:</strong> {content.uploadedBy}</p>}
          {content.dateUploaded && <p><strong>Date Uploaded:</strong> {content.dateUploaded}</p>}
          {content.url && (
            <p>
              <strong>URL:</strong>{' '}
              <a href={content.url} target="_blank" rel="noopener noreferrer">
                Open File
              </a>
            </p>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };
  

const openFolder = (folderName: string) => {
  setCurrentPath((prevPath) => (prevPath ? `${prevPath}/${folderName}` : folderName));
};
const navigateUp = () => {
  setCurrentPath((prevPath) => {
    const parts = prevPath.split('/').filter(Boolean); 
    parts.pop(); 
    return parts.join('/');
  });
};


const handleMultipleFileUpload = async (files: FileList | null) => {
  if (!files) return;

  try {
    setLoading(true); // Start loading spinner
    const userName = await fetchUserFullName(); // Get uploader's name
    const uploadedFiles: UploadedFile[] = [];
    const uploadedFileNames: string[] = [];  // Track names of uploaded files for logging
    const folderPath = `organizations/${organizationName}/ORG_files/${folderType}${currentPath ? `/${currentPath}` : ''}`; // Path of the current folder
    const simplifiedFolderPath = `/${folderType}${currentPath ? `/${currentPath}` : ''}`; // Simplified path for the log

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = `${folderPath}/${file.name}`;

      const fileExists = await checkFileExists(filePath); // Check if file exists

      if (fileExists) {
        const confirmOverwrite = window.confirm(`A file named '${file.name}' already exists. Do you want to overwrite it?`);
        if (!confirmOverwrite) {
          showToast(`Skipping upload of ${file.name}.`, "error");
          continue; // Skip this file if user doesn't want to overwrite
        }
      }

      const storageRef = ref(storage, filePath);

      // Add custom metadata
      const metadata = {
        customMetadata: {
          uploadedBy: userName,
        },
      };

      // Use uploadBytesResumable to upload the file
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      // Await the upload to complete
      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress); // Update progress
          },
          (error) => {
            console.error('Error uploading file:', error);

            showToast(`Error uploading ${file.name}`, "error");
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const fetchedMetadata = await getMetadata(uploadTask.snapshot.ref);

            const uploadedFile: UploadedFile = {
              name: file.name,
              url: downloadURL,
              type: fetchedMetadata.contentType || 'Unknown',
              size: formatFileSize(fetchedMetadata.size),
              uploadedBy: fetchedMetadata.customMetadata?.uploadedBy || 'Unknown',
              dateUploaded: fetchedMetadata.timeCreated || 'Unknown',
            };

            uploadedFiles.push(uploadedFile);
            uploadedFileNames.push(file.name);  // Add file name to the list
            resolve(null);
          }
        );
      });
    }

    await fetchFilesAndFolders(); // Fetch the latest list from Firebase
    showToast(`Successfully uploaded ${uploadedFiles.length} file(s).`, "success");
    // Log the activity
    let logMessage = '';
    
    if (uploadedFileNames.length === 1) {
      // Log for single file with the simplified path
      logMessage = `Uploaded 1 file: '${uploadedFileNames[0]}' to path '${simplifiedFolderPath}'`;
    } else if (uploadedFileNames.length > 1) {
      // Log for multiple files with the simplified path
      logMessage = `Uploaded ${uploadedFileNames.length} files to path '${simplifiedFolderPath}'`;
    }
    
    logActivity(logMessage); // Log the activity message

  } catch (error) {
    console.error('Error uploading files:', error);
    showToast('Some files could not be uploaded.', "error");

  } finally {
    setLoading(false); // Stop loading spinner
  }
};


// Helper function to check if a file exists
const checkFileExists = async (filePath: string) => {
  try {
    const fileRef = ref(storage, filePath);
    const fileMetadata = await getMetadata(fileRef);
    return !!fileMetadata; // If metadata exists, the file exists
  } catch (error) {
    return false; // File does not exist
  }
};




const handleDelete = async () => {
  Swal.fire({
    title: "Are you sure?",
    text: "This action cannot be undone!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const basePath = `organizations/${organizationName}/ORG_files/${folderType}${currentPath ? `/${currentPath}` : ''}`;
        const deletedFiles: string[] = [];
        const deletedFolders: string[] = [];
        const simplifiedFolderPath = `/${folderType}${currentPath ? `/${currentPath}` : ''}`;

        // Delete selected files
        const filesToDelete = Array.from(selectedFiles);
        for (const fileName of filesToDelete) {
          const fileRef = ref(storage, `${basePath}/${fileName}`);
          await deleteObject(fileRef);
          deletedFiles.push(fileName);
        }

        // Delete selected folders recursively
        const foldersToDelete = Array.from(selectedFolders);
        for (const folderName of foldersToDelete) {
          const folderPath = `${basePath}/${folderName}`;
          await deleteFolderRecursively(folderPath);
          deletedFolders.push(folderName);
        }

        // Update UI
        setFiles((prevFiles) => prevFiles.filter((file) => !selectedFiles.has(file.name)));
        setFolders((prevFolders) => prevFolders.filter((folder) => !selectedFolders.has(folder.name)));
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());

        Swal.fire("Deleted!", "Selected files and folders have been deleted.", "success");

        let logMessage = "";
        if (deletedFolders.length > 0) {
          logMessage += `Deleted ${deletedFolders.length} folder(s) in ${simplifiedFolderPath}:\n`;
          deletedFolders.forEach((folder) => {
            logMessage += `• ${folder}\n`;
          });
        }

        if (deletedFiles.length > 0) {
          logMessage += `Deleted ${deletedFiles.length} file(s) in ${simplifiedFolderPath}:\n`;
          deletedFiles.forEach((file) => {
            logMessage += `• ${file}\n`;
          });
        }

        if (logMessage) {
          logActivity(logMessage);
        }
      } catch (error) {
        console.error("Error deleting files or folders:", error);
        Swal.fire("Error!", "Failed to delete files or folders.", "error");
      }
    }
  });
};




const deleteFolderRecursively = async (folderPath: string) => {
  const folderRef = ref(storage, folderPath);

  // List all items (files and subdirectories) in the folder
  const listResult = await listAll(folderRef);

  // Delete all files in the folder
  for (const fileRef of listResult.items) {
    await deleteObject(fileRef);
  }

  // Recursively delete all subfolders
  for (const subfolderRef of listResult.prefixes) {
    await deleteFolderRecursively(subfolderRef.fullPath);
  }
};




  const handleFileClick = (file: UploadedFile) => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setModalContent({ type: file.type, url: file.url });
      setIsModalOpen(true);
    } else {
      window.open(file.url, '_blank'); // Open other file types directly
    }
  };
  

  const toggleFileSelection = (fileName: string) => {
    setSelectedFiles((prevSelected) => {
      const updatedSelected = new Set(prevSelected);
      if (updatedSelected.has(fileName)) {
        updatedSelected.delete(fileName);
      } else {
        updatedSelected.add(fileName);
      }
      return updatedSelected;
    });
  };
  
  
  const toggleFolderSelection = (folderName: string) => {
    setSelectedFolders((prevSelected) => {
      const updatedSelected = new Set(prevSelected);
      if (updatedSelected.has(folderName)) {
        updatedSelected.delete(folderName);
      } else {
        updatedSelected.add(folderName);
      }
  
      return updatedSelected;
    });
  };

  
  const toggleSortOrder = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortOrder('asc'); // Reset to ascending when switching columns
    }
  
    // Sorting logic for files
    const sortedFiles = [...files].sort((a, b) => {
      let comparison = 0;
  
      if (column === 'size') {
        const sizeA = parseFloat(a.size?.replace(/[^\d.]/g, '') || '0');
        const sizeB = parseFloat(b.size?.replace(/[^\d.]/g, '') || '0');
        comparison = sizeA - sizeB;
      } else if (column === 'dateUploaded') {
        comparison = new Date(a.dateUploaded ?? '').getTime() - new Date(b.dateUploaded ?? '').getTime();
      } else {
        // Default case for string properties
        const valueA = (a[column as keyof UploadedFile] ?? '') as string;
        const valueB = (b[column as keyof UploadedFile] ?? '') as string;
        comparison = valueA.localeCompare(valueB);
      }
  
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  
    // Sorting logic for folders
    const sortedFolders = [...folders].sort((a, b) => {
      let comparison = 0;
  
      if (column === 'dateUploaded') {
        comparison = new Date(a.dateUploaded ?? '').getTime() - new Date(b.dateUploaded ?? '').getTime();
      } else if (column === 'name') {
        // Sort folders by name
        const valueA = a.name ?? '';
        const valueB = b.name ?? '';
        comparison = valueA.localeCompare(valueB);
      }
  
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  
    setFiles(sortedFiles);
    setFolders(sortedFolders);
  };


  const renderSidebar = () => {
    switch (role) {
      case 'president':
        return <StudentPresidentSidebar />;
      case 'officer':
        return <StudentPresidentSidebar  />;
        case 'faculty':
          return <StudentPresidentSidebar  />;
      case 'member':
        return <StudentMemberSidebar />;
      default:
        return; 
    }
  };
  
  const filteredFolders = [...folders]
  .filter((folder) => folder.name.toLowerCase().includes(searchQuery.toLowerCase()));

const filteredFiles = [...files]
  .filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));




  const Modal: React.FC<{ content: { type: string; url: string } | null; onClose: () => void }> = ({
    content,
    onClose,
  }) => {
    if (!content) return null;
  
    return (
      <div className="piclp-modal-overlay" onClick={onClose}>
    <div className="piclp-modal-content" onClick={(e) => e.stopPropagation()}>
    <button onClick={onClose} className="piclp-modal-close">x</button>
          {content.type.startsWith('image/') ? (
            <img src={content.url} alt="Preview"  />
          ) : content.type.startsWith('video/') ? (
            <video src={content.url} controls/>
          ) : null}

        </div>
      </div>
    );
  };
  
  return (
    
     <div className="organization-announcements-page">
      <Header />
      <div className="organization-announcements-container">
      <div className="sidebar-section">
  {renderSidebar()}
  </div>


    <main className="main-content">
  
    <div className="header-container">
  <h1 className="headtitle">Resources</h1>
</div>
      <div className="OrgResour-toolbar-upload">
      <button
    className="OrgResour-button-upload"
    onClick={() => document.getElementById('fileInput')?.click()}
  >
    Upload Files
  </button>
  <input
    id="fileInput"
    type="file"
    multiple
    style={{ display: 'none' }}
    onChange={(e) => handleMultipleFileUpload(e.target.files)}
  />
  <button onClick={() => setIsCreateFolderModalOpen(true)} className="create-folder-button">
    Create Folder
  </button>
</div>
      {/* Breadcrumbs */}
      <div className="OrgResour-breadcrumbs">
        <span onClick={() => setCurrentPath('')}>/</span>
        {currentPath.split('/').map((part, index, arr) => (
          <span
            key={index}
            onClick={() => setCurrentPath(arr.slice(0, index + 1).join('/'))}
          >
            {`  ${part}`}
          </span>
        ))}
      </div>
<div className="OrgResour-toolbar-actions">
    <div className="OrgResour-toolbar-left">
        <button onClick={navigateUp} disabled={!currentPath} title="Go Back">
            <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        {role !== 'member' && (
  <select
    className="OrgResour-input-select"
    value={folderType}
    onChange={(e) => setFolderType(e.target.value as 'public' | 'private')}
  >
    <option value="public">Public Folder</option>
    {role !== 'member' && <option value="private">Private Folder</option>}
  </select>
)}

        <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="OrgResour-input-search"
        />
    </div>
     <div className="OrgResour-toolbar-right">
    
        <button
            onClick={handleDelete}
            disabled={selectedFiles.size === 0 && selectedFolders.size === 0}
            className="OrgResour-button-delete"
        >
            Delete Selected
        </button>
        
    </div>
</div>
{loading && (
  <div className="loading">
    <div className="spinner"></div>
    <div className="progress-container">
      <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
    </div>
    <div className="upload-text">
      Uploading... {uploadProgress !== null && `${uploadProgress.toFixed(0)}%`}
    </div>
  </div>
)}

<div
  className={`OrgResour-resources-table ${isDragOver ? 'drag-over' : ''}`}
  onDragOver={(e) => {
    e.preventDefault();
    setIsDragOver(true); // Highlight the table area
  }}
  onDragLeave={() => setIsDragOver(false)} // Remove highlight when dragging leaves
  onDrop={(e) => {
    e.preventDefault();
    setIsDragOver(false); // Remove highlight
    if (e.dataTransfer.files) {
      handleMultipleFileUpload(e.dataTransfer.files); // Handle dropped files
    }
  }}
>

  <div className="OrgResour-scrollable-container">
    <table className="OrgResour-table">
    <thead>
    <tr>
      <th>Select</th>
      <th onClick={() => toggleSortOrder('name')} style={{ cursor: 'pointer' }}>
        Name {sortColumn === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
      </th>
      <th onClick={() => toggleSortOrder('size')} style={{ cursor: 'pointer' }}>
        Size {sortColumn === 'size' && (sortOrder === 'asc' ? '▲' : '▼')}
      </th>
      <th onClick={() => toggleSortOrder('type')} style={{ cursor: 'pointer' }}>
        Type {sortColumn === 'type' && (sortOrder === 'asc' ? '▲' : '▼')}
      </th>
      <th onClick={() => toggleSortOrder('uploadedBy')} style={{ cursor: 'pointer' }}>
        Uploaded By {sortColumn === 'uploadedBy' && (sortOrder === 'asc' ? '▲' : '▼')}
      </th>
      <th onClick={() => toggleSortOrder('dateUploaded')} style={{ cursor: 'pointer' }}>
        Date Uploaded {sortColumn === 'dateUploaded' && (sortOrder === 'asc' ? '▲' : '▼')}
      </th>
    </tr>
  </thead>
      <tbody>
        {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ textAlign: 'center', padding: '10px' }}>
              There's no file or folder matching your search.
            </td>
          </tr>
        ) : (
          <>
            {filteredFolders.map((folder) => (
              <tr
                key={folder.name}
                onClick={() => openFolder(folder.name)}
                style={{ cursor: 'pointer' }}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedFolders.has(folder.name)}
                    onChange={() => toggleFolderSelection(folder.name)}
                  />
                </td>
                <td>
                  <FontAwesomeIcon icon={faFolder} className="OrgResour-icon folder" />
                  {folder.name}
                </td>
                <td>—</td>
                <td>Folder</td>
                <td>{folder.uploadedBy}</td>
                <td>
                  {folder.dateUploaded !== 'Unknown'
                    ? formatDate(folder.dateUploaded)
                    : 'Unknown'}
                </td>
              </tr>
            ))}

            {filteredFiles.map((file) => {
              const fileClass =
                file.type.includes('image')
                  ? 'image'
                  : file.type.includes('video')
                  ? 'video'
                  : file.type.includes('pdf')
                  ? 'pdf'
                  : file.type.includes('word')
                  ? 'word'
                  : file.type.includes('presentation')
                  ? 'powerpoint'
                  : file.type.includes('spreadsheet')
                  ? 'excel'
                  : 'default';

              return (
                <tr
                  key={file.name}
                  onClick={() => handleFileClick(file)}
                  style={{ cursor: 'pointer' }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.name)}
                      onChange={() => toggleFileSelection(file.name)}
                    />
                  </td>
                  <td>
                    <FontAwesomeIcon
                      icon={getFileIcon(file.name)}
                      className={`OrgResour-icon ${fileClass}`}
                    />
                    {file.name.replace(/\.[^/.]+$/, '') /* Remove file extension */}
                  </td>
                  <td>{file.size || '—'}</td>
                  <td>{file?.type?.length > 10 ? file.type.substring(0,15) + '...' : file.type || 'Unknown'}</td>
                  <td>{file.uploadedBy || 'Unknown'}</td>
                  <td>
                    {file.dateUploaded ? formatDate(file.dateUploaded) : 'Unknown'}
                  </td>
                </tr>
              );
            })}
          </>
        )}
      </tbody>
    </table>
  </div>
</div>


{isCreateFolderModalOpen && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2>Create a New Folder</h2>
      <input
        type="text"
        placeholder="Folder name"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value)}
      />
      <button onClick={createFolder}>Create</button>
      <button onClick={() => setIsCreateFolderModalOpen(false)}>Cancel</button>
    </div>
  </div>
)}

        
          {detailsContent && (
            <DetailsModal
              content={detailsContent}
              onClose={() => setDetailsContent(null)}
            />
          )}
  
          {/* Modal for Image/Video Preview */}
          {isModalOpen && modalContent && (
            <Modal content={modalContent} onClose={() => setIsModalOpen(false)} />
          )}
        </main>
      </div>
    </div>
  );
  
};

export default OrganizationResources;
