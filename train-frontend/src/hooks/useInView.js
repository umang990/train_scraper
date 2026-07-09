import { useEffect, useRef, useState } from 'react';

/**
 * Fires once when the ref element enters the viewport.
 * Returns { ref, inView } — attach ref to the element.
 */
const useInView = (options = {}) => {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                observer.disconnect(); // fire once
            }
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px', ...options });

        const el = ref.current;
        if (el) observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { ref, inView };
};

export default useInView;
