import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

interface Testimonial {
  tempId: number;
  name: string;
  role: string;
  quote: string;
  rating: number;
  imgSrc: string;
}

const TESTIMONIALS_BASE = [
  {
    name: "Aarav R.",
    role: "JEE Aspirant, Kota",
    quote:
      "I got a full set of Cengage Physics and Chemistry books for less than half the MRP. The seller was verified and we met on campus. Super smooth.",
    rating: 5,
    imgSrc: "/assets/testimonials/aarav.webp",
  },
  {
    name: "Sanya P.",
    role: "NEET Student, Delhi",
    quote:
      "Sold my MBBS first-year books in two days. The buyer messaged on WhatsApp, checked the photos, and we arranged pickup directly.",
    rating: 5,
    imgSrc: "/assets/testimonials/sanya.webp",
  },
  {
    name: "Vikram K.",
    role: "GATE Prep, Hyderabad",
    quote:
      "I was skeptical about used book listings, but verified profiles and admin-approved posts made it easy to find a genuine seller nearby.",
    rating: 5,
    imgSrc: "/assets/testimonials/vikram.webp",
  },
];

// Duplicate 3 times to get 9 items total
const testimonials: Testimonial[] = [
  ...TESTIMONIALS_BASE.map((t, i) => ({ ...t, tempId: i })),
  ...TESTIMONIALS_BASE.map((t, i) => ({ ...t, tempId: i + 3 })),
  ...TESTIMONIALS_BASE.map((t, i) => ({ ...t, tempId: i + 6 })),
];

export function StaggerTestimonials() {
  const [current, setCurrent] = useState(0);
  const [cardSize, setCardSize] = useState(365);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Setup responsive card size and container height
  useEffect(() => {
    const updateSizes = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      setCardSize(isMobile ? 290 : 365);
      setContainerHeight(isMobile ? 500 : 600);
    };

    updateSizes();
    window.addEventListener("resize", updateSizes);
    return () => window.removeEventListener("resize", updateSizes);
  }, []);

  // Auto-advance every 4 seconds, pause on hover
  useEffect(() => {
    const startAutoAdvance = () => {
      autoAdvanceRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % testimonials.length);
      }, 4000);
    };

    const clearAutoAdvance = () => {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };

    if (!isHovered) {
      startAutoAdvance();
    } else {
      clearAutoAdvance();
    }

    return clearAutoAdvance;
  }, [isHovered]);

  const handleMove = (direction: 1 | -1) => {
    setCurrent((prev) => (prev + direction + testimonials.length) % testimonials.length);
  };

  const getCardPosition = (index: number) => {
    const distance = (index - current + testimonials.length) % testimonials.length;
    const normalizedDistance = distance > testimonials.length / 2 ? distance - testimonials.length : distance;
    return normalizedDistance;
  };

  const getCardStyle = (index: number) => {
    const position = getCardPosition(index);
    const isCenter = position === 0;
    const offset = Math.abs(position);

    // Stagger effect: cards on the sides move down
    const translateY = offset > 0 ? offset * 30 : 0;
    const scale = isCenter ? 1 : 0.85;
    const opacity = offset > 2 ? 0 : 1 - offset * 0.15;
    const zIndex = Math.max(0, 10 - offset);

    return {
      transform: `translateY(${translateY}px) scale(${scale})`,
      opacity,
      zIndex,
      transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center px-4"
      style={{ height: containerHeight }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cards container */}
      <div className="relative" style={{ perspective: "1000px", width: "100%", maxWidth: "900px" }}>
        {testimonials.map((testimonial, index) => {
          const position = getCardPosition(index);
          const isCenter = position === 0;
          const isVisible = Math.abs(position) <= 2;

          if (!isVisible) return null;

          return (
            <div
              key={testimonial.tempId}
              onClick={() => {
                if (!isCenter) {
                  const distance = (index - current + testimonials.length) % testimonials.length;
                  const shortestPath = distance > testimonials.length / 2 ? distance - testimonials.length : distance;
                  setCurrent((prev) => (prev + shortestPath + testimonials.length) % testimonials.length);
                }
              }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl border p-6 sm:p-8 ${
                isCenter
                  ? "bg-primary text-primary-foreground border-primary shadow-[0px_8px_0px_4px_hsl(var(--border))] cursor-default"
                  : "bg-card text-card-foreground border-border cursor-pointer hover:shadow-elegant"
              } transition-all duration-500`}
              style={{
                width: cardSize,
                ...getCardStyle(index),
              }}
            >
              <p className="text-sm leading-relaxed sm:text-base">{testimonial.quote}</p>

              <div className="mt-6 flex items-center gap-3 sm:mt-8">
                <img
                  src={testimonial.imgSrc}
                  alt={`${testimonial.name} headshot`}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 object-cover object-top sm:h-14 sm:w-12"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{testimonial.name}</p>
                  <p className="truncate text-xs opacity-80">{testimonial.role}</p>
                </div>
              </div>

              {/* Star rating */}
              <div className="mt-3 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < testimonial.rating ? "fill-gold text-gold" : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation buttons */}
      <button
        onClick={() => handleMove(-1)}
        aria-label="Previous testimonial"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden md:grid h-10 w-10 place-items-center rounded-2xl border-2 border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => handleMove(1)}
        aria-label="Next testimonial"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden md:grid h-10 w-10 place-items-center rounded-2xl border-2 border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
