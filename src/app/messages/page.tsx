"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { NewMessageDialog } from "@/components/messages/new-message-dialog";
import { Button } from "@/components/ui/button";

export default function MessagesHome() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 grid size-24 place-items-center rounded-full border-2 border-foreground">
        <Send className="size-11 -rotate-12" strokeWidth={1.5} />
      </div>
      <h2 className="font-sans text-xl font-semibold tracking-normal">Your messages</h2>
      <p className="mt-1 text-sm text-muted-foreground">Send private photos and messages to a friend or group.</p>
      <Button className="mt-5 rounded-lg px-4 font-semibold" onClick={() => setOpen(true)}>Send message</Button>
      <NewMessageDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
