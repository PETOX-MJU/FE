import axios from 'axios';
import { API_BASE_URL } from '@env';
import { supabase } from './supabase';

// FastAPI 백엔드 전용 클라이언트 — /auth/signup, /me, /reports/weekly 등
// ADR-002로 범위가 좁혀진 엔드포인트만 여기로 호출한다 (docs/TRD.md 4.2 참고).
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

apiClient.interceptors.request.use(async config => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
