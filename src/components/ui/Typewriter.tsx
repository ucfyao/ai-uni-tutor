'use client';

import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from '../MarkdownRenderer';

interface TypewriterProps {
  content: string;
  onComplete?: () => void;
  speed?: number;
}

export const Typewriter: React.FC<TypewriterProps> = ({ 
  content, 
  onComplete, 
  speed = 3 
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    // Reset if content changes completely (fresh start)
    // In a real streaming scenario, we might append, but this logic assumes full content replacement
    if (content.length < displayedContent.length) {
        // Content surprisingly shrank or changed? Reset.
        indexRef.current = 0;
        setDisplayedContent('');
    }

    const intervalId = setInterval(() => {
      // If we've reached the end of the *current* content string
      if (indexRef.current >= content.length) {
        setDisplayedContent(content);
        clearInterval(intervalId);
        if (onComplete) {
            onComplete();
        }
        return;
      }

      indexRef.current += speed;
      // Ensure we don't go out of bounds
      const nextIndex = Math.min(indexRef.current, content.length);
      setDisplayedContent(content.slice(0, nextIndex));
      
    }, 10);

    return () => clearInterval(intervalId);
  }, [content, speed, onComplete, displayedContent.length]);

  return <MarkdownRenderer content={displayedContent} />;
};
