import { createContext, useContext, useEffect, useState } from "react";
import { 
  collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc, arrayUnion 
} from "firebase/firestore";
import { firestore } from '../services/firebaseConfig';

// Define the Task type
interface Task {
  id: string;
  title: string;
  dueDate: string;
  assignedMembers?: string[];
  assignedCommittees?: string[];
  notificationsSent?: string[];
}

// Define User type
interface User {
  uid: string;
  orgName: string;
}

// Create Context
const TaskNotificationContext = createContext<{ tasks: Task[] } | undefined>(undefined);

export const TaskNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const currentUser: User | null = { uid: "user123", orgName: "myOrg" }; // Replace with actual user state

  useEffect(() => {
    if (!currentUser || !currentUser.orgName) return;

    const orgDocRef = doc(firestore, "organizations", currentUser.orgName);

    const fetchTasks = async () => {
      const orgDoc = await getDoc(orgDocRef);
      if (!orgDoc.exists()) return;

      const orgData = orgDoc.data();
      const userId = currentUser.uid;

      // Get user's committees
      const userCommittees = orgData?.committees?.filter(
        (c: any) => c.head?.id === userId || c.members?.some((m: any) => m.id === userId)
      ) || [];

      const userCommitteeIds = userCommittees.map((c: any) => c.id);
      const tasksCollectionPath = collection(firestore, "tasks", currentUser.orgName, "AllTasks");

      const taskQuery = query(tasksCollectionPath);

      // Listen for task updates
      const unsubscribe = onSnapshot(taskQuery, (querySnapshot) => {
        const userTasks: Task[] = [];
        const notificationPromises: Promise<void>[] = [];
        const currentDate = new Date();

        querySnapshot.forEach((docSnapshot) => {
          const taskData = docSnapshot.data() as Task;

          // Check if user is assigned
          const isAssigned = taskData.assignedMembers?.includes(userId) ||
            taskData.assignedCommittees?.some((id) => userCommitteeIds.includes(id));

          if (isAssigned) {
            userTasks.push({ ...taskData, id: docSnapshot.id });

            // Notifications
            if (!taskData.notificationsSent) taskData.notificationsSent = [];

            const taskDueDate = new Date(taskData.dueDate);
            const hoursToDue = (taskDueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);

            const notifyUsers = new Set<string>();
            taskData.assignedMembers?.forEach((id) => notifyUsers.add(id));
            taskData.assignedCommittees?.forEach((id) => {
              const committee = orgData.committees.find((c: any) => c.id === id);
              if (committee) {
                if (committee.head?.id) notifyUsers.add(committee.head.id);
                committee.members?.forEach((m: any) => notifyUsers.add(m.id));
              }
            });

            // 24h Reminder
            const notifId24h = `${taskData.id}-24h`;
            if (!taskData.notificationsSent.includes(notifId24h) && hoursToDue <= 24 && hoursToDue > 6) {
              notifyUsers.forEach((recipientId) => {
                const notificationRef = doc(firestore, "notifications", recipientId, "userNotifications", notifId24h);
                notificationPromises.push(setDoc(notificationRef, {
                  subject: `Task "${taskData.title}" is due in 24 hours!`,
                  description: `The task is due on ${taskDueDate.toLocaleString()}.`,
                  timestamp: new Date(),
                  isRead: false,
                  senderName: orgData.name || "Organization",
                  senderProfilePic: orgData.profileImagePath || "",
                  taskId: taskData.id,
                  type: "task-reminder",
                }));
              });
              notificationPromises.push(updateDoc(docSnapshot.ref, { notificationsSent: arrayUnion(notifId24h) }));
            }

            // 6h Reminder
            const notifId6h = `${taskData.id}-6h`;
            if (!taskData.notificationsSent.includes(notifId6h) && hoursToDue <= 6 && hoursToDue > 0) {
              notifyUsers.forEach((recipientId) => {
                const notificationRef = doc(firestore, "notifications", recipientId, "userNotifications", notifId6h);
                notificationPromises.push(setDoc(notificationRef, {
                  subject: `Task "${taskData.title}" is almost due!`,
                  description: `The task is due on ${taskDueDate.toLocaleString()}.`,
                  timestamp: new Date(),
                  isRead: false,
                  senderName: orgData.name || "Organization",
                  senderProfilePic: orgData.profileImagePath || "",
                  taskId: taskData.id,
                  type: "task-reminder",
                }));
              });
              notificationPromises.push(updateDoc(docSnapshot.ref, { notificationsSent: arrayUnion(notifId6h) }));
            }
          }
        });

        Promise.all(notificationPromises).then(() => {
          setTasks((prevTasks) => {
            const newTaskIds = new Set(userTasks.map(task => task.id));
            const prevTaskIds = new Set(prevTasks.map(task => task.id));

            // Only update if there are changes
            if (
              userTasks.length !== prevTasks.length ||
              ![...newTaskIds].every(id => prevTaskIds.has(id))
            ) {
              return userTasks;
            }
            return prevTasks;
          });
        });
      });

      return unsubscribe;
    };

    let unsubscribe: (() => void) | null = null;
    fetchTasks().then(unsub => {
        if (unsub) unsubscribe = unsub;
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  return (
    <TaskNotificationContext.Provider value={{ tasks }}>
      {children}
    </TaskNotificationContext.Provider>
  );
};

export const useTaskNotifications = () => {
  const context = useContext(TaskNotificationContext);
  if (!context) {
    throw new Error("useTaskNotifications must be used within a TaskNotificationProvider");
  }
  return context;
};
