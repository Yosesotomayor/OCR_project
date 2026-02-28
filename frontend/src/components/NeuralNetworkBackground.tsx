import React, { useRef, useEffect, useCallback } from 'react'; // Removed useState

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

const NEON_COLOR = '#00e6e6'; // A bright cyan, similar to accent-electric

const INITIAL_POINTS = 80; // Increased from 50
const MAX_POINTS = 150;    // Increased from 100
const CONNECTION_DISTANCE = 130; // Increased from 100
const MOUSE_INFLUENCE_RADIUS = 100; // Decreased from 150
const REPULSION_FORCE_MULTIPLIER = 0.2; // Decreased from 0.5

const NeuralNetworkBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef({ x: 0, y: 0 }); // Changed to useRef
  const pointsRef = useRef<Point[]>([]);
  const animationFrameId = useRef<number | null>(null);

  const createPoint = useCallback((canvas: HTMLCanvasElement): Point => {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 0.5 + 0.1; // Slower movement
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 1.5 + 0.5, // Smaller points
      color: NEON_COLOR,
    };
  }, []);

  const updatePoints = useCallback((canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2d) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Add a new point if there are too few
    if (pointsRef.current.length < INITIAL_POINTS && Math.random() < 0.05) { // Use INITIAL_POINTS
      pointsRef.current.push(createPoint(canvas));
    }

    // Remove old points if there are too many
    if (pointsRef.current.length > MAX_POINTS) { // Use MAX_POINTS
      pointsRef.current.shift();
    }

    pointsRef.current.forEach(point => {
      // Update position
      point.x += point.vx;
      point.y += point.vy;

      // Bounce off walls
      if (point.x < 0 || point.x > canvas.width) point.vx *= -1;
      if (point.y < 0 || point.y > canvas.height) point.vy *= -1;

      // Draw point
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      ctx.fillStyle = point.color;
      ctx.shadowBlur = 5; // Neon glow
      ctx.shadowColor = point.color;
      ctx.fill();

      // Connect to other points
      pointsRef.current.forEach(other => {
        if (point === other) return;
        const dist = Math.hypot(point.x - other.x, point.y - other.y);
        if (dist < CONNECTION_DISTANCE) { // Use CONNECTION_DISTANCE
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(0, 230, 230, ${0.3 - (dist / CONNECTION_DISTANCE) * 0.3})`; // Fading neon lines
          ctx.lineWidth = 0.5;
          ctx.shadowBlur = 3;
          ctx.shadowColor = NEON_COLOR;
          ctx.stroke();
        }
      });

      // React to mouse position
      const distToMouse = Math.hypot(point.x - mousePosRef.current.x, point.y - mousePosRef.current.y); // Use mousePosRef.current
      if (distToMouse < MOUSE_INFLUENCE_RADIUS) { // Use MOUSE_INFLUENCE_RADIUS
        const angleToMouse = Math.atan2(point.y - mousePosRef.current.y, point.x - mousePosRef.current.x); // Use mousePosRef.current
        const repulsionForce = (MOUSE_INFLUENCE_RADIUS - distToMouse) / MOUSE_INFLUENCE_RADIUS * REPULSION_FORCE_MULTIPLIER; // Use constants
        point.vx += Math.cos(angleToMouse) * repulsionForce;
        point.vy += Math.sin(angleToMouse) * repulsionForce;
      }
    });

    animationFrameId.current = requestAnimationFrame(() => updatePoints(canvas, ctx));
  }, [createPoint]); // Removed mousePos from dependency array

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to fill parent
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // Re-initialize points on resize to distribute them correctly
      pointsRef.current = Array.from({ length: INITIAL_POINTS }, () => createPoint(canvas)); // Use INITIAL_POINTS
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize points
    pointsRef.current = Array.from({ length: INITIAL_POINTS }, () => createPoint(canvas)); // Use INITIAL_POINTS

    animationFrameId.current = requestAnimationFrame(() => updatePoints(canvas, ctx));

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [createPoint, updatePoints]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = { // Update mousePosRef.current
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      className="absolute inset-0 w-full h-full z-0" // z-0 to be behind content
      style={{ background: 'transparent' }} // Ensure canvas background is transparent
    />
  );
};

export default NeuralNetworkBackground;
