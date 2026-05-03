import { useEffect, useRef, useState } from "react";
import { useAuth } from "@app/providers/AuthProvider";
import { auth } from "@shared/lib/firebase";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Switch } from "@shared/ui/switch";
import { Label } from "@shared/ui/label";
import { Card, CardContent } from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { Bot, Loader2, Lock, Send, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { useEducatorFeatures } from "@shared/hooks/useEducatorFeatures";

const API_BASE = import.meta.env.VITE_MONKEY_KING_API_URL as string;

type Message = { role: "user" | "assistant"; content: string };

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken();
}

export default function StudentChatbot() {
  const { profile } = useAuth();
  const educatorId = profile?.educatorId;
  const { features, loading: featuresLoading } = useEducatorFeatures(educatorId);

  if (!featuresLoading && !features.chatbot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">AI Tutor not available</h2>
        <p className="text-muted-foreground max-w-sm">The AI Doubt Chatbot is not included in your institute's current plan. Contact your educator or admin to enable it.</p>
      </div>
    );
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useInternet, setUseInternet] = useState(false);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(100_000);
  const [limitReached, setLimitReached] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load current usage on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}/api/chat/usage`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTokensUsed(data.tokensUsedToday ?? 0);
          setDailyLimit(data.dailyLimit ?? 100_000);
          if (data.tokensUsedToday >= data.dailyLimit) setLimitReached(true);
        }
      } catch {
        // usage fetch is non-critical
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || limitReached) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          use_internet: useInternet,
          history: messages.slice(-6),
        }),
      });

      if (res.status === 429) {
        const err = await res.json();
        toast.error(err.detail || "Daily limit reached");
        setLimitReached(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: Message = { role: "assistant", content: data.answer };
      setMessages((prev) => [...prev, assistantMessage]);
      setTokensUsed(data.totalUsedToday ?? tokensUsed);
      setDailyLimit(data.dailyLimit ?? dailyLimit);
      if (data.totalUsedToday >= data.dailyLimit) setLimitReached(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to get response");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const usagePct = dailyLimit > 0 ? Math.min((tokensUsed / dailyLimit) * 100, 100) : 0;

  return (
    <div className="flex flex-col h-full p-4 gap-4 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Tutor</h1>
          <p className="text-sm text-muted-foreground">Ask questions about your course content</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="internet-toggle" className="text-sm font-medium">
            General search
          </Label>
          <Switch
            id="internet-toggle"
            checked={useInternet}
            onCheckedChange={setUseInternet}
          />
        </div>
      </div>

      {/* Search mode indicator */}
      <div className="flex items-center gap-2">
        <Badge variant={useInternet ? "default" : "secondary"} className="text-xs">
          {useInternet ? "Course content + internet knowledge" : "Course content only"}
        </Badge>
      </div>

      {/* Token usage bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Daily usage</span>
          <span>{tokensUsed.toLocaleString()} / {dailyLimit.toLocaleString()} tokens</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              usagePct >= 90 ? "bg-destructive" : usagePct >= 70 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full p-4 overflow-y-auto flex flex-col gap-4" style={{ minHeight: 300, maxHeight: "60vh" }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Bot className="h-10 w-10 opacity-30" />
              <p className="text-sm">Ask anything about your course material</p>
              {!useInternet && (
                <p className="text-xs">Enable "General search" to also use broader knowledge</p>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 items-start",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                  msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed",
                  msg.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-sm"
                    : "bg-primary text-primary-foreground rounded-tr-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </CardContent>
      </Card>

      {/* Input */}
      {limitReached ? (
        <div className="text-center text-sm text-destructive py-2">
          Daily limit reached for your institute. Access resets tomorrow.
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your course..."
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
