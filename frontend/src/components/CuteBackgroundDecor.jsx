import React from 'react';
import { Baby, Heart, Sparkles } from 'lucide-react';

/** Rounded five-point star, yellow / blue / pink */
function StarSoft({ className, fill }) {
  return (
    <svg className={className} viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13 1.5l2.8 8.4 9 .7-6.8 5.6 2.4 8.8L13 19.8 4.6 24.9l2.4-8.8L.2 10.6l9-.7L13 1.5z"
        fill={fill}
        fillOpacity="0.9"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Baby bottle, soft pastel fill */
function BottleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 4h8v4h-8V4Z"
        fill="#bfdbfe"
        fillOpacity="0.9"
        stroke="rgba(59,130,246,0.35)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M10 10h12l1 22a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3L10 10Z"
        fill="#e0f2fe"
        fillOpacity="0.92"
        stroke="rgba(59,130,246,0.4)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M11 18h10" stroke="rgba(147,197,253,0.85)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 23h10" stroke="rgba(147,197,253,0.55)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** Pacifier, nursery accent */
function PacifierIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="18"
        cy="18"
        r="10"
        fill="#fce7f3"
        fillOpacity="0.88"
        stroke="rgba(244,114,182,0.45)"
        strokeWidth="1.2"
      />
      <ellipse cx="18" cy="18" rx="5" ry="4" fill="#fbcfe8" fillOpacity="0.95" />
      <path
        d="M8 18H4M32 18h-4"
        stroke="#fda4af"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      <circle cx="18" cy="10" r="2.5" fill="#fda4af" fillOpacity="0.5" />
    </svg>
  );
}

/** Tiny filler dot */
function Spark({ className, fill, delay, top, left }) {
  return (
    <span
      className={className}
      style={{
        top,
        left,
        ['--spark-delay']: `${delay}s`,
        background: fill,
      }}
    />
  );
}

const SPARKS = [
  { t: '8%', l: '22%', d: 0, c: '#fbcfe8' },
  { t: '14%', l: '78%', d: 0.4, c: '#fef9c3' },
  { t: '22%', l: '12%', d: 0.8, c: '#bfdbfe' },
  { t: '18%', l: '55%', d: 0.2, c: '#fce7f3' },
  { t: '34%', l: '8%', d: 1.1, c: '#fde68a' },
  { t: '38%', l: '92%', d: 0.6, c: '#fbcfe8' },
  { t: '48%', l: '18%', d: 1.4, c: '#93c5fd' },
  { t: '52%', l: '88%', d: 0.3, c: '#fef9c3' },
  { t: '62%', l: '6%', d: 1.8, c: '#fbcfe8' },
  { t: '58%', l: '72%', d: 0.9, c: '#bfdbfe' },
  { t: '72%', l: '14%', d: 0.5, c: '#fde68a' },
  { t: '68%', l: '48%', d: 1.2, c: '#fce7f3' },
  { t: '82%', l: '28%', d: 1.6, c: '#93c5fd' },
  { t: '78%', l: '82%', d: 0.7, c: '#fbcfe8' },
  { t: '88%', l: '58%', d: 1, c: '#fef9c3' },
  { t: '26%', l: '38%', d: 1.3, c: '#bfdbfe' },
  { t: '44%', l: '62%', d: 0.15, c: '#fce7f3' },
  { t: '92%', l: '12%', d: 1.5, c: '#fbcfe8' },
];

function LucideDecor({ className, icon: Icon, size = 34 }) {
  return (
    <div className={className}>
      <Icon size={size} strokeWidth={1.65} aria-hidden className="nursery-icon-stroke" />
    </div>
  );
}

function AuroraWash() {
  return <div className="cute-bg-aurora" aria-hidden />;
}

export default function CuteBackgroundDecor() {
  return (
    <div className="cute-bg-decor nursery-bg-decor" aria-hidden>
      <AuroraWash />
      <div className="cute-bg-polka cute-bg-polka--pink" />
      <div className="cute-bg-polka cute-bg-polka--blue" />

      {SPARKS.map((s, i) => (
        <Spark key={i} className="nursery-spark" fill={s.c} delay={s.d} top={s.t} left={s.l} />
      ))}

      <LucideDecor className="nursery-icon nursery-icon--baby1" icon={Baby} size={38} />
      <LucideDecor className="nursery-icon nursery-icon--heart nursery-icon--heart-1" icon={Heart} size={32} />
      <LucideDecor className="nursery-icon nursery-icon--heart nursery-icon--heart-2" icon={Heart} size={28} />
      <LucideDecor className="nursery-icon nursery-icon--heart nursery-icon--heart-3" icon={Heart} size={26} />
      <LucideDecor className="nursery-icon nursery-icon--heart nursery-icon--heart-4" icon={Heart} size={30} />
      <LucideDecor className="nursery-icon nursery-icon--heart nursery-icon--heart-5" icon={Heart} size={24} />
      <LucideDecor className="nursery-icon nursery-icon--sparkles" icon={Sparkles} size={30} />
      <LucideDecor className="nursery-icon nursery-icon--baby2" icon={Baby} size={30} />

      <div className="nursery-icon nursery-icon--bottle">
        <BottleIcon className="nursery-icon-custom-svg" />
      </div>
      <div className="nursery-icon nursery-icon--pacifier">
        <PacifierIcon className="nursery-icon-custom-svg" />
      </div>

      <StarSoft className="nursery-star nursery-star--1" fill="#fef08a" />
      <StarSoft className="nursery-star nursery-star--2" fill="#93c5fd" />
      <StarSoft className="nursery-star nursery-star--3" fill="#fbcfe8" />
      <StarSoft className="nursery-star nursery-star--4" fill="#fde047" />
      <StarSoft className="nursery-star nursery-star--5" fill="#7dd3fc" />
      <StarSoft className="nursery-star nursery-star--6" fill="#f9a8d4" />
      <StarSoft className="nursery-star nursery-star--7" fill="#fef08a" />
      <StarSoft className="nursery-star nursery-star--8" fill="#a5b4fc" />
      <StarSoft className="nursery-star nursery-star--9" fill="#fbcfe8" />
      <StarSoft className="nursery-star nursery-star--10" fill="#fde68a" />
      <StarSoft className="nursery-star nursery-star--11" fill="#7dd3fc" />
      <StarSoft className="nursery-star nursery-star--12" fill="#fda4af" />
    </div>
  );
}
