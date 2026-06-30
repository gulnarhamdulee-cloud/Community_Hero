import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, OfficerProfile, UserRole } from '../types';

export interface AuthContextType {
  user: (UserProfile & Partial<OfficerProfile>) | (OfficerProfile & Partial<UserProfile>) | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  role: UserRole | null;
  isOfficer: boolean;
  isCitizen: boolean;
  loginWithGoogle: (role?: UserRole) => Promise<void>;
  loginWithEmail: (email: string, pass: string, role?: UserRole) => Promise<void>;
  signUpWithEmail: (
    email: string, 
    pass: string, 
    name: string, 
    city: string, 
    role?: UserRole, 
    additional?: {
      ward?: string;
      department?: string;
      designation?: string;
    }
  ) => Promise<void>;
  loginAnonymously: (city?: string) => Promise<void>;
  updateUserCity: (city: string) => Promise<void>;
  clearError: () => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120"
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<any | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Helper to ensure a profile document exists in firestore and returned as UserProfile/OfficerProfile
  const syncUserProfile = async (
    fbUser: User, 
    extraData?: { 
      name?: string; 
      city?: string; 
      ward?: string;
      role?: UserRole; 
      department?: string; 
      designation?: string; 
      isGuest?: boolean;
    }
  ) => {
    try {
      const now = new Date().toISOString();
      let requestedRole = extraData?.role;
      let mergedExtraData = { ...extraData };

      // Fallback to simulated account details if logged in anonymously and matching uid is found in localStorage
      if (fbUser.isAnonymous || !fbUser.email) {
        try {
          const accountsStr = localStorage.getItem('simulated_accounts') || '{}';
          const accounts = JSON.parse(accountsStr);
          const localAcc = Object.values(accounts).find((acc: any) => acc.uid === fbUser.uid) as any;
          if (localAcc) {
            if (requestedRole === undefined) {
              requestedRole = localAcc.role;
            }
            mergedExtraData = {
              name: localAcc.name,
              city: localAcc.city,
              role: localAcc.role,
              ward: localAcc.ward,
              department: localAcc.department,
              designation: localAcc.designation,
              isGuest: false,
              ...mergedExtraData
            };
          }
        } catch (e) {
          console.warn("Error reading local accounts in sync:", e);
        }
      }

      // 1. If role is explicitly requested to be Municipal Officer
      if (requestedRole === UserRole.MUNICIPAL_OFFICER) {
        const officerDocRef = doc(db, 'officers', fbUser.uid);
        let officerDocSnap = null;
        try {
          officerDocSnap = await getDoc(officerDocRef);
        } catch (err) {
          console.log("No officer doc or read error:", err);
        }

        let officerData: OfficerProfile;
        if (officerDocSnap?.exists()) {
          const existingData = officerDocSnap.data() as OfficerProfile;
          const updatedOfficer: Partial<OfficerProfile> = {
            name: mergedExtraData?.name || existingData.name || fbUser.displayName || "Municipal Officer",
            email: fbUser.email || existingData.email || "",
          };
          try {
            await updateDoc(officerDocRef, updatedOfficer);
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `officers/${fbUser.uid}`);
          }
          officerData = { ...existingData, ...updatedOfficer };
        } else {
          officerData = {
            uid: fbUser.uid,
            name: mergedExtraData?.name || fbUser.displayName || "Municipal Officer",
            email: fbUser.email || "",
            role: UserRole.MUNICIPAL_OFFICER,
            department: mergedExtraData?.department || "Sanitation & Waste Management",
            city: mergedExtraData?.city || "Mumbai",
            ward: mergedExtraData?.ward || "Ward A, Fort Division, BMC",
            designation: mergedExtraData?.designation || "Executive Engineer",
            active: true,
            createdAt: now
          };
          try {
            await setDoc(officerDocRef, officerData);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `officers/${fbUser.uid}`);
          }
        }

        // Clean up any accidental citizen record created by onAuthStateChanged timing races
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          await deleteDoc(userDocRef);
        } catch (e) {
          // ignore cleanup failures
        }

