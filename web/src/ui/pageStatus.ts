/** 배포 화면에서 로딩·빈·에러 문구를 한곳에서 통일 */
export const PAGE_STATUS_COPY = {
  loading: 'ggg가 데이터 가져오고 있어요',
  empty: '아직 표시할 데이터가 없습니다.',
  error: '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  supabaseMissing:
    '앱 설정이 완료되지 않았습니다. 관리자에게 문의하거나 잠시 후 다시 시도해 주세요.',
} as const
