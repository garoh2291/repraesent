import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPublicConfig,
  getAvailabilitiesPublic,
  createBooking,
  type CreateBookingDto,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Calendar } from "lucide-react";

export function meta() {
  return [
    { title: "Book an Appointment" },
    { name: "description", content: "Schedule your appointment" },
  ];
}

function formatSlot(slot: string): string {
  const [start] = slot.split("--");
  const date = new Date(start);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookAppointment() {
  const { configId } = useParams<{ configId: string }>();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["public-config", configId],
    queryFn: () => getPublicConfig(configId!),
    enabled: !!configId,
  });

  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate);

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["availabilities-public", configId, selectedDate],
    queryFn: () => getAvailabilitiesPublic(configId!, selectedDate),
    enabled: !!configId && !!selectedDate && isValidDate,
  });

  const bookMutation = useMutation({
    mutationFn: (dto: CreateBookingDto) => createBooking(dto),
    onSuccess: () => {
      toast.success("Appointment booked successfully!");
      setSelectedSlot(null);
      setCustomerName("");
      setCustomerEmail("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["availabilities-public"] });
    },
    onError: (error) => {
      toast.error("Failed to book", {
        description: extractErrorMessage(error),
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configId || !selectedSlot || !customerName || !customerEmail) return;

    const [start, end] = selectedSlot.split("--");
    bookMutation.mutate({
      configId,
      start,
      end,
      customerName,
      customerEmail,
      notes: notes || undefined,
    });
  }

  if (!configId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          Invalid booking link.
        </div>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 w-48 bg-muted rounded mx-auto" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          Appointment config not found.
        </div>
      </div>
    );
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Calendar className="h-6 w-6" />
            Book an Appointment
          </h1>
          <p className="text-muted-foreground mt-2">
            Select a date and time.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
              }}
              min={minDate}
            />
          </div>

          {selectedDate && (
            <div className="space-y-2">
              <Label>Available times</Label>
              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No slots available for this date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      variant={selectedSlot === slot ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatSlot(slot)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedSlot && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information..."
                  rows={3}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={bookMutation.isPending || !customerName || !customerEmail}
              >
                {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
