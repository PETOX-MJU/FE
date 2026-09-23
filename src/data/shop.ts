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
  /**
   * 아이템이 합쳐진 배경을 단계별로 미리 그려 둔 테마(해변).
   * scenes[0] = 아이템 없음, scenes[n] = 앞에서부터 n 개 아이템을 가진 모습.
   * 아이템을 좌표로 얹는 대신 이 그림을 통째로 바꿔 깐다 — 그래서 아이템은 순서대로 산다.
   */
  scenes?: ImageSourcePropType[];
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
    scenes: [
      require('../assets/images/shop/home/bg_room.jpg'),
      require('../assets/images/shop/home/bg_home_1.jpg'), // + 방석
      require('../assets/images/shop/home/bg_home_2.jpg'), // + 화분·액자
      require('../assets/images/shop/home/bg_home_3.jpg'), // + 선반
      require('../assets/images/shop/home/bg_home_4.jpg'), // + 급식·놀이 세트
    ],
    items: [
      {
        id: 'home-cushion',
        name: '포근포근 방석',
        price: 12,
        thumbnail: require('../assets/images/shop/home/cushion.png'), // 방석 + 러그
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
      {
        id: 'home-bowl',
        name: '냠냠 놀이 세트',
        price: 12,
        thumbnail: require('../assets/images/shop/home/bowl.png'), // 밥그릇·물그릇 + 장난감 바구니 + 뼈다귀
      },
    ],
  },
  {
    id: 'beach',
    name: '해변',
    price: 12,
    preview: require('../assets/images/shop/beach/bg_beach_0.jpg'),
    background: require('../assets/images/shop/beach/bg_beach_0.jpg'),
    scenes: [
      require('../assets/images/shop/beach/bg_beach_0.jpg'),
      require('../assets/images/shop/beach/bg_beach_1.jpg'), // + 파라솔
      require('../assets/images/shop/beach/bg_beach_2.jpg'), // + 오리·튜브
      require('../assets/images/shop/beach/bg_beach_3.jpg'), // + 고양이 돛단배
      require('../assets/images/shop/beach/bg_beach_4_night.jpg'), // + 밤바다
    ],
    items: [
      {
        id: 'beach-parasol',
        name: '발바닥 파라솔',
        price: 12,
        thumbnail: require('../assets/images/shop/beach/parasol.png'),
      },
      {
        id: 'beach-float',
        name: '둥실 오리 튜브',
        price: 12,
        thumbnail: require('../assets/images/shop/beach/duck_tube.png'), // 러버덕 + 튜브
      },
      {
        id: 'beach-boat',
        name: '고양이 돛단배',
        price: 12,
        thumbnail: require('../assets/images/shop/beach/boat.png'),
      },
      {
        id: 'beach-night',
        name: '달빛 밤바다',
        price: 12,
        thumbnail: require('../assets/images/shop/beach/night.png'), // 배경이 밤으로 바뀜
      },
    ],
  },
  {
    id: 'polar',
    name: '빙하',
    price: 12,
    preview: require('../assets/images/shop/polar/bg_polar_0.jpg'),
    background: require('../assets/images/shop/polar/bg_polar_0.jpg'),
    scenes: [
      require('../assets/images/shop/polar/bg_polar_0.jpg'),
      require('../assets/images/shop/polar/bg_polar_1.jpg'), // + 물범
      require('../assets/images/shop/polar/bg_polar_2.jpg'), // + 펭귄 바이킹선
      require('../assets/images/shop/polar/bg_polar_3.jpg'), // + 낚시하는 북극곰
      require('../assets/images/shop/polar/bg_polar_4_night.jpg'), // + 밤
    ],
    items: [
      {
        id: 'polar-seal',
        name: '뒹굴 물범',
        price: 12,
        thumbnail: require('../assets/images/shop/polar/seal.png'),
      },
      {
        id: 'polar-viking',
        name: '펭귄 바이킹선',
        price: 12,
        thumbnail: require('../assets/images/shop/polar/viking.png'),
      },
      {
        id: 'polar-bear',
        name: '낚시왕 북극곰',
        price: 12,
        thumbnail: require('../assets/images/shop/polar/bear.png'),
      },
      {
        id: 'polar-night',
        name: '별빛 빙하',
        price: 12,
        // 빙산 + 큰 별 (디자인 원본: Item/2i_5_밤배경.png)
        thumbnail: require('../assets/images/shop/polar/night.png'),
      },
    ],
  },
  {
    id: 'camp',
    name: '캠핑장',
    price: 12,
    preview: require('../assets/images/shop/camp/bg_camp_0.jpg'),
    background: require('../assets/images/shop/camp/bg_camp_0.jpg'),
    scenes: [
      require('../assets/images/shop/camp/bg_camp_0.jpg'),
      require('../assets/images/shop/camp/bg_camp_1.jpg'), // + 텐트
      require('../assets/images/shop/camp/bg_camp_2.jpg'), // + 모닥불
      require('../assets/images/shop/camp/bg_camp_3.jpg'), // + 다람쥐
      require('../assets/images/shop/camp/bg_camp_4_night.jpg'), // + 밤
    ],
    items: [
      {
        id: 'camp-tent',
        name: '아늑한 텐트',
        price: 12,
        thumbnail: require('../assets/images/shop/camp/tent.png'),
      },
      {
        id: 'camp-fire',
        name: '타닥타닥 모닥불',
        price: 12,
        thumbnail: require('../assets/images/shop/camp/fire.png'),
      },
      {
        id: 'camp-squirrel',
        name: '도토리 다람쥐',
        price: 12,
        thumbnail: require('../assets/images/shop/camp/squirrel.png'),
      },
      {
        id: 'camp-night',
        name: '별밤 캠핑',
        price: 12,
        thumbnail: require('../assets/images/shop/camp/night.png'), // 배경이 밤으로 바뀜
      },
    ],
  },
];
