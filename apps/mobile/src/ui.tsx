import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { c, radius } from './lib/theme';

/** Küçük, tekrar eden parçalar: başlık, yumuşak metin, düğme, rozet, kart. Kit değil; yeter. */
export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}
export function Soft({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.soft, style]}>{children}</Text>;
}
export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Badge({ text, color, bg }: { text: string; color: string; bg?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg ?? color }]}>
      <Text style={[s.badgeText, bg ? { color } : null]}>{text}</Text>
    </View>
  );
}
export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ink' | 'ghost';
  disabled?: boolean;
}) {
  const bg = kind === 'primary' ? c.accent : kind === 'ink' ? c.ink : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        kind === 'ghost' && s.btnGhost,
      ]}
    >
      <Text style={[s.btnText, kind === 'ghost' && { color: c.ink }]}>{title}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: c.ink, letterSpacing: -0.5 },
  soft: { color: c.inkSoft, fontSize: 14, lineHeight: 20 },
  label: {
    color: c.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 16,
    padding: 14,
    backgroundColor: c.paper,
  },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  btn: {
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
