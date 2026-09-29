import { NativeModules } from 'react-native';

// 네이티브 모듈을 흉내 낸다: 받은 원본 위치에 '#색' 을 붙여 재색칠한 파일인 척 돌려준다.
const renderPet = jest.fn(async (_b: string, _m: string | null, _s: string | null, _f: boolean, src: Record<string, string>) =>
  Object.fromEntries(Object.entries(src).map(([k, v]) => [k, `file:///pet/${k}.png#${v}`])),
);
const extractFurColors = jest.fn(async () => ({ main: 'golden', sub: 'cream' }));

beforeEach(() => {
  jest.resetModules();
  renderPet.mockClear();
  NativeModules.PetoxPetTemplate = { renderPet, extractFurColors };
});

test('앉기·걷기 프레임을 모두 넘기고, 홈 화면이 쓰는 모양 그대로 돌려준다', async () => {
  const { renderPetSprites } = require('../src/features/pet/petTemplate');
  const out = await renderPetSprites('dachshund', { main: 'golden', sub: 'cream' });
  const [breed, main, sub, fit, sources] = renderPet.mock.calls[0];
  expect([breed, main, sub, fit]).toEqual(['dachshund', 'golden', 'cream', true]);
  expect(Object.keys(sources).sort()).toEqual(['home', 'walk_0', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5']);
  expect(out.home).toEqual({ uri: expect.stringContaining('file:///pet/home.png') });
  expect(out.walk.frames).toHaveLength(6);
  expect(out.walk.frames[2]).toEqual({ uri: expect.stringContaining('file:///pet/walk_2.png') });
  expect(out.walk.pxW).toBeGreaterThan(0); // 크기 정보는 원본 그대로
});

test('걷기 그림이 없는 견종(코기)은 앉기만 칠한다', async () => {
  const { renderPetSprites } = require('../src/features/pet/petTemplate');
  const out = await renderPetSprites('corgi', { main: 'black', sub: null });
  expect(Object.keys(renderPet.mock.calls[0][4])).toEqual(['home']);
  expect(out.walk).toBeUndefined();
});

test('사용자가 스와치를 직접 고르면 밝기 순서 맞추기를 끈다', async () => {
  const { renderPetSprites } = require('../src/features/pet/petTemplate');
  await renderPetSprites('husky', { main: 'white', sub: 'gray' }, { userPicked: true });
  expect(renderPet.mock.calls[0][3]).toBe(false);
});

test('네이티브가 실패하거나 없으면 원본 스프라이트를 쓴다', async () => {
  renderPet.mockRejectedValueOnce(new Error('boom'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  let mod = require('../src/features/pet/petTemplate');
  const failed = await mod.renderPetSprites('golden', { main: 'black', sub: null });
  const { homePetImages } = require('../src/assets/images');
  expect(failed.home).toEqual(homePetImages.golden);

  jest.resetModules();
  NativeModules.PetoxPetTemplate = undefined;
  mod = require('../src/features/pet/petTemplate');
  expect((await mod.renderPetSprites('golden', { main: 'black', sub: null })).home).toEqual(homePetImages.golden);
  expect(await mod.extractFurColors('file:///x.jpg')).toEqual({ main: null, sub: null, reason: 'unsupported' });
});
