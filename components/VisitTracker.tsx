import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../services/firebaseConfig';

const VisitTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Generate a unique device ID using userAgent and the current date
    const userAgent = navigator.userAgent;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const deviceId = `${userAgent}-${today}`; // Unique ID for the device and day

    console.log(`Device ID: ${deviceId}`); // Debugging: Log the device ID

    // Log the visit to Firestore if it's the first visit for this device today
    const logVisit = async () => {
      try {
        console.log('Checking for existing visits...'); // Debugging: Log the start of the check

        // Check if a visit from this device has already been logged today
        const visitsQuery = query(
          collection(firestore, 'websiteVisits'),
          where('deviceId', '==', deviceId)
        );
        const visitsSnapshot = await getDocs(visitsQuery);

        if (visitsSnapshot.empty) {
          console.log('No existing visit found. Logging new visit...'); // Debugging: Log the new visit

          // Log the visit if no record exists for this device today
          await addDoc(collection(firestore, 'websiteVisits'), {
            deviceId, // Unique ID for the device and day
            path: location.pathname, // Current URL path
            timestamp: new Date(), // Timestamp of the visit
            userAgent, // Browser/device info
          });

          console.log('Visit logged successfully.'); // Debugging: Log successful visit
        } else {
          console.log('Visit already logged for this device today.'); // Debugging: Log duplicate visit
        }
      } catch (error) {
        console.error('Error logging visit:', error); // Debugging: Log errors
      }
    };

    if (location.pathname === '/login') {
      logVisit();
    }

}, [location.pathname]);

  return null; // This component doesn't render anything
};

export default VisitTracker;