# Supabase 방명록 연결

## 1. 데이터베이스 만들기

1. Supabase Dashboard에서 현재 프로젝트를 엽니다.
2. `SQL Editor`에서 `supabase/schema.sql`의 전체 내용을 실행합니다.
3. `Table Editor`에 `guestbook_entries` 테이블이 생겼는지 확인합니다.

이 SQL은 다음 설정을 한 번에 적용합니다.

- 이름 30자, 메시지 300자 제한
- 누구나 방명록을 읽고 작성할 수 있는 RLS 정책
- 수정과 삭제는 허용하지 않음
- 새 글을 브라우저에 전달하는 Realtime publication

## 2. 프로젝트 키 연결하기

Supabase Dashboard의 `Connect` 또는 `Project Settings > API Keys`에서 아래 값을 확인합니다.

- Project URL
- Publishable key (`sb_publishable_...`)

로컬에서는 `.env.example`을 복사해 `.env.local`을 만들고 실제 값으로 변경합니다.

```env
VITE_SUPABASE_URL=https://프로젝트-ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_실제키
```

`secret` 또는 예전 `service_role` 키는 브라우저 코드에 절대 넣지 않습니다.

## 3. 로컬에서 확인하기

```bash
npm install
npm run dev
```

브라우저 우상단의 `방명록`을 누른 뒤 글을 작성합니다. Supabase의 `Table Editor > guestbook_entries`에도 같은 행이 저장되어야 합니다.

## 4. GitHub Pages 빌드에 값 전달하기

Vite 환경변수는 배포 빌드 시점에 필요합니다. GitHub 저장소의 `Settings > Secrets and variables > Actions > Variables`에 아래 두 Repository variable을 추가합니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

현재 Pages workflow의 `npm run build` 단계에 환경변수를 연결합니다.

```yaml
- name: Build
  run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}
```

로컬에서 `dist`를 직접 올리는 방식이라면 `.env.production.local`에 같은 값을 넣고 `npm run build`를 실행합니다. `.env*` 실제 파일은 커밋하지 않습니다.

## 5. Realtime 확인하기

배포 페이지를 브라우저 두 개에서 열고 한쪽에서 글을 작성합니다. 다른 쪽 화면에도 새 포스트잇이 바로 나타나면 정상입니다.

실시간 반영만 되지 않는다면 Supabase에서 `Database > Publications > supabase_realtime`에 `guestbook_entries`가 포함됐는지 확인합니다. 제공된 SQL을 전체 실행했다면 자동으로 포함됩니다.
