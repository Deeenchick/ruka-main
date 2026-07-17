import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Generates a one-time password shown to the admin to hand to the new player (spec §14). */
function generatePassword() {
  return Math.random().toString(36).slice(-8);
}

export function CreatePlayerDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);

  const createPlayer = useMutation({
    mutationFn: async () => {
      const password = generatePassword();
      // Needs the service role key, so this goes through an Edge Function
      // rather than the anon-key client. See supabase/functions/create-user.
      const { error } = await supabase.functions.invoke("create-user", {
        body: { login: login.trim(), name: name.trim(), password },
      });
      if (error) throw error;
      return { login: login.trim(), password };
    },
    onSuccess: (result) => {
      setCreated(result);
      setName("");
      setLogin("");
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCreated(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1 h-4 w-4" />
          Игрок
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый игрок</DialogTitle>
          <DialogDescription>Логин и пароль игрок получает от вас лично (§14).</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="rounded-md bg-secondary p-3 text-sm">
              Логин: <b>{created.login}</b>
              <br />
              Пароль: <b>{created.password}</b>
              <br />
              <span className="text-xs text-muted-foreground">Пароль показывается один раз.</span>
            </p>
            <Button className="w-full" variant="outline" onClick={() => setCreated(null)}>
              Добавить ещё
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Логин" value={login} onChange={(e) => setLogin(e.target.value)} />
            <Button
              className="w-full"
              disabled={!name || !login || createPlayer.isPending}
              onClick={() => createPlayer.mutate()}
            >
              {createPlayer.isPending ? "Создаём…" : "Создать"}
            </Button>
            {createPlayer.isError && <p className="text-xs text-destructive">Не удалось создать игрока</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
