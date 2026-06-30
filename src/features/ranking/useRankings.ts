import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Report, UserProfile, INDIAN_CITIES } from '../../types';
import { SEED_REPORTS } from '../../mockReports';

export interface CitizenRanking {
  uid: string;
  name: string;
  city: string;
  photoURL: string;
  reportsSubmitted: number;
  reportsVerified: number;
  issuesResolved: number;
  score: number;
  badge: string;
}

export interface MunicipalRanking {
  city: string;
  municipalBody: string;
  state: string;
  resolutionPercentage: number;
  averageResponseTime: number; // in hours
  communityRatings: number; // 0 - 100 score
  score: number;
}

const CACHE_CITIZENS_KEY = 'community_hero_citizen_rankings';
const CACHE_MUNICIPALS_KEY = 'community_hero_municipal_rankings';

// Baseline fallback citizen champions (for early stage gracefully populated lists)
const BACKUP_CITIZENS: CitizenRanking[] = [
  {
    uid: "ananya-rao-seed",
    name: "Ananya Rao",
    city: "Mumbai",
    photoURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120",
    reportsSubmitted: 22,
    reportsVerified: 19,
    issuesResolved: 15,
    score: 1480, // Dynamic calculation matching Gandhi champion status
    badge: "MGD WARRIOR"
  },
  {
    uid: "kunal-patel-seed",
    name: "Kunal Patel",
    city: "Pune",
    photoURL: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&q=80&w=120",
    reportsSubmitted: 16,
    reportsVerified: 11,
    issuesResolved: 10,
    score: 980,
    badge: "SWACHH CO-LEAD"
  }
];

