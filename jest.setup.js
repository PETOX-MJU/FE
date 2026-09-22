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
