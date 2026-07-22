"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

interface DropdownPortalProps {
  children: React.ReactNode;
  triggerRect: DOMRect | null;
  onClose: () => void;
}

export default function DropdownPortal({ children, triggerRect, onClose }: DropdownPortalProps) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    
    const handleScroll = () => onClose();
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      setMounted(false);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!mounted || !triggerRect) return null;

  // Position dropdown below the trigger, aligned to the right edge of the trigger
  const top = triggerRect.bottom + window.scrollY;
  const right = window.innerWidth - triggerRect.right - window.scrollX;

  return createPortal(
    <div 
      ref={menuRef}
      className="absolute z-[9999]" 
      style={{ top: `${top}px`, right: `${right}px` }}
    >
      {children}
    </div>,
    document.body
  );
}
