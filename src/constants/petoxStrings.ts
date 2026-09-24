/** 로그인 플로우 문구 — fe_mk_1 의 res/values/strings.xml 에서 옮겨왔습니다. */
export const petoxStrings = {
  /** 로그인 화면 로고 밑 한 줄 — 들어올 때마다 하나씩 바뀐다 */
  loginTaglines: [
    '숏폼 대신, 내 펫과 함께하는 시간',
    '펫이 지켜보는 디지털 디톡스',
    '스크롤은 줄이고, 펫은 키우고',
  ],
  loginKakao: '카카오 로그인',
  loginEmail: '이메일 로그인',

  emailLoginSubtitle: '만나서 반가워요! 펫이 기다리고 있었어요',
  emailLoginEmailHint: '이메일을 입력해 주세요',
  emailLoginPasswordHint: '비밀번호를 입력해 주세요',
  emailLoginSubmit: '로그인 하기',
  emailLoginToSignup: '아직 계정이 없으신가요? 회원가입',
  emailLoginErrorEmail: '올바른 이메일 형식을 입력해 주세요',
  emailLoginErrorPassword: '비밀번호를 입력해 주세요',

  signupSubtitle: '펫과 함께하는 디지털 디톡스, 지금 시작해요',
  signupNicknameHint: '닉네임',
  signupEmailHint: 'example@gmail.com',
  signupPasswordHint: '비밀번호를 입력해 주세요',
  signupSubmit: '통합가입 하기',
  signupErrorNickname: '닉네임을 입력해 주세요',
  signupErrorEmail: '올바른 이메일 형식을 입력해 주세요',
  signupErrorPassword: '비밀번호를 입력해 주세요',
  signupErrorPasswordShort: '비밀번호는 6자 이상이어야 해요',
  signupNeedsConfirm: '가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.',

  loggingIn: '로그인 중…',
  signingUp: '가입 중…',
  authErrorInvalidCredentials: '이메일 또는 비밀번호가 맞지 않아요',
  authErrorUserExists: '이미 가입된 이메일이에요. 로그인해 주세요.',
  authErrorWeakPassword: '비밀번호는 6자 이상이어야 해요',
  authErrorEmailNotConfirmed: '이메일 인증이 아직 안 됐어요. 받은 메일을 확인해 주세요.',
  authErrorRateLimit: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  authErrorNetwork: '네트워크에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.',
  authErrorUnknown: '문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
} as const;
