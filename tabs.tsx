import { NavLink, Outlet, useLocation, useNavigate, matchPath } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trophy, BarChart3, UserRound, CircleSlash2 } from "lucide-react";
import { useAuthContext } from "@/lib/auth-context";
import { cancelTournament } from "@/lib/adminActions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Same three tabs for everyone — admin doesn't get a separate section, just
// extra buttons/dialogs on these same pages (see isAdmin checks inside them).
const navItems = [
  { to: "/", label: "Турниры", icon: Trophy },
  { to: "/rating", label: "Рейтинг", icon: BarChart3 },
  { to: "/profile", label: "Профиль", icon: UserRound },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
const queryClient = useQueryClient();
const { isAdmin } = useAuthContext();
const [confirmOpen, setConfirmOpen] = useState(false);
const eventMatch = matchPath("/event/:id", location.pathname);
const eventId = eventMatch?.params.id;
const isEventPage = !!eventMatch;

const cancelMutation = useMutation({
  mutationFn: () => cancelTournament(eventId!),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    setConfirmOpen(false);
    navigate("/");
  },
});

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        {isEventPage ? (
          <>
            <button
              onClick={() => navigate("/")}
              aria-label="Назад"
              className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full text-foreground active:bg-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-lg font-bold tracking-tight text-primary">Турнир</span>
{isAdmin && (
  <button
    onClick={() => setConfirmOpen(true)}
    aria-label="Отменить турнир"
    className="-mr-2 ml-auto flex h-8 w-8 items-center justify-center rounded-full text-destructive active:bg-secondary"
  >
    <CircleSlash2 className="h-5 w-5" />
  </button>
)}
          </>
        ) : (
          <span className="text-lg font-bold tracking-tight text-primary">П⚽️лянка</span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav className="pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t bg-background">
        <ul className="flex items-stretch justify-around">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground transition-colors",
                    isActive && "text-primary"
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Отменить турнир?</DialogTitle>
      <DialogDescription>Все данные турнира удалятся</DialogDescription>
    </DialogHeader>
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setConfirmOpen(false)}>Не отменять</Button>
      <Button variant="destructive" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
        Отменить турнир
      </Button>
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
}