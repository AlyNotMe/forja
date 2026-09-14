import { createRoot } from "react-dom/client";

const appName = import.meta.env.VITE_APP_NAME || "forja-app";

const translations = {
  en: { welcome: "Welcome to", tagline: "An app by Forja · Free by default, equipped by choice." },
  fr: { welcome: "Bienvenue sur", tagline: "Une app par Forja · Libre par défaut, équipé par choix." },
};

// DEMO ONLY — hand-rolled language detection just to prove the concept here.
// Not a pattern to copy into your own components. Once @forja/addon-i18n ships
// with client-side support, delete `translations` and `lang` below and use its
// hook/helper instead. Until then this file is yours to edit or delete freely.
const lang = navigator.language.startsWith("fr") ? "fr" : "en";
const t = translations[lang];

function ForjaLogoMark() {
  return (
    <svg width="88" height="88" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="forja-g" x1="4" y1="4" x2="76" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB3E6" />
          <stop offset="52%" stopColor="#B796FF" />
          <stop offset="100%" stopColor="#8A7CFF" />
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d="M 10 10 L 24 10 L 24 70 L 10 70 Z" fill="url(#forja-g)" filter="url(#glow)" />
      <path d="M 24 10 L 66 10 L 63 23 L 24 23 Z" fill="url(#forja-g)" filter="url(#glow)" />
      <path d="M 24 37 L 53 37 L 50 49 L 24 49 Z" fill="url(#forja-g)" filter="url(#glow)" />
      <path d="M 69 7 L 71 2 L 73 7 L 78 9 L 73 11 L 71 16 L 69 11 L 64 9 Z" fill="#FFB3E6" opacity="0.9" />
    </svg>
  );
}

function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#1a1a1e",
        color: "#f0eeff",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700,
          height: 700,
          borderRadius: "50%",
          opacity: 0.15,
          filter: "blur(140px)",
          pointerEvents: "none",
          background: "radial-gradient(circle, #B796FF 0%, #FFB3E6 60%, transparent 80%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          padding: "0 1.5rem",
          textAlign: "center",
          maxWidth: 512,
        }}
      >
        <ForjaLogoMark />

        <div>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "rgba(183,150,255,0.7)",
              margin: 0,
            }}
          >
            {t.welcome}
          </p>

          <h1
            style={{
              backgroundImage: "linear-gradient(135deg, #FFB3E6 0%, #B796FF 45%, #8A7CFF 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              lineHeight: 1,
              margin: 0,
            }}
          >
            {appName}
          </h1>

          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              letterSpacing: "0.05em",
              color: "rgba(240,238,255,0.45)",
              margin: "4px 0 0",
            }}
          >
            {t.tagline}
          </p>
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 288,
          height: 1,
          opacity: 0.25,
          background: "linear-gradient(90deg, transparent, #B796FF, transparent)",
        }}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
