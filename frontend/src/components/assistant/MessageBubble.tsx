import { Badge, ProgressBar } from "@/components/ui";
import { AlertTriangleIcon } from "@/components/icons";
import type { AssistantMessage } from "@/lib/assistant";

/** Shared chat bubble used by the full assistant page and the floating widget. */
export function MessageBubble({
  message,
  compact = false,
}: {
  message: AssistantMessage;
  compact?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div
        className={`max-w-[80%] self-end rounded-[16px] rounded-br-[4px] bg-navy px-3.5 py-2.5 font-medium leading-relaxed text-white ${
          compact ? "text-[12.5px]" : "text-[13.5px]"
        }`}
      >
        {message.text}
      </div>
    );
  }

  return (
    <div
      className={`max-w-[88%] self-start rounded-[16px] rounded-bl-[4px] bg-card p-3.5 shadow-card ring-1 ring-line ${
        compact ? "text-[12.5px]" : "text-[13.5px]"
      }`}
    >
      <p className="font-medium leading-relaxed text-ink">{message.text}</p>

      {message.bars && message.bars.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2">
          {message.bars.map((bar) => (
            <div key={bar.label}>
              <div className="mb-1 flex justify-between text-[12px] font-semibold text-ink-2">
                <span>{bar.label}</span>
                <span>{bar.percent}%</span>
              </div>
              <ProgressBar value={bar.percent} max={100} height={6} />
            </div>
          ))}
        </div>
      )}

      {message.period && (
        <div className="mt-2.5">
          <Badge tone="teal">{message.period}</Badge>
        </div>
      )}

      {message.note && (
        <div className="mt-2 flex items-start gap-2 text-[11.5px] font-medium leading-relaxed text-ink-2">
          <AlertTriangleIcon size={14} className="mt-px shrink-0 text-amber-d" />
          {message.note}
        </div>
      )}
    </div>
  );
}
