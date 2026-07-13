"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import AISection from "@/components/AISection";
import GigBoard from "@/components/GigBoard";
import RemitSection from "@/components/RemitSection";
import Faq from "@/components/Faq";
import Pricing from "@/components/Pricing";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import Modal from "@/components/Modal";

export default function Home() {
  const [modal, setModal] = useState<{ open: boolean; type: "login" | "waitlist" | "demo" }>({
    open: false,
    type: "waitlist",
  });

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const type = (e as CustomEvent).detail;
      setModal({ open: true, type });
    };
    window.addEventListener("open-modal", handleOpen);
    return () => window.removeEventListener("open-modal", handleOpen);
  }, []);

  return (
    <main className="bg-[#F5F8FC] min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <AISection />
      <GigBoard />
      <RemitSection />
      <Faq />
      <Pricing />
      <FinalCTA />
      <Footer />

      <Modal
        isOpen={modal.open}
        onClose={() => setModal((prev) => ({ ...prev, open: false }))}
        type={modal.type}
      />
    </main>
  );
}
