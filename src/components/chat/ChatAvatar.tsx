import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "./chat-utils";

interface ChatAvatarProps {
  name: string | null | undefined;
  isGroup?: boolean;
  online?: boolean;
  size?: "sm" | "md";
}

export function ChatAvatar({ name, isGroup = false, online = false, size = "md" }: ChatAvatarProps) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-semibold",
          isGroup ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
          size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs"
        )}
      >
        {isGroup ? <Users className={size === "md" ? "w-5 h-5" : "w-4 h-4"} /> : getInitials(name)}
      </div>
      {online && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-card",
            size === "md" ? "w-3 h-3" : "w-2.5 h-2.5"
          )}
          aria-label="En línea"
        />
      )}
    </div>
  );
}
