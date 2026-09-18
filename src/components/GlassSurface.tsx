import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '@/theme/colors';

// 유리 뒤에 비칠 배경. 화면(window) 기준 (0,0)에 그려진 배경 이미지와 그 크기.
export type Backdrop = {
  source: ImageSourcePropType;
  width: number;
  height: number;
};

export const BackdropContext = createContext<Backdrop | null>(null);

type Props = {
  radius: number;
  tint?: string;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

// 투명 유리 표면.
// 네이티브 blur 라이브러리 없이, 같은 배경 이미지를 버튼 위치만큼 당겨서 흐리게(blurRadius)
// 깔아 두는 방식이라 "뒤 배경이 비쳐 보이는" 효과가 난다. 그 위에 틴트 + 윗부분 하이라이트
// + 흰 테두리를 얹어 피그마 Glass 효과를 흉내낸다.
export function GlassSurface({
  radius,
  tint = colors.glassTint,
  shadow = false,
  style,
  children,
}: Props) {
  const backdrop = useContext(BackdropContext);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const handleLayout = useCallback(() => {
    ref.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  }, []);

  const round = { borderRadius: radius };

  return (
    <View
      ref={ref}
      onLayout={handleLayout}
      style={[styles.base, round, shadow && styles.shadow, style]}
    >
      <View pointerEvents="none" style={[styles.clip, round]}>
        {backdrop && origin && (
          <Image
            source={backdrop.source}
            blurRadius={6}
            style={[
              styles.backdrop,
              {
                left: -origin.x,
                top: -origin.y,
                width: backdrop.width,
                height: backdrop.height,
              },
            ]}
          />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
        <LinearGradient
          colors={[colors.glassHighlight, 'rgba(255,255,255,0)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View pointerEvents="none" style={[styles.rim, round]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    boxShadow: colors.glassShadow,
  },
  clip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
});
