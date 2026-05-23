"use client";

import { useState } from "react";

interface NewsletterFormProps {
  endpoint?: string;
  headline?: string;
  subtext?: string;
  cta?: string;
}

export default function NewsletterForm({
  endpoint,
  headline,
  subtext,
  cta,
}: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const defaultEndpoint = process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT || "";
  const formEndpoint = endpoint || defaultEndpoint;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    if (!formEndpoint) {
      setStatus("error");
      setMessage("Newsletter signup is temporarily unavailable. Please try again later.");
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch(formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: window.location.pathname }),
      });

      if (response.ok) {
        setStatus("success");
        setMessage("subscribed — check your inbox for confirmation.");
        setEmail("");
      } else {
        const data = await response.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  };

  return (
    <div className="newsletter-cta">
      <h3>{headline || "the briefing"}</h3>
      <p>
        {subtext ||
          "occasional notes on what we tested, what's worth buying, and what to skip. unsubscribe anytime."}
      </p>

      {status === "success" ? (
        <p className="text-sm font-mono" style={{ color: "var(--color-accent)" }}>
          {message}
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="your@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "submitting"}
          />
          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "…" : (cta || "subscribe")}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="text-xs mt-3 font-mono" style={{ color: "#dc2626" }}>
          {message}
        </p>
      )}

      <p className="text-xs mt-3 font-mono" style={{ color: "var(--color-text-muted)" }}>
        we use your email only for newsletter delivery.
      </p>
    </div>
  );
}
