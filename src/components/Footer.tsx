"use client";

import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Code2, Link2, Play } from "lucide-react";

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "Features",   href: "/#features"  },
    { label: "Gig Board",  href: "/#gig-board" },
    { label: "Pricing",    href: "/#pricing"   },
    { label: "Changelog",  href: "/changelog"  },
    { label: "Roadmap",    href: "/roadmap"    },
  ],
  Company: [
    { label: "About",      href: "/about"    },
    { label: "Blog",       href: "/blog"     },
    { label: "Careers",    href: "/careers"  },
    { label: "Press",      href: "/press"    },
    { label: "Contact",    href: "/contact"  },
  ],
  Resources: [
    { label: "Documentation",  href: "/docs"           },
    { label: "API Reference",  href: "/api-reference"  },
    { label: "Guides",         href: "/guides"         },
    { label: "Community",      href: "/community"      },
  ],
  Legal: [
    { label: "Privacy Policy",   href: "/privacy" },
    { label: "Terms of Service", href: "/terms"   },
    { label: "Cookie Policy",    href: "/cookies" },
  ],
};

const socials = [
  { icon: ExternalLink, label: "Twitter",  href: "#" },
  { icon: Code2,        label: "GitHub",   href: "#" },
  { icon: Link2,        label: "LinkedIn", href: "#" },
  { icon: Play,         label: "YouTube",  href: "#" },
];

export default function Footer() {
  return (
    <footer className="relative bg-[#F5F8FC] dark:bg-[#0B1120] border-t border-slate-100 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-8">

        {/* ── Top grid ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-14">

          {/* Logo + blurb */}
          <div className="col-span-2 flex flex-col gap-4">
            <Link href="/" className="inline-flex w-fit">
              <Image
                src="/brand-assets/logo.png"
                alt="rive."
                width={90}
                height={40}
                style={{ objectFit: "contain" }}
              />
            </Link>

            <p
              className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-[220px] font-medium"
              style={{ fontFamily: "var(--font-body)" }}
            >
              The all-in-one operating system for freelancers and businesses. Built for the future of work.
            </p>

            {/* Socials */}
            <div className="flex gap-2.5 mt-1">
              {socials.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 transition-all duration-200 shadow-sm hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/40"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category} className="flex flex-col gap-4">
              <h4
                className="text-slate-800 dark:text-white font-bold text-sm"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {category}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-slate-500 dark:text-slate-400 hover:text-blue-600 text-sm transition-colors duration-200 font-medium"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ────────────────────────────── */}
        <div className="border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p
            className="text-slate-400 text-sm font-medium"
            style={{ fontFamily: "var(--font-body)" }}
          >
            © 2026 rive. All rights reserved.
          </p>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span
              className="text-xs text-slate-400 font-medium"
              style={{ fontFamily: "var(--font-body)" }}
            >
              All systems operational
            </span>
          </div>

          <p
            className="text-slate-400 text-sm font-medium"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Built with ♥ for the freelance generation.
          </p>
        </div>
      </div>
    </footer>
  );
}
