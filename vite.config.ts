import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/lib/auth-context";
import { CreateEventDialog, hasOpenEvent } from "@/components/admin/CreateEventDialog";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/statusLabels";
import type { Event } from "@/lib/types";

async function fetchEvents(): Promise<Event[]> {
  const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false });
  if (error) throw error;
  return data;
}

export default function Tournaments() {
  const { isAdmin } = useAuthContext();
  const { data: events, isLoading, error } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка турниров…</p>;
  if (error) return <p className="text-sm text-destructive">Не удалось загрузить турниры</p>;

  const active = events?.filter((e) => e.status !== "finished") ?? [];
  const history = events?.filter((e) => e.status === "finished") ?? [];

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">🔥 Активный турнир</h2>
          {isAdmin && <CreateEventDialog hasOpenEvent={hasOpenEvent(events ?? [])} />}
        </div>
        {active.length === 0 && <p className="text-sm text-muted-foreground">Сейчас нет активного турнира</p>}
        <div className="flex flex-col gap-2">
          {active.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">📅 История турниров</h2>
          <div className="flex flex-col gap-2">
            {history.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link to={`/event/${event.id}`}>
      <Card className="transition-shadow active:shadow-none hover:shadow-md">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">
              {new Date(event.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "long" })}
            </p>
            <p className="text-sm text-muted-foreground">{event.time}</p>
          </div>
          <Badge variant={STATUS_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
