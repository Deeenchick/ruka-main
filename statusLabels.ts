@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 20% 12%;

    --card: 0 0% 100%;
    --card-foreground: 222 20% 12%;

    --primary: 294 100% 44%; /* pitch green */
    --primary-foreground: 0 0% 100%;

    --secondary: 210 20% 96%;
    --secondary-foreground: 222 20% 12%;

    --muted: 210 20% 96%;
    --muted-foreground: 215 16% 47%;

    --accent: 38 92% 50%; /* card/whistle amber for highlights */
    --accent-foreground: 24 10% 10%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;

    --border: 214 20% 90%;
    --input: 214 20% 90%;
    --ring: 294 100% 44%;

    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  html {
    -webkit-tap-highlight-color: transparent;
  }
  body {
    @apply bg-background text-foreground antialiased;
    font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  }
}

/* Safe-area padding for mobile nav */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}