export function useRankings() {
  const [citizenRankings, setCitizenRankings] = useState<CitizenRanking[]>(() => {
    const cached = localStorage.getItem(CACHE_CITIZENS_KEY);
    return cached ? JSON.parse(cached) : BACKUP_CITIZENS;
  });

  const [municipalRankings, setMunicipalRankings] = useState<MunicipalRanking[]>(() => {
    const cached = localStorage.getItem(CACHE_MUNICIPALS_KEY);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let reportsList: Report[] = [];
    let usersList: UserProfile[] = [];

    // Local trigger function to run aggregation and ranking computations
    const recalculateRankings = () => {
      // 1. COMPUTE CITIZEN RANKINGS
      // We look at all registered users in Firestore + include backup seeds to ensure fully packed scoreboard
      const computedCitizens = usersList.map(user => {
        const userReports = reportsList.filter(r => r.userId === user.uid);
        
        // Dynamic counts from the real-time reports database
        const reportsSubmitted = Math.max(user.reportsSubmitted || 0, userReports.length);
        const issuesResolved = userReports.filter(r => r.status === 'Resolved').length;
        
        // Verification happens when issue has community upvotes (>= 3 upvotes) or explicitly marked verified
        const reportsVerified = Math.max(
          user.reportsVerified || 0,
          userReports.filter(r => r.upvotesUsers.length >= 3).length
        );

        // Citizen Score = reportsSubmitted * 10 + reportsVerified * 5 + issuesResolved * 25
        const score = (reportsSubmitted * 10) + (reportsVerified * 5) + (issuesResolved * 25);

        // Map score to a badge
        let badge = "Active Hero";
        if (score >= 1200) badge = "MGD WARRIOR";
        else if (score >= 800) badge = "SWACHH CO-LEAD";
        else if (score >= 300) badge = "Ward Leader";
        else if (score >= 100) badge = "Civic Guardian";

        return {
          uid: user.uid,
          name: user.name,
          city: user.city,
          photoURL: user.photoURL,
          reportsSubmitted,
          reportsVerified,
          issuesResolved,
          score,
          badge
        };
      });

      // Filter and merge backup citizens that aren't already represented to avoid duplication
      const currentUids = new Set(computedCitizens.map(c => c.uid));
      const mergedCitizens = [
        ...computedCitizens,
        ...BACKUP_CITIZENS.filter(b => !currentUids.has(b.uid))
      ].sort((a, b) => b.score - a.score);

      setCitizenRankings(mergedCitizens);
      localStorage.setItem(CACHE_CITIZENS_KEY, JSON.stringify(mergedCitizens));

      // 2. COMPUTE MUNICIPALITY RANKINGS
      // Loop over every target city in the Indian Cities list and calculate real-time Municipal Score
      // Municipal Score = resolutionPercentage + averageResponseTimeScore + communityRatings
      const computedMunicipals: MunicipalRanking[] = INDIAN_CITIES.map(city => {
        // Aggregate all reports belonging to design city (includes Firestore + fallback seeds for dense charts)
        const cityReports = [
          ...reportsList,
          ...SEED_REPORTS
        ].filter(r => r.location.city.toLowerCase() === city.name.toLowerCase());

        const totalCityReports = cityReports.length;
        const resolvedReportsCount = cityReports.filter(r => r.status === 'Resolved').length;

        // A. Resolution Percentage (0 - 100 value)
        const resolutionPercentage = totalCityReports > 0 
          ? Math.round((resolvedReportsCount / totalCityReports) * 100)
          : (() => {
              // Graceful seed baselines for empty states
              if (city.name === "Bengaluru") return 88;
              if (city.name === "Mumbai") return 84;
              if (city.name === "Pune") return 78;
              return 65; // baseline minimum fallback
            })();

        // B. Average Response Time (Score component where lower hours = more points)
        // Let's compute average duration in hours of resolved reports
        const resolvedWithDates = cityReports.filter(r => r.status === 'Resolved' && r.resolvedAt);
        const resolvedDurations = resolvedWithDates.map(r => {
          const start = new Date(r.createdAt).getTime();
          const end = new Date(r.resolvedAt!).getTime();
          return Math.max(1, (end - start) / (1000 * 30 * 60 * 60)); // hours
        });

        const averageResponseTime = resolvedDurations.length > 0
          ? Math.round(resolvedDurations.reduce((a, b) => a + b, 0) / resolvedDurations.length)
          : (() => {
              // Default baselines
              if (city.name === "Bengaluru") return 32;
              if (city.name === "Mumbai") return 48;
              if (city.name === "Pune") return 54;
              return 72;
            })();

        // Helper maps Response time to weight score contribution: faster = closer to 100 points
        const responseTimeScore = Math.max(10, Math.min(100, 120 - averageResponseTime));

        // C. Community Ratings: based on upvote intensity and resolved ratios (0 - 100)
        const totalUpvotes = cityReports.reduce((acc, r) => acc + r.upvotesCount, 0);
        const communityRatings = totalCityReports > 0
          ? Math.min(100, Math.round((totalUpvotes / totalCityReports) * 6) + 40)
          : (() => {
              // default baselines
              if (city.name === "Bengaluru") return 85;
              if (city.name === "Mumbai") return 78;
              if (city.name === "Pune") return 75;
              return 60;
            })();

        // Municipal Score = resolutionPercentage + averageResponseTime (responseTimeScore) + communityRatings
        const score = resolutionPercentage + responseTimeScore + communityRatings;

        return {
          city: city.name,
          municipalBody: city.municipalBody,
          state: city.state,
          resolutionPercentage,
          averageResponseTime,
          communityRatings,
          score
        };
      }).sort((a, b) => b.score - a.score);

      setMunicipalRankings(computedMunicipals);
      localStorage.setItem(CACHE_MUNICIPALS_KEY, JSON.stringify(computedMunicipals));
      setLoading(false);
    };

    // Subscriptions setup
    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      const reports: Report[] = [];
      snap.forEach(docSnap => {
        reports.push({ id: docSnap.id, ...docSnap.data() } as Report);
      });
      reportsList = reports;
      recalculateRankings();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'reports');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const users: UserProfile[] = [];
      snap.forEach(docSnap => {
        users.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      usersList = users;
      recalculateRankings();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    return () => {
      unsubReports();
      unsubUsers();
    };
  }, []);

  return {
    citizenRankings,
    municipalRankings,
    loading
  };
}
