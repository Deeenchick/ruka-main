import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Same generator as CreatePlayerDialog — kept local to avoid a shared-state footgun. */
function generatePassword() {
  return Math.random().toString(36).slice(-8);
}

export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const resetPassword = useMutation({
    mutationFn: async () => {
      const password = generatePassword();
      const { error } = await supabase.functions.invoke("reset-password", {
        body: { userId, password },
      });
      if (error) throw error;
      return password;
    },
    onSuccess: (password) => setNewPassword(password),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setNewPassword(null);
          resetPassword.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Сбросить пароль">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сбросить пароль</DialogTitle>
          <DialogDescription>
            {userName}: старый пароль перестанет работать, будет выдан новый.
          </DialogDescription>
        </DialogHeader>

        {newPassword ? (
          <p className="rounded-md bg-secondary p-3 text-sm">
            Новый пароль: <b>{newPassword}</b>
            <br />
            <span className="text-xs text-muted-foreground">Показывается один раз — передайте игроку.</span>
          </p>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" disabled={resetPassword.isPending} onClick={() => resetPassword.mutate()}>
              {resetPassword.isPending ? "Сбрасываем…" : "Сгенерировать новый пароль"}
            </Button>
            {resetPassword.isError && <p className="text-xs text-destructive">Не удалось сбросить пароль</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
