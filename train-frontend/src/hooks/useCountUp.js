import { useEffect, useRef, useState } from 'react';

/**
 * Counts from 0 to `target` over `duration`ms using ease-out-cubic.
 * Only starts when `start` is true — combine with useInView.
 */
const useCountUp = (target, duration = 1200, start = false) => {
    const [count, setCount] = useState(0);
    const frameRef = useRef(null);

    useEffect(() => {
        if (!start) return;
        const startTime = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
            setCount(Math.floor(eased * target));
            if (progress < 1) frameRef.current = requestAnimationFrame(tick);
            else setCount(target);
        };
        frameRef.current = requestAnimationFrame(tick);
        return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
    }, [target, duration, start]);

    return count;
};

export default useCountUp;
