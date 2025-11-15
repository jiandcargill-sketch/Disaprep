import React, { useState, useEffect, useCallback } from 'react';
import { Home, MapPin, AlertTriangle, Leaf, ChevronRight, Bell, Shield, Map, Package, Loader } from 'lucide-react';
import type { Screen, Progress, AIRecommendations } from './types';
import { generateAIRecommendationsService, getLocationNameFromCoords } from './services/geminiService';

// Add type definition for a custom window.storage API
declare global {
  interface Window {
    storage: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<void>;
    };
  }
}

const KIT_ITEM_CATEGORIES = {
    'Water and Food': [
        { id: 'water', title: 'Water (1 gallon per person per day)', desc: '3 day supply for household' },
        { id: 'food', title: 'Non-perishable food', desc: 'Canned goods, crackers, energy bars' },
        { id: 'can-opener', title: 'Manual can opener', desc: 'Essential for canned food' },
    ],
    'Power and Communication': [
        { id: 'radio', title: 'Battery-powered radio', desc: 'NOAA weather radio preferred' },
        { id: 'flashlight', title: 'Flashlights and extra batteries', desc: 'One per person plus backups' },
        { id: 'chargers', title: 'Portable phone chargers', desc: 'Fully charged power banks' },
    ],
    'Medical and Personal': [
        { id: 'first-aid', title: 'First aid kit', desc: 'Bandages, antiseptic, pain relievers' },
        { id: 'medications', title: 'Prescription medications', desc: '2 week supply' },
        { id: 'hygiene', title: 'Personal hygiene items', desc: 'Soap, hand sanitizer, toiletries' },
    ],
    'Documents and Tools': [
        { id: 'documents', title: 'Important documents', desc: 'Insurance policies, IDs in waterproof bag' },
        { id: 'cash', title: 'Emergency cash', desc: 'ATMs may not work during disasters' },
        { id: 'tools', title: 'Basic tools', desc: 'Wrench, pliers, duct tape' },
    ]
};
const ALL_KIT_ITEMS = Object.values(KIT_ITEM_CATEGORIES).flat();
const TOTAL_KIT_ITEMS = ALL_KIT_ITEMS.length;

const HOME_ITEM_CATEGORIES = {
    'Exterior Protection': [
        { id: 'shutters', title: 'Install storm shutters or board windows', desc: 'Use 5/8 inch plywood at minimum' },
        { id: 'garage', title: 'Secure garage door', desc: 'Reinforce with horizontal bracing if needed' },
        { id: 'trim', title: 'Trim trees and shrubs', desc: 'Remove dead branches within 10 feet of house' },
        { id: 'furniture', title: 'Bring outdoor furniture inside', desc: 'Secure or store patio items, grills, toys' },
        { id: 'gutters', title: 'Clear gutters and drains', desc: 'Ensure proper water drainage' },
    ],
    'Interior Preparation': [
        { id: 'valuables', title: 'Move valuables to upper floors', desc: 'Elevate items in case of flooding' },
        { id: 'fridge', title: 'Turn refrigerator to coldest setting', desc: 'Food stays fresh longer if power fails' },
        { id: 'bathtub', title: 'Fill bathtubs with water', desc: 'For washing and sanitation if water stops' },
    ],
    'Vehicle and Property': [
        { id: 'gas', title: 'Fill vehicle gas tanks', desc: 'Gas stations may close or lose power' },
        { id: 'photos', title: 'Document property with photos', desc: 'For insurance claims if damage occurs' },
        { id: 'insurance', title: 'Review insurance coverage', desc: 'Ensure you have flood and wind coverage' },
    ]
};
const ALL_HOME_ITEMS = Object.values(HOME_ITEM_CATEGORIES).flat();
const TOTAL_HOME_ITEMS = ALL_HOME_ITEMS.length;


