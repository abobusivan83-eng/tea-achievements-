import { useState } from "react";
import { FiCopy, FiExternalLink } from "react-icons/fi";
import { TELEGRAM_BOT_MENTION, TELEGRAM_BOT_TG_APP, TELEGRAM_BOT_URL } from "../../lib/config";
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
    <div
      className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/12 via-black/25 to-black/40 px-3 py-3 text-sm shadow-[0_0_28px_-10px_rgba(251,191,36,0.45)] sm:px-4"
      style={{ willChange: "transform" }}
    >
      <div className="text-[0.9375rem] font-semibold leading-snug text-steam-text/95 sm:text-sm">
        Наш бот: {TELEGRAM_BOT_MENTION}
      </div>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-steam-muted sm:text-sm">
        Сначала напиши боту <span className="font-mono text-steam-text/90">/start</span>, а затем жми{" "}
        <span className="text-steam-text/85">«Продолжить»</span>, чтобы получить код.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="ghost" size="sm" className="min-h-11 justify-center sm:min-h-0" leftIcon={<FiCopy />} onClick={copyMention}>
          {copied ? "Скопировано" : "Скопировать ник"}
        </Button>
        <a
          href={TELEGRAM_BOT_TG_APP}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 text-xs font-medium text-steam-text/90 transition hover:border-amber-400/40 hover:bg-amber-500/10 sm:min-h-0 sm:px-3 sm:py-1.5"
        >
          <FiExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          Открыть в приложении Telegram
        </a>
        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-[11px] text-steam-muted underline decoration-white/20 underline-offset-2 hover:text-steam-text/80"
        >
          Открыть в браузере (t.me)
        </a>
      </div>
    </div>
  );
}
