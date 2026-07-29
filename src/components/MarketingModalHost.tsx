"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";

type ModalType = "login" | "waitlist" | "demo";

function isModalType(value: unknown): value is ModalType {
  return value === "login" || value === "waitlist" || value === "demo";
}

export default function MarketingModalHost() {
  const [modal, setModal] = useState<{ open: boolean; type: ModalType }>({
    open: false,
    type: "waitlist",
  });

  useEffect(() => {
    function handleOpen(event: Event) {
      const type = (event as CustomEvent<unknown>).detail;
      if (isModalType(type)) setModal({ open: true, type });
    }

    window.addEventListener("open-modal", handleOpen);
    return () => window.removeEventListener("open-modal", handleOpen);
  }, []);

  return (
    <Modal
      isOpen={modal.open}
      onClose={() => setModal((current) => ({ ...current, open: false }))}
      type={modal.type}
    />
  );
}
