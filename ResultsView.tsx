import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import type { Event } from "@/lib/types";

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function CreateEventDialog({ hasOpenEvent }: { hasOpenEvent: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("19:00");

  const createEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").insert({ date, time, status: "voting" });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setDate(todayISO());
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={hasOpenEvent}>
          <Plus className="mr-1 h-4 w-4" />
          Турнир
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый турнир</DialogTitle>
          <DialogDescription>
            {hasOpenEvent
              ? "Сначала завершите текущий турнир — активным может быть только один (§16)."
              : "Создаст турнир в статусе «голосование»."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!date || hasOpenEvent || createEvent.isPending}
            onClick={() => createEvent.mutate()}
          >
            {createEvent.isPending ? "Создаём…" : "Создать"}
          </Button>
          {createEvent.isError && <p className="text-xs text-destructive">Не удалось создать турнир</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function hasOpenEvent(events: Event[]) {
  return events.some((e) => e.status !== "finished");
}