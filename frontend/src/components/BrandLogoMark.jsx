import React from 'react';
import { Baby } from 'lucide-react';

/** Rounded-square brand glyph: infant baby icon for Infant Cry Guard. */
export default function BrandLogoMark({ compact = false }) {
  return (
    <span className="brand-logo-mark" aria-hidden>
      <Baby
        className="brand-logo-mark-baby"
        size={compact ? 19 : 24}
        strokeWidth={2.35}
      />
    </span>
  );
}
