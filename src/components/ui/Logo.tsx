import Image from 'next/image';

const LOGO_SRC = '/assets/logo.png';

interface LogoProps {
  /** Display size in pixels (same for width and height). */
  size?: number;
  alt?: string;
  /** Use unoptimized so the same URL is used everywhere → one request, browser cache. */
  unoptimized?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Shared logo image. Uses unoptimized by default so /assets/logo.png
 * is requested once and cached, avoiding duplicate loads from different sizes.
 */
export function Logo({ size = 24, alt = 'Logo', unoptimized = true, className, style }: LogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      unoptimized={unoptimized}
      className={className}
      style={style}
    />
  );
}
