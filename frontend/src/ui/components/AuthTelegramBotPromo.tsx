import { useState } from "react";
import { FiCopy, FiExternalLink } from "react-icons/fi";
import { TELEGRAM_BOT_MENTION, TELEGRAM_BOT_URL } from "../../lib/config";
import { Button } from "./Button";

export function AuthTelegramBotPromo() {
  const [copied, setCopied] = useState(false);

  async function copyMention() {
    try {
      await navigator.clipboard.writeText(TELEGRAM_BOT_MENTION);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/12 via-black/25 to-black/40 px-4 py-3 text-sm shadow-[0_0_28px_-10px_rgba(251,191,36,0.45)]">
      <div className="font-semibold text-steam-text/95">Наш бот: {TELEGRAM_BOT_MENTION}</div>
      <p className="mt-2 leading-relaxed text-steam-muted">
        Сначала напиши боту <span className="font-mono text-steam-text/90">/start</span>, а затем жми{" "}
        <span className="text-steam-text/85">«Продолжить»</span>, чтобы получить код.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" leftIcon={<FiCopy />} onClick={copyMention}>
          {copied ? "Скопировано" : "Скопировать ник"}
        </Button>
        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-steam-text/90 transition hover:border-amber-400/40 hover:bg-amber-500/10"
        >
          <FiExternalLink className="shrink-0" aria-hidden />
          Открыть в Telegram
        </a>
      </div>
    </div>
  );
}
