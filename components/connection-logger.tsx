
"use client";

import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface LogEntry {
  timestamp: Date;
  level: "info" | "success" | "warning" | "error";
  message: string;
  details?: string;
}

interface ConnectionLoggerProps {
  logs: LogEntry[];
  maxHeight?: string;
}

export function ConnectionLogger({ logs, maxHeight = "300px" }: ConnectionLoggerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return "text-green-600 dark:text-green-400";
      case "warning":
        return "text-yellow-600 dark:text-yellow-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const getLevelIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✗";
      default:
        return "ℹ";
    }
  };

  return (
    <Card className="p-4 bg-slate-50 dark:bg-slate-900">
      <h3 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
        Connection Logs
      </h3>
      <ScrollArea
        className="rounded border bg-white dark:bg-slate-950"
        style={{ height: maxHeight }}
      >
        <div ref={scrollRef} className="p-3 space-y-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-slate-400 dark:text-slate-500">
              Waiting for connection...
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-slate-400 dark:text-slate-500 shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className={`font-bold shrink-0 ${getLevelColor(log.level)}`}>
                  {getLevelIcon(log.level)}
                </span>
                <div className="flex-1">
                  <span className={getLevelColor(log.level)}>{log.message}</span>
                  {log.details && (
                    <div className="text-slate-500 dark:text-slate-400 ml-2 text-[10px]">
                      {log.details}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
