<script>
  const appName = import.meta.env.VITE_APP_NAME || "forja-app";

  const translations = {
    en: { welcome: "Welcome to", tagline: "An app by Forja · Free by default, equipped by choice." },
    fr: { welcome: "Bienvenue sur", tagline: "Une app par Forja · Libre par défaut, équipé par choix." },
  };

  // DEMO ONLY — hand-rolled language detection just to prove the concept here.
  // Not a pattern to copy into your own components. Once @forja/addon-i18n ships
  // with client-side support, delete `translations` and `lang` below and use its
  // store/helper instead. Until then this file is yours to edit or delete freely.
  const lang = navigator.language.startsWith("fr") ? "fr" : "en";
  const t = translations[lang];
</script>

<div class="page">
  <div class="glow" aria-hidden="true"></div>

  <div class="content">
    <img class="logo" src="/logo.png" width="88" height="88" alt="Forja logo" />

    <div>
      <p class="eyebrow">{t.welcome}</p>
      <h1 class="app-name">{appName}</h1>
      <p class="tagline">{t.tagline}</p>
    </div>
  </div>

  <div class="baseline" aria-hidden="true"></div>
</div>

<style>
  :global(:root) {
    font-family: "Outfit", sans-serif;
  }
  :global(body) {
    margin: 0;
  }
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background-color: #1a1a1e;
    color: #f0eeff;
  }
  .glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 700px;
    height: 700px;
    border-radius: 50%;
    opacity: 0.15;
    filter: blur(140px);
    pointer-events: none;
    background: radial-gradient(circle, #b796ff 0%, #ffb3e6 60%, transparent 80%);
  }
  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
    padding: 0 1.5rem;
    text-align: center;
    max-width: 32rem;
  }
  .eyebrow {
    font-family: "Inter", sans-serif;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: rgba(183, 150, 255, 0.7);
    margin: 0;
  }
  .app-name {
    background-image: linear-gradient(135deg, #ffb3e6 0%, #b796ff 45%, #8a7cff 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 4rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    line-height: 1;
    margin: 0;
  }
  .tagline {
    font-family: "Inter", sans-serif;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
    color: rgba(240, 238, 255, 0.45);
    margin: 0.25rem 0 0;
  }
  .baseline {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 18rem;
    height: 1px;
    opacity: 0.25;
    background: linear-gradient(90deg, transparent, #b796ff, transparent);
  }
</style>
