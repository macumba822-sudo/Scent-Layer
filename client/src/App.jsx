import { Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider } from './context/AppContext.jsx';
import { Toaster } from './components/Toaster.jsx';
import { SourceModal } from './components/SourceModal.jsx';
import { SampleModal } from './components/SampleModal.jsx';
import { GiftModal } from './components/GiftModal.jsx';
import { CartDrawer } from './components/CartDrawer.jsx';
import { CookieConsent } from './components/CookieConsent.jsx';
import { MobileBottomNav } from './components/MobileBottomNav.jsx';
import { ReadingProgress } from './components/ReadingProgress.jsx';
import { SearchPalette } from './components/SearchPalette.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { ApiStatusBanner } from './components/ApiStatusBanner.jsx';
import { MiniCartBar } from './components/MiniCartBar.jsx';
import { PromoBar } from './components/PromoBar.jsx';
import { CompareTray } from './components/CompareTray.jsx';
import { captureRefFromUrl } from './lib/referral.js';
import { trackPageView } from './lib/analytics.js';

import { HomePage } from './pages/HomePage.jsx';
const ShopPage = lazy(() => import('./pages/ShopPage.jsx').then(m => ({ default: m.ShopPage })));
const StorePage = lazy(() => import('./pages/StorePage.jsx').then(m => ({ default: m.StorePage })));
const StoreProductPage = lazy(() => import('./pages/StoreProductPage.jsx').then(m => ({ default: m.StoreProductPage })));
const ToolsPage = lazy(() => import('./pages/ToolsPage.jsx').then(m => ({ default: m.ToolsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx').then(m => ({ default: m.ProfilePage })));
const ExtrasPage = lazy(() => import('./pages/ExtrasPage.jsx').then(m => ({ default: m.ExtrasPage })));
const FragrancePage = lazy(() => import('./pages/FragrancePage.jsx').then(m => ({ default: m.FragrancePage })));
const NotePage = lazy(() => import('./pages/NotePage.jsx').then(m => ({ default: m.NotePage })));
const BrandPage = lazy(() => import('./pages/BrandPage.jsx').then(m => ({ default: m.BrandPage })));
const GiftRevealPage = lazy(() => import('./pages/GiftRevealPage.jsx').then(m => ({ default: m.GiftRevealPage })));
const StoryPage = lazy(() => import('./pages/StoryPage.jsx').then(m => ({ default: m.StoryPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx').then(m => ({ default: m.NotFoundPage })));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage.jsx').then(m => ({ default: m.SignupPage })));
const PrivacyPage = lazy(() => import('./pages/LegalPage.jsx').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/LegalPage.jsx').then(m => ({ default: m.TermsPage })));
const ShippingPage = lazy(() => import('./pages/InfoPage.jsx').then(m => ({ default: m.ShippingPage })));
const FAQPage = lazy(() => import('./pages/InfoPage.jsx').then(m => ({ default: m.FAQPage })));
const SharedWishlistPage = lazy(() => import('./pages/SharedWishlistPage.jsx').then(m => ({ default: m.SharedWishlistPage })));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx').then(m => ({ default: m.AboutPage })));
const IntroSpray = lazy(() => import('./components/IntroSpray.jsx').then(m => ({ default: m.IntroSpray })));

const INTRO_KEY = 'sl-intro-played-v1';
function RouteFallback(){return <div className="route-fallback" aria-hidden="true"><div className="route-fallback-bar"/><div className="route-fallback-hero"><span className="skeleton route-fallback-eyebrow"/><span className="skeleton route-fallback-title"/><span className="skeleton route-fallback-title short"/><span className="skeleton route-fallback-line"/></div></div>}
function RefCapture(){useEffect(()=>{captureRefFromUrl()},[]);return null}
function ScrollToHash(){const{hash,pathname}=useLocation();useEffect(()=>{if(!hash){window.scrollTo({top:0,behavior:'auto'});return}const t=setTimeout(()=>{const el=document.getElementById(hash.slice(1));if(el)el.scrollIntoView({behavior:'smooth'})},50);return()=>clearTimeout(t)},[hash,pathname]);return null}
function PageviewTracker(){const{pathname,hash}=useLocation();useEffect(()=>{trackPageView(pathname+hash)},[pathname,hash]);return null}
function AnimatedRoutes(){const location=useLocation();return <AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2,ease:'easeOut'}}><Routes location={location}><Route path="/" element={<HomePage/>}/><Route path="/shop" element={<ShopPage/>}/><Route path="/store" element={<StorePage/>}/><Route path="/store/:id" element={<StoreProductPage/>}/><Route path="/tools" element={<ToolsPage/>}/><Route path="/profile" element={<ProfilePage/>}/><Route path="/explore" element={<ExtrasPage/>}/><Route path="/about" element={<AboutPage/>}/><Route path="/fragrance/:id" element={<FragrancePage/>}/><Route path="/notes/:slug" element={<NotePage/>}/><Route path="/brand/:slug" element={<BrandPage/>}/><Route path="/gift/:slug" element={<GiftRevealPage/>}/><Route path="/story" element={<StoryPage/>}/><Route path="/privacy" element={<PrivacyPage/>}/><Route path="/terms" element={<TermsPage/>}/><Route path="/shipping" element={<ShippingPage/>}/><Route path="/faq" element={<FAQPage/>}/><Route path="/wishlist/shared" element={<SharedWishlistPage/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/signup" element={<SignupPage/>}/><Route path="*" element={<NotFoundPage/>}/></Routes></motion.div></AnimatePresence>}
export default function App(){const[showIntro,setShowIntro]=useState(()=>{if(typeof window==='undefined')return false;try{return !sessionStorage.getItem(INTRO_KEY)}catch{return false}});function finishIntro(){try{sessionStorage.setItem(INTRO_KEY,'1')}catch{}setShowIntro(false)}return <AppProvider><PromoBar/><ApiStatusBanner/><ReadingProgress/><RefCapture/><ScrollToHash/><PageviewTracker/><ErrorBoundary><Suspense fallback={<RouteFallback/>}><AnimatedRoutes/></Suspense></ErrorBoundary><SampleModal/><SourceModal/><GiftModal/><CartDrawer/><MiniCartBar/><CompareTray/><MobileBottomNav/><Toaster/><CookieConsent/><SearchPalette/>{showIntro&&<Suspense fallback={null}><IntroSpray onFinish={finishIntro}/></Suspense>}</AppProvider>}
