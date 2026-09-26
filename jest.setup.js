/* eslint-env jest */
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const animated = { View, createAnimatedComponent: component => component };
  return {
    __esModule: true,
    default: animated,
    ...animated,
    Easing: { out: value => value, quad: 'quad', back: () => 'back' },
    useAnimatedStyle: factory => factory(),
    useSharedValue: value => ({ value }),
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values.at(-1),
    withTiming: value => value,
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

// 테스트에서는 로그인하지 않은 상태로 본다(네트워크 호출 없음).
jest.mock('@/api/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

// 네이티브 모델 런타임. 테스트는 __tests__/slm.test.ts 에서 동작을 따로 정한다.
jest.mock('llama.rn', () => ({ initLlama: jest.fn(async () => { throw new Error('jest: 모델 없음'); }) }));
