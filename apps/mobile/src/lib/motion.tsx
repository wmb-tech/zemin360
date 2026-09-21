import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { motion } from './theme';

/** Sistem "hareketi azalt" tercihi; açılışta okunur, değişince güncellenir. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/**
 * Bölge girişi: opaklık 0→1, 8→0 px; i×55 ms gecikme; yalnız native driver (transform/opacity).
 * Reduced motion: süre 0, kayma yok. Yalnız mount'ta oynar.
 */
export function Enter({
  i = 0,
  children,
  style,
}: {
  i?: number;
  children: ReactNode;
  style?: object;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: reduced ? 0 : motion.page,
      delay: reduced ? 0 : Math.min(i * motion.stagger, 220),
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [v, i, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 8, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
