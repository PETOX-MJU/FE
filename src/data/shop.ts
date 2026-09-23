import type { ImageSourcePropType } from 'react-native';

// 상점 카탈로그.
// TODO: 지금은 화면을 잡기 위한 더미 데이터다. 서버(Supabase)에서 테마/아이템 목록과
// 가격, 보유 여부를 받아오도록 바꿔야 한다.
// TODO: thumbnail 이 없는 항목은 화면에 빈 자리(플레이스홀더)로 그려진다.
// 에셋 PNG가 나오면 src/assets/images/shop/ 에 넣고 require 만 채우면 된다.
//
// 아이템 하나 = 한 덩어리 세트. 썸네일은 세트 전체(src/assets/images/shop/<테마>/),
// 홈 화면에 배치할 때 쓸 조각 PNG 는 같은 폴더의 parts/ 에 따로 둔다.
// TODO: 홈 화면 배치 좌표는 아이템별로 정해지면 여기(또는 별도 표)에 추가한다.
//       배치 참고 그림: design/홈테마_배치_참고.jpg

export type ShopItem = {
  id: string;
  name: string;
  price: number;
  thumbnail?: ImageSourcePropType;
  owned?: boolean;
};

export type ShopTheme = {
  id: string;
  name: string;
  price: number;
  preview?: ImageSourcePropType;
  /** 홈 화면 배경으로 깔릴 그림 */
  background?: ImageSourcePropType;
  owned?: boolean;
  items: ShopItem[];
};

// 기본 테마(초원, src/assets/images/home/bg_meadow.jpg)는 처음부터 적용돼 있어 상점에 넣지 않는다.
export const shopThemes: ShopTheme[] = [
  {
    id: 'home',
    name: '홈',
    price: 12,
    preview: require('../assets/images/shop/home/bg_room.jpg'),
    background: require('../assets/images/shop/home/bg_room.jpg'),
    items: [
      {
        id: 'home-cushion',
        name: '포근포근 방석',
        price: 12,
        thumbnail: require('../assets/images/shop/home/cushion.png'), // 방석 + 러그
      },
      {
        id: 'home-bowl',
        name: '냠냠 놀이 세트',
        price: 12,
        thumbnail: require('../assets/images/shop/home/bowl.png'), // 밥그릇·물그릇 + 장난감 바구니 + 뼈다귀
      },
      {
        id: 'home-plant',
        name: '동글 화분',
        price: 12,
        thumbnail: require('../assets/images/shop/home/plant.png'), // 큰 화분 + 풍경 액자
      },
      {
        id: 'home-shelf',
        name: '초록 선반',
        price: 12,
        thumbnail: require('../assets/images/shop/home/shelf.png'), // 선반 두 개(덩굴·액자 / 책·화분)
      },
    ],
  },
  {
    id: 'beach',
    name: '해변',
    price: 12,
    items: [
      { id: 'beach-parasol', name: '발바닥 파라솔', price: 12 },
      { id: 'beach-ball', name: '비치볼', price: 12 },
      { id: 'beach-tube', name: '튜브', price: 12 },
      { id: 'beach-castle', name: '모래성', price: 12 },
    ],
  },
  {
    id: 'night',
    name: '밤하늘',
    price: 12,
    items: [
      { id: 'night-lamp', name: '달 조명', price: 12 },
      { id: 'night-tent', name: '캠핑 텐트', price: 12 },
      { id: 'night-fire', name: '모닥불', price: 12 },
      { id: 'night-star', name: '별 가랜드', price: 12 },
    ],
  },
  {
    id: 'sky',
    name: '하늘',
    price: 12,
    items: [
      { id: 'sky-cloud', name: '구름 방석', price: 12 },
      { id: 'sky-balloon', name: '풍선', price: 12 },
      { id: 'sky-rainbow', name: '무지개', price: 12 },
      { id: 'sky-kite', name: '연', price: 12 },
    ],
  },
];
