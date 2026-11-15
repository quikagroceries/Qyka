"use client";

import React, { ReactNode, useId } from 'react';
import { Reveal } from './motion';
import Eyebrow from './Eyebrow';

export interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  lede?: string;
  bg?: 'canvas' | 'surface' | 'canvas-deep' | 'orange';
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  /** 'center' also centers the lede's own box (mx-auto), not just its text -
   * text-center alone leaves a max-w'd block pinned to the left edge. */
  align?: 'left' | 'center';
}

export function Section({
  id,
  eyebrow,
  title,
  lede,
  bg = 'canvas',
  children,
  className = '',
  narrow = false,
  align = 'left',
}: SectionProps) {
  const centered = align === 'center';
  const generatedId = useId();
  
  const titleId = id ? `${id}-title` : title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || generatedId : undefined;

  const bgClasses = {
    canvas: 'bg-canvas text-ink',
    surface: 'bg-surface text-ink',
    'canvas-deep': 'bg-canvas-deep text-ink',
    orange: 'bg-brand-orange text-[#1A1A1A]',
  };

  const hasHeader = eyebrow || title || lede;

  return (
    <section 
      id={id} 
      className={`scroll-mt-28 px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32 ${bgClasses[bg]} ${className}`} 
      aria-labelledby={titleId}
    >
      <div className={`mx-auto ${narrow ? 'max-w-4xl' : 'max-w-6xl'}`}>
        {hasHeader && (
          <Reveal className={`mb-12 md:mb-16 ${centered ? 'text-center' : ''}`}>
            {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
            {title && (
              <h2
                id={titleId}
                className={`font-display font-extrabold tracking-tight text-balance ${bg === 'orange' ? 'text-[#1A1A1A]' : 'text-ink'} mb-4`}
                style={{ fontSize: 'clamp(1.875rem, 4vw, 3rem)' }}
              >
                {title}
              </h2>
            )}
            {lede && (
              <p className={`max-w-2xl text-pretty ${centered ? 'mx-auto' : ''} ${bg === 'orange' ? 'text-[#1A1A1A]/80' : 'text-muted'} text-lg sm:text-xl`}>
                {lede}
              </p>
            )}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
