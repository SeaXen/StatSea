import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check } from 'lucide-react';

const TOUR_STEPS = [
    {
        title: "Welcome to StatSea",
        description: "Your complete dashboard for server monitoring and analytics. Let's take a quick tour.",
        target: "body"
    },
    {
        title: "Dashboard Overview",
        description: "View real-time metrics, system health, and active alerts at a glance.",
        target: "#nav-dashboard"
    },
    {
        title: "Device Management",
        description: "Monitor and manage all your connected servers and devices from one place.",
        target: "#nav-devices"
    },
    {
        title: "Analytics & Reports",
        description: "Deep dive into historical data, trends, and performance reports.",
        target: "#nav-analytics"
    },
    {
        title: "Settings",
        description: "Configure alerts, users, and system preferences.",
        target: "#nav-settings"
    }
];

export const OnboardingTour: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('statsea_onboarding_completed');
        if (!hasSeenTour) {
            // Small delay to allow app to load
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem('statsea_onboarding_completed', 'true');
    };

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    if (!isVisible) return null;

    const step = TOUR_STEPS[currentStep];
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="relative p-6">
                        <button
                            onClick={handleComplete}
                            className="absolute top-4 right-4 p-1 text-gray-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6">
                            <span className="inline-block px-2 py-1 mb-3 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20">
                                Step {currentStep + 1} of {TOUR_STEPS.length}
                            </span>
                            <h2 className="text-xl font-bold text-white mb-2">{step.title}</h2>
                            <p className="text-gray-400 leading-relaxed">{step.description}</p>
                        </div>

                        <div className="flex items-center justify-between mt-8">
                            <div className="flex gap-1">
                                {TOUR_STEPS.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-blue-500' : 'w-1.5 bg-white/10'
                                            }`}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors group"
                            >
                                {isLastStep ? 'Get Started' : 'Next'}
                                {isLastStep ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                            </button>
                        </div>
                    </div>

                    {/* Decorative gradient overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5" />
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
