"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { calculateAge, validateHandleFormat, normalizeHandle, setHandleAtomically } from "@/lib/utils";
import { calculateCompleteMacros, calculateMacrosFromPercentages, calculateTargetCalories, calculateBMR, calculateTDEE, type ActivityLevel, type GoalType, type Gender } from "@/lib/tdee-calculator";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, AlertCircle, Search, X } from "lucide-react";

interface Coach {
  coach_id: string;
  coach_name: string;
  coach_persona: string;
  coach_picture: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, updateProfile } = useAuth();
  const [step, setStep] = useState(0); // Start at 0, will adjust based on DOB status
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  
  // Check if date of birth is missing (for Google sign-ups)
  // Use a ref to track the initial state to prevent step counter from changing mid-flow
  const initialNeedsDateOfBirth = useRef<boolean | null>(null);
  const needsDateOfBirth = !profile?.dateOfBirth;
  
  // Set initial state once
  useEffect(() => {
    if (initialNeedsDateOfBirth.current === null) {
      initialNeedsDateOfBirth.current = needsDateOfBirth;
    }
  }, [needsDateOfBirth]);
  
  // Use initial state for step counting to maintain consistency
  const useInitialStepCount = initialNeedsDateOfBirth.current ?? needsDateOfBirth;
  
  // Adjust step when profile loads (only on initial load, not when step changes)
  useEffect(() => {
    if (profile && !needsDateOfBirth && step === 0) {
      setStep(1); // Skip DOB step if already have it
    }
    // Only run this effect when profile or needsDateOfBirth changes, not when step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, needsDateOfBirth]);

  // Step 0: Date of Birth, Country, Timezone (only shown if missing)
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [country, setCountry] = useState("");
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [timezone, setTimezone] = useState("");

  // List of countries
  const countries = [
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Netherlands",
    "Belgium",
    "Switzerland",
    "Austria",
    "Sweden",
    "Norway",
    "Denmark",
    "Finland",
    "Poland",
    "Portugal",
    "Ireland",
    "Greece",
    "Czech Republic",
    "Romania",
    "Hungary",
    "New Zealand",
    "Japan",
    "South Korea",
    "China",
    "India",
    "Brazil",
    "Mexico",
    "Argentina",
    "Chile",
    "South Africa",
    "Egypt",
    "Turkey",
    "Russia",
    "Ukraine",
    "Israel",
    "Saudi Arabia",
    "United Arab Emirates",
    "Singapore",
    "Malaysia",
    "Thailand",
    "Philippines",
    "Indonesia",
    "Vietnam",
    "Other",
  ];

  // Filter countries based on search query
  const filteredCountries = countries.filter((c) =>
    c.toLowerCase().includes(countrySearchQuery.toLowerCase())
  );

  // Timezone mapping for display
  const timezoneMap: Record<string, string> = {
    "America/New_York": "Eastern Time (ET)",
    "America/Chicago": "Central Time (CT)",
    "America/Denver": "Mountain Time (MT)",
    "America/Los_Angeles": "Pacific Time (PT)",
    "America/Anchorage": "Alaska Time (AKT)",
    "Pacific/Honolulu": "Hawaii Time (HST)",
    "America/Toronto": "Toronto (EST/EDT)",
    "America/Vancouver": "Vancouver (PST/PDT)",
    "Europe/London": "London (GMT/BST)",
    "Europe/Paris": "Paris (CET/CEST)",
    "Europe/Berlin": "Berlin (CET/CEST)",
    "Europe/Rome": "Rome (CET/CEST)",
    "Europe/Madrid": "Madrid (CET/CEST)",
    "Europe/Amsterdam": "Amsterdam (CET/CEST)",
    "Europe/Brussels": "Brussels (CET/CEST)",
    "Europe/Zurich": "Zurich (CET/CEST)",
    "Europe/Vienna": "Vienna (CET/CEST)",
    "Europe/Stockholm": "Stockholm (CET/CEST)",
    "Europe/Oslo": "Oslo (CET/CEST)",
    "Europe/Copenhagen": "Copenhagen (CET/CEST)",
    "Europe/Helsinki": "Helsinki (EET/EEST)",
    "Europe/Warsaw": "Warsaw (CET/CEST)",
    "Europe/Lisbon": "Lisbon (WET/WEST)",
    "Europe/Dublin": "Dublin (GMT/IST)",
    "Europe/Athens": "Athens (EET/EEST)",
    "Europe/Prague": "Prague (CET/CEST)",
    "Europe/Budapest": "Budapest (CET/CEST)",
    "Europe/Bucharest": "Bucharest (EET/EEST)",
    "Australia/Sydney": "Sydney (AEST/AEDT)",
    "Australia/Melbourne": "Melbourne (AEST/AEDT)",
    "Australia/Brisbane": "Brisbane (AEST)",
    "Australia/Perth": "Perth (AWST)",
    "Australia/Adelaide": "Adelaide (ACST/ACDT)",
    "Pacific/Auckland": "Auckland (NZST/NZDT)",
    "Asia/Tokyo": "Tokyo (JST)",
    "Asia/Seoul": "Seoul (KST)",
    "Asia/Shanghai": "Shanghai (CST)",
    "Asia/Hong_Kong": "Hong Kong (HKT)",
    "Asia/Singapore": "Singapore (SGT)",
    "Asia/Kuala_Lumpur": "Kuala Lumpur (MYT)",
    "Asia/Bangkok": "Bangkok (ICT)",
    "Asia/Manila": "Manila (PHT)",
    "Asia/Jakarta": "Jakarta (WIB)",
    "Asia/Ho_Chi_Minh": "Ho Chi Minh (ICT)",
    "Asia/Dubai": "Dubai (GST)",
    "Asia/Riyadh": "Riyadh (AST)",
    "Asia/Jerusalem": "Jerusalem (IST/IDT)",
    "Asia/Kolkata": "Mumbai (IST)",
    "Asia/Dhaka": "Dhaka (BST)",
    "America/Sao_Paulo": "São Paulo (BRT/BRST)",
    "America/Buenos_Aires": "Buenos Aires (ART)",
    "America/Santiago": "Santiago (CLT/CLST)",
    "Africa/Johannesburg": "Johannesburg (SAST)",
    "Africa/Cairo": "Cairo (EET)",
    "Europe/Istanbul": "Istanbul (TRT)",
    "Europe/Moscow": "Moscow (MSK)",
    "Asia/Almaty": "Almaty (ALMT)",
  };

  // Country to timezone mapping for suggestions
  const countryToTimezone: Record<string, string> = {
    "United States": "America/New_York",
    "United Kingdom": "Europe/London",
    "Canada": "America/Toronto",
    "Australia": "Australia/Sydney",
    "Germany": "Europe/Berlin",
    "France": "Europe/Paris",
    "Italy": "Europe/Rome",
    "Spain": "Europe/Madrid",
    "Netherlands": "Europe/Amsterdam",
    "Belgium": "Europe/Brussels",
    "Switzerland": "Europe/Zurich",
    "Austria": "Europe/Vienna",
    "Sweden": "Europe/Stockholm",
    "Norway": "Europe/Oslo",
    "Denmark": "Europe/Copenhagen",
    "Finland": "Europe/Helsinki",
    "Poland": "Europe/Warsaw",
    "Portugal": "Europe/Lisbon",
    "Ireland": "Europe/Dublin",
    "Greece": "Europe/Athens",
    "Czech Republic": "Europe/Prague",
    "Romania": "Europe/Bucharest",
    "Hungary": "Europe/Budapest",
    "New Zealand": "Pacific/Auckland",
    "Japan": "Asia/Tokyo",
    "South Korea": "Asia/Seoul",
    "China": "Asia/Shanghai",
    "India": "Asia/Kolkata",
    "Brazil": "America/Sao_Paulo",
    "Mexico": "America/Mexico_City",
    "Argentina": "America/Buenos_Aires",
    "Chile": "America/Santiago",
    "South Africa": "Africa/Johannesburg",
    "Egypt": "Africa/Cairo",
    "Turkey": "Europe/Istanbul",
    "Russia": "Europe/Moscow",
    "Ukraine": "Europe/Kiev",
    "Israel": "Asia/Jerusalem",
    "Saudi Arabia": "Asia/Riyadh",
    "United Arab Emirates": "Asia/Dubai",
    "Singapore": "Asia/Singapore",
    "Malaysia": "Asia/Kuala_Lumpur",
    "Thailand": "Asia/Bangkok",
    "Philippines": "Asia/Manila",
    "Indonesia": "Asia/Jakarta",
    "Vietnam": "Asia/Ho_Chi_Minh",
  };

  // Step 1: Basic Info
  const [basicInfo, setBasicInfo] = useState({
    handle: "",
    weight: "",
    height: "",
  });
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);

  // Step 2: Goals & TDEE
  const [goalsInfo, setGoalsInfo] = useState({
    goalType: "" as GoalType | "",
    experienceLevel: "Novice" as "Novice" | "Beginner" | "Intermediate" | "Advanced" | "",
    bodyFatPercentage: "",
    activityLevel: "" as ActivityLevel | "",
    gender: "" as Gender | "",
  });

  // Experience level mapping for slider
  const experienceLevels = [
    { value: "Novice", label: "Novice", description: "New to fitness, just starting your journey" },
    { value: "Beginner", label: "Beginner", description: "Some experience, learning the basics" },
    { value: "Intermediate", label: "Intermediate", description: "Regular training, comfortable with most exercises" },
    { value: "Advanced", label: "Advanced", description: "Years of experience, advanced techniques" },
  ];

  // Get default body fat percentage based on gender
  const getDefaultBodyFat = (gender: Gender | ""): number => {
    if (gender === "Male") return 18; // Average for men
    if (gender === "Female") return 25; // Average for women
    return 20; // Default if gender not selected
  };

  // Step 3: Activity Goals
  const [activityGoals, setActivityGoals] = useState({
    workoutSessionsPerWeek: "",
    cardioSessionsPerWeek: "",
    waterGoal: "",
  });

  // Step 4: AI Coach
  const [coachInfo, setCoachInfo] = useState({
    coachId: "",
    coachIntensity: "" as "Low" | "Medium" | "High" | "Extreme" | "",
    skipCoach: "" as "none" | "later" | "build" | "",
  });

  // Calculated values
  const [calculatedMacros, setCalculatedMacros] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);

  // Macro adjustment state - default to moderate
  const [macroPreset, setMacroPreset] = useState<"moderate" | "lower" | "higher" | "custom">("moderate");
  const [customMacroPercentages, setCustomMacroPercentages] = useState({
    protein: 30,
    carbs: 35,
    fat: 35,
  });
  const [customCalories, setCustomCalories] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Carb presets: Protein/Fat/Carbs percentages
  const macroPresets = {
    moderate: { protein: 30, fat: 35, carbs: 35 },
    lower: { protein: 40, fat: 40, carbs: 20 },
    higher: { protein: 30, fat: 20, carbs: 50 },
  };
  
  // Calculate age from date of birth (use state if we're collecting it, otherwise use profile)
  const dobToUse = dateOfBirth || profile?.dateOfBirth || "";
  // Convert DD/MM/YYYY to YYYY-MM-DD for calculateAge function
  const convertToISOFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };
  const age = dobToUse ? calculateAge(convertToISOFormat(dobToUse)) : null;

  // Auto-detect timezone on component load
  useEffect(() => {
    if (!timezone && typeof window !== 'undefined' && needsDateOfBirth) {
      try {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Only set if it's a valid timezone from our list
        if (timezoneMap[detectedTimezone]) {
          setTimezone(detectedTimezone);
        }
      } catch (error) {
        console.error("Error detecting timezone:", error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDateOfBirth]);

  // Suggest timezone based on country selection
  useEffect(() => {
    if (country && !timezone && countryToTimezone[country]) {
      const suggestedTimezone = countryToTimezone[country];
      if (timezoneMap[suggestedTimezone]) {
        setTimezone(suggestedTimezone);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, timezone]);

  // Handle click outside country dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch coaches
  useEffect(() => {
    const fetchCoaches = async () => {
      if (!db) return;
      setLoadingCoaches(true);
      try {
        const coachesRef = collection(db, "coaches");
        const coachesSnap = await getDocs(coachesRef);
        const coachesList: Coach[] = [];
        coachesSnap.forEach((doc) => {
          coachesList.push(doc.data() as Coach);
        });
        setCoaches(coachesList);
      } catch (error) {
        console.error("Error fetching coaches:", error);
        toast.error("Failed to load coaches.");
      } finally {
        setLoadingCoaches(false);
      }
    };

    const currentStep = needsDateOfBirth ? step : step + 1;
    if (currentStep === 4) {
      fetchCoaches();
    }
  }, [needsDateOfBirth, step]);

  // Calculate TDEE and macros when relevant fields change
  useEffect(() => {
    if (
      step === 2 &&
      basicInfo.weight &&
      basicInfo.height &&
      age !== null &&
      goalsInfo.goalType &&
      goalsInfo.activityLevel &&
      goalsInfo.gender
    ) {
      try {
        const weight = parseFloat(basicInfo.weight);
        const height = parseFloat(basicInfo.height);
        
        // Calculate BMR and TDEE
        const bmr = calculateBMR(weight, height, age, goalsInfo.gender);
        const tdee = calculateTDEE(bmr, goalsInfo.activityLevel);
        const targetCalories = calculateTargetCalories(tdee, goalsInfo.goalType);
        
        // Determine which percentages to use
        let proteinPct: number;
        let carbPct: number;
        let fatPct: number;
        
        if (macroPreset === "custom") {
          // Use custom percentages
          proteinPct = customMacroPercentages.protein / 100;
          carbPct = customMacroPercentages.carbs / 100;
          fatPct = customMacroPercentages.fat / 100;
        } else if (macroPreset && macroPresets[macroPreset]) {
          // Use preset percentages
          const preset = macroPresets[macroPreset];
          proteinPct = preset.protein / 100;
          carbPct = preset.carbs / 100;
          fatPct = preset.fat / 100;
        } else {
          // Default: use original calculation method
          const macros = calculateCompleteMacros(
            weight,
            height,
            age,
            goalsInfo.gender,
            goalsInfo.activityLevel,
            goalsInfo.goalType
          );
          setCalculatedMacros(macros);
          return;
        }
        
        // Calculate macros from percentages
        const macros = calculateMacrosFromPercentages(
          targetCalories,
          proteinPct,
          carbPct,
          fatPct
        );
        setCalculatedMacros(macros);
      } catch (error) {
        console.error("Error calculating macros:", error);
        setCalculatedMacros(null);
      }
    }
  }, [needsDateOfBirth, step, basicInfo.weight, basicInfo.height, age, goalsInfo.goalType, goalsInfo.activityLevel, goalsInfo.gender, goalsInfo.bodyFatPercentage, macroPreset, customMacroPercentages, customCalories]);

  // Load existing profile data if available
  useEffect(() => {
    if (profile) {
      if (profile.dateOfBirth) {
        setDateOfBirth(profile.dateOfBirth);
        // Parse DD/MM/YYYY format
        const parts = profile.dateOfBirth.split('/');
        if (parts.length === 3) {
          setBirthDay(parts[0]);
          setBirthMonth(parts[1]);
          setBirthYear(parts[2]);
        }
      }
      if (profile.country) setCountry(profile.country);
      if (profile.timezone) setTimezone(profile.timezone);
      if (profile.handle) setBasicInfo(prev => ({ ...prev, handle: profile.handle || "" }));
      if (profile.weight) setBasicInfo(prev => ({ ...prev, weight: profile.weight?.toString() || "", height: profile.height?.toString() || "" }));
      if (profile.goals) {
        setGoalsInfo({
          goalType: profile.goals.goalType || "",
          experienceLevel: profile.experienceLevel || "Novice",
          bodyFatPercentage: profile.bodyFatPercentage?.toString() || "",
          activityLevel: profile.activityLevel || "",
          gender: (profile.gender as Gender) || "",
        });
        setActivityGoals({
          workoutSessionsPerWeek: profile.goals.workoutSessionsPerWeek?.toString() || "",
          cardioSessionsPerWeek: profile.goals.cardioSessionsPerWeek?.toString() || "",
          waterGoal: profile.goals.waterGoal?.toString() || "",
        });
      }
      if (profile.coachId) setCoachInfo((prev) => ({ ...prev, coachId: profile.coachId || "" }));
      if (profile.coachIntensity) setCoachInfo((prev) => ({ ...prev, coachIntensity: profile.coachIntensity || "" }));
      if ((profile as any).skipCoachReason) {
        setCoachInfo((prev) => ({ ...prev, skipCoach: (profile as any).skipCoachReason }));
      }
      // Load macro preferences
      if ((profile as any).macroPreset) {
        setMacroPreset((profile as any).macroPreset as typeof macroPreset);
        if ((profile as any).macroPreset === "custom" && (profile as any).customMacroPercentages) {
          setCustomMacroPercentages((profile as any).customMacroPercentages);
        } else if ((profile as any).macroPreset && macroPresets[(profile as any).macroPreset as keyof typeof macroPresets]) {
          setCustomMacroPercentages(macroPresets[(profile as any).macroPreset as keyof typeof macroPresets]);
        }
      }
    }
  }, [profile]);

  const handleNext = async () => {
    // Validation for each step
    if (needsDateOfBirth && step === 0) {
      // Step 0: Date of Birth, Country, Timezone (only if missing)
      if (!birthDay || !birthMonth || !birthYear) {
        toast.error("Please enter your complete date of birth");
        return;
      }
      // Validate day (1-31)
      const day = parseInt(birthDay, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        toast.error("Please enter a valid day (1-31)");
        return;
      }
      // Validate month (1-12)
      const month = parseInt(birthMonth, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        toast.error("Please enter a valid month (1-12)");
        return;
      }
      // Validate year (reasonable range)
      const year = parseInt(birthYear, 10);
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
        toast.error("Please enter a valid year");
        return;
      }
      // Validate that it's a valid date (e.g., not Feb 30)
      const dayPadded = birthDay.padStart(2, '0');
      const monthPadded = birthMonth.padStart(2, '0');
      const dateString = `${dayPadded}/${monthPadded}/${birthYear}`;
      // Convert DD/MM/YYYY to Date object (Date expects MM/DD/YYYY or YYYY-MM-DD)
      const date = new Date(`${year}-${monthPadded}-${dayPadded}`);
      if (isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() + 1 !== month) {
        toast.error("Please enter a valid date");
        return;
      }
      // Validate that the date is not in the future
      if (date > new Date()) {
        toast.error("Birthday cannot be in the future");
        return;
      }
      // Validate that the date is not too old (e.g., more than 150 years ago)
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 150);
      if (date < minDate) {
        toast.error("Please enter a valid birthday");
        return;
      }
      // Update dateOfBirth with the formatted string
      setDateOfBirth(dateString);
      if (!country) {
        toast.error("Please select your country");
        return;
      }
      if (!timezone) {
        toast.error("Please select your timezone");
        return;
      }
      // Save date of birth, country, and timezone immediately
      updateProfile({ dateOfBirth: dateString, country, timezone }).catch((error) => {
        console.error("Error saving profile information:", error);
        toast.error("Failed to save profile information. Please try again.");
      });
    } else if (step === 1 || (needsDateOfBirth && step === 1)) {
      // Validate handle
      if (!basicInfo.handle || basicInfo.handle.trim() === "") {
        toast.error("Please enter a handle");
        return;
      }
      const handleValidation = validateHandleFormat(basicInfo.handle);
      if (!handleValidation.isValid) {
        toast.error(handleValidation.error || "Invalid handle format");
        setHandleError(handleValidation.error || "Invalid handle format");
        return;
      }
      
      // Validate handle (uniqueness will be checked atomically when saving)
      setCheckingHandle(true);
      setHandleError(null);
      try {
        // Quick pre-check for better UX (non-atomic)
        const usersRef = collection(db, "users");
        const normalizedHandle = normalizeHandle(basicInfo.handle);
        const q = query(usersRef, where("handle", "==", normalizedHandle));
        const querySnapshot = await getDocs(q);
        const handleTaken = querySnapshot.docs.length > 0 && 
          (!user?.uid || !querySnapshot.docs.some(doc => doc.id === user.uid));
        
        if (handleTaken) {
          toast.error("This handle is already taken. Please choose another one.");
          setHandleError("This handle is already taken");
          setCheckingHandle(false);
          return;
        }
      } catch (error) {
        console.error("Error checking handle:", error);
        // Continue anyway - atomic check will happen on save
      }
      setCheckingHandle(false);
      
      if (!basicInfo.weight || !basicInfo.height) {
        toast.error("Please enter your weight and height");
        return;
      }
      if (isNaN(parseFloat(basicInfo.weight)) || parseFloat(basicInfo.weight) <= 0) {
        toast.error("Please enter a valid weight");
        return;
      }
      if (isNaN(parseFloat(basicInfo.height)) || parseFloat(basicInfo.height) <= 0) {
        toast.error("Please enter a valid height");
        return;
      }
      // Date of birth should be collected in step 0 if missing
      if (needsDateOfBirth && !dateOfBirth) {
        toast.error("Please go back and enter your date of birth first.");
        return;
      }
    } else if (step === 2) {
      if (!goalsInfo.goalType) {
        toast.error("Please select your goal");
        return;
      }
      if (!goalsInfo.experienceLevel) {
        toast.error("Please select your experience level");
        return;
      }
      if (!goalsInfo.activityLevel) {
        toast.error("Please select your activity level");
        return;
      }
      if (!goalsInfo.gender) {
        toast.error("Please select your gender");
        return;
      }
      if (!calculatedMacros) {
        toast.error("Unable to calculate macros. Please check your inputs.");
        return;
      }
    } else if (step === 3) {
      if (!activityGoals.workoutSessionsPerWeek || isNaN(parseInt(activityGoals.workoutSessionsPerWeek))) {
        toast.error("Please enter a valid number of workout sessions per week");
        return;
      }
      if (!activityGoals.cardioSessionsPerWeek || isNaN(parseInt(activityGoals.cardioSessionsPerWeek))) {
        toast.error("Please enter a valid number of cardio sessions per week");
        return;
      }
      if (!activityGoals.waterGoal || isNaN(parseFloat(activityGoals.waterGoal))) {
        toast.error("Please enter a valid daily water goal");
        return;
      }
    } else if (step === 4) {
      if (!coachInfo.skipCoach && !coachInfo.coachId) {
        toast.error("Please select an AI coach or choose an option");
        return;
      }
      if (!coachInfo.skipCoach && !coachInfo.coachIntensity) {
        toast.error("Please select coach intensity");
        return;
      }
    }

    const maxStep = needsDateOfBirth ? 4 : 4;
    if (step < maxStep) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    const minStep = needsDateOfBirth ? 0 : 1;
    if (step > minStep) {
      setStep(step - 1);
    }
  };

  const handleFinish = async () => {
    if (!user || !calculatedMacros) return;

    setLoading(true);
    try {
      // Set handle atomically first to ensure uniqueness
      await setHandleAtomically(user.uid, basicInfo.handle);
      
      // Prepare profile update
      const profileUpdate: any = {
        handle: normalizeHandle(basicInfo.handle),
        weight: parseFloat(basicInfo.weight),
        height: parseFloat(basicInfo.height),
        experienceLevel: goalsInfo.experienceLevel,
        activityLevel: goalsInfo.activityLevel,
        onboardingCompleted: true,
      };

      // Include date of birth, country, and timezone if we collected them
      if (dateOfBirth) {
        profileUpdate.dateOfBirth = dateOfBirth;
      }
      if (country) {
        profileUpdate.country = country;
      }
      if (timezone) {
        profileUpdate.timezone = timezone;
      }

      // Use default body fat if not provided
      const bodyFat = goalsInfo.bodyFatPercentage 
        ? parseFloat(goalsInfo.bodyFatPercentage) 
        : getDefaultBodyFat(goalsInfo.gender);
      profileUpdate.bodyFatPercentage = bodyFat;

      // Add coach info if not skipped
      if (!coachInfo.skipCoach) {
        profileUpdate.coachId = coachInfo.coachId;
        profileUpdate.coachIntensity = coachInfo.coachIntensity;
      } else {
        // Save the skip reason
        profileUpdate.skipCoachReason = coachInfo.skipCoach;
      }

      // Add gender
      profileUpdate.gender = goalsInfo.gender;

      // Add goals
      const finalCalories = (macroPreset === "custom" && customCalories !== null) ? customCalories : calculatedMacros.calories;
      profileUpdate.goals = {
        goalType: goalsInfo.goalType,
        calorieLimit: finalCalories,
        proteinGoal: calculatedMacros.protein,
        carbGoal: calculatedMacros.carbs,
        fatGoal: calculatedMacros.fat,
        workoutSessionsPerWeek: parseInt(activityGoals.workoutSessionsPerWeek),
        cardioSessionsPerWeek: parseInt(activityGoals.cardioSessionsPerWeek),
        startingWeight: parseFloat(basicInfo.weight),
        waterGoal: parseFloat(activityGoals.waterGoal),
      };

      // Save macro preferences if set
      if (macroPreset) {
        profileUpdate.macroPreset = macroPreset;
        if (macroPreset === "custom") {
          profileUpdate.customMacroPercentages = customMacroPercentages;
          if (customCalories !== null) {
            profileUpdate.customCalories = customCalories;
          }
        }
      }

      await updateProfile(profileUpdate);
      toast.success("Onboarding completed! Welcome to your coaching app.");
      router.push("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="pt-6">
            <p>Please log in to complete onboarding.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome! Let's set up your profile</CardTitle>
          <CardDescription>
            {useInitialStepCount 
              ? `Step ${step + 1} of 5` 
              : `Step ${step} of 4`}
          </CardDescription>
          {/* Progress indicator */}
          <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, useInitialStepCount 
                  ? ((step + 1) / 5) * 100 
                  : (step / 4) * 100)}%` 
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 0: Date of Birth, Country, Timezone (only if missing) */}
          {needsDateOfBirth && step === 0 && (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-6">
                <p className="text-lg font-semibold">Almost there!</p>
                <p className="text-sm text-muted-foreground">
                  We just need a few more details to personalize your experience.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Birthday</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="birth-day" className="text-xs text-muted-foreground">Day</Label>
                    <Input
                      id="birth-day"
                      type="text"
                      placeholder="DD"
                      value={birthDay}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setBirthDay(value);
                        if (value && birthMonth && birthYear) {
                          const day = value.padStart(2, '0');
                          const month = birthMonth.padStart(2, '0');
                          setDateOfBirth(`${day}/${month}/${birthYear}`);
                        } else {
                          setDateOfBirth("");
                        }
                      }}
                      maxLength={2}
                      className="text-lg text-center"
                    />
                  </div>
                  <div className="pt-6 text-lg font-semibold">/</div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="birth-month" className="text-xs text-muted-foreground">Month</Label>
                    <Input
                      id="birth-month"
                      type="text"
                      placeholder="MM"
                      value={birthMonth}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setBirthMonth(value);
                        if (birthDay && value && birthYear) {
                          const day = birthDay.padStart(2, '0');
                          const month = value.padStart(2, '0');
                          setDateOfBirth(`${day}/${month}/${birthYear}`);
                        } else {
                          setDateOfBirth("");
                        }
                      }}
                      maxLength={2}
                      className="text-lg text-center"
                    />
                  </div>
                  <div className="pt-6 text-lg font-semibold">/</div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="birth-year" className="text-xs text-muted-foreground">Year</Label>
                    <Input
                      id="birth-year"
                      type="text"
                      placeholder="YYYY"
                      value={birthYear}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setBirthYear(value);
                        if (birthDay && birthMonth && value) {
                          const day = birthDay.padStart(2, '0');
                          const month = birthMonth.padStart(2, '0');
                          setDateOfBirth(`${day}/${month}/${value}`);
                        } else {
                          setDateOfBirth("");
                        }
                      }}
                      maxLength={4}
                      className="text-lg text-center"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <div className="relative" ref={countryDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="country"
                      type="text"
                      placeholder="Search for your country..."
                      value={country && !showCountryDropdown ? country : countrySearchQuery}
                      onChange={(e) => {
                        setCountrySearchQuery(e.target.value);
                        setShowCountryDropdown(true);
                        if (country) {
                          setCountry("");
                        }
                      }}
                      onFocus={() => {
                        setShowCountryDropdown(true);
                        if (country) {
                          setCountrySearchQuery("");
                        }
                      }}
                      className="pl-10 pr-10"
                      required
                    />
                    {country && !showCountryDropdown && (
                      <button
                        type="button"
                        onClick={() => {
                          setCountry("");
                          setCountrySearchQuery("");
                          setShowCountryDropdown(true);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {showCountryDropdown && countrySearchQuery && filteredCountries.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-auto">
                      {filteredCountries.map((countryName) => (
                        <button
                          key={countryName}
                          type="button"
                          onClick={() => {
                            setCountry(countryName);
                            setCountrySearchQuery("");
                            setShowCountryDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          {countryName}
                        </button>
                      ))}
                    </div>
                  )}
                  {showCountryDropdown && countrySearchQuery && filteredCountries.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-4 text-center text-muted-foreground">
                      No countries found
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                {timezone ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Detected timezone:</p>
                        <p className="font-medium text-sm">
                          {timezoneMap[timezone] || timezone}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setTimezone("")}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Select value={timezone} onValueChange={setTimezone} required>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select your timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii Time (HST)</SelectItem>
                    <SelectItem value="America/Toronto">Toronto (EST/EDT)</SelectItem>
                    <SelectItem value="America/Vancouver">Vancouver (PST/PDT)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Berlin">Berlin (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Rome">Rome (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Madrid">Madrid (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Amsterdam">Amsterdam (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Brussels">Brussels (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Zurich">Zurich (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Vienna">Vienna (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Stockholm">Stockholm (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Oslo">Oslo (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Copenhagen">Copenhagen (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Helsinki">Helsinki (EET/EEST)</SelectItem>
                    <SelectItem value="Europe/Warsaw">Warsaw (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Lisbon">Lisbon (WET/WEST)</SelectItem>
                    <SelectItem value="Europe/Dublin">Dublin (GMT/IST)</SelectItem>
                    <SelectItem value="Europe/Athens">Athens (EET/EEST)</SelectItem>
                    <SelectItem value="Europe/Prague">Prague (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Budapest">Budapest (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Bucharest">Bucharest (EET/EEST)</SelectItem>
                    <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Melbourne">Melbourne (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Brisbane">Brisbane (AEST)</SelectItem>
                    <SelectItem value="Australia/Perth">Perth (AWST)</SelectItem>
                    <SelectItem value="Australia/Adelaide">Adelaide (ACST/ACDT)</SelectItem>
                    <SelectItem value="Pacific/Auckland">Auckland (NZST/NZDT)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    <SelectItem value="Asia/Seoul">Seoul (KST)</SelectItem>
                    <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                    <SelectItem value="Asia/Hong_Kong">Hong Kong (HKT)</SelectItem>
                    <SelectItem value="Asia/Singapore">Singapore (SGT)</SelectItem>
                    <SelectItem value="Asia/Kuala_Lumpur">Kuala Lumpur (MYT)</SelectItem>
                    <SelectItem value="Asia/Bangkok">Bangkok (ICT)</SelectItem>
                    <SelectItem value="Asia/Manila">Manila (PHT)</SelectItem>
                    <SelectItem value="Asia/Jakarta">Jakarta (WIB)</SelectItem>
                    <SelectItem value="Asia/Ho_Chi_Minh">Ho Chi Minh (ICT)</SelectItem>
                    <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                    <SelectItem value="Asia/Riyadh">Riyadh (AST)</SelectItem>
                    <SelectItem value="Asia/Jerusalem">Jerusalem (IST/IDT)</SelectItem>
                    <SelectItem value="Asia/Kolkata">Mumbai (IST)</SelectItem>
                    <SelectItem value="Asia/Dhaka">Dhaka (BST)</SelectItem>
                    <SelectItem value="America/Sao_Paulo">São Paulo (BRT/BRST)</SelectItem>
                    <SelectItem value="America/Buenos_Aires">Buenos Aires (ART)</SelectItem>
                    <SelectItem value="America/Santiago">Santiago (CLT/CLST)</SelectItem>
                    <SelectItem value="Africa/Johannesburg">Johannesburg (SAST)</SelectItem>
                    <SelectItem value="Africa/Cairo">Cairo (EET)</SelectItem>
                    <SelectItem value="Europe/Istanbul">Istanbul (TRT)</SelectItem>
                    <SelectItem value="Europe/Moscow">Moscow (MSK)</SelectItem>
                    <SelectItem value="Asia/Almaty">Almaty (ALMT)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {((needsDateOfBirth && step === 1) || (!needsDateOfBirth && step === 1)) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="handle">Handle</Label>
                <div className="relative">
                  <Input
                    id="handle"
                    type="text"
                    placeholder="@username"
                    value={basicInfo.handle}
                    onChange={(e) => {
                      setBasicInfo({ ...basicInfo, handle: e.target.value });
                      setHandleError(null);
                    }}
                    onBlur={async () => {
                      if (basicInfo.handle && basicInfo.handle.trim() !== "" && user) {
                        const validation = validateHandleFormat(basicInfo.handle);
                        if (!validation.isValid) {
                          setHandleError(validation.error || "Invalid handle format");
                          return;
                        }
                        setCheckingHandle(true);
                        try {
                          // Quick check for UI feedback (non-atomic)
                          const usersRef = collection(db, "users");
                          const normalizedHandle = normalizeHandle(basicInfo.handle);
                          const q = query(usersRef, where("handle", "==", normalizedHandle));
                          const querySnapshot = await getDocs(q);
                          const handleTaken = querySnapshot.docs.length > 0 && 
                            !querySnapshot.docs.some(doc => doc.id === user.uid);
                          
                          if (handleTaken) {
                            setHandleError("This handle is already taken");
                          } else {
                            setHandleError(null);
                          }
                        } catch (error) {
                          // Silently fail on blur - atomic check will happen on save
                          setHandleError(null);
                        } finally {
                          setCheckingHandle(false);
                        }
                      }
                    }}
                    className={handleError ? "border-destructive" : ""}
                  />
                  {checkingHandle && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      Checking...
                    </span>
                  )}
                </div>
                {handleError && (
                  <p className="text-xs text-destructive">{handleError}</p>
                )}
                {!handleError && basicInfo.handle && (
                  <p className="text-xs text-muted-foreground">
                    Your handle will be displayed as {normalizeHandle(basicInfo.handle)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Choose a unique handle that others can use to find you. Must be 3-30 characters, start with a letter, and contain only letters, numbers, and underscores.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="70"
                  value={basicInfo.weight}
                  onChange={(e) => setBasicInfo({ ...basicInfo, weight: e.target.value })}
                  min="1"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="175"
                  value={basicInfo.height}
                  onChange={(e) => setBasicInfo({ ...basicInfo, height: e.target.value })}
                  min="1"
                  step="0.1"
                />
              </div>
            </div>
          )}

          {/* Step 2: Goals & TDEE Calculator */}
          {((needsDateOfBirth && step === 2) || (!needsDateOfBirth && step === 2)) && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <RadioGroup
                    value={goalsInfo.goalType}
                    onValueChange={(value) => setGoalsInfo({ ...goalsInfo, goalType: value as GoalType })}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      {(["Lose Weight", "Gain Weight", "Gain Strength", "Maintain"] as GoalType[]).map((goal) => (
                        <Card
                          key={goal}
                          className={`cursor-pointer transition-all ${
                            goalsInfo.goalType === goal
                              ? "border-primary bg-primary/5 shadow-md"
                              : "hover:border-primary/50 hover:shadow-sm"
                          }`}
                          onClick={() => setGoalsInfo({ ...goalsInfo, goalType: goal })}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value={goal}
                                id={`goal-${goal.toLowerCase().replace(/\s+/g, "-")}`}
                                className="pointer-events-none"
                              />
                              <Label
                                htmlFor={`goal-${goal.toLowerCase().replace(/\s+/g, "-")}`}
                                className="cursor-pointer font-medium flex-1"
                              >
                                {goal}
                              </Label>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-4">
                  <Label>Experience Level</Label>
                  <div className="space-y-3">
                    <Slider
                      value={[
                        experienceLevels.findIndex((level) => level.value === goalsInfo.experienceLevel) !== -1
                          ? experienceLevels.findIndex((level) => level.value === goalsInfo.experienceLevel)
                          : 0
                      ]}
                      onValueChange={(value) => {
                        const selectedLevel = experienceLevels[value[0]];
                        if (selectedLevel) {
                          setGoalsInfo({ ...goalsInfo, experienceLevel: selectedLevel.value as typeof goalsInfo.experienceLevel });
                        }
                      }}
                      min={0}
                      max={experienceLevels.length - 1}
                      step={1}
                      className="w-full"
                    />
                    <div className="space-y-2">
                      {goalsInfo.experienceLevel ? (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="font-medium text-sm">{experienceLevels.find((l) => l.value === goalsInfo.experienceLevel)?.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {experienceLevels.find((l) => l.value === goalsInfo.experienceLevel)?.description}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Select your experience level using the slider above</p>
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      {experienceLevels.map((level, index) => (
                        <span key={level.value} className={goalsInfo.experienceLevel === level.value ? "font-medium text-foreground" : ""}>
                          {level.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup
                    value={goalsInfo.gender}
                    onValueChange={(value) => setGoalsInfo({ ...goalsInfo, gender: value as Gender })}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      {(["Male", "Female"] as Gender[]).map((gender) => (
                        <Card
                          key={gender}
                          className={`cursor-pointer transition-all ${
                            goalsInfo.gender === gender
                              ? "border-primary bg-primary/5 shadow-md"
                              : "hover:border-primary/50 hover:shadow-sm"
                          }`}
                          onClick={() => setGoalsInfo({ ...goalsInfo, gender })}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value={gender}
                                id={`gender-${gender.toLowerCase()}`}
                                className="pointer-events-none"
                              />
                              <Label
                                htmlFor={`gender-${gender.toLowerCase()}`}
                                className="cursor-pointer font-medium flex-1"
                              >
                                {gender}
                              </Label>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activity-level">Activity Level</Label>
                  <Select
                    value={goalsInfo.activityLevel}
                    onValueChange={(value) =>
                      setGoalsInfo({ ...goalsInfo, activityLevel: value as ActivityLevel })
                    }
                  >
                    <SelectTrigger id="activity-level">
                      <SelectValue placeholder="Select activity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sedentary">Sedentary (little or no exercise)</SelectItem>
                      <SelectItem value="Lightly Active">Lightly Active (light exercise 1-3 days/week)</SelectItem>
                      <SelectItem value="Moderately Active">Moderately Active (moderate exercise 3-5 days/week)</SelectItem>
                      <SelectItem value="Very Active">Very Active (hard exercise 6-7 days/week)</SelectItem>
                      <SelectItem value="Extremely Active">Extremely Active (very hard exercise, physical job)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bodyfat">Body Fat Percentage (optional)</Label>
                  <Input
                    id="bodyfat"
                    type="number"
                    placeholder={goalsInfo.gender ? getDefaultBodyFat(goalsInfo.gender).toString() : "20"}
                    value={goalsInfo.bodyFatPercentage}
                    onChange={(e) => setGoalsInfo({ ...goalsInfo, bodyFatPercentage: e.target.value })}
                    min="0"
                    max="50"
                    step="0.1"
                  />
                </div>
              </div>

              {/* TDEE Calculator Results */}
              {calculatedMacros && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-lg">Your Calculated Macros</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Default Display - Show current preset */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {macroPreset === "moderate" ? "Moderate Carb" : macroPreset === "lower" ? "Lower Carb" : macroPreset === "higher" ? "Higher Carb" : "Custom"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {macroPreset === "custom" 
                            ? `${customMacroPercentages.protein}% Protein, ${customMacroPercentages.carbs}% Carbs, ${customMacroPercentages.fat}% Fat`
                            : `${macroPresets[macroPreset]?.protein || 0}% Protein, ${macroPresets[macroPreset]?.carbs || 0}% Carbs, ${macroPresets[macroPreset]?.fat || 0}% Fat`}
                        </p>
                      </div>
                    </div>

                    {/* Advanced Options Accordion */}
                    <Accordion type="single" collapsible value={showAdvanced ? "advanced" : ""} onValueChange={(value) => setShowAdvanced(value === "advanced")}>
                      <AccordionItem value="advanced" className="border-none">
                        <AccordionTrigger className="py-2 text-sm">
                          Show Advanced
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                          {/* Macro Preset Selector */}
                          <div className="space-y-2">
                            <Label>Macro Distribution</Label>
                            <div className="grid grid-cols-4 gap-2">
                              {(["moderate", "lower", "higher", "custom"] as const).map((preset) => (
                                <Card
                                  key={preset}
                                  className={`cursor-pointer transition-all ${
                                    macroPreset === preset
                                      ? "border-primary bg-primary/5 shadow-md"
                                      : "hover:border-primary/50 hover:shadow-sm"
                                  }`}
                                  onClick={() => {
                                    setMacroPreset(preset);
                                    if (preset !== "custom" && macroPresets[preset]) {
                                      setCustomMacroPercentages(macroPresets[preset]);
                                      setCustomCalories(null); // Reset custom calories when switching presets
                                    }
                                  }}
                                >
                                  <CardContent className="p-3">
                                    <p className="text-sm font-medium text-center capitalize">
                                      {preset === "moderate" ? "Moderate Carb" : preset === "lower" ? "Lower Carb" : preset === "higher" ? "Higher Carb" : "Custom"}
                                    </p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* Custom Macro Adjustment (shown when custom is selected) */}
                          {macroPreset === "custom" && (
                            <div className="space-y-4 p-4 bg-muted/50 rounded-md">
                              {/* Custom Calorie Adjustment */}
                              <div className="space-y-2 pb-4 border-b">
                                <div className="flex justify-between items-center">
                                  <Label>Daily Calories</Label>
                                  <span className="text-sm text-muted-foreground">
                                    {customCalories !== null ? customCalories : calculatedMacros.calories} cal
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  <Slider
                                    value={[customCalories !== null ? customCalories : calculatedMacros.calories]}
                                    onValueChange={(value) => {
                                      const newCalories = value[0];
                                      setCustomCalories(newCalories);
                                    }}
                                    min={Math.max(1200, calculatedMacros.calories - 500)}
                                    max={calculatedMacros.calories + 500}
                                    step={50}
                                    className="w-full"
                                  />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{Math.max(1200, calculatedMacros.calories - 500)}</span>
                                    <span>Base: {calculatedMacros.calories}</span>
                                    <span>{calculatedMacros.calories + 500}</span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={() => {
                                      if (!goalsInfo.gender || !goalsInfo.activityLevel || !goalsInfo.goalType) {
                                        toast.error("Please fill in all required fields (gender, activity level, goal type)");
                                        return;
                                      }
                                      const weight = parseFloat(basicInfo.weight);
                                      const height = parseFloat(basicInfo.height);
                                      const bmr = calculateBMR(weight, height, age!, goalsInfo.gender as Gender);
                                      const tdee = calculateTDEE(bmr, goalsInfo.activityLevel as ActivityLevel);
                                      const baseCalories = calculateTargetCalories(tdee, goalsInfo.goalType as GoalType);
                                      setCustomCalories(baseCalories);
                                    }}
                                  >
                                    Reset to Calculated
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label>Protein: {customMacroPercentages.protein}%</Label>
                              <span className="text-sm text-muted-foreground">
                                {Math.round(((customCalories !== null ? customCalories : calculatedMacros.calories) * customMacroPercentages.protein / 100) / 4)}g
                              </span>
                            </div>
                            <Slider
                              value={[customMacroPercentages.protein]}
                              onValueChange={(value) => {
                                const newProtein = Math.max(10, Math.min(60, value[0]));
                                const remaining = 100 - newProtein;
                                const currentCarbs = customMacroPercentages.carbs;
                                const currentFat = customMacroPercentages.fat;
                                const totalOther = currentCarbs + currentFat;
                                
                                if (totalOther > 0 && remaining >= 20) { // Ensure at least 20% for carbs+fat
                                  // Proportionally adjust carbs and fat
                                  let newCarbs = Math.round((remaining * currentCarbs) / totalOther);
                                  let newFat = remaining - newCarbs;
                                  
                                  // Ensure minimums
                                  const minCarbs = 5;
                                  const minFat = 15;
                                  
                                  // Adjust if minimums violated
                                  if (newCarbs < minCarbs) {
                                    newCarbs = minCarbs;
                                    newFat = remaining - newCarbs;
                                  }
                                  if (newFat < minFat) {
                                    newFat = minFat;
                                    newCarbs = remaining - newFat;
                                  }
                                  
                                  if (newCarbs >= minCarbs && newFat >= minFat) {
                                    setCustomMacroPercentages({
                                      protein: newProtein,
                                      carbs: newCarbs,
                                      fat: newFat,
                                    });
                                  }
                                }
                              }}
                              min={10}
                              max={60}
                              step={1}
                              className="w-full"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label>Carbs: {customMacroPercentages.carbs}%</Label>
                              <span className="text-sm text-muted-foreground">
                                {Math.round(((customCalories !== null ? customCalories : calculatedMacros.calories) * customMacroPercentages.carbs / 100) / 4)}g
                              </span>
                            </div>
                            <Slider
                              value={[customMacroPercentages.carbs]}
                              onValueChange={(value) => {
                                const newCarbs = Math.max(5, Math.min(70, value[0]));
                                const remaining = 100 - newCarbs;
                                const currentProtein = customMacroPercentages.protein;
                                const currentFat = customMacroPercentages.fat;
                                const totalOther = currentProtein + currentFat;
                                
                                if (totalOther > 0 && remaining >= 25) { // Ensure at least 25% for protein+fat
                                  let newProtein = Math.round((remaining * currentProtein) / totalOther);
                                  let newFat = remaining - newProtein;
                                  
                                  const minProtein = 10;
                                  const minFat = 15;
                                  
                                  // Adjust if minimums violated
                                  if (newProtein < minProtein) {
                                    newProtein = minProtein;
                                    newFat = remaining - newProtein;
                                  }
                                  if (newFat < minFat) {
                                    newFat = minFat;
                                    newProtein = remaining - newFat;
                                  }
                                  
                                  if (newProtein >= minProtein && newFat >= minFat) {
                                    setCustomMacroPercentages({
                                      protein: newProtein,
                                      carbs: newCarbs,
                                      fat: newFat,
                                    });
                                  }
                                }
                              }}
                              min={5}
                              max={70}
                              step={1}
                              className="w-full"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label>Fat: {customMacroPercentages.fat}%</Label>
                              <span className="text-sm text-muted-foreground">
                                {Math.round(((customCalories !== null ? customCalories : calculatedMacros.calories) * customMacroPercentages.fat / 100) / 9)}g
                              </span>
                            </div>
                            <Slider
                              value={[customMacroPercentages.fat]}
                              onValueChange={(value) => {
                                const newFat = Math.max(15, Math.min(60, value[0]));
                                const remaining = 100 - newFat;
                                const currentProtein = customMacroPercentages.protein;
                                const currentCarbs = customMacroPercentages.carbs;
                                const totalOther = currentProtein + currentCarbs;
                                
                                if (totalOther > 0 && remaining >= 15) { // Ensure at least 15% for protein+carbs
                                  let newProtein = Math.round((remaining * currentProtein) / totalOther);
                                  let newCarbs = remaining - newProtein;
                                  
                                  const minProtein = 10;
                                  const minCarbs = 5;
                                  
                                  // Adjust if minimums violated
                                  if (newProtein < minProtein) {
                                    newProtein = minProtein;
                                    newCarbs = remaining - newProtein;
                                  }
                                  if (newCarbs < minCarbs) {
                                    newCarbs = minCarbs;
                                    newProtein = remaining - newCarbs;
                                  }
                                  
                                  if (newProtein >= minProtein && newCarbs >= minCarbs) {
                                    setCustomMacroPercentages({
                                      protein: newProtein,
                                      carbs: newCarbs,
                                      fat: newFat,
                                    });
                                  }
                                }
                              }}
                              min={15}
                              max={60}
                              step={1}
                              className="w-full"
                            />
                          </div>
                          
                          {/* Total validation */}
                          <div className="pt-2 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Total:</span>
                              <span className={`text-sm font-bold ${
                                customMacroPercentages.protein + customMacroPercentages.carbs + customMacroPercentages.fat === 100
                                  ? "text-green-600"
                                  : "text-destructive"
                              }`}>
                                {customMacroPercentages.protein + customMacroPercentages.carbs + customMacroPercentages.fat}%
                              </span>
                            </div>
                            {customMacroPercentages.protein + customMacroPercentages.carbs + customMacroPercentages.fat !== 100 && (
                              <p className="text-xs text-destructive mt-1">
                                Percentages must equal 100%
                              </p>
                            )}
                          </div>
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Macro Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Daily Calories</p>
                        <p className="text-2xl font-bold">{customCalories !== null && macroPreset === "custom" ? customCalories : calculatedMacros.calories}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Protein</p>
                        <p className="text-2xl font-bold">{calculatedMacros.protein}g</p>
                        {macroPreset && (
                          <p className="text-xs text-muted-foreground">
                            {macroPreset === "custom" 
                              ? `${customMacroPercentages.protein}%` 
                              : `${macroPresets[macroPreset]?.protein || 0}%`}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Carbs</p>
                        <p className="text-2xl font-bold">{calculatedMacros.carbs}g</p>
                        {macroPreset && (
                          <p className="text-xs text-muted-foreground">
                            {macroPreset === "custom" 
                              ? `${customMacroPercentages.carbs}%` 
                              : `${macroPresets[macroPreset]?.carbs || 0}%`}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fat</p>
                        <p className="text-2xl font-bold">{calculatedMacros.fat}g</p>
                        {macroPreset && (
                          <p className="text-xs text-muted-foreground">
                            {macroPreset === "custom" 
                              ? `${customMacroPercentages.fat}%` 
                              : `${macroPresets[macroPreset]?.fat || 0}%`}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Activity Goals */}
          {((needsDateOfBirth && step === 3) || (!needsDateOfBirth && step === 3)) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workouts">Workout Sessions per Week</Label>
                <Input
                  id="workouts"
                  type="number"
                  placeholder="4"
                  value={activityGoals.workoutSessionsPerWeek}
                  onChange={(e) =>
                    setActivityGoals({ ...activityGoals, workoutSessionsPerWeek: e.target.value })
                  }
                  min="0"
                  max="14"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardio">Cardio Sessions per Week</Label>
                <Input
                  id="cardio"
                  type="number"
                  placeholder="3"
                  value={activityGoals.cardioSessionsPerWeek}
                  onChange={(e) =>
                    setActivityGoals({ ...activityGoals, cardioSessionsPerWeek: e.target.value })
                  }
                  min="0"
                  max="14"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="water">Daily Water Goal (Liters)</Label>
                <Input
                  id="water"
                  type="number"
                  placeholder="2.5"
                  value={activityGoals.waterGoal}
                  onChange={(e) => setActivityGoals({ ...activityGoals, waterGoal: e.target.value })}
                  min="0"
                  max="10"
                  step="0.1"
                />
              </div>
            </div>
          )}

          {/* Step 4: AI Coach */}
          {((needsDateOfBirth && step === 4) || (!needsDateOfBirth && step === 4)) && (
            <div className="space-y-6">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                      AI Coach Disclaimer
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Your AI Coach is an artificial intelligence system and not a real person. The coaching messages
                      are generated based on your data and are for informational purposes only. Always consult with a
                      healthcare professional before making significant changes to your diet or exercise routine.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>AI Coach Selection</Label>
                  <RadioGroup
                    value={coachInfo.skipCoach || "coach"}
                    onValueChange={(value) => {
                      if (value === "coach") {
                        setCoachInfo({ ...coachInfo, skipCoach: "" });
                      } else {
                        setCoachInfo({ ...coachInfo, skipCoach: value as "none" | "later" | "build", coachId: "", coachIntensity: "" });
                      }
                    }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="coach" id="coach-option" />
                        <Label htmlFor="coach-option" className="cursor-pointer font-normal">
                          I want an AI Coach
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="none" id="skip-none" />
                        <Label htmlFor="skip-none" className="cursor-pointer font-normal">
                          I don't want an AI Coach
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="later" id="skip-later" />
                        <Label htmlFor="skip-later" className="cursor-pointer font-normal">
                          I'll decide later
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="build" id="skip-build" />
                        <Label htmlFor="skip-build" className="cursor-pointer font-normal">
                          I want to build my own
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {!coachInfo.skipCoach && (
                  <>
                    <div className="space-y-2">
                      <Label>Choose your AI Coach</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        You can change this at any time from your profile
                      </p>
                      {loadingCoaches ? (
                        <p className="text-sm text-muted-foreground">Loading coaches...</p>
                      ) : coaches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No coaches available</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {coaches.map((coach) => (
                            <Card
                              key={coach.coach_id}
                              className={`cursor-pointer transition-all ${
                                coachInfo.coachId === coach.coach_id
                                  ? "border-primary bg-primary/5"
                                  : "hover:border-primary/50"
                              }`}
                              onClick={() => setCoachInfo({ ...coachInfo, coachId: coach.coach_id })}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <Avatar>
                                    <AvatarImage src={coach.coach_picture} alt={coach.coach_name} />
                                    <AvatarFallback>{coach.coach_name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold mb-1">{coach.coach_name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      {coach.coach_persona}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="intensity">Coach Intensity</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        You can change this at any time from your profile
                      </p>
                      <Select
                        value={coachInfo.coachIntensity}
                        onValueChange={(value) =>
                          setCoachInfo({
                            ...coachInfo,
                            coachIntensity: value as typeof coachInfo.coachIntensity,
                          })
                        }
                      >
                        <SelectTrigger id="intensity">
                          <SelectValue placeholder="Select coach intensity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low - Supportive and gentle</SelectItem>
                          <SelectItem value="Medium">Medium - Balanced approach</SelectItem>
                          <SelectItem value="High">High - Direct and motivational</SelectItem>
                          <SelectItem value="Extreme">Extreme - Very intense and demanding</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Disclaimer for Extreme intensity */}
                      {coachInfo.coachIntensity === "Extreme" && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">
                                Extreme Intensity Warning
                              </p>
                              <p className="text-xs text-red-700 dark:text-red-300">
                                Extreme intensity coaching is very demanding and may include aggressive messaging, strict accountability, and high expectations. 
                                This level is designed for experienced users who are comfortable with intense motivation. 
                                If you find this too challenging, you can change your intensity level at any time from your profile settings.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm font-semibold mb-1">What does the AI Coach do?</p>
                      <p className="text-xs text-muted-foreground">
                        Your AI Coach will analyze your weekly progress, including your workouts, nutrition, and
                        check-ins. Based on your data, it will provide personalized coaching messages with feedback,
                        motivation, and recommendations to help you reach your goals.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={handleBack} 
              disabled={(needsDateOfBirth ? step === 0 : step === 1) || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={loading}>
              {((needsDateOfBirth && step === 4) || (!needsDateOfBirth && step === 4)) ? (
                loading ? (
                  "Finishing..."
                ) : (
                  "Finish"
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

