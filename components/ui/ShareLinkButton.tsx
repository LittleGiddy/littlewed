'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { buttonClasses } from './AppButton';

interface ShareLinkButtonProps {
  url: string;
  title?: string;
  text?: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Shares a link, preferring the native share sheet on mobile and falling back
 * to the clipboard. The point of the fallback is that `navigator.share` does
 * not exist on desktop, where copy-to-clipboard is the useful behaviour.
 */
export function ShareLinkButton({
  url,
  title,
  text,
  label = 'Share',
  variant = 'secondary',
  size = 'md',
  className,
}: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      // navigator.clipboard needs a secure context; the execCommand path is the
      // fallback for plain http, which happens on local network testing.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement('textarea');
        field.value = url;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        document.body.removeChild(field);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const share = async () => {
    const payload = { title: title ?? label, text, url };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        // AbortError means the user dismissed the sheet - that is not a
        // failure, and re-copying would be a surprising side effect.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copy();
  };

  // Choosing the icon during render would read `navigator` before mount on the
  // server, so pick the neutral icon and let the copied state do the work.
  const Icon = copied ? Check : Share2;

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? 'Link copied' : label}
      className={buttonClasses({ variant, size, className: className })}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