        const mergedOfficer = {
          ...officerData,
          uid: fbUser.uid,
          role: UserRole.MUNICIPAL_OFFICER,
          points: 0,
          badges: [],
          reportsSubmitted: 0,
          reportsVerified: 0,
          photoURL: DEFAULT_AVATARS[0]
        } as any;

        setProfile(mergedOfficer);
        setRole(UserRole.MUNICIPAL_OFFICER);
        return mergedOfficer;
      }

      // 2. If role is explicitly requested to be Citizen
      if (requestedRole === UserRole.CITIZEN) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        let userDocSnap = null;
        try {
          userDocSnap = await getDoc(userDocRef);
        } catch (err) {
          console.log("No user doc or read error:", err);
        }

        let userData: UserProfile;
        const isGuest = fbUser.isAnonymous || mergedExtraData?.isGuest || false;

        if (userDocSnap?.exists()) {
          const existingData = userDocSnap.data() as UserProfile;
          const updatedUser: Partial<UserProfile> = {
            lastLogin: now,
            name: mergedExtraData?.name || existingData.name || fbUser.displayName || "Civic Citizen",
            photoURL: existingData.photoURL || fbUser.photoURL || DEFAULT_AVATARS[0]
          };
          try {
            await updateDoc(userDocRef, updatedUser);
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${fbUser.uid}`);
          }
          userData = { ...existingData, ...updatedUser };
        } else {
          userData = {
            uid: fbUser.uid,
            name: mergedExtraData?.name || fbUser.displayName || (isGuest ? "Guest Hero" : "Civic Citizen"),
            email: fbUser.email || (isGuest ? "guest@communityhero.in" : ""),
            photoURL: fbUser.photoURL || DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
            role: UserRole.CITIZEN,
            city: mergedExtraData?.city || "Mumbai",
            ward: mergedExtraData?.ward || "",
            points: isGuest ? 10 : 25,
            badges: isGuest ? ["Guest Explorer"] : ["First Citizen"],
            reportsSubmitted: 0,
            reportsVerified: 0,
            createdAt: now,
            lastLogin: now,
            isGuest
          };
          try {
            await setDoc(userDocRef, userData);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
          }
        }

        // Clean up any accidental officer record
        try {
          const officerDocRef = doc(db, 'officers', fbUser.uid);
          await deleteDoc(officerDocRef);
        } catch (e) {}

        const mergedUser = {
          ...userData,
          uid: fbUser.uid,
          role: UserRole.CITIZEN,
        } as UserProfile;

        setProfile(mergedUser);
        setRole(UserRole.CITIZEN);
        return mergedUser;
      }

      // 3. No role explicitly requested (e.g. automatic trigger from onAuthStateChanged)
      // Check if they are registered as an Officer first
      const officerDocRef = doc(db, 'officers', fbUser.uid);
      let officerDocSnap = null;
      try {
        officerDocSnap = await getDoc(officerDocRef);
      } catch (err) {
        console.log("No officer doc or read error:", err);
      }

      if (officerDocSnap?.exists()) {
        const officerData = officerDocSnap.data() as OfficerProfile;
        const updatedOfficer: Partial<OfficerProfile> = {
          name: officerData.name || fbUser.displayName || "Municipal Officer",
          email: officerData.email || fbUser.email || "",
        };
        try {
          await updateDoc(officerDocRef, updatedOfficer);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `officers/${fbUser.uid}`);
        }
        
        const mergedOfficer = {
          ...officerData,
          ...updatedOfficer,
          uid: fbUser.uid,
          role: UserRole.MUNICIPAL_OFFICER,
          points: 0,
          badges: [],
          reportsSubmitted: 0,
          reportsVerified: 0,
          photoURL: DEFAULT_AVATARS[0]
        } as any;
        
        setProfile(mergedOfficer);
        setRole(UserRole.MUNICIPAL_OFFICER);
        return mergedOfficer;
      }

      // 4. Check if they are registered as a Citizen
      const userDocRef = doc(db, 'users', fbUser.uid);
      let userDocSnap = null;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (err) {
        console.log("No user doc or read error:", err);
      }

      if (userDocSnap?.exists()) {
        const userData = userDocSnap.data() as UserProfile;
        const updatedUser: Partial<UserProfile> = {
          lastLogin: now,
          name: userData.name || fbUser.displayName || "Civic Citizen",
          photoURL: userData.photoURL || fbUser.photoURL || DEFAULT_AVATARS[0]
        };
        try {
          await updateDoc(userDocRef, updatedUser);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${fbUser.uid}`);
        }
        
        const mergedUser = {
          ...userData,
          ...updatedUser,
          uid: fbUser.uid,
          role: UserRole.CITIZEN,
        } as UserProfile;
        
        setProfile(mergedUser);
        setRole(UserRole.CITIZEN);
        return mergedUser;
      }

      // 5. New Registration / No Document Exists / No explicit requestedRole (rare fallback)
      const isGuest = fbUser.isAnonymous || false;
      const newProfile: UserProfile = {
        uid: fbUser.uid,
        name: fbUser.displayName || (isGuest ? "Guest Hero" : "Civic Citizen"),
        email: fbUser.email || (isGuest ? "guest@communityhero.in" : ""),
        photoURL: fbUser.photoURL || DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
        role: UserRole.CITIZEN,
        city: "Mumbai",
        ward: "",
        points: isGuest ? 10 : 25,
        badges: isGuest ? ["Guest Explorer"] : ["First Citizen"],
        reportsSubmitted: 0,
        reportsVerified: 0,
        createdAt: now,
        lastLogin: now,
        isGuest
      };
      try {
        await setDoc(userDocRef, newProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
      }
      setProfile(newProfile);
      setRole(UserRole.CITIZEN);
      return newProfile;
    } catch (err: any) {
      console.error("Error syncing profile:", err);
      const fallbackProfile: UserProfile = {
        uid: fbUser.uid,
        name: extraData?.name || fbUser.displayName || "Civic Citizen",
        email: fbUser.email || "",
        photoURL: fbUser.photoURL || DEFAULT_AVATARS[0],
        role: UserRole.CITIZEN,
        city: extraData?.city || "Mumbai",
        ward: extraData?.ward || "",
        points: 25,
        badges: ["First Citizen"],
        reportsSubmitted: 0,
        reportsVerified: 0,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      setProfile(fallbackProfile);
      setRole(UserRole.CITIZEN);
      return fallbackProfile;
    }
  };

  // Monitor firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUserProfile(fbUser);
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (requestedRole: UserRole = UserRole.CITIZEN) => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await syncUserProfile(result.user, { role: requestedRole });
    } catch (err: any) {
      console.error("Google login failed:", err);
      setError(err.message || "Failed to authenticate with Google.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string, requestedRole: UserRole = UserRole.CITIZEN) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      await syncUserProfile(result.user, { role: requestedRole });
    } catch (err: any) {
      console.warn("Real email login failed, trying simulated fallback:", err);
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/user-not-found' || err.message?.includes('operation-not-allowed') || err.message?.includes('user-not-found') || err.code === 'auth/invalid-credential' || err.message?.includes('invalid-credential') || err.message?.includes('auth-type-not-allowed')) {
        try {
          const accountsStr = localStorage.getItem('simulated_accounts') || '{}';
          const accounts = JSON.parse(accountsStr);
          const localAcc = accounts[email.toLowerCase()];
          
          if (!localAcc) {
            throw new Error("No registered account found with this email. Please sign up.");
          }
          if (localAcc.password !== pass) {
            throw new Error("Incorrect password. Please try again.");
          }

          const targetRole = localAcc.role ?? requestedRole;
          const anonResult = await signInAnonymously(auth);
          const newUid = anonResult.user.uid;
          const oldUid = localAcc.uid;

          if (oldUid && oldUid !== newUid) {
            const oldCollection = targetRole === UserRole.MUNICIPAL_OFFICER ? 'officers' : 'users';
            const newCollection = targetRole === UserRole.MUNICIPAL_OFFICER ? 'officers' : 'users';
            
            const oldDocRef = doc(db, oldCollection, oldUid);
            const oldDocSnap = await getDoc(oldDocRef);
            
            if (oldDocSnap.exists()) {
              const oldData = oldDocSnap.data();
              const newDocRef = doc(db, newCollection, newUid);
              await setDoc(newDocRef, {
                ...oldData,
                uid: newUid,
                lastLogin: new Date().toISOString()
              });
            }
          }

          localAcc.uid = newUid;
          accounts[email.toLowerCase()] = localAcc;
          localStorage.setItem('simulated_accounts', JSON.stringify(accounts));

          await syncUserProfile(anonResult.user, {
            name: localAcc.name,
            city: localAcc.city,
            role: targetRole,
            isGuest: false,
            ward: localAcc.ward,
            department: localAcc.department,
            designation: localAcc.designation
          });
        } catch (simErr: any) {
          console.error("Simulated login failed:", simErr);
          setError(simErr.message || "Invalid credentials.");
          throw simErr;
        }
      } else {
        setError(err.message || "Invalid credentials. Please verify your email and password.");
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string, 
    pass: string, 
    name: string, 
    city: string, 
    requestedRole: UserRole = UserRole.CITIZEN,
    additional?: {
      ward?: string;
      department?: string;
      designation?: string;
    }
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(result.user, {
        displayName: name
      });
      await syncUserProfile(result.user, { 
        name, 
        city, 
        role: requestedRole, 
        isGuest: false,
        ...additional
      });
    } catch (err: any) {
      console.warn("Real email signup failed, trying simulated fallback:", err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed') || err.message?.includes('auth-type-not-allowed')) {
        try {
          const accountsStr = localStorage.getItem('simulated_accounts') || '{}';
          const accounts = JSON.parse(accountsStr);
          if (accounts[email.toLowerCase()]) {
            throw new Error("This email address is already registered.");
          }

          const anonResult = await signInAnonymously(auth);
          
          accounts[email.toLowerCase()] = {
            uid: anonResult.user.uid,
            password: pass,
            role: requestedRole,
            name,
            city,
            ...additional
          };
          localStorage.setItem('simulated_accounts', JSON.stringify(accounts));

          await syncUserProfile(anonResult.user, {
            name,
            city,
            role: requestedRole,
            isGuest: false,
            ...additional
          });
        } catch (simErr: any) {
          console.error("Simulated signup failed:", simErr);
          setError(simErr.message || "Failed to create account.");
          throw simErr;
        }
      } else {
        setError(err.message || "Failed to create account.");
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  const loginAnonymously = async (city: string = "Mumbai") => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInAnonymously(auth);
      await syncUserProfile(result.user, { name: "Guest Hero", city, isGuest: true, role: UserRole.CITIZEN });
    } catch (err: any) {
      console.error("Anonymous login failed:", err);
      setError(err.message || "Could not spin up guest session.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateUserCity = async (city: string) => {
    if (!profile || !firebaseUser) return;
    try {
      const collectionName = role === UserRole.MUNICIPAL_OFFICER ? 'officers' : 'users';
      const docRef = doc(db, collectionName, firebaseUser.uid);
      await updateDoc(docRef, { city });
      setProfile((prev: any) => prev ? { ...prev, city } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${role === UserRole.MUNICIPAL_OFFICER ? 'officers' : 'users'}/${firebaseUser.uid}`);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setProfile(null);
      setRole(null);
      setFirebaseUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user: profile,
    firebaseUser,
    loading,
    error,
    role,
    isOfficer: role === UserRole.MUNICIPAL_OFFICER,
    isCitizen: role === UserRole.CITIZEN,
    loginWithGoogle,
    loginWithEmail,
    signUpWithEmail,
    loginAnonymously,
    updateUserCity,
    clearError,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
