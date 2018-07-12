export const isProd: boolean = process.env.ENV === 'production';
export const apiBaseUrl: string = isProd
  ? 'http://api.hackerlog.io/v1'
  : 'http://localhost:8000/v1';