const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');
  const [userName, setUserName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [disasters, setDisasters] = useState<string[]>([]);
  const [kitProgress, setKitProgress] = useState<Progress>({});
  const [homeProgress, setHomeProgress] = useState<Progress>({});
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendations | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);

  const loadUserData = useCallback(async () => {
    try {
      if (window.storage) {
        const profileResult = await window.storage.get('user-profile');
        if (profileResult?.value) {
          const profile = JSON.parse(profileResult.value);
          setUserName(profile.userName || '');
          setLocation(profile.location || '');
          setDisasters(profile.disasters || []);
        }

        const kitResult = await window.storage.get('kit-progress');
        if (kitResult?.value) {
          setKitProgress(JSON.parse(kitResult.value));
        }

        const homeResult = await window.storage.get('home-progress');
        if (homeResult?.value) {
          setHomeProgress(JSON.parse(homeResult.value));
        }
        
        const aiResult = await window.storage.get('ai-recommendations');
        if (aiResult?.value) {
          setAiRecommendations(JSON.parse(aiResult.value));
        }
      }
      setCurrentScreen('onboarding');
    } catch (error) {
      console.log('No saved data found or storage not available, starting fresh');
      setCurrentScreen('onboarding');
    }
  }, []);

  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToStorage = useCallback(async (key: string, data: object) => {
    if (window.storage) {
      try {
        await window.storage.set(key, JSON.stringify(data));
      } catch (error) {
        console.error(`Error saving ${key}:`, error);
      }
    }
  }, []);


  const calculateReadinessScore = useCallback(() => {
    const kitCompleted = Object.values(kitProgress).filter(Boolean).length;
    const homeCompleted = Object.values(homeProgress).filter(Boolean).length;
    const totalItems = TOTAL_KIT_ITEMS + TOTAL_HOME_ITEMS;
    if (totalItems === 0) return 0;
    const completedItems = kitCompleted + homeCompleted;
    return Math.round((completedItems / totalItems) * 100);
  }, [kitProgress, homeProgress]);

  const generateAIRecommendations = useCallback(async () => {
    setIsLoadingAI(true);
    const score = calculateReadinessScore();
    const recommendations = await generateAIRecommendationsService(location, disasters, score);
    
    if (recommendations && recommendations.urgentActions) {
      setAiRecommendations(recommendations);
      await saveToStorage('ai-recommendations', recommendations);
    }
    
    setIsLoadingAI(false);
  }, [calculateReadinessScore, location, disasters, saveToStorage]);

  const toggleDisaster = (type: string) => {
    setDisasters(prev => 
      prev.includes(type) ? prev.filter(d => d !== type) : [...prev, type]
    );
  };

  const toggleKitItem = (itemId: string) => {
    const newProgress = { ...kitProgress, [itemId]: !kitProgress[itemId] };
    setKitProgress(newProgress);
    saveToStorage('kit-progress', newProgress);
  };

  const toggleHomeItem = (itemId: string) => {
    const newProgress = { ...homeProgress, [itemId]: !homeProgress[itemId] };
    setHomeProgress(newProgress);
    saveToStorage('home-progress', newProgress);
  };

  const handleCreatePlan = async () => {
    await saveToStorage('user-profile', { userName, location, disasters });
    await generateAIRecommendations();
    setCurrentScreen('dashboard');
  };
  
  const handleDashboardAccess = () => {
      if (userName || location || disasters.length > 0) {
          setCurrentScreen('dashboard');
      } else {
          setCurrentScreen('signup');
      }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
        setIsGeolocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const locationName = await getLocationNameFromCoords(latitude, longitude);
                    setLocation(locationName);
                } catch (e) {
                    console.error("Failed to get location name", e);
                    setLocation("Unable to fetch location");
                } finally {
                    setIsGeolocating(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("Could not get your location. Please enable location services or enter your location manually.");
                setIsGeolocating(false);
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
    }
  };


  if (currentScreen === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-800 flex items-center justify-center">
        <Loader className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (currentScreen === 'onboarding') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-full w-24 h-24 mx-auto flex items-center justify-center">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white">DisaPrep</h1>
          <p className="text-xl text-blue-100">Prepared. Protected. Powered by AI.</p>
          <div className="space-y-4 pt-8">
            <button 
              onClick={() => setCurrentScreen('signup')}
              className="w-full bg-white text-blue-700 py-4 rounded-full font-semibold text-lg hover:bg-blue-50 transition shadow-lg"
            >
              Get Started
            </button>
            <button 
              onClick={handleDashboardAccess}
              className="w-full bg-transparent border-2 border-white text-white py-4 rounded-full font-semibold text-lg hover:bg-white/10 transition"
            >
              I Already Have an Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'signup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-800 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Create Your Safety Profile</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
            <input
              type="tel"
              placeholder="Phone for emergency alerts"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
            <button 
              onClick={() => setCurrentScreen('location')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition shadow-lg"
            >
              Continue
            </button>
            <button 
                onClick={() => setCurrentScreen('onboarding')}
                className="w-full text-gray-600 py-2 rounded-xl font-medium hover:bg-gray-100 transition"
            >
                Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'location') {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl">
          <div className="flex items-center justify-center mb-6">
            <MapPin className="w-12 h-12 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Where are you located?</h2>
          <p className="text-gray-600 mb-6 text-center">We will customize your disaster readiness plan</p>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="City, State or Country"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
            <button 
              onClick={handleUseCurrentLocation}
              disabled={isGeolocating}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition flex items-center justify-center disabled:opacity-50"
            >
              {isGeolocating ? (
                <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Getting Location...
                </>
              ) : (
                <>
                    <MapPin className="w-5 h-5 mr-2" />
                    Use My Current Location
                </>
              )}
            </button>
            <button 
              onClick={() => setCurrentScreen('disaster')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition shadow-lg"
            >
              Continue
            </button>
            <button 
                onClick={() => setCurrentScreen('signup')}
                className="w-full text-gray-600 py-2 rounded-xl font-medium hover:bg-gray-100 transition"
            >
                Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'disaster') {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl">
          <div className="flex items-center justify-center mb-6">
            <AlertTriangle className="w-12 h-12 text-orange-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">What disasters affect your area?</h2>
          <p className="text-gray-600 mb-6 text-center">Select all that apply</p>
          <div className="space-y-3 mb-6">
            {['Hurricane', 'Flood', 'Earthquake', 'Wildfire', 'Tornado', 'Tsunami'].map(type => (
              <button
                key={type}
                onClick={() => toggleDisaster(type)}
                className={`w-full p-4 rounded-xl border-2 text-left font-medium transition ${
                  disasters.includes(type)
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{type}</span>
                  {disasters.includes(type) && (
                    <span className="text-blue-600 font-bold">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <button 
            onClick={handleCreatePlan}
            disabled={disasters.length === 0 || isLoadingAI}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition shadow-lg ${
              disasters.length > 0 && !isLoadingAI
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoadingAI ? (
              <span className="flex items-center justify-center">
                <Loader className="w-5 h-5 mr-2 animate-spin" />
                Creating Your Plan...
              </span>
            ) : (
              'Create My Plan'
            )}
          </button>
          <button 
            onClick={() => setCurrentScreen('location')}
            className="w-full text-gray-600 py-2 mt-2 rounded-xl font-medium hover:bg-gray-100 transition"
          >
              Back
          </button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'dashboard') {
    const readinessScore = calculateReadinessScore();
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">DisaPrep</h1>
          </div>
          <h2 className="text-xl mb-2">Hello {userName || 'User'}</h2>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Readiness Score</p>
              <p className="text-3xl font-bold">{readinessScore}%</p>
            </div>
            <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
              <Shield className="w-10 h-10" />
            </div>
          </div>
        </div>

        <div className="mx-6 mt-6 bg-orange-100 border-l-4 border-orange-500 rounded-xl p-4 flex items-start">
          <Bell className="w-6 h-6 text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-900">Tropical Storm Watch</p>
            <p className="text-sm text-orange-800">Storm forming 500mi SE. Monitor for 72hrs</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setCurrentScreen('aiplan')}
              className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition"
            >
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-800">My AI Plan</p>
            </button>
            <button 
              onClick={() => setCurrentScreen('evacuation')}
              className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition"
            >
              <div className="bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                <Map className="w-6 h-6 text-red-600" />
              </div>
              <p className="font-semibold text-gray-800">Evacuation</p>
            </button>
            <button 
              onClick={() => setCurrentScreen('resources')}
              className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition"
            >
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-semibold text-gray-800">Resources</p>
            </button>
            <button 
              onClick={() => setCurrentScreen('mangrove')}
              className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition"
            >
              <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                <Leaf className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-semibold text-gray-800">Mangroves</p>
            </button>
          </div>
        </div>

        <div className="px-6 pb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Complete Your Prep</h3>
          <div className="space-y-3">
            <button 
              onClick={() => setCurrentScreen('emergencykit')}
              className="w-full bg-white rounded-xl p-4 shadow-md flex items-center justify-between hover:shadow-lg transition"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Build Emergency Kit</p>
                  <p className="text-sm text-gray-600">{TOTAL_KIT_ITEMS - Object.values(kitProgress).filter(Boolean).length} items remaining</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button 
              onClick={() => setCurrentScreen('securehome')}
              className="w-full bg-white rounded-xl p-4 shadow-md flex items-center justify-between hover:shadow-lg transition"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <Home className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Secure Your Home</p>
                  <p className="text-sm text-gray-600">{TOTAL_HOME_ITEMS - Object.values(homeProgress).filter(Boolean).length} steps remaining</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'aiplan') {
    useEffect(() => {
        if (!aiRecommendations && !isLoadingAI) {
            generateAIRecommendations();
        }
    }, [aiRecommendations, isLoadingAI, generateAIRecommendations]);

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 pb-8 rounded-b-3xl shadow-lg">
          <button onClick={() => setCurrentScreen('dashboard')} className="mb-4 flex items-center text-blue-100 hover:text-white">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2">Your AI Readiness Plan</h1>
          <p className="text-blue-100">Personalized for {disasters.length > 0 ? disasters.join(', ') : 'disasters'} in {location || 'your area'}</p>
        </div>

        <div className="p-6 space-y-4">
          {isLoadingAI ? (
            <div className="bg-white rounded-2xl p-12 shadow-md flex flex-col items-center justify-center">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600">Generating your personalized plan...</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center mb-3">
                  <AlertTriangle className="w-6 h-6 mr-2" />
                  <h3 className="text-xl font-bold">Immediate Actions</h3>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <p className="font-semibold mb-2">PRIORITY TASKS</p>
                  <ul className="space-y-2 text-sm">
                    {aiRecommendations?.urgentActions?.map((action, idx) => (
                      <li key={idx}>• {action}</li>
                    )) || (
                      <>
                        <li>• Stock 3 gallons of water per person</li>
                        <li>• Charge all electronic devices</li>
                        <li>• Secure outdoor furniture</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              {aiRecommendations?.locationSpecific && (
                <div className="bg-blue-50 rounded-2xl p-6 shadow-md border-2 border-blue-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Location-Specific Advice</h3>
                  <p className="text-gray-700 text-sm">{aiRecommendations.locationSpecific}</p>
                </div>
              )}

              <button 
                onClick={() => setCurrentScreen('emergencykit')}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg"
              >
                View Full Emergency Checklist
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (currentScreen === 'emergencykit') {
    const kitCompleted = Object.values(kitProgress).filter(Boolean).length;
    const kitPercentage = TOTAL_KIT_ITEMS > 0 ? Math.round((kitCompleted / TOTAL_KIT_ITEMS) * 100) : 0;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 pb-8 rounded-b-3xl shadow-lg">
          <button onClick={() => setCurrentScreen('dashboard')} className="mb-4 flex items-center text-blue-100 hover:text-white">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2">Build Emergency Kit</h1>
          <p className="text-blue-100">Essential supplies for 3 days</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm opacity-90">Completion Progress</p>
                <p className="text-3xl font-bold">{kitPercentage}%</p>
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
                <Package className="w-10 h-10" />
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full h-3 overflow-hidden">
              <div className="bg-white h-full rounded-full transition-all" style={{width: `${kitPercentage}%`}}></div>
            </div>
          </div>

          {Object.entries(KIT_ITEM_CATEGORIES).map(([category, items]) => (
            <div key={category} className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">{category}</h3>
              <div className="space-y-3">
                {items.map(item => (
                  <label key={item.id} className={`flex items-center p-3 border-2 rounded-xl cursor-pointer ${kitProgress[item.id] ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'} transition`}>
                    <input type="checkbox" checked={kitProgress[item.id] || false} onChange={() => toggleKitItem(item.id)} className="w-5 h-5 mr-3" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-600">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-blue-50 rounded-2xl p-6 shadow-md border-2 border-blue-200">
            <h3 className="text-lg font-bold text-gray-800 mb-3">💡 Pro Tip</h3>
            <p className="text-gray-700 text-sm">Store your emergency kit in a waterproof container in an easy-to-access location. Check and rotate supplies every 6 months.</p>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'securehome') {
    const homeCompleted = Object.values(homeProgress).filter(Boolean).length;
    const homePercentage = TOTAL_HOME_ITEMS > 0 ? Math.round((homeCompleted / TOTAL_HOME_ITEMS) * 100) : 0;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 pb-8 rounded-b-3xl shadow-lg">
          <button onClick={() => setCurrentScreen('dashboard')} className="mb-4 flex items-center text-purple-100 hover:text-white">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2">Secure Your Home</h1>
          <p className="text-purple-100">Hurricane protection checklist</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm opacity-90">Steps Completed</p>
                <p className="text-3xl font-bold">{homeCompleted} of {TOTAL_HOME_ITEMS}</p>
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
                <Home className="w-10 h-10" />
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full h-3 overflow-hidden">
              <div className="bg-white h-full rounded-full transition-all" style={{width: `${homePercentage}%`}}></div>
            </div>
          </div>

          {Object.entries(HOME_ITEM_CATEGORIES).map(([category, items]) => (
            <div key={category} className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">{category}</h3>
              <div className="space-y-3">
                {items.map(item => (
                  <label key={item.id} className={`flex items-start p-3 border-2 rounded-xl cursor-pointer ${homeProgress[item.id] ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'} transition`}>
                    <input type="checkbox" checked={homeProgress[item.id] || false} onChange={() => toggleHomeItem(item.id)} className="w-5 h-5 mr-3 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-600">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-orange-50 rounded-2xl p-6 shadow-md border-2 border-orange-200">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
              Important Reminder
            </h3>
            <p className="text-gray-700 text-sm">Complete these steps at least 48 hours before the storm arrives. If evacuation is ordered, do not delay securing your home.</p>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'evacuation') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 pb-8 rounded-b-3xl shadow-lg">
          <button onClick={() => setCurrentScreen('dashboard')} className="mb-4 flex items-center text-red-100 hover:text-white">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2">Evacuation Routes</h1>
          <p className="text-red-100">Based on your current location</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-gray-300 h-64 flex items-center justify-center">
              <Map className="w-16 h-16 text-gray-500" />
              <p className="ml-4 text-gray-600 text-lg">Interactive Map</p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Recommended Route</h3>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">CLEAR</span>
              </div>
              <div className="space-y-3 text-gray-700">
                <p><strong>Distance:</strong> 45 miles</p>
                <p><strong>Est. Time:</strong> 1 hour 20 minutes</p>
                <p><strong>Nearest Shelter:</strong> Bay County High School (38 miles)</p>
              </div>
            </div>
          </div>

          <button 
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-red-700 transition flex items-center justify-center"
          >
            <AlertTriangle className="w-6 h-6 mr-2" />
            EMERGENCY: I Need Rescue
          </button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'resources') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 pb-8 rounded-b-3xl shadow-lg">
          <button onClick={() => setCurrentScreen('dashboard')} className="mb-4 flex items-center text-green-100 hover:text-white">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2">Community Resources</h1>
          <p className="text-green-100">Find and share disaster supplies</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Resource Distribution Points</h3>
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-gray-800">City Hall Downtown</p>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">Open Now</span>
                </div>
                <p className="text-sm text-gray-600">Water, Food, First Aid</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-gray-800">Fire Station 3</p>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">Opens 8 AM</span>
                </div>
                <p className="text-sm text-gray-600">Water, Blankets</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Share Resources</h3>
            <p className="text-gray-600 mb-4">Help your neighbors by sharing what you have</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="What can you offer?"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none"
              />
              <button className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition">
                Post to Community
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'mangrove') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-emerald-600 to-green-700 text-white p-6 pb-8 rounded-b-3xl shadow-lg">
          <button onClick={() => setCurrentScreen('dashboard')} className="mb-4 flex items-center text-emerald-100 hover:text-white">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2">Mangrove Protection</h1>
          <p className="text-emerald-100">Nature-based disaster prevention</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">How Mangroves Protect You</h3>
            <div className="bg-emerald-50 rounded-xl p-4 mb-4">
              <p className="text-emerald-900 font-semibold mb-2">In Your Community</p>
              <p className="text-emerald-800 text-sm">500 mangroves would reduce storm surge by 40% and save an estimated $2.3M in property damage</p>
            </div>
            <div className="space-y-3 text-gray-700 text-sm">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
                <p><strong>Reduce storm surge</strong> by breaking wave energy</p>
              </div>
              <div className="flex items-start">
                <Leaf className="w-5 h-5 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
                <p><strong>Prevent coastal erosion</strong> with root systems</p>
              </div>
              <div className="flex items-start">
                <Home className="w-5 h-5 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
                <p><strong>Protect property</strong> and critical infrastructure</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Upcoming Planting Event</h3>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
              <p className="font-semibold mb-1">Saturday, November 23</p>
              <p className="text-sm">Coastal Restoration Site • 9 AM to 1 PM</p>
            </div>
            <p className="text-sm mb-4">Join 50+ volunteers planting 200 mangroves</p>
            <button className="w-full bg-white text-emerald-700 py-3 rounded-xl font-semibold hover:bg-emerald-50 transition">
              Register to Volunteer
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Your Impact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-700">12</p>
                <p className="text-sm text-gray-600">Trees Planted</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-700">3</p>
                <p className="text-sm text-gray-600">Events Attended</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default App